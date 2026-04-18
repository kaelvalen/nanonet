// Package demo seeds a fresh user account with a small but realistic set of
// services, metrics history and an active alert so the empty-state UI does not
// look bleak. The seed is idempotent at the user level: it refuses to run if
// the user already owns any service. This keeps it safe to invoke from a UI
// "Load demo data" button.
package demo

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"nanonet-backend/internal/alerts"
	"nanonet-backend/internal/metrics"
	"nanonet-backend/internal/services"
)

// ErrAlreadySeeded is returned when the user already has services. We never
// double-seed because that would dilute their real data with synthetic noise.
var ErrAlreadySeeded = errors.New("demo verisi zaten yüklenmiş — önce mevcut servisleri silin")

type Service struct{ db *gorm.DB }

func New(db *gorm.DB) *Service { return &Service{db: db} }

// blueprint defines a demo service plus how its metric series should look.
// Each series is a sine + noise pattern around a baseline; one service is
// intentionally configured to spike beyond default thresholds so the
// generated alert is meaningful.
type blueprint struct {
	name        string
	host        string
	port        int
	healthPath  string
	cpuBase     float64
	cpuAmp      float64
	memBaseMB   float64
	memAmpMB    float64
	latBase     float64
	latAmp      float64
	errRate     float64
	stressSpike bool // adds late-window CPU spike → triggers cpu alert
}

var blueprints = []blueprint{
	{
		name:       "checkout-api",
		host:       "10.0.1.21",
		port:       8080,
		healthPath: "/healthz",
		cpuBase:    32, cpuAmp: 12,
		memBaseMB: 420, memAmpMB: 60,
		latBase: 90, latAmp: 35,
		errRate: 0.4,
	},
	{
		name:       "auth-service",
		host:       "10.0.1.22",
		port:       9001,
		healthPath: "/health",
		cpuBase:    18, cpuAmp: 6,
		memBaseMB: 260, memAmpMB: 30,
		latBase: 40, latAmp: 12,
		errRate: 0.1,
	},
	{
		name:       "search-indexer",
		host:       "10.0.1.31",
		port:       7600,
		healthPath: "/_cluster/health",
		cpuBase:    55, cpuAmp: 25,
		memBaseMB: 1100, memAmpMB: 220,
		latBase:     180,
		latAmp:      80,
		errRate:     1.2,
		stressSpike: true,
	},
	{
		name:       "notification-worker",
		host:       "10.0.1.41",
		port:       3000,
		healthPath: "/ready",
		cpuBase:    22, cpuAmp: 10,
		memBaseMB: 180, memAmpMB: 25,
		latBase: 60, latAmp: 18,
		errRate: 0.2,
	},
}

// Seed populates the user with the blueprint services and ~6 hours of metrics
// history per service at 1-minute resolution. It returns the IDs of the
// created services so the caller can navigate the user straight to one.
func (s *Service) Seed(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	var existing int64
	if err := s.db.WithContext(ctx).
		Model(&services.Service{}).
		Where("user_id = ?", userID).
		Count(&existing).Error; err != nil {
		return nil, fmt.Errorf("mevcut servisler kontrol edilemedi: %w", err)
	}
	if existing > 0 {
		return nil, ErrAlreadySeeded
	}

	createdIDs := make([]uuid.UUID, 0, len(blueprints))
	now := time.Now().UTC().Truncate(time.Minute)
	rng := rand.New(rand.NewSource(now.UnixNano()))

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, bp := range blueprints {
			svc := &services.Service{
				UserID:          userID,
				Name:            bp.name,
				Host:            bp.host,
				Port:            bp.port,
				HealthEndpoint:  bp.healthPath,
				PollIntervalSec: 15,
				Status:          "up",
				AgentStatus:     "healthy",
			}
			if err := tx.Create(svc).Error; err != nil {
				return fmt.Errorf("servis oluşturulamadı (%s): %w", bp.name, err)
			}
			createdIDs = append(createdIDs, svc.ID)

			rows := generateMetricSeries(svc.ID, bp, now, rng)
			if len(rows) > 0 {
				// Chunk inserts so we never trip a 65k parameter limit even on
				// drivers that don't support unbounded multi-row insert.
				const chunk = 500
				for i := 0; i < len(rows); i += chunk {
					end := i + chunk
					if end > len(rows) {
						end = len(rows)
					}
					if err := tx.Create(rows[i:end]).Error; err != nil {
						return fmt.Errorf("metrik insert (%s): %w", bp.name, err)
					}
				}
			}

			if bp.stressSpike {
				alert := alerts.Alert{
					ServiceID:   svc.ID,
					Type:        "high_cpu",
					Severity:    "warning",
					Message:     "CPU son 10 dakikadır %85 üzerinde — demo verisi",
					TriggeredAt: now.Add(-7 * time.Minute),
				}
				if err := tx.Create(&alert).Error; err != nil {
					return fmt.Errorf("uyarı oluşturulamadı: %w", err)
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return createdIDs, nil
}

func generateMetricSeries(serviceID uuid.UUID, bp blueprint, now time.Time, rng *rand.Rand) []*metrics.Metric {
	const (
		minutes = 6 * 60 // 6 hours
		stepMin = 1
	)
	rows := make([]*metrics.Metric, 0, minutes/stepMin)
	for i := minutes; i >= 0; i -= stepMin {
		t := now.Add(-time.Duration(i) * time.Minute)
		// position within the window, 0..1
		phase := float64(minutes-i) / float64(minutes)

		cpu := bp.cpuBase + bp.cpuAmp*math.Sin(phase*math.Pi*4) + (rng.Float64()-0.5)*4
		mem := bp.memBaseMB + bp.memAmpMB*math.Sin(phase*math.Pi*3+1) + (rng.Float64()-0.5)*15
		lat := bp.latBase + bp.latAmp*math.Sin(phase*math.Pi*5+0.7) + (rng.Float64()-0.5)*8
		errRate := bp.errRate + (rng.Float64()-0.5)*0.3

		// Only the last ~20 minutes spike for the stressed service so the
		// rest of the chart looks healthy and the spike is visually obvious.
		if bp.stressSpike && i <= 20 {
			cpu += 35 + rng.Float64()*8
			lat += 220
			errRate += 1.5
		}

		cpu = clamp(cpu, 0, 100)
		mem = math.Max(0, mem)
		lat = math.Max(1, lat)
		errRate = math.Max(0, errRate)

		cpuF, memF, latF, errF := float32(cpu), float32(mem), float32(lat), float32(errRate)
		rows = append(rows, &metrics.Metric{
			Time:         t,
			ServiceID:    serviceID,
			CPUPercent:   &cpuF,
			MemoryUsedMB: &memF,
			LatencyMS:    &latF,
			ErrorRate:    &errF,
			Status:       "up",
		})
	}
	return rows
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
