package tokenblacklist

import (
	"sync"
	"time"
)

type entry struct {
	expiresAt time.Time
}

// Blacklist is a thread-safe in-memory token blacklist.
// Tokens are automatically evicted once they expire so memory stays bounded.
type Blacklist struct {
	mu      sync.RWMutex
	entries map[string]entry
}

var Default = New()

func New() *Blacklist {
	b := &Blacklist{
		entries: make(map[string]entry),
	}
	go b.cleanup()
	return b
}

// Add blacklists a token until the given expiry time.
func (b *Blacklist) Add(token string, expiresAt time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.entries[token] = entry{expiresAt: expiresAt}
}

// IsBlacklisted returns true if the token has been revoked and has not yet expired.
func (b *Blacklist) IsBlacklisted(token string) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	e, ok := b.entries[token]
	if !ok {
		return false
	}
	return time.Now().Before(e.expiresAt)
}

func (b *Blacklist) cleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		b.mu.Lock()
		for token, e := range b.entries {
			if now.After(e.expiresAt) {
				delete(b.entries, token)
			}
		}
		b.mu.Unlock()
	}
}
