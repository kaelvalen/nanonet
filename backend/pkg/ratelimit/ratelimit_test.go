package ratelimit

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestAllow_BasicLimit(t *testing.T) {
	l := New(3, time.Minute)

	assert.True(t, l.Allow("ip1"))
	assert.True(t, l.Allow("ip1"))
	assert.True(t, l.Allow("ip1"))
	assert.False(t, l.Allow("ip1")) // 4th request should be denied
}

func TestAllow_IndependentKeys(t *testing.T) {
	l := New(2, time.Minute)

	assert.True(t, l.Allow("a"))
	assert.True(t, l.Allow("a"))
	assert.False(t, l.Allow("a"))

	// farklı key bağımsız kota kullanmalı
	assert.True(t, l.Allow("b"))
	assert.True(t, l.Allow("b"))
	assert.False(t, l.Allow("b"))
}

func TestAllow_WindowReset(t *testing.T) {
	l := New(1, 50*time.Millisecond)

	assert.True(t, l.Allow("x"))
	assert.False(t, l.Allow("x"))

	time.Sleep(60 * time.Millisecond)

	// pencere sıfırlandı, yeni istek izinli olmalı
	assert.True(t, l.Allow("x"))
}

func TestRemaining_FullQuota(t *testing.T) {
	l := New(5, time.Minute)
	assert.Equal(t, 5, l.Remaining("new-ip"))
}

func TestRemaining_AfterRequests(t *testing.T) {
	l := New(5, time.Minute)

	l.Allow("ip")
	l.Allow("ip")
	assert.Equal(t, 3, l.Remaining("ip"))
}

func TestRemaining_AfterExhaustion(t *testing.T) {
	l := New(2, time.Minute)
	l.Allow("ip")
	l.Allow("ip")
	l.Allow("ip") // limit aşıldı
	assert.Equal(t, 0, l.Remaining("ip"))
}

func TestRemaining_AfterWindowReset(t *testing.T) {
	l := New(3, 50*time.Millisecond)
	l.Allow("ip")
	l.Allow("ip")

	time.Sleep(60 * time.Millisecond)
	// pencere sıfırlandı
	assert.Equal(t, 3, l.Remaining("ip"))
}

func TestAllow_ConcurrentAccess(t *testing.T) {
	l := New(100, time.Minute)
	const goroutines = 50
	var wg sync.WaitGroup
	results := make(chan bool, goroutines)

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results <- l.Allow("concurrent-ip")
		}()
	}

	wg.Wait()
	close(results)

	allowed := 0
	for r := range results {
		if r {
			allowed++
		}
	}
	// 50 < 100 limit, hepsinin izinli olması gerekir
	assert.Equal(t, goroutines, allowed)
}

func TestAllow_LimitOnePerWindow(t *testing.T) {
	l := New(1, time.Minute)
	assert.True(t, l.Allow("k"))
	for i := 0; i < 5; i++ {
		assert.False(t, l.Allow("k"))
	}
}

func TestAllow_ZeroRemainingNoNegative(t *testing.T) {
	l := New(1, time.Minute)
	l.Allow("ip")
	l.Allow("ip") // limit aştı

	rem := l.Remaining("ip")
	assert.GreaterOrEqual(t, rem, 0, "kalan asla negatif olmamalı")
}
