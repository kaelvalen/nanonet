package alerts

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
