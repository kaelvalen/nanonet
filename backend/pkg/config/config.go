package config

import (
	"log"
	"os"
	"runtime"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL      string
	JWTSecret        string
	ClaudeAPIKey     string
	Port             string
	FrontendURL      string
	RedisURL         string
	PollDefaultSec   int
	WSMaxConnections int

	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string

	AllowedOrigins []string
	Environment    string // "development", "staging", "production"

	// Security toggles (safe defaults vary by environment).
	AllowQueryTokenAuth       bool // allow `?token=` for auth (avoid: leakage)
	AllowPrivateProbeTargets  bool // allow probes to hit private/reserved IPs
	AllowLoopbackProbeTargets bool // allow probes to hit loopback/localhost (dev only)
	AllowPrivateWebhookURLs   bool // allow webhooks/slack/discord to private/reserved IPs

	// SecureCookies — `Set-Cookie ... Secure` bayrağını kontrol eder.
	// Production'da daima true (HTTPS arkasında zorunlu), dev'de false
	// (lokal http üstünde browser cookie'yi kabul etsin diye). Override
	// için SECURE_COOKIES env'i mevcut.
	SecureCookies bool

	// MetricsBasicAuth — "user:pass" formatında. Boşsa /metrics endpoint
	// servis edilmez. Boşken prod'da uyarı verilir.
	MetricsBasicAuth string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env dosyası bulunamadı, ortam değişkenleri kullanılıyor")
	}

	environment := getEnv("ENVIRONMENT", "development")
	if environment == "" {
		if os.Getenv("GIN_MODE") == "release" {
			environment = "production"
		} else {
			environment = "development"
		}
	}

	cfg := &Config{
		DatabaseURL:      getEnv("DATABASE_URL", ""),
		JWTSecret:        getEnv("JWT_SECRET", ""),
		ClaudeAPIKey:     getEnv("CLAUDE_API_KEY", ""),
		Port:             getEnv("PORT", "8080"),
		FrontendURL:      getEnv("FRONTEND_URL", "http://localhost:3000"),
		RedisURL:         getEnv("REDIS_URL", ""),
		PollDefaultSec:   getEnvInt("POLL_DEFAULT_SEC", 10),
		WSMaxConnections: getEnvInt("WS_MAX_CONNECTIONS", 1000),

		SMTPHost:       getEnv("SMTP_HOST", ""),
		SMTPPort:       getEnv("SMTP_PORT", "587"),
		SMTPUser:       getEnv("SMTP_USER", ""),
		SMTPPassword:   getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:       getEnv("SMTP_FROM", ""),
		AllowedOrigins: parseAllowedOrigins(),
		Environment:    environment,
	}

	// Security toggles:
	// - In production: prefer secure defaults.
	// - In non-production: keep compatibility unless explicitly disabled.
	isProd := cfg.Environment == "production"
	_ = isProd // kept for future environment-specific validations

	// NOTE: These are explicit opt-ins. Safe-by-default even in dev/staging,
	// because query-string tokens and private egress are high-risk if a non-prod
	// environment is accidentally exposed.
	cfg.AllowQueryTokenAuth = getEnvBool("ALLOW_QUERY_TOKEN_AUTH", false)
	cfg.AllowPrivateProbeTargets = getEnvBool("ALLOW_PRIVATE_PROBE_TARGETS", false)
	cfg.AllowLoopbackProbeTargets = getEnvBool("ALLOW_LOOPBACK_PROBE_TARGETS", false)
	cfg.AllowPrivateWebhookURLs = getEnvBool("ALLOW_PRIVATE_WEBHOOK_URLS", false)

	// SecureCookies default: prod'da true, geri kalanlarda false. Override
	// gerekiyorsa SECURE_COOKIES=true|false ile zorla — örn. dev makinede
	// HTTPS reverse-proxy varsa.
	cfg.SecureCookies = getEnvBool("SECURE_COOKIES", cfg.Environment == "production")
	cfg.MetricsBasicAuth = getEnv("METRICS_BASIC_AUTH", "")

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
		log.Println("Warning: CLAUDE_API_KEY ayarlanmamış, AI analiz özelliği devre dışı")
	}

	// Production-specific validations
	if cfg.Environment == "production" {
		if cfg.RedisURL == "" {
			log.Fatal("Redis URL production için zorunludur")
		}
		if cfg.FrontendURL == "" || strings.Contains(cfg.FrontendURL, "localhost") {
			log.Fatal("FRONTEND_URL production için geçerli bir domain olmalı")
		}
		if strings.Contains(cfg.DatabaseURL, "localhost") || strings.Contains(cfg.DatabaseURL, "127.0.0.1") {
			log.Fatal("DATABASE_URL production için remote bir database olmalı")
		}
		if os.Getenv("GIN_MODE") != "release" {
			log.Println("Warning: Production'da GIN_MODE=release ayarlanmalı")
		}
		// Check for secure defaults
		if cfg.PollDefaultSec < 5 {
			log.Println("Warning: Production'da POLL_DEFAULT_SEC en az 5 olmalı")
		}
	}

	log.Printf("Environment: %s", cfg.Environment)
	log.Printf("Go version: %s", runtime.Version())
	log.Printf("OS/Arch: %s/%s", runtime.GOOS, runtime.GOARCH)

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

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "1", "true", "yes", "y", "on":
			return true
		case "0", "false", "no", "n", "off":
			return false
		}
	}
	return defaultValue
}

func parseAllowedOrigins() []string {
	val := os.Getenv("ALLOWED_ORIGINS")
	if val == "" {
		return nil
	}
	parts := strings.Split(val, ",")
	var result []string
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			result = append(result, p)
		}
	}
	return result
}
