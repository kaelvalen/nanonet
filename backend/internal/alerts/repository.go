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

func (r *Repository) GetActiveAlerts(ctx context.Context) ([]Alert, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var alerts []Alert
	err := r.db.WithContext(ctx).
		Where("resolved_at IS NULL").
		Order("triggered_at DESC").
		Find(&alerts).Error
	return alerts, err
}
