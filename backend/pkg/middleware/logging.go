package middleware

import (
	"log/slog"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func sanitizeQuery(raw string) string {
	if raw == "" {
		return ""
	}
	q, err := url.ParseQuery(raw)
	if err != nil {
		// If it's not parseable, do not risk logging secrets.
		return "<redacted>"
	}

	// Redact common secret-bearing params.
	redactKeys := map[string]struct{}{
		"token":         {},
		"access_token":  {},
		"refresh_token": {},
		"authorization": {},
		"code":          {},
	}
	for k := range q {
		if _, ok := redactKeys[strings.ToLower(k)]; ok {
			q.Set(k, "<redacted>")
		}
	}
	return q.Encode()
}

// StructuredLoggingMiddleware adds structured request logging
func StructuredLoggingMiddleware(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := sanitizeQuery(c.Request.URL.RawQuery)

		c.Next()

		duration := time.Since(start)
		requestID := GetRequestID(c)
		userID := c.GetString("user_id")

		attrs := []any{
			slog.String("request_id", requestID),
			slog.String("method", c.Request.Method),
			slog.String("path", path),
			slog.String("query", query),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("duration", duration),
			slog.String("client_ip", c.ClientIP()),
			slog.String("user_agent", c.Request.UserAgent()),
		}
		if userID != "" {
			attrs = append(attrs, slog.String("user_id", userID))
		}

		logger.Info("request",
			attrs...,
		)
	}
}
