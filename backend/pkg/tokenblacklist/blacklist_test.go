package tokenblacklist

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var ctx = context.Background()

// ── InMemoryBlacklist ─────────────────────────────────────────────

func TestInMemory_AddAndIsBlacklisted(t *testing.T) {
	b := NewInMemory()
	token := "tok-abc"

	// eklemeden önce blacklist'te olmamalı
	assert.False(t, b.IsBlacklisted(ctx, token))

	require.NoError(t, b.Add(ctx, token, time.Minute))
	assert.True(t, b.IsBlacklisted(ctx, token))
}

func TestInMemory_ExpiredTokenNotBlacklisted(t *testing.T) {
	b := NewInMemory()
	token := "expired-tok"

	require.NoError(t, b.Add(ctx, token, 50*time.Millisecond))
	assert.True(t, b.IsBlacklisted(ctx, token))

	time.Sleep(60 * time.Millisecond)
	assert.False(t, b.IsBlacklisted(ctx, token), "TTL geçtikten sonra blacklisted dönmemeli")
}

func TestInMemory_UnknownTokenNotBlacklisted(t *testing.T) {
	b := NewInMemory()
	assert.False(t, b.IsBlacklisted(ctx, "no-such-token"))
}

func TestInMemory_MultipleTokens(t *testing.T) {
	b := NewInMemory()

	require.NoError(t, b.Add(ctx, "tok-1", time.Minute))
	require.NoError(t, b.Add(ctx, "tok-2", time.Minute))

	assert.True(t, b.IsBlacklisted(ctx, "tok-1"))
	assert.True(t, b.IsBlacklisted(ctx, "tok-2"))
	assert.False(t, b.IsBlacklisted(ctx, "tok-3"))
}

func TestInMemory_OverwriteExtendsTTL(t *testing.T) {
	b := NewInMemory()
	token := "renew-tok"

	require.NoError(t, b.Add(ctx, token, 50*time.Millisecond))
	// TTL'yi yenile
	require.NoError(t, b.Add(ctx, token, time.Minute))

	time.Sleep(60 * time.Millisecond)
	// uzatılmış TTL ile hâlâ geçerli
	assert.True(t, b.IsBlacklisted(ctx, token))
}

func TestInMemory_ConcurrentSafety(t *testing.T) {
	b := NewInMemory()
	const workers = 20
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			tok := "tok"
			_ = b.Add(ctx, tok, time.Minute)
			_ = b.IsBlacklisted(ctx, tok)
		}(i)
	}
	wg.Wait()
	// panic olmadan tamamlanmalı
}

// ── Default değişkeni ─────────────────────────────────────────────

func TestDefault_IsInMemory(t *testing.T) {
	_, ok := Default.(*InMemoryBlacklist)
	assert.True(t, ok, "Default bir InMemoryBlacklist olmalı")
}

func TestDefault_FunctionalAdd(t *testing.T) {
	token := "default-tok-" + time.Now().Format(time.RFC3339Nano)
	require.NoError(t, Default.Add(ctx, token, time.Minute))
	assert.True(t, Default.IsBlacklisted(ctx, token))
}
