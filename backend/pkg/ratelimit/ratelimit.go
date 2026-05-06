package ratelimit

import (
	"container/list"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// DenialObserver — 429 yanıtı verildiğinde çağrılır. Observability paketi
// kendi counter'ını burada register edecek. Nil olabilir; bu paketin
// observability paketine import bağımlılığı yoktur (cycle önleme).
var DenialObserver func(limiter string)

// entry — her IP için istek sayacı ve son sıfırlama zamanı.
//
// LRU evict için entry, doubly-linked-list elemanına da işaret tutar; bu sayede
// haritada O(1) erişim, evict tarafında O(1) en eski (idle) silme yapabiliyoruz.
type entry struct {
	count   int
	resetAt time.Time
	// lruElem — LRU listesinde bu entry'ye karşılık gelen düğüm.
	// Allow her tetiklendiğinde MoveToFront ile "yeni dokunuldu" işareti
	// koyar. cleanup ve evict yolu Back()'i siler.
	lruElem *list.Element
	key     string
}

// Limiter — basit sliding window rate limiter, LRU evict'li.
type Limiter struct {
	mu       sync.Mutex
	entries  map[string]*entry
	lru      *list.List
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
		lru:      list.New(),
		limit:    limit,
		window:   window,
		cleanTTL: window * 2,
	}
	go l.cleanup()
	return l
}

// maxLimiterEntries — eşzamanlı tutulacak en fazla farklı key sayısı.
//
// Bu sınıra ulaşıldığında eski davranış: yeni key'leri reddet ⇒ yeni
// kullanıcılar siteye giremez (DoS amplifier). Yeni davranış: en uzun süredir
// dokunulmamış (LRU) entry'i sil, böylece yeni IP her durumda hizmet alabilir.
const maxLimiterEntries = 100000

// Allow — verilen key için isteğe izin verilip verilmediğini kontrol eder.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	e, exists := l.entries[key]

	if !exists || now.After(e.resetAt) {
		if !exists && len(l.entries) >= maxLimiterEntries {
			l.evictLRULocked()
		}
		if exists {
			e.count = 1
			e.resetAt = now.Add(l.window)
			l.lru.MoveToFront(e.lruElem)
			return true
		}
		ne := &entry{
			count:   1,
			resetAt: now.Add(l.window),
			key:     key,
		}
		ne.lruElem = l.lru.PushFront(ne)
		l.entries[key] = ne
		return true
	}

	if e.count >= l.limit {
		// "Dokunma" yenileme yapmıyoruz: rate limit'i aşan istekler aktif
		// kullanım sinyali değil, bu entry'i LRU'da öne almak yanıltıcı olur.
		return false
	}

	e.count++
	l.lru.MoveToFront(e.lruElem)
	return true
}

// Remaining — kalan istek hakkını döndürür.
func (l *Limiter) Remaining(key string) int {
	l.mu.Lock()
	defer l.mu.Unlock()

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

// RetryAfter — pencerenin sıfırlanmasına kalan saniye (en az 1).
// Key bilinmiyorsa 0 döner ⇒ middleware bu durumda header eklemez.
func (l *Limiter) RetryAfter(key string) int {
	l.mu.Lock()
	defer l.mu.Unlock()

	e, exists := l.entries[key]
	if !exists {
		return 0
	}
	d := time.Until(e.resetAt)
	if d <= 0 {
		return 1
	}
	secs := int(d / time.Second)
	if d%time.Second != 0 {
		secs++
	}
	if secs < 1 {
		secs = 1
	}
	return secs
}

// evictLRULocked — en uzun süredir dokunulmamış entry'i siler.
// Çağıran l.mu.Lock altında olmalı.
func (l *Limiter) evictLRULocked() {
	back := l.lru.Back()
	if back == nil {
		return
	}
	e, _ := back.Value.(*entry)
	if e == nil {
		l.lru.Remove(back)
		return
	}
	l.lru.Remove(back)
	delete(l.entries, e.key)
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
				if e.lruElem != nil {
					l.lru.Remove(e.lruElem)
				}
				delete(l.entries, key)
			}
		}
		l.mu.Unlock()
	}
}

// ---- Gin Middleware'leri ----

// writeRateLimited — 429 yanıtını header'larla birlikte yazar.
//
// Retry-After: pencerenin sıfırlanmasına kalan saniye (RFC 9110).
// X-RateLimit-Remaining: 0 (limit aşıldı).
// X-RateLimit-Limit: middleware'in toplam pencere kapasitesi.
func writeRateLimited(c *gin.Context, l *Limiter, key, msg, limiterName string) {
	if r := l.RetryAfter(key); r > 0 {
		c.Header("Retry-After", strconv.Itoa(r))
	}
	c.Header("X-RateLimit-Limit", strconv.Itoa(l.limit))
	c.Header("X-RateLimit-Remaining", "0")
	c.JSON(http.StatusTooManyRequests, gin.H{
		"success": false,
		"error":   msg,
	})
	c.Abort()
	if DenialObserver != nil {
		DenialObserver(limiterName)
	}
}

// Middleware — genel amaçlı rate limit middleware'i.
// İstemci IP'sine göre sınırlama yapar.
func Middleware(limit int, window time.Duration) gin.HandlerFunc {
	limiter := New(limit, window)
	return func(c *gin.Context) {
		key := c.ClientIP()
		if !limiter.Allow(key) {
			writeRateLimited(c, limiter, key, "çok fazla istek — lütfen biraz bekleyin", "general")
			return
		}
		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(limiter.Remaining(key)))
		c.Next()
	}
}

// StrictMiddleware — kritik endpoint'ler için daha sıkı rate limit.
// Örn: scale, exec, restart gibi side-effect yaratan işlemler.
//
// Key: ClientIP + ":" + user_id. Auth zorunlu route'larda kullanılır.
func StrictMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	limiter := New(limit, window)
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		key := c.ClientIP() + ":" + userID
		if !limiter.Allow(key) {
			writeRateLimited(c, limiter, key, "bu işlem için rate limit aşıldı — lütfen bekleyin", "strict")
			return
		}
		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(limiter.Remaining(key)))
		c.Next()
	}
}

// BruteForceMiddleware — login/register/forgot-password gibi kimlik doğrulama
// uçları için tasarlanmıştır. Sıkı limit (örn. 10/dk/IP), 429 yanıtında her
// zaman Retry-After içerir.
//
// Hata mesajı brute force tarayıcılarına ipucu vermemek adına nötrdür.
func BruteForceMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	limiter := New(limit, window)
	return func(c *gin.Context) {
		key := c.ClientIP()
		if !limiter.Allow(key) {
			writeRateLimited(c, limiter, key, "çok fazla deneme — lütfen biraz sonra tekrar deneyin", "brute_force")
			return
		}
		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(limiter.Remaining(key)))
		c.Next()
	}
}
