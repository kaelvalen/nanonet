package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"nanonet-backend/internal/agentmgmt"
	"nanonet-backend/internal/ai"
	"nanonet-backend/internal/alerts"
	"nanonet-backend/internal/apitokens"
	"nanonet-backend/internal/auth"
	"nanonet-backend/internal/commands"
	"nanonet-backend/internal/demo"
	"nanonet-backend/internal/dependencies"
	"nanonet-backend/internal/grants"
	"nanonet-backend/internal/incidents"
	"nanonet-backend/internal/k8s"
	"nanonet-backend/internal/logs"
	"nanonet-backend/internal/maintenance"
	"nanonet-backend/internal/metrics"
	"nanonet-backend/internal/notifications"
	"nanonet-backend/internal/probes"
	"nanonet-backend/internal/runbooks"
	"nanonet-backend/internal/security"
	"nanonet-backend/internal/services"
	"nanonet-backend/internal/settings"
	"nanonet-backend/internal/slo"
	"nanonet-backend/internal/statuspage"
	"nanonet-backend/internal/ws"
	"nanonet-backend/pkg/audit"
	"nanonet-backend/pkg/config"
	"nanonet-backend/pkg/database"
	"nanonet-backend/pkg/mailer"
	"nanonet-backend/pkg/middleware"
	"nanonet-backend/pkg/netguard"
	"nanonet-backend/pkg/ratelimit"
	"nanonet-backend/pkg/redisstore"
	"nanonet-backend/pkg/shutdown"
	"nanonet-backend/pkg/tokenblacklist"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func main() {
	cfg := config.Load()

	// ── Structured Logger ──────────────────────────────────────────
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Veritabanı bağlantısı başarısız: %v", err)
	}

	if err := database.RunMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("Migration başarısız: %v", err)
	}

	// ── Redis (optional) ───────────────────────────────────────────
	var bl tokenblacklist.Blacklist
	var hub *ws.Hub

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if cfg.RedisURL != "" {
		rdb, err := redisstore.New(cfg.RedisURL)
		if err != nil {
			logger.Warn("Redis bağlantısı başarısız — bellek içi mod kullanılıyor", slog.String("error", err.Error()))
			bl = tokenblacklist.NewInMemory()
			hub = ws.NewHub(cfg.WSMaxConnections)
		} else {
			logger.Info("Redis bağlandı", slog.String("url", cfg.RedisURL))
			bl = tokenblacklist.NewRedis(rdb)
			hub = ws.NewHubWithRedis(cfg.WSMaxConnections, rdb)
			go hub.StartRedis(ctx)
		}
	} else {
		bl = tokenblacklist.NewInMemory()
		hub = ws.NewHub(cfg.WSMaxConnections)
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("WS hub panikledi", slog.Any("panic", r))
			}
		}()
		hub.Run()
	}()

	// ── Alert + Maintenance wiring ─────────────────────────────────
	alertSvc := alerts.NewService(db)
	maintRepo := maintenance.NewRepository(db)
	alertSvc.SetMaintenanceChecker(maintRepo)
	logsRepo := logs.NewRepository(db)

	broadcaster := ws.NewMetricsBroadcaster(hub, db, alertSvc, logsRepo, time.Duration(cfg.PollDefaultSec)*time.Second)
	go func() {
		for {
			func() {
				defer func() {
					if r := recover(); r != nil {
						logger.Error("Broadcaster panikledi — 5s içinde yeniden başlıyor", slog.Any("panic", r))
					}
				}()
				broadcaster.Start(ctx)
			}()
			select {
			case <-ctx.Done():
				logger.Info("Broadcaster durduruluyor (context iptal)")
				return
			case <-time.After(5 * time.Second):
				logger.Info("Broadcaster yeniden başlatılıyor...")
			}
		}
	}()

	// ── Mailer ────────────────────────────────────────────────────
	m := mailer.New(mailer.Config{
		Host:     cfg.SMTPHost,
		Port:     cfg.SMTPPort,
		User:     cfg.SMTPUser,
		Password: cfg.SMTPPassword,
		From:     cfg.SMTPFrom,
	})
	if !m.Enabled() {
		logger.Warn("SMTP yapılandırılmamış, şifre sıfırlama emaili gönderilmeyecek")
	} else {
		alertSvc.SetNotifier(m)
		logger.Info("Alert email bildirimleri aktif")
	}

	// ── Notifications (multi-channel: slack/discord/webhook/email/pagerduty)
	notifSvc := notifications.NewService(db, m, netguard.Options{AllowPrivate: cfg.AllowPrivateWebhookURLs})
	alertSvc.SetMultiNotifier(notificationsAdapter{svc: notifSvc})
	logger.Info("Çok-kanallı bildirim servisi aktif")

	// ── Handlers ──────────────────────────────────────────────────
	authHandler := auth.NewHandler(db, cfg.JWTSecret, m, cfg.FrontendURL, bl)
	authMiddleware := auth.NewMiddleware(cfg.JWTSecret, bl, cfg.AllowQueryTokenAuth)
	apiTokensSvc := apitokens.NewService(db)
	apiTokensHandler := apitokens.NewHandler(apiTokensSvc)
	demoSvc := demo.New(db)
	demoHandler := demo.NewHandler(demoSvc)
	authMiddleware.SetAPITokenAuthenticator(apiTokensAdapter{svc: apiTokensSvc})
	authSvc := auth.NewService(db, cfg.JWTSecret)
	serviceHandler := services.NewHandler(db, hub)
	metricsHandler := metrics.NewHandler(db)
	alertHandler := alerts.NewHandler(alertSvc, db)
	maintHandler := maintenance.NewHandler(maintRepo, db)
	wsHandler := ws.NewHandler(hub, cfg.JWTSecret, cfg.FrontendURL, authSvc, cfg.AllowQueryTokenAuth)
	aiHandler := ai.NewHandler(db, cfg.ClaudeAPIKey)
	cmdHandler := commands.NewHandler(db)
	cmdService := commands.NewService(db)
	settingsHandler := settings.NewHandler(db)
	auditHandler := audit.NewHandler(db)
	logsHandler := logs.NewHandler(logsRepo)
	securityHandler := security.NewHandler(db)
	notifHandler := notifications.NewHandler(notifSvc, db)
	sloHandler := slo.NewHandler(slo.NewService(db), db)
	statusHandler := statuspage.NewHandler(statuspage.NewService(db))

	// ── Incidents (auto-grouped from alerts) ─────────────────────
	incidentsSvc := incidents.NewService(db)
	alertSvc.SetIncidentRecorder(incidentsAdapter{svc: incidentsSvc})
	incidentsHandler := incidents.NewHandler(incidentsSvc)
	logger.Info("Incident otomatik gruplama aktif")

	// ── Kubernetes (optional) ─────────────────────────────────────
	var k8sClient *k8s.Client
	if ns := os.Getenv("K8S_NAMESPACE"); ns != "" {
		var err error
		k8sClient, err = k8s.NewClient(ns)
		if err != nil {
			logger.Warn("Kubernetes client oluşturulamadı (devam ediliyor)", slog.String("error", err.Error()))
		} else {
			logger.Info("Kubernetes entegrasyonu aktif", slog.String("namespace", ns))
		}
	} else {
		logger.Info("K8S_NAMESPACE tanımlanmadı — Kubernetes entegrasyonu devre dışı")
	}
	k8sHandler := k8s.NewHandler(k8sClient)

	// ── Router ────────────────────────────────────────────────────
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestContextMiddleware())
	router.Use(middleware.StructuredLoggingMiddleware(logger))
	router.Use(middleware.CORSMiddleware(cfg.FrontendURL, cfg.AllowedOrigins))
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(ratelimit.Middleware(100, time.Minute))

	strictLimiter := ratelimit.StrictMiddleware(10, time.Minute)

	hub.SetOnCommandResult(func(commandID, status string, msg ws.AgentMessage) {
		ctx := context.Background()
		switch status {
		case "success", "failed":
			if err := cmdService.CompleteFromAgent(ctx, commandID, status, msg.Output, msg.Error); err != nil {
				logger.Debug("komut tamamlanamadı", slog.String("command_id", commandID), slog.String("error", err.Error()))
			}
		default:
			_ = cmdService.UpdateStatus(ctx, commandID, status, nil)
		}
	})

	// ── Dependency auto-discovery (agent-reported outbound connections)
	depsHandler := dependencies.NewHandler(db)
	grantsHandler := grants.NewHandler(db)
	agentSvc := agentmgmt.New(db)
	agentHandler := agentmgmt.NewHandler(agentSvc)
	hub.SetOnAgentHeartbeat(func(serviceID, version string, at time.Time) {
		if err := agentSvc.RecordHeartbeat(context.Background(), serviceID, version, at); err != nil {
			logger.Debug("heartbeat persist hatası", slog.String("service_id", serviceID), slog.String("error", err.Error()))
		}
	})
	hub.SetOnDependencies(func(serviceID string, raw []map[string]interface{}) {
		sid, err := uuid.Parse(serviceID)
		if err != nil {
			return
		}
		obs := make([]dependencies.Observation, 0, len(raw))
		for _, r := range raw {
			host, _ := r["target_host"].(string)
			portF, _ := r["target_port"].(float64)
			proto, _ := r["protocol"].(string)
			var pname *string
			if v, ok := r["process_name"].(string); ok && v != "" {
				pname = &v
			}
			obs = append(obs, dependencies.Observation{
				TargetHost:  host,
				TargetPort:  int(portF),
				Protocol:    proto,
				ProcessName: pname,
			})
		}
		ctx2, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := depsHandler.IngestFromAgent(ctx2, sid, obs); err != nil {
			logger.Warn("Dependency ingest failed", slog.String("service_id", serviceID), slog.String("error", err.Error()))
		}
	})

	// ── Synthetic probes (server-side HTTP/TCP checks) ─────────────
	probesSvc := probes.NewService(db, netguard.Options{AllowPrivate: cfg.AllowPrivateProbeTargets})
	probesHandler := probes.NewHandler(probesSvc)
	probesRunner := probes.NewRunner(probesSvc.Repo(), logger)
	// On Up→Down (after 3 fails) or Down→Up, dispatch a notification.
	probesRunner.SetOnTransition(func(ctx context.Context, p probes.Probe, status string) {
		var sev, msg string
		if status == "down" {
			sev = "crit"
			msg = "Probe '" + p.Name + "' down: " + p.Target
			if p.LastError != nil && *p.LastError != "" {
				msg += " (" + *p.LastError + ")"
			}
		} else {
			sev = "info"
			msg = "Probe '" + p.Name + "' recovered: " + p.Target
		}
		_ = notifSvc.Dispatch(ctx, p.UserID, notifications.Event{
			Kind:        "alert",
			Title:       "Probe " + status + ": " + p.Name,
			ServiceName: p.Name,
			AlertType:   "probe_" + status,
			Severity:    sev,
			Message:     msg,
			Timestamp:   time.Now(),
		})
	})
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Probe runner panikledi", slog.Any("panic", r))
			}
		}()
		probesRunner.Start(ctx, 10*time.Second)
	}()
	// Trim probe_runs to a 14-day window every 6h to keep the table bounded.
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Probe prune loop panikledi", slog.Any("panic", r))
			}
		}()
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := probesSvc.Repo().PruneRuns(context.Background(), 14*24*time.Hour); err != nil {
					logger.Warn("Probe run prune hatası", slog.String("error", err.Error()))
				}
			}
		}
	}()
	logger.Info("Synthetic probe runner aktif")

	// ── Runbook automation (alert-triggered actions) ───────────────
	runbooksSvc := runbooks.NewService(db, hub, cmdService, logger)
	runbooksHandler := runbooks.NewHandler(runbooksSvc)
	alertSvc.SetRunbookTrigger(runbooksAdapter{svc: runbooksSvc})
	logger.Info("Runbook engine aktif")

	// Periodic prune of stale, non-promoted dependencies (older than 7 days).
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Dependency prune loop panikledi", slog.Any("panic", r))
			}
		}()
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := depsHandler.Repo().PruneStale(context.Background(), 7*24*time.Hour); err != nil {
					logger.Warn("Dependency prune hatası", slog.String("error", err.Error()))
				}
				if guard := aiHandler.CostGuard(); guard != nil {
					if err := guard.PruneCache(context.Background()); err != nil {
						logger.Warn("AI prompt cache prune hatası", slog.String("error", err.Error()))
					}
				}
			}
		}
	}()

	// Agent heartbeat policy — every 30s, promote services whose agent has not
	// reported recently to "stale" / "down" and emit alerts. Lightweight scan
	// over all services with a known last-heartbeat.
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Agent staleness loop panikledi", slog.Any("panic", r))
			}
		}()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				eval, err := agentSvc.EvaluateStaleness(context.Background(), time.Now())
				if err != nil {
					logger.Warn("Agent stale evaluation hatası", slog.String("error", err.Error()))
					continue
				}
				for _, sid := range eval.NewlyStale {
					if err := alertSvc.CreateManualAlert(context.Background(), sid, "agent_stale", "warning",
						"Agent heartbeat 90 saniyedir alınamadı"); err != nil {
						logger.Debug("agent_stale alert eklenemedi", slog.String("error", err.Error()))
					}
				}
				for _, sid := range eval.NewlyDown {
					if err := alertSvc.CreateManualAlert(context.Background(), sid, "agent_down", "critical",
						"Agent heartbeat 5 dakikadır alınamadı — bağlantı kesilmiş olabilir"); err != nil {
						logger.Debug("agent_down alert eklenemedi", slog.String("error", err.Error()))
					}
				}
			}
		}
	}()

	// Per-user log retention — her gün çalışır. Default 30 gün; her kullanıcının
	// user_settings.log_retention_days değeri varsa onu kullan.
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Log retention loop panikledi", slog.Any("panic", r))
			}
		}()
		runRetention := func() {
			type row struct {
				UserID uuid.UUID `gorm:"column:user_id"`
				Days   *int      `gorm:"column:log_retention_days"`
			}
			var rows []row
			if err := db.Raw(`SELECT user_id, log_retention_days FROM user_settings`).Scan(&rows).Error; err != nil {
				logger.Warn("Log retention: ayar okunamadı", slog.String("error", err.Error()))
				return
			}
			// Build user_id → days map; fall back to 30 for users without settings.
			perUser := make(map[uuid.UUID]int, len(rows))
			for _, r := range rows {
				d := 30
				if r.Days != nil && *r.Days > 0 {
					d = *r.Days
				}
				perUser[r.UserID] = d
			}
			// Tek geçişte servis-bazlı silme: her servis için sahibin retention'ını uygula.
			type svcRow struct {
				ID     uuid.UUID `gorm:"column:id"`
				UserID uuid.UUID `gorm:"column:user_id"`
			}
			var svcs []svcRow
			if err := db.Raw(`SELECT id, user_id FROM services`).Scan(&svcs).Error; err != nil {
				logger.Warn("Log retention: servisler okunamadı", slog.String("error", err.Error()))
				return
			}
			var totalDeleted int64
			for _, s := range svcs {
				days := perUser[s.UserID]
				if days <= 0 {
					days = 30
				}
				cutoff := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
				res := db.Exec(`DELETE FROM service_logs WHERE service_id = ? AND time < ?`, s.ID, cutoff)
				if res.Error != nil {
					logger.Warn("Log retention: servis için silme başarısız",
						slog.String("service_id", s.ID.String()),
						slog.String("error", res.Error.Error()),
					)
					continue
				}
				totalDeleted += res.RowsAffected
			}
			if totalDeleted > 0 {
				logger.Info("Log retention: eski kayıtlar silindi", slog.Int64("count", totalDeleted))
			}
		}
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		// İlk çalışma — startup'tan 5 dk sonra (ısınma ve health check'leri etkilemesin diye).
		startup := time.NewTimer(5 * time.Minute)
		defer startup.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-startup.C:
				runRetention()
			case <-ticker.C:
				runRetention()
			}
		}
	}()

	// Askıda kalan komutları periyodik olarak timeout'a al
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Command timeout loop panikledi", slog.Any("panic", r))
			}
		}()
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				threshold := time.Now().Add(-5 * time.Minute)
				if err := cmdService.MarkStalledCommandsTimeout(context.Background(), threshold); err != nil {
					logger.Warn("Komut timeout temizleme hatası", slog.String("error", err.Error()))
				}
			}
		}
	}()

	v1 := router.Group("/api/v1")
	{
		authGroup := v1.Group("/auth")
		authGroup.Use(ratelimit.Middleware(10, time.Minute))
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
			authGroup.POST("/refresh", authHandler.Refresh)
			authGroup.POST("/forgot-password", authHandler.ForgotPassword)
			authGroup.POST("/reset-password", authHandler.ResetPassword)
			authGroup.POST("/logout", authMiddleware.Required(), authHandler.Logout)
			authGroup.POST("/agent-token", authMiddleware.Required(), authHandler.AgentToken)
			authGroup.GET("/agent-tokens", authMiddleware.Required(), authHandler.ListAgentTokens)
			authGroup.DELETE("/agent-tokens/:token_id", authMiddleware.Required(), authHandler.RevokeAgentToken)
			authGroup.GET("/me", authMiddleware.Required(), authHandler.Me)
			authGroup.PUT("/password", authMiddleware.Required(), authHandler.ChangePassword)
		}

		aiGroup := v1.Group("/ai", authMiddleware.Required())
		{
			aiGroup.POST("/chat", strictLimiter, aiHandler.Chat)
			aiGroup.POST("/report", strictLimiter, aiHandler.GenerateReport)
			aiGroup.GET("/usage", aiHandler.UsageSummary)
			aiGroup.GET("/usage/recent", aiHandler.UsageRecent)
		}

		svcGroup := v1.Group("/services", authMiddleware.Required())
		{
			svcGroup.GET("", serviceHandler.List)
			svcGroup.POST("", serviceHandler.Create)
			svcGroup.GET("/:id", serviceHandler.Get)
			svcGroup.PUT("/:id", serviceHandler.Update)
			svcGroup.DELETE("/:id", serviceHandler.Delete)
			svcGroup.GET("/:id/metrics", metricsHandler.GetHistory)
			svcGroup.GET("/:id/metrics/aggregated", metricsHandler.GetAggregated)
			svcGroup.GET("/:id/metrics/uptime", metricsHandler.GetUptime)
			svcGroup.GET("/:id/metrics/rollup", metricsHandler.GetRollup)
			svcGroup.GET("/:id/metrics/forecast", metricsHandler.GetForecast)
			svcGroup.GET("/:id/dependencies", depsHandler.List)
			svcGroup.PATCH("/:id/dependencies/:dep_id", depsHandler.Promote)
			svcGroup.DELETE("/:id/dependencies/:dep_id", depsHandler.Delete)
			svcGroup.GET("/:id/grants", grantsHandler.List)
			svcGroup.POST("/:id/grants", grantsHandler.Create)
			svcGroup.PATCH("/:id/grants/:grant_id", grantsHandler.Update)
			svcGroup.DELETE("/:id/grants/:grant_id", grantsHandler.Delete)
			svcGroup.GET("/:id/alerts", alertHandler.List)
			svcGroup.GET("/:id/alert-rules", alertHandler.GetAlertRules)
			svcGroup.PUT("/:id/alert-rules", alertHandler.UpsertAlertRules)
			svcGroup.GET("/:id/maintenance", maintHandler.List)
			svcGroup.POST("/:id/maintenance", maintHandler.Create)
			svcGroup.DELETE("/:id/maintenance/:windowId", maintHandler.Delete)
			svcGroup.GET("/:id/insights", aiHandler.GetInsights)
			svcGroup.POST("/:id/restart", strictLimiter, serviceHandler.Restart)
			svcGroup.POST("/:id/stop", strictLimiter, serviceHandler.Stop)
			svcGroup.POST("/:id/start", strictLimiter, serviceHandler.Start)
			svcGroup.POST("/:id/exec", strictLimiter, serviceHandler.Exec)
			svcGroup.POST("/:id/scale", strictLimiter, serviceHandler.Scale)
			svcGroup.POST("/:id/ping", serviceHandler.Ping)
			svcGroup.POST("/:id/analyze", aiHandler.Analyze)
			svcGroup.GET("/:id/commands", cmdHandler.GetHistory)
			svcGroup.GET("/:id/logs", logsHandler.GetServiceLogs)
		}

		alertsGroup := v1.Group("/alerts", authMiddleware.Required())
		{
			alertsGroup.GET("", alertHandler.GetActive)
			alertsGroup.POST("/:alertId/resolve", alertHandler.Resolve)
			alertsGroup.POST("/:alertId/snooze", alertHandler.Snooze)
		}

		settingsGroup := v1.Group("/settings", authMiddleware.Required())
		{
			settingsGroup.GET("", settingsHandler.Get)
			settingsGroup.PUT("", settingsHandler.Update)
		}

		// One-shot demo data seeder. Idempotent at the user level — refuses to
		// run if the user already has services so we never pollute real data.
		v1.POST("/demo/seed", authMiddleware.Required(), strictLimiter, demoHandler.Seed)

		// Agent release info — agents poll this to decide whether to surface an
		// "update available" banner. Authenticated to keep download URLs private.
		agentsGroup := v1.Group("/agents", authMiddleware.Required())
		{
			agentsGroup.GET("/release", agentHandler.LatestRelease)
		}

		// Personal API tokens for programmatic access. Token issuance is JWT-only
		// (no token can mint another); using an API token to hit /api-tokens
		// is intentionally rejected via RequireScope("api_tokens:manage") which
		// no scope grants.
		apiTokensGroup := v1.Group("/api-tokens", authMiddleware.Required())
		{
			apiTokensGroup.GET("", apiTokensHandler.List)
			apiTokensGroup.POST("", apiTokensHandler.Create)
			apiTokensGroup.DELETE("/:id", apiTokensHandler.Revoke)
		}

		// Public, unauthenticated status page endpoint.
		v1.GET("/public/status/:slug", statusHandler.Public)

		incidentsGroup := v1.Group("/incidents", authMiddleware.Required())
		{
			incidentsGroup.GET("", incidentsHandler.List)
			incidentsGroup.GET("/:id", incidentsHandler.Get)
			incidentsGroup.PATCH("/:id", incidentsHandler.Update)
			incidentsGroup.POST("/:id/resolve", incidentsHandler.Resolve)
			incidentsGroup.DELETE("/:id", incidentsHandler.Delete)
		}

		statusGroup := v1.Group("/status-pages", authMiddleware.Required())
		{
			statusGroup.GET("", statusHandler.List)
			statusGroup.POST("", statusHandler.Create)
			statusGroup.PUT("/:id", statusHandler.Update)
			statusGroup.DELETE("/:id", statusHandler.Delete)
		}

		sloGroup := v1.Group("/slos", authMiddleware.Required())
		{
			sloGroup.GET("", sloHandler.List)
			sloGroup.POST("", sloHandler.Create)
			sloGroup.PUT("/:id", sloHandler.Update)
			sloGroup.DELETE("/:id", sloHandler.Delete)
			sloGroup.GET("/:id/compliance", sloHandler.Compliance)
		}

		probesGroup := v1.Group("/probes", authMiddleware.Required())
		{
			probesGroup.GET("", probesHandler.List)
			probesGroup.POST("", probesHandler.Create)
			probesGroup.PUT("/:id", probesHandler.Update)
			probesGroup.DELETE("/:id", probesHandler.Delete)
			probesGroup.GET("/:id/runs", probesHandler.Runs)
		}

		runbooksGroup := v1.Group("/runbooks", authMiddleware.Required())
		{
			runbooksGroup.GET("", runbooksHandler.List)
			runbooksGroup.POST("", runbooksHandler.Create)
			runbooksGroup.PUT("/:id", runbooksHandler.Update)
			runbooksGroup.DELETE("/:id", runbooksHandler.Delete)
			runbooksGroup.GET("/:id/fires", runbooksHandler.Fires)
		}

		notifGroup := v1.Group("/notifications", authMiddleware.Required())
		{
			notifGroup.GET("/channels", notifHandler.List)
			notifGroup.POST("/channels", notifHandler.Create)
			notifGroup.PUT("/channels/:id", notifHandler.Update)
			notifGroup.DELETE("/channels/:id", notifHandler.Delete)
			notifGroup.POST("/channels/:id/test", strictLimiter, notifHandler.Test)
			notifGroup.GET("/channels/:id/deliveries", notifHandler.Deliveries)
		}

		auditGroup := v1.Group("/audit", authMiddleware.Required())
		{
			auditGroup.GET("", auditHandler.GetLogs)
		}

		securityGroup := v1.Group("/security", authMiddleware.Required())
		{
			securityGroup.GET("/overview", securityHandler.GetOverview)
		}

		svcGroup.GET("/:id/security/scans", securityHandler.GetServiceScans)
		svcGroup.POST("/:id/security/scan", strictLimiter, securityHandler.TriggerScan)

		logsGroup := v1.Group("/logs", authMiddleware.Required())
		{
			logsGroup.GET("", logsHandler.SearchAll)
			logsGroup.GET("/stats", logsHandler.GetStats)
		}

		// Tek istekle tüm servislerin uptime özetini döndürür (N+1 önleme)
		v1.GET("/services/uptime/summary", authMiddleware.Required(), metricsHandler.GetBulkUptime)

		// Servis haritası persist (node/edge layout)
		v1.GET("/services/map", authMiddleware.Required(), serviceHandler.GetMap)
		v1.PUT("/services/map", authMiddleware.Required(), serviceHandler.SaveMap)

		// Global metrik özeti — tüm servislerin ort. latency, p95, error rate, CPU
		v1.GET("/metrics/summary", authMiddleware.Required(), metricsHandler.GetGlobalSummary)

		// Tüm servislerin AI insight'ları
		v1.GET("/insights", authMiddleware.Required(), aiHandler.GetAllInsights)

		k8sGroup := v1.Group("/k8s", authMiddleware.Required())
		{
			k8sGroup.GET("/status", k8sHandler.GetStatus)
			k8sGroup.GET("/namespaces", k8sHandler.ListNamespaces)
			k8sGroup.GET("/nodes", k8sHandler.GetNodes)
			k8sGroup.GET("/pods", k8sHandler.GetPods)
			k8sGroup.GET("/pods/all", k8sHandler.GetAllPods)
			k8sGroup.GET("/pods/:name/logs", k8sHandler.GetPodLogs)
			k8sGroup.DELETE("/pods/:name", strictLimiter, k8sHandler.DeletePod)
			k8sGroup.GET("/deployments", k8sHandler.ListDeployments)
			k8sGroup.GET("/deployments/:name", k8sHandler.GetDeployment)
			k8sGroup.POST("/deployments/:name/scale", strictLimiter, k8sHandler.ScaleDeployment)
			k8sGroup.POST("/deployments/:name/restart", strictLimiter, k8sHandler.RolloutRestart)
			k8sGroup.GET("/hpa", k8sHandler.ListHPAs)
			k8sGroup.GET("/hpa/:name", k8sHandler.GetHPA)
			k8sGroup.POST("/hpa", strictLimiter, k8sHandler.CreateOrUpdateHPA)
			k8sGroup.DELETE("/hpa/:name", strictLimiter, k8sHandler.DeleteHPA)
			k8sGroup.GET("/services", k8sHandler.ListServices)
			k8sGroup.GET("/endpoints/:name", k8sHandler.GetServiceEndpoints)
			k8sGroup.GET("/events", k8sHandler.GetEvents)
			k8sGroup.GET("/top/pods", k8sHandler.GetTopPods)
			k8sGroup.GET("/top/nodes", k8sHandler.GetTopNodes)
			k8sGroup.POST("/deploy", strictLimiter, k8sHandler.DeployService)
			k8sGroup.DELETE("/deploy/:name", strictLimiter, k8sHandler.UndeployService)
		}
	}

	router.POST("/api/v1/metrics", authMiddleware.Required(), metricsHandler.InsertMetric)

	wsGroup := router.Group("/ws")
	{
		wsGroup.GET("/dashboard", wsHandler.Dashboard)
		wsGroup.GET("/services/:id", wsHandler.ServiceStream)
		wsGroup.GET("/agent", wsHandler.AgentConnect)
	}

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":               "ok",
			"connected_agents":     hub.GetConnectedAgentCount(),
			"connected_dashboards": hub.GetConnectedDashboardCount(),
		})
	})

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		logger.Info("Server başlatılıyor", slog.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server başlatılamadı: %v", err)
		}
	}()

	sm := shutdown.NewManager(30 * time.Second)
	sm.Register(func(ctx context.Context) error {
		cancel()
		return nil
	})
	sm.Shutdown(srv)
	logger.Info("Server kapatıldı")
}

