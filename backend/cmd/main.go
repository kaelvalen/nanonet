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
	"nanonet-backend/internal/metrics"
	"nanonet-backend/internal/services"
	"nanonet-backend/internal/ws"
	"nanonet-backend/pkg/config"
	"nanonet-backend/pkg/database"

	"github.com/gin-gonic/gin"
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

	router := gin.Default()
	router.Use(corsMiddleware(cfg.FrontendURL))

	generalLimiter := auth.NewRateLimiter(100, time.Minute)
	authLimiter := auth.NewRateLimiter(10, time.Minute)
	router.Use(auth.RateLimitMiddleware(generalLimiter))

	hub := ws.NewHub()
	go hub.Run()

	broadcaster := ws.NewMetricsBroadcaster(hub, db, time.Duration(cfg.PollDefaultSec)*time.Second)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go broadcaster.Start(ctx)

	authHandler := auth.NewHandler(db, cfg.JWTSecret)
	authMiddleware := auth.NewMiddleware(cfg.JWTSecret)
	serviceHandler := services.NewHandler(db, hub)
	metricsHandler := metrics.NewHandler(db)
	alertHandler := alerts.NewHandler(db)
	wsHandler := ws.NewHandler(hub)
	aiHandler := ai.NewHandler(db, cfg.ClaudeAPIKey)
	cmdHandler := commands.NewHandler(db)
	cmdService := commands.NewService(db)

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
			authGroup.POST("/logout", authMiddleware.Required(), authHandler.Logout)
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
			svcGroup.POST("/:id/restart", serviceHandler.Restart)
			svcGroup.POST("/:id/stop", serviceHandler.Stop)
			svcGroup.POST("/:id/ping", serviceHandler.Ping)
			svcGroup.POST("/:id/analyze", aiHandler.Analyze)
			svcGroup.GET("/:id/commands", cmdHandler.GetHistory)
		}

		alertsGroup := v1.Group("/alerts", authMiddleware.Required())
		{
			alertsGroup.GET("", alertHandler.GetActive)
			alertsGroup.POST("/:alertId/resolve", alertHandler.Resolve)
		}
	}

	router.POST("/api/v1/metrics", metricsHandler.InsertMetric)

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
