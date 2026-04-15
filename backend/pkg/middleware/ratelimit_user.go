package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// UserRateLimiter provides per-user rate limiting
type UserRateLimiter struct {
	clients map[string]*clientInfo
	mu      sync.RWMutex
	rate    int           // requests per window
	window  time.Duration // time window
}

type clientInfo struct {
	tokens     int
	lastUpdate time.Time
}

// NewUserRateLimiter creates a new per-user rate limiter
func NewUserRateLimiter(rate int, window time.Duration) *UserRateLimiter {
	limiter := &UserRateLimiter{
		clients: make(map[string]*clientInfo),
		rate:    rate,
		window:  window,
	}
	// Start cleanup goroutine
	go limiter.cleanup()
	return limiter
}

// Allow checks if the user is allowed to make a request
func (l *UserRateLimiter) Allow(userID string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	client, exists := l.clients[userID]

	if !exists {
		l.clients[userID] = &clientInfo{
			tokens:     l.rate - 1,
			lastUpdate: now,
		}
		return true
	}

	// Refill tokens based on time elapsed
	elapsed := now.Sub(client.lastUpdate)
	tokensToAdd := int(elapsed / (l.window / time.Duration(l.rate)))
	client.tokens += tokensToAdd
	if client.tokens > l.rate {
		client.tokens = l.rate
	}
	client.lastUpdate = now

	if client.tokens > 0 {
		client.tokens--
		return true
	}

	return false
}

// cleanup removes stale client entries
func (l *UserRateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		l.mu.Lock()
		now := time.Now()
		for userID, client := range l.clients {
			if now.Sub(client.lastUpdate) > l.window*2 {
				delete(l.clients, userID)
			}
		}
		l.mu.Unlock()
	}
}

// UserRateLimitMiddleware applies per-user rate limiting
func UserRateLimitMiddleware(limiter *UserRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			// No user ID, skip rate limiting
			c.Next()
			return
		}

		if !limiter.Allow(userID) {
			c.JSON(429, gin.H{"error": "rate limit exceeded"})
			c.Abort()
			return
		}

		c.Next()
	}
}
