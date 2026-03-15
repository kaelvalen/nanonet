package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"nanonet-backend/internal/ai"
	"nanonet-backend/internal/alerts"
	"nanonet-backend/internal/auth"
	"nanonet-backend/internal/commands"
	"nanonet-backend/internal/k8s"
	"nanonet-backend/internal/maintenance"
	"nanonet-backend/internal/metrics"
	"nanonet-backend/internal/services"
	"nanonet-backend/internal/settings"
	"nanonet-backend/internal/ws"
	"nanonet-backend/pkg/audit"
	"nanonet-backend/pkg/config"
	"nanonet-backend/pkg/database"
	"nanonet-backend/pkg/mailer"
	"nanonet-backend/pkg/ratelimit"
	"nanonet-backend/pkg/redisstore"
	"nanonet-backend/pkg/tokenblacklist"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Veritabanı bağlantısı başarısız: %v", err)
	}

	if err := database.RunMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("Migration başarısız: %v", err)
	}

	// Uygulama kapandığında DB bağlantı havuzunu temizle
	defer func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	}()

	// ── Redis (optional) ───────────────────────────────────────────
	var bl tokenblacklist.Blacklist
	var hub *ws.Hub

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if cfg.RedisURL != "" {
		rdb, err := redisstore.New(cfg.RedisURL)
		if err != nil {
			log.Printf("[WARN] Redis bağlantısı başarısız (%v) — bellek içi mod kullanılıyor", err)
			bl = tokenblacklist.NewInMemory()
			hub = ws.NewHub(cfg.WSMaxConnections)
		} else {
			log.Printf("Redis bağlandı: %s", cfg.RedisURL)
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

	broadcaster := ws.NewMetricsBroadcaster(hub, db, alertSvc, time.Duration(cfg.PollDefaultSec)*time.Second)
	go func() {
		for {
			func() {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("[PANIC] Broadcaster panikledi: %v — 5s içinde yeniden başlıyor", r)
					}
				}()
				broadcaster.Start(ctx)
			}()
			// Context iptal edildiyse döngüden çık
			select {
			case <-ctx.Done():
				log.Println("[INFO] Broadcaster durduruluyor (context iptal)")
				return
			case <-time.After(5 * time.Second):
				log.Println("[INFO] Broadcaster yeniden başlatılıyor...")
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
		log.Println("Warning: SMTP yapılandırılmamış, şifre sıfırlama emaili gönderilmeyecek")
	} else {
		alertSvc.SetNotifier(m)
		log.Println("Alert email bildirimleri aktif")
	}

	// ── Handlers ──────────────────────────────────────────────────
	authHandler := auth.NewHandler(db, cfg.JWTSecret, m, cfg.FrontendURL, bl)
	authMiddleware := auth.NewMiddleware(cfg.JWTSecret, bl)
	serviceHandler := services.NewHandler(db, hub)
	metricsHandler := metrics.NewHandler(db)
	alertHandler := alerts.NewHandler(alertSvc)
	maintHandler := maintenance.NewHandler(maintRepo)
	wsHandler := ws.NewHandler(hub, cfg.JWTSecret, cfg.FrontendURL)
	aiHandler := ai.NewHandler(db, cfg.ClaudeAPIKey)
	cmdHandler := commands.NewHandler(db)
	cmdService := commands.NewService(db)
	settingsHandler := settings.NewHandler(db)
	auditHandler := audit.NewHandler(db)

	// ── Kubernetes (optional) ─────────────────────────────────────
	var k8sClient *k8s.Client
	if ns := os.Getenv("K8S_NAMESPACE"); ns != "" {
		var err error
		k8sClient, err = k8s.NewClient(ns)
		if err != nil {
			log.Printf("[WARN] Kubernetes client oluşturulamadı (devam ediliyor): %v", err)
		} else {
			log.Printf("Kubernetes entegrasyonu aktif (namespace: %s)", ns)
		}
	} else {
		log.Println("K8S_NAMESPACE tanımlanmadı — Kubernetes entegrasyonu devre dışı")
	}
	k8sHandler := k8s.NewHandler(k8sClient)

	// ── Router ────────────────────────────────────────────────────
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(requestIDMiddleware())
	router.Use(corsMiddleware(cfg.FrontendURL, cfg.AllowedOrigins))
	router.Use(securityHeadersMiddleware())

	generalLimiter := auth.NewRateLimiter(100, time.Minute)
	authLimiter := auth.NewRateLimiter(10, time.Minute)
	router.Use(auth.RateLimitMiddleware(generalLimiter))

	strictLimiter := ratelimit.StrictMiddleware(10, time.Minute)

	hub.SetOnCommandResult(func(commandID, status string, msg ws.AgentMessage) {
		cmdService.UpdateStatus(context.Background(), commandID, status, nil)
	})

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
					log.Printf("[WARN] Komut timeout temizleme hatası: %v", err)
				}
			}
		}
	}()

	v1 := router.Group("/api/v1")
	{
		authGroup := v1.Group("/auth")
		authGroup.Use(auth.AuthRateLimitMiddleware(authLimiter))
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
			authGroup.POST("/refresh", authHandler.Refresh)
			authGroup.POST("/forgot-password", authHandler.ForgotPassword)
			authGroup.POST("/reset-password", authHandler.ResetPassword)
			authGroup.POST("/logout", authMiddleware.Required(), authHandler.Logout)
			authGroup.POST("/agent-token", authMiddleware.Required(), authHandler.AgentToken)
			authGroup.GET("/me", authMiddleware.Required(), authHandler.Me)
			authGroup.PUT("/password", authMiddleware.Required(), authHandler.ChangePassword)
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
		}

		alertsGroup := v1.Group("/alerts", authMiddleware.Required())
		{
			alertsGroup.GET("", alertHandler.GetActive)
			alertsGroup.POST("/:alertId/resolve", alertHandler.Resolve)
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

		// Tek istekle tüm servislerin uptime özetini döndürür (N+1 önleme)
		v1.GET("/services/uptime/summary", authMiddleware.Required(), metricsHandler.GetBulkUptime)

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
		log.Printf("Server %s portunda başlatılıyor...", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server başlatılamadı: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Server kapatılıyor...")
	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server kapatma hatası: %v", err)
	}

	log.Println("Server kapatıldı")
}


func securityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Next()
	}
}

func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-Id")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Header("X-Request-Id", requestID)
		c.Set("request_id", requestID)
		c.Next()
	}
}

func corsMiddleware(frontendURL string, extraOrigins []string) gin.HandlerFunc {
	allowedOrigins := map[string]bool{}
	if frontendURL != "" {
		allowedOrigins[frontendURL] = true
	}
	for _, origin := range extraOrigins {
		allowedOrigins[origin] = true
	}
	// Geliştirme ortamında ek origin belirtilmemişse localhost'lara varsayılan olarak izin ver
	if len(extraOrigins) == 0 && gin.Mode() != gin.ReleaseMode {
		allowedOrigins["http://localhost:3000"] = true
		allowedOrigins["http://localhost:5173"] = true
		allowedOrigins["http://localhost:4173"] = true
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if allowedOrigins[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else if frontendURL != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-Id")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length, X-Request-Id")

		if c.Request.Method == "OPTIONS" {
			if allowedOrigins[origin] {
				c.AbortWithStatus(204)
			} else {
				c.AbortWithStatus(403)
			}
			return
		}

		c.Next()
	}
}
