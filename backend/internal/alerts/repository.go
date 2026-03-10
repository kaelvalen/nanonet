package alerts

import (
	"context"
	"errors"
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

func (r *Repository) Create(ctx context.Context, alert *Alert) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).Create(alert).Error
}

func (r *Repository) GetByServiceID(ctx context.Context, serviceID uuid.UUID, includeResolved bool) ([]Alert, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := r.db.WithContext(ctx).Where("service_id = ?", serviceID)

	if !includeResolved {
		query = query.Where("resolved_at IS NULL")
	}

	var alerts []Alert
	err := query.Order("triggered_at DESC").Find(&alerts).Error
	return alerts, err
}

func (r *Repository) GetByServiceIDPage(ctx context.Context, serviceID uuid.UUID, includeResolved bool, limit, offset int) ([]Alert, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := r.db.WithContext(ctx).Model(&Alert{}).Where("service_id = ?", serviceID)
	if !includeResolved {
		query = query.Where("resolved_at IS NULL")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var alerts []Alert
	err := query.Order("triggered_at DESC").Limit(limit).Offset(offset).Find(&alerts).Error
	return alerts, total, err
}

func (r *Repository) Resolve(ctx context.Context, alertID uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&Alert{}).
		Where("id = ? AND resolved_at IS NULL", alertID).
		Update("resolved_at", now).Error
}

func (r *Repository) GetActiveAlerts(ctx context.Context, userID uuid.UUID) ([]Alert, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var alerts []Alert
	err := r.db.WithContext(ctx).
		Joins("JOIN services ON services.id = alerts.service_id").
		Where("services.user_id = ? AND alerts.resolved_at IS NULL", userID).
		Order("alerts.triggered_at DESC").
		Find(&alerts).Error
	return alerts, err
}

func (r *Repository) HasActiveAlert(ctx context.Context, serviceID uuid.UUID, alertType string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var count int64
	err := r.db.WithContext(ctx).
		Model(&Alert{}).
		Where("service_id = ? AND type = ? AND resolved_at IS NULL", serviceID, alertType).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) GetActiveAlertTypes(ctx context.Context, serviceID uuid.UUID) (map[string]bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var types []string
	err := r.db.WithContext(ctx).
		Model(&Alert{}).
		Where("service_id = ? AND resolved_at IS NULL", serviceID).
		Distinct("type").
		Pluck("type", &types).Error
	if err != nil {
		return nil, err
	}

	result := make(map[string]bool, len(types))
	for _, t := range types {
		result[t] = true
	}
	return result, nil
}

func (r *Repository) ResolveByType(ctx context.Context, serviceID uuid.UUID, alertType string) error {
	return r.ResolveByTypes(ctx, serviceID, []string{alertType})
}

func (r *Repository) ResolveByTypes(ctx context.Context, serviceID uuid.UUID, alertTypes []string) error {
	if len(alertTypes) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&Alert{}).
		Where("service_id = ? AND type IN ? AND resolved_at IS NULL", serviceID, alertTypes).
		Update("resolved_at", now).Error
}

func (r *Repository) IsServiceOwner(ctx context.Context, serviceID, userID uuid.UUID) bool {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var count int64
	r.db.WithContext(ctx).
		Table("services").
		Where("id = ? AND user_id = ?", serviceID, userID).
		Count(&count)
	return count > 0
}

func (r *Repository) ResolveByUser(ctx context.Context, alertID, userID uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	now := time.Now()
	result := r.db.WithContext(ctx).
		Exec(`UPDATE alerts SET resolved_at = ?
			WHERE id = ? AND resolved_at IS NULL
			AND service_id IN (SELECT id FROM services WHERE user_id = ?)`,
			now, alertID, userID)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ──────────────────────── ServiceAlertRule ────────────────────────

// GetAlertRule returns the per-service alert rule, or nil if none is stored.
func (r *Repository) GetAlertRule(ctx context.Context, serviceID uuid.UUID) (*ServiceAlertRule, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var rule ServiceAlertRule
	err := r.db.WithContext(ctx).
		Table("service_alert_rules").
		Where("service_id = ?", serviceID).
		First(&rule).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

// UpsertAlertRule inserts or updates the per-service alert rule.
func (r *Repository) UpsertAlertRule(ctx context.Context, rule *ServiceAlertRule) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).Exec(`
		INSERT INTO service_alert_rules (service_id, cpu_threshold, memory_threshold_mb, latency_threshold_ms, error_rate_threshold, updated_at)
		VALUES (?, ?, ?, ?, ?, now())
		ON CONFLICT (service_id) DO UPDATE SET
			cpu_threshold        = EXCLUDED.cpu_threshold,
			memory_threshold_mb  = EXCLUDED.memory_threshold_mb,
			latency_threshold_ms = EXCLUDED.latency_threshold_ms,
			error_rate_threshold = EXCLUDED.error_rate_threshold,
			updated_at           = now()
	`, rule.ServiceID, rule.CPUThreshold, rule.MemoryThresholdMB, rule.LatencyThresholdMS, rule.ErrorRateThreshold).Error
}
