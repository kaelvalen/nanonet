package auth

import (
	"net/http"
	"sync"
	"time"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type rateLimitEntry struct {
	timestamps []time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rateLimitEntry
	limit   int
	window  time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*rateLimitEntry),
		limit:   limit,
		window:  window,
	}

	go rl.cleanup()

	return rl
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.window)
		for key, entry := range rl.entries {
			var valid []time.Time
			for _, t := range entry.timestamps {
				if t.After(cutoff) {
					valid = append(valid, t)
				}
			}
			if len(valid) == 0 {
				delete(rl.entries, key)
			} else {
				entry.timestamps = valid
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	entry, exists := rl.entries[key]
	if !exists {
		rl.entries[key] = &rateLimitEntry{
			timestamps: []time.Time{now},
		}
		return true
	}

	var valid []time.Time
	for _, t := range entry.timestamps {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		entry.timestamps = valid
		return false
	}

	entry.timestamps = append(valid, now)
	return true
}

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