// notificationsAdapter bridges alerts.MultiNotifierEvent ↔ notifications.Event
// so the alerts package doesn't need to import notifications directly.
type notificationsAdapter struct{ svc *notifications.Service }

func (a notificationsAdapter) Dispatch(ctx context.Context, userID uuid.UUID, ev alerts.MultiNotifierEvent) int {
	return a.svc.Dispatch(ctx, userID, notifications.Event{
		Kind:        ev.Kind,
		Title:       ev.Title,
		Message:     ev.Message,
		Severity:    ev.Severity,
		ServiceID:   ev.ServiceID,
		ServiceName: ev.ServiceName,
		AlertID:     ev.AlertID,
		AlertType:   ev.AlertType,
		Timestamp:   ev.Timestamp,
	})
}

// incidentsAdapter bridges alerts.IncidentRecorderInput ↔ incidents.AlertInput.
type incidentsAdapter struct{ svc *incidents.Service }

func (a incidentsAdapter) RecordAlert(ctx context.Context, in alerts.IncidentRecorderInput) error {
	_, err := a.svc.RecordAlert(ctx, incidents.AlertInput{
		UserID:      in.UserID,
		ServiceID:   in.ServiceID,
		AlertID:     in.AlertID,
		Type:        in.Type,
		Severity:    in.Severity,
		Message:     in.Message,
		TriggeredAt: in.TriggeredAt,
		ServiceName: in.ServiceName,
	})
	return err
}

func (a incidentsAdapter) MaybeResolveByAlert(ctx context.Context, alertID uuid.UUID) error {
	return a.svc.MaybeResolveByAlert(ctx, alertID)
}

// runbooksAdapter bridges alerts.RunbookTriggerInput ↔ runbooks.AlertInput.
type runbooksAdapter struct{ svc *runbooks.Service }

func (a runbooksAdapter) OnAlert(ctx context.Context, in alerts.RunbookTriggerInput) {
	a.svc.OnAlert(ctx, runbooks.AlertInput{
		UserID:    in.UserID,
		ServiceID: in.ServiceID,
		AlertID:   in.AlertID,
		AlertType: in.AlertType,
		Severity:  in.Severity,
		Message:   in.Message,
	})
}

// apiTokensAdapter wires apitokens.Service into the auth middleware without
// causing an import cycle (auth → apitokens would create one).
type apiTokensAdapter struct{ svc *apitokens.Service }

func (a apiTokensAdapter) Authenticate(ctx context.Context, secret string) (uuid.UUID, []string, bool) {
	t, err := a.svc.Authenticate(ctx, secret)
	if err != nil || t == nil {
		return uuid.Nil, nil, false
	}
	return t.UserID, []string(t.Scopes), true
}
