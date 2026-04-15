package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"nanonet-backend/internal/ai"
	"nanonet-backend/internal/alerts"
	"nanonet-backend/internal/auth"
	"nanonet-backend/internal/commands"
	"nanonet-backend/internal/k8s"
	"nanonet-backend/internal/logs"
	"nanonet-backend/internal/maintenance"
	"nanonet-backend/internal/metrics"
	"nanonet-backend/internal/security"
	"nanonet-backend/internal/services"
	"nanonet-backend/internal/settings"
	"nanonet-backend/internal/ws"
	"nanonet-backend/pkg/audit"
	"nanonet-backend/pkg/config"
	"nanonet-backend/pkg/database"
	"nanonet-backend/pkg/mailer"
	"nanonet-backend/pkg/middleware"
	"nanonet-backend/pkg/ratelimit"
	"nanonet-backend/pkg/redisstore"
	"nanonet-backend/pkg/shutdown"
	"nanonet-backend/pkg/tokenblacklist"

	"github.com/gin-gonic/gin"
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

	go hub.Run()

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

	// ── Handlers ──────────────────────────────────────────────────
	authHandler := auth.NewHandler(db, cfg.JWTSecret, m, cfg.FrontendURL, bl)
	authMiddleware := auth.NewMiddleware(cfg.JWTSecret, bl)
	authSvc := auth.NewService(db, cfg.JWTSecret)
	serviceHandler := services.NewHandler(db, hub)
	metricsHandler := metrics.NewHandler(db)
	alertHandler := alerts.NewHandler(alertSvc, db)
	maintHandler := maintenance.NewHandler(maintRepo, db)
	wsHandler := ws.NewHandler(hub, cfg.JWTSecret, cfg.FrontendURL, authSvc)
	aiHandler := ai.NewHandler(db, cfg.ClaudeAPIKey)
	cmdHandler := commands.NewHandler(db)
	cmdService := commands.NewService(db)
	settingsHandler := settings.NewHandler(db)
	auditHandler := audit.NewHandler(db)
	logsHandler := logs.NewHandler(logsRepo)
	securityHandler := security.NewHandler(db)

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
		_ = cmdService.UpdateStatus(context.Background(), commandID, status, nil)
	})

	// 30 günlük log retention — her gün gece yarısı çalışır
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				threshold := time.Now().Add(-30 * 24 * time.Hour)
				n, err := logsRepo.DeleteOlderThan(context.Background(), threshold)
				if err != nil {
					logger.Warn("Log retention temizleme hatası", slog.String("error", err.Error()))
				} else if n > 0 {
					logger.Info("Log retention: eski kayıtlar silindi", slog.Int64("count", n))
				}
			}
		}
	}()

	// Askıda kalan komutları periyodik olarak timeout'a al
	go func() {
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
