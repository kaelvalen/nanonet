package tokenblacklist

import (
	"context"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Blacklist is the interface for token revocation.
// Implementations must be safe for concurrent use.
type Blacklist interface {
	// Add revokes a token for the given duration.
	Add(ctx context.Context, token string, ttl time.Duration) error
	// IsBlacklisted returns true if the token has been revoked.
	// It returns false on any internal error (fail-open).
	IsBlacklisted(ctx context.Context, token string) bool
}

// ──────────────────────── InMemory ────────────────────────

type entry struct {
	expiresAt time.Time
}

// InMemoryBlacklist is a thread-safe in-memory token blacklist.
// Tokens are automatically evicted once they expire so memory stays bounded.
type InMemoryBlacklist struct {
	mu      sync.RWMutex
	entries map[string]entry
}

// NewInMemory creates an in-memory blacklist with background cleanup.
func NewInMemory() *InMemoryBlacklist {
	b := &InMemoryBlacklist{
		entries: make(map[string]entry),
	}
	go b.cleanup()
	return b
}

func (b *InMemoryBlacklist) Add(_ context.Context, token string, ttl time.Duration) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.entries[token] = entry{expiresAt: time.Now().Add(ttl)}
	return nil
}

func (b *InMemoryBlacklist) IsBlacklisted(_ context.Context, token string) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	e, ok := b.entries[token]
	if !ok {
		return false
	}
	return time.Now().Before(e.expiresAt)
}

func (b *InMemoryBlacklist) cleanup() {
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

// ──────────────────────── Redis ────────────────────────

// RedisBlacklist stores revoked tokens in Redis with automatic TTL expiry.
type RedisBlacklist struct {
	client *redis.Client
	prefix string
}

// NewRedis creates a Redis-backed blacklist.
func NewRedis(client *redis.Client) *RedisBlacklist {
	return &RedisBlacklist{
		client: client,
		prefix: "nanonet:bl:",
	}
}

func (r *RedisBlacklist) Add(ctx context.Context, token string, ttl time.Duration) error {
	if ttl <= 0 {
		return nil
	}
	return r.client.Set(ctx, r.prefix+token, "1", ttl).Err()
}

func (r *RedisBlacklist) IsBlacklisted(ctx context.Context, token string) bool {
	n, err := r.client.Exists(ctx, r.prefix+token).Result()
	if err != nil {
		// Fail open — don't block legitimate requests on Redis errors.
		return false
	}
	return n > 0
}

// Default is a convenience in-memory blacklist for simple setups.
var Default Blacklist = NewInMemory()
