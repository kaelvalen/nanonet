package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestContextMiddleware adds request ID and timing to context
func RequestContextMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-Id")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		c.Set("request_id", requestID)
		c.Header("X-Request-Id", requestID)

		start := time.Now()
		c.Set("request_start", start)

		c.Next()

		duration := time.Since(start)
		c.Set("request_duration", duration)
	}
}

// GetRequestID retrieves request ID from context
func GetRequestID(c *gin.Context) string {
	if id, exists := c.Get("request_id"); exists {
		return id.(string)
	}
	return ""
}

// GetRequestDuration retrieves request duration from context
func GetRequestDuration(c *gin.Context) time.Duration {
	if duration, exists := c.Get("request_duration"); exists {
		return duration.(time.Duration)
	}
	return 0
}
