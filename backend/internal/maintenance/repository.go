package maintenance

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

// IsActiveNow returns true if there is an active maintenance window for the service at this moment.
func (r *Repository) IsActiveNow(ctx context.Context, serviceID uuid.UUID) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var count int64
	err := r.db.WithContext(ctx).
		Table("maintenance_windows").
		Where("service_id = ? AND starts_at <= now() AND ends_at > now()", serviceID).
		Count(&count).Error
	return count > 0, err
}

// List returns all maintenance windows for a service ordered by start time.
func (r *Repository) List(ctx context.Context, serviceID uuid.UUID) ([]MaintenanceWindow, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var windows []MaintenanceWindow
	err := r.db.WithContext(ctx).
		Table("maintenance_windows").
		Where("service_id = ?", serviceID).
		Order("starts_at DESC").
		Find(&windows).Error
	return windows, err
}

// Create inserts a new maintenance window.
func (r *Repository) Create(ctx context.Context, w *MaintenanceWindow) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).Table("maintenance_windows").Create(w).Error
}

// Delete removes a maintenance window by ID, scoped to the given service for safety.
func (r *Repository) Delete(ctx context.Context, id, serviceID uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	result := r.db.WithContext(ctx).
		Table("maintenance_windows").
		Where("id = ? AND service_id = ?", id, serviceID).
		Delete(&MaintenanceWindow{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// IsServiceOwner checks ownership via the services table.
func (r *Repository) IsServiceOwner(ctx context.Context, serviceID, userID uuid.UUID) bool {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var count int64
	r.db.WithContext(ctx).
		Table("services").
		Where("id = ? AND user_id = ?", serviceID, userID).
		Count(&count)
	return count > 0
}
