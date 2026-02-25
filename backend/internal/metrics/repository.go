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
