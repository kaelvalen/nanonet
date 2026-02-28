package metrics

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Insert(ctx context.Context, metric *Metric) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).Create(metric).Error
}

func (r *Repository) GetHistory(ctx context.Context, serviceID uuid.UUID, duration time.Duration, limit int) ([]Metric, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if limit <= 0 {
		limit = 500
	}

	var metrics []Metric
	err := r.db.WithContext(ctx).
		Where("service_id = ? AND time > ?", serviceID, time.Now().Add(-duration)).
		Order("time ASC").
		Limit(limit).
		Find(&metrics).Error

	return metrics, err
}

func (r *Repository) GetAggregated(ctx context.Context, serviceID uuid.UUID, duration time.Duration, bucketSize string) ([]map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var results []map[string]interface{}
	err := r.db.WithContext(ctx).
		Raw(`
			SELECT
				time_bucket(?, time) AS bucket,
				AVG(cpu_percent) AS avg_cpu,
				AVG(latency_ms) AS avg_latency,
				MAX(latency_ms) AS max_latency,
				AVG(memory_used_mb) AS avg_memory
			FROM metrics
			WHERE service_id = ? AND time > ?
			GROUP BY bucket
			ORDER BY bucket
		`, bucketSize, serviceID, time.Now().Add(-duration)).
		Scan(&results).Error

	return results, err
}

func (r *Repository) GetLatestPerService(ctx context.Context) ([]Metric, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var results []Metric
	err := r.db.WithContext(ctx).
		Raw(`
			SELECT DISTINCT ON (service_id) *
			FROM metrics
			ORDER BY service_id, time DESC
		`).
		Scan(&results).Error
	return results, err
}

func (r *Repository) GetLatest(ctx context.Context, serviceID uuid.UUID) (*Metric, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var metric Metric
	err := r.db.WithContext(ctx).
		Where("service_id = ?", serviceID).
		Order("time DESC").
		Limit(1).
		First(&metric).Error
	if err != nil {
		return nil, err
	}
	return &metric, nil
}

// StatsSummary TimescaleDB'den çekilen istatistiksel özet.
// summarizeMetrics() Go tarafında çalışır; bu fonksiyon büyük zaman pencereleri için
// hesaplamayı veritabanına taşır ve percentile_cont ile doğru P95 verir.
type StatsSummary struct {
	SampleCount   int64    `gorm:"column:sample_count"`
	CPUMean       *float64 `gorm:"column:cpu_mean"`
	CPUMin        *float64 `gorm:"column:cpu_min"`
	CPUMax        *float64 `gorm:"column:cpu_max"`
	MemMean       *float64 `gorm:"column:mem_mean"`
	MemMin        *float64 `gorm:"column:mem_min"`
	MemMax        *float64 `gorm:"column:mem_max"`
	LatencyMean   *float64 `gorm:"column:latency_mean"`
	LatencyMin    *float64 `gorm:"column:latency_min"`
	LatencyMax    *float64 `gorm:"column:latency_max"`
	LatencyP95    *float64 `gorm:"column:latency_p95"`
	ErrorRateMean *float64 `gorm:"column:error_rate_mean"`
	DownCount     int64    `gorm:"column:down_count"`
	DegradedCount int64    `gorm:"column:degraded_count"`
}

func (r *Repository) GetStatsSummary(ctx context.Context, serviceID uuid.UUID, duration time.Duration) (*StatsSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var result StatsSummary
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			COUNT(*)                                          AS sample_count,
			AVG(cpu_percent)                                  AS cpu_mean,
			MIN(cpu_percent)                                  AS cpu_min,
			MAX(cpu_percent)                                  AS cpu_max,
			AVG(memory_used_mb)                               AS mem_mean,
			MIN(memory_used_mb)                               AS mem_min,
			MAX(memory_used_mb)                               AS mem_max,
			AVG(latency_ms)                                   AS latency_mean,
			MIN(latency_ms)                                   AS latency_min,
			MAX(latency_ms)                                   AS latency_max,
			percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS latency_p95,
			AVG(error_rate)                                   AS error_rate_mean,
			COUNT(*) FILTER (WHERE status = 'down')           AS down_count,
			COUNT(*) FILTER (WHERE status = 'degraded')       AS degraded_count
		FROM metrics
		WHERE service_id = ? AND time > ?
	`, serviceID, time.Now().Add(-duration)).Scan(&result).Error

	return &result, err
}

func (r *Repository) GetUptime(ctx context.Context, serviceID uuid.UUID, duration time.Duration) (float64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var result struct {
		UptimePercent *float64 `gorm:"column:uptime_percent"`
	}

	err := r.db.WithContext(ctx).
		Raw(`
			SELECT
				COUNT(*) FILTER (WHERE status = 'up')::float /
				NULLIF(COUNT(*), 0) * 100 AS uptime_percent
			FROM metrics
			WHERE service_id = ? AND time > ?
		`, serviceID, time.Now().Add(-duration)).
		Scan(&result).Error

	if err != nil {
		return 0, err
	}

	if result.UptimePercent == nil {
		return 0, nil
	}

	return *result.UptimePercent, nil
}
