package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL       string
	JWTSecret         string
	ClaudeAPIKey      string
	Port              string
	FrontendURL       string
	PollDefaultSec    int
	WSMaxConnections  int
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env dosyası bulunamadı, ortam değişkenleri kullanılıyor")
	}

	cfg := &Config{
		DatabaseURL:      getEnv("DATABASE_URL", ""),
		JWTSecret:        getEnv("JWT_SECRET", ""),
		ClaudeAPIKey:     getEnv("CLAUDE_API_KEY", ""),
		Port:             getEnv("PORT", "8080"),
		FrontendURL:      getEnv("FRONTEND_URL", "http://localhost:3000"),
		PollDefaultSec:   getEnvInt("POLL_DEFAULT_SEC", 10),
		WSMaxConnections: getEnvInt("WS_MAX_CONNECTIONS", 1000),
	}

	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL zorunlu")
	}
	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET zorunlu")
	}
	if len(cfg.JWTSecret) < 32 {
		log.Fatal("JWT_SECRET en az 32 karakter olmalı")
	}
	if cfg.ClaudeAPIKey == "" {
		log.Fatal("CLAUDE_API_KEY zorunlu")
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}
