package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"nanonet-backend/internal/ai"
	"nanonet-backend/internal/alerts"
	"nanonet-backend/internal/auth"
	"nanonet-backend/internal/commands"
	"nanonet-backend/internal/k8s"
	"nanonet-backend/internal/metrics"
	"nanonet-backend/internal/services"
	"nanonet-backend/internal/settings"
	"nanonet-backend/internal/ws"
	"nanonet-backend/pkg/audit"
	"nanonet-backend/pkg/config"
	"nanonet-backend/pkg/database"
	"nanonet-backend/pkg/mailer"
	"nanonet-backend/pkg/ratelimit"
	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(corsMiddleware(cfg.FrontendURL))
	router.Use(securityHeadersMiddleware())

	generalLimiter := auth.NewRateLimiter(100, time.Minute)
	authLimiter := auth.NewRateLimiter(10, time.Minute)
	router.Use(auth.RateLimitMiddleware(generalLimiter))

	hub := ws.NewHub(cfg.WSMaxConnections)
	go hub.Run()

	broadcaster := ws.NewMetricsBroadcaster(hub, db, time.Duration(cfg.PollDefaultSec)*time.Second)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go broadcaster.Start(ctx)

	m := mailer.New(mailer.Config{
		Host:     cfg.SMTPHost,
		Port:     cfg.SMTPPort,
		User:     cfg.SMTPUser,
		Password: cfg.SMTPPassword,
		From:     cfg.SMTPFrom,
	})
	if !m.Enabled() {
		log.Println("Warning: SMTP yapılandırılmamış, şifre sıfırlama emaili gönderilmeyecek")
	}

	authHandler := auth.NewHandler(db, cfg.JWTSecret, m, cfg.FrontendURL)
	authMiddleware := auth.NewMiddleware(cfg.JWTSecret)
	serviceHandler := services.NewHandler(db, hub)
	metricsHandler := metrics.NewHandler(db)
	alertHandler := alerts.NewHandler(db)
	wsHandler := ws.NewHandler(hub, cfg.JWTSecret)
	aiHandler := ai.NewHandler(db, cfg.ClaudeAPIKey)
	cmdHandler := commands.NewHandler(db)
	cmdService := commands.NewService(db)
	settingsHandler := settings.NewHandler(db)

	// Kubernetes entegrasyonu (önemsiz — yoksa devre dışı kalır)
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

	// Kritik endpoint'ler için sıkı rate limiter (dakikada 10 istek)
	strictLimiter := ratelimit.StrictMiddleware(10, time.Minute)

	hub.SetOnCommandResult(func(commandID, status string, msg ws.AgentMessage) {
		cmdService.UpdateStatus(context.Background(), commandID, status, nil)
	})

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
			svcGroup.GET("/:id/alerts", alertHandler.List)
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
			auditGroup.GET("", handleAuditLogs(db))
		}

		// Kubernetes API route'ları
		k8sGroup := v1.Group("/k8s", authMiddleware.Required())
		{
			k8sGroup.GET("/status", k8sHandler.GetStatus)
			k8sGroup.GET("/namespaces", k8sHandler.ListNamespaces)
			k8sGroup.GET("/pods", k8sHandler.GetPods)
			k8sGroup.GET("/deployments/:name", k8sHandler.GetDeployment)
			k8sGroup.POST("/deployments/:name/scale", strictLimiter, k8sHandler.ScaleDeployment)
			k8sGroup.GET("/hpa/:name", k8sHandler.GetHPA)
			k8sGroup.POST("/hpa", strictLimiter, k8sHandler.CreateOrUpdateHPA)
			k8sGroup.DELETE("/hpa/:name", strictLimiter, k8sHandler.DeleteHPA)
			k8sGroup.GET("/endpoints/:name", k8sHandler.GetServiceEndpoints)
		}
	}

	router.POST("/api/v1/metrics", authMiddleware.Required(), metricsHandler.InsertMetric)

	wsGroup := router.Group("/ws")
	{
		wsGroup.GET("/dashboard", authMiddleware.Required(), wsHandler.Dashboard)
		wsGroup.GET("/services/:id", authMiddleware.Required(), wsHandler.ServiceStream)
		wsGroup.GET("/agent", authMiddleware.Required(), wsHandler.AgentConnect)
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

func handleAuditLogs(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			response.Unauthorized(c, "geçersiz kullanıcı")
			return
		}

		limit := 50
		offset := 0
		if l := c.Query("limit"); l != "" {
			if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 200 {
				limit = v
			}
		}
		if o := c.Query("offset"); o != "" {
			if v, err := strconv.Atoi(o); err == nil && v >= 0 {
				offset = v
			}
		}

		var logs []audit.Log
		var total int64

		q := db.WithContext(c.Request.Context()).
			Where("user_id = ?", userID).
			Order("created_at DESC")

		q.Model(&audit.Log{}).Count(&total)
		if err := q.Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
			response.InternalError(c, "audit loglar alınamadı")
			return
		}

		response.Success(c, gin.H{
			"logs":   logs,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		})
	}
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

func corsMiddleware(frontendURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowedOrigins := map[string]bool{
			frontendURL:             true,
			"http://localhost:3000": true,
			"http://localhost:5173": true,
			"http://localhost:4173": true,
		}

		if allowedOrigins[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else if frontendURL != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length, X-Request-Id")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
