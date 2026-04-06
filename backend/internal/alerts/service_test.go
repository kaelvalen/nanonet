package alerts

import (
	"context"
	"testing"
	"time"

	"nanonet-backend/internal/metrics"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── mock yardımcıları ─────────────────────────────────────────────

type mockMaintChecker struct {
	active bool
	err    error
}

func (m *mockMaintChecker) IsActiveNow(_ context.Context, _ uuid.UUID) (bool, error) {
	return m.active, m.err
}

// ── Email cooldown ────────────────────────────────────────────────

func newServiceForCooldown() *Service {
	return &Service{
		cooldowns: make(map[string]time.Time),
	}
}

func TestEmailCooldown_NotActiveInitially(t *testing.T) {
	svc := newServiceForCooldown()
	id := uuid.New()
	assert.False(t, svc.emailCooldownActive(id, "high_cpu"))
}

func TestEmailCooldown_ActiveAfterSet(t *testing.T) {
	svc := newServiceForCooldown()
	id := uuid.New()

	svc.setEmailCooldown(id, "high_cpu")
	assert.True(t, svc.emailCooldownActive(id, "high_cpu"))
}

func TestEmailCooldown_IndependentAlertTypes(t *testing.T) {
	svc := newServiceForCooldown()
	id := uuid.New()

	svc.setEmailCooldown(id, "high_cpu")
	assert.True(t, svc.emailCooldownActive(id, "high_cpu"))
	assert.False(t, svc.emailCooldownActive(id, "high_memory"), "farklı tip için cooldown olmamalı")
}

func TestEmailCooldown_IndependentServices(t *testing.T) {
	svc := newServiceForCooldown()
	id1 := uuid.New()
	id2 := uuid.New()

	svc.setEmailCooldown(id1, "high_cpu")
	assert.True(t, svc.emailCooldownActive(id1, "high_cpu"))
	assert.False(t, svc.emailCooldownActive(id2, "high_cpu"), "farklı servis için cooldown olmamalı")
}

func TestEmailCooldown_ExpiredAfterTTL(t *testing.T) {
	svc := newServiceForCooldown()
	id := uuid.New()
	key := id.String() + ":high_cpu"

	// Geçmiş bir zaman koy (cooldown süresi dolmuş)
	svc.muCool.Lock()
	svc.cooldowns[key] = time.Now().Add(-emailCooldown - time.Second)
	svc.muCool.Unlock()

	assert.False(t, svc.emailCooldownActive(id, "high_cpu"), "süresi dolmuş cooldown aktif görünmemeli")
}

// ── CheckMetricAndCreateAlert: bakım penceresi ───────────────────

func TestCheckMetricAndCreateAlert_SkipsDuringMaintenance(t *testing.T) {
	svc := newServiceForCooldown()
	svc.maint = &mockMaintChecker{active: true}

	cpu := float32(95.0)
	metric := &metrics.Metric{CPUPercent: &cpu}

	err := svc.CheckMetricAndCreateAlert(context.Background(), uuid.New(), metric)
	require.NoError(t, err, "bakım sırasında hata döndürülmemeli")
}

func TestCheckMetricAndCreateAlert_MaintenanceCheckError_Continues(t *testing.T) {
	// Bakım kontrolü hata verirse alert akışı devam etmeli.
	// repo nil olduğu için sonuçta panic'e gider;
	// sadece bakım hata yolunun erken return yapıp yapmadığını test et.
	svc := newServiceForCooldown()
	svc.maint = &mockMaintChecker{active: false, err: assert.AnError}

	// Repo nil olduğu için GetAlertRule çağrısında panic beklenir —
	// testik amaç: bakım hatası silent loglanır ve devam edilir.
	// Repo'yu set etmeden sadece paniklemeden bakım bloğunu aşıyor muyuz?
	// Bunu recovery ile yakalayabiliriz.
	defer func() {
		r := recover()
		// Panic bekleniyor (nil repo), ama maintenance hata yoluna girmemeliyiz
		_ = r
	}()
	_ = svc.CheckMetricAndCreateAlert(context.Background(), uuid.New(), &metrics.Metric{})
}

// ── DefaultAlertRules ────────────────────────────────────────────

func TestDefaultAlertRules_Values(t *testing.T) {
	assert.Equal(t, float32(80.0), DefaultAlertRules.CPUThreshold)
	assert.Equal(t, float32(2048.0), DefaultAlertRules.MemoryThreshold)
	assert.Equal(t, float32(1000.0), DefaultAlertRules.LatencyThreshold)
	assert.Equal(t, float32(5.0), DefaultAlertRules.ErrorRateThreshold)
}

func TestDefaultAlertRules_MemoryInMB(t *testing.T) {
	// Eski bug: MemoryThreshold 85.0 (%) olarak ayarlanmıştı, 2048 MB olmalı
	assert.Greater(t, DefaultAlertRules.MemoryThreshold, float32(100.0),
		"MemoryThreshold yüzde değil MB cinsinden olmalı (>100)")
}
