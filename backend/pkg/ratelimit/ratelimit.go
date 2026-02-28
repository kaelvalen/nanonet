package ratelimit

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// entry — her IP için istek sayacı ve son sıfırlama zamanı.
type entry struct {
	count   int
	resetAt time.Time
}

// Limiter — basit sliding window rate limiter.
type Limiter struct {
	mu       sync.RWMutex
	entries  map[string]*entry
	limit    int
	window   time.Duration
	cleanTTL time.Duration
}

// New — yeni rate limiter oluşturur.
// limit: pencere başına maksimum istek sayısı
// window: zaman penceresi (örn: 1 dakika)
func New(limit int, window time.Duration) *Limiter {
	l := &Limiter{
		entries:  make(map[string]*entry),
		limit:    limit,
		window:   window,
		cleanTTL: window * 2,
	}
	// Arka planda eski kayıtları temizle
	go l.cleanup()
	return l
}

// Allow — verilen key için isteğe izin verilip verilmediğini kontrol eder.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	e, exists := l.entries[key]

	if !exists || now.After(e.resetAt) {
		l.entries[key] = &entry{
			count:   1,
			resetAt: now.Add(l.window),
		}
		return true
	}

	if e.count >= l.limit {
		return false
	}

	e.count++
	return true
}

// Remaining — kalan istek hakkını döndürür.
func (l *Limiter) Remaining(key string) int {
	l.mu.RLock()
	defer l.mu.RUnlock()

	e, exists := l.entries[key]
	if !exists || time.Now().After(e.resetAt) {
		return l.limit
	}
	rem := l.limit - e.count
	if rem < 0 {
		return 0
	}
	return rem
}

// cleanup — süresi dolan kayıtları periyodik olarak temizler.
func (l *Limiter) cleanup() {
	ticker := time.NewTicker(l.cleanTTL)
	defer ticker.Stop()

	for range ticker.C {
		l.mu.Lock()
		now := time.Now()
		for key, e := range l.entries {
			if now.After(e.resetAt.Add(l.cleanTTL)) {
				delete(l.entries, key)
			}
		}
		l.mu.Unlock()
	}
}

// ---- Gin Middleware'leri ----

// Middleware — genel amaçlı rate limit middleware'i.
// İstemci IP'sine göre sınırlama yapar.
func Middleware(limit int, window time.Duration) gin.HandlerFunc {
	limiter := New(limit, window)
	return func(c *gin.Context) {
		key := c.ClientIP()
		if !limiter.Allow(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "çok fazla istek — lütfen biraz bekleyin",
			})
			c.Abort()
			return
		}
		c.Header("X-RateLimit-Remaining", string(rune('0'+limiter.Remaining(key))))
		c.Next()
	}
}

// StrictMiddleware — kritik endpoint'ler için daha sıkı rate limit.
// Örn: scale, exec, restart gibi side-effect yaratan işlemler.
func StrictMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	limiter := New(limit, window)
	return func(c *gin.Context) {
		// IP + UserID birleşik key
		userID := c.GetString("user_id")
		key := c.ClientIP() + ":" + userID
		if !limiter.Allow(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "bu işlem için rate limit aşıldı — lütfen bekleyin",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
