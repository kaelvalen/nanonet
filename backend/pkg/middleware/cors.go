package middleware

import (
	"github.com/gin-gonic/gin"
)

// CORSMiddleware handles CORS headers and preflight requests.
// In development mode (non-release), common localhost origins are permitted automatically.
func CORSMiddleware(frontendURL string, extraOrigins []string) gin.HandlerFunc {
	allowedOrigins := make(map[string]bool)
	if frontendURL != "" {
		allowedOrigins[frontendURL] = true
	}
	for _, origin := range extraOrigins {
		allowedOrigins[origin] = true
	}
	if len(extraOrigins) == 0 && gin.Mode() != gin.ReleaseMode {
		allowedOrigins["http://localhost:3000"] = true
		allowedOrigins["http://localhost:5173"] = true
		allowedOrigins["http://localhost:4173"] = true
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		// Only echo back allowed Origins. Never "fallback" to a different origin.
		// Browsers enforce CORS; for non-browser clients, these headers are irrelevant.
		if origin != "" && allowedOrigins[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
		}

		// Keep credentials enabled for existing clients; only meaningful for browsers.
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-Id")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length, X-Request-Id")

		if c.Request.Method == "OPTIONS" {
			if origin != "" && allowedOrigins[origin] {
				c.AbortWithStatus(204)
			} else {
				c.AbortWithStatus(403)
			}
			return
		}

		c.Next()
	}
}
