package auth

// Bu paket pkg/ratelimit üzerinden sarmalanmış middleware'leri sunar.
// Daha önce burada tutulan in-memory sliding-window implementasyonu
// pkg/ratelimit.Limiter ile değiştirildi; böylece tüm rate limiter'lar
// aynı altyapıyı paylaşır ve dağıtık ortamlarda tutarlı çalışır.

import (
	"net/http"
	"time"

	"nanonet-backend/pkg/ratelimit"
	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// RateLimiter — pkg/ratelimit.Limiter etrafında bir wrapper; mevcut
// çağrı yerlerini (NewRateLimiter, RateLimiter.Allow vb.) bozmadan
// geçişi sağlar.
type RateLimiter struct {
	inner *ratelimit.Limiter
}

// NewRateLimiter — belirtilen limit ve pencere süresiyle yeni bir
// RateLimiter oluşturur. pkg/ratelimit.Limiter kullanır.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{inner: ratelimit.New(limit, window)}
}

// Allow — verilen anahtar için rate limit kontrolü yapar.
func (rl *RateLimiter) Allow(key string) bool {
	return rl.inner.Allow(key)
}

// RateLimitMiddleware — genel IP bazlı rate limit middleware'i.
// X-RateLimit-Remaining header'ını ekler.
func RateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()

		if !limiter.Allow(key) {
			response.Error(c, http.StatusTooManyRequests, "istek limiti aşıldı, lütfen bekleyin")
			c.Abort()
			return
		}

		c.Next()
	}
}

// AuthRateLimitMiddleware — kimlik doğrulama endpoint'leri için
// daha sıkı rate limit middleware'i. Key: "auth:<IP>".
func AuthRateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := "auth:" + c.ClientIP()

		if !limiter.Allow(key) {
			response.Error(c, http.StatusTooManyRequests, "çok fazla giriş denemesi, lütfen bekleyin")
			c.Abort()
			return
		}

		c.Next()
	}
}
