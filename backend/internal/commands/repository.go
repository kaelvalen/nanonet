package commands

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

func (r *Repository) Create(ctx context.Context, log *CommandLog) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).Create(log).Error
}

func (r *Repository) UpdateStatus(ctx context.Context, commandID, status string, durationMS *int) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	updates := map[string]interface{}{
		"status": status,
	}

	if status == "success" || status == "failed" || status == "timeout" {
		now := time.Now()
		updates["completed_at"] = now
	}

	if durationMS != nil {
		updates["duration_ms"] = *durationMS
	}

	return r.db.WithContext(ctx).
		Model(&CommandLog{}).
		Where("command_id = ?", commandID).
		Updates(updates).Error
}

func (r *Repository) HasInFlightCommand(ctx context.Context, serviceID uuid.UUID, action string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var count int64
	err := r.db.WithContext(ctx).
		Model(&CommandLog{}).
		Where("service_id = ? AND action = ? AND status IN ('queued', 'sent') AND queued_at > ?",
			serviceID, action, time.Now().Add(-5*time.Minute)).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) MarkStalledCommandsTimeout(ctx context.Context, threshold time.Time) error {
	return r.db.WithContext(ctx).
		Model(&CommandLog{}).
		Where("status IN ('queued', 'sent') AND queued_at < ?", threshold).
		Updates(map[string]interface{}{
			"status":       "timeout",
			"completed_at": time.Now(),
		}).Error
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

func (r *Repository) GetByServiceID(ctx context.Context, serviceID uuid.UUID, limit, offset int) ([]CommandLog, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var logs []CommandLog
	var total int64

	query := r.db.WithContext(ctx).Where("service_id = ?", serviceID)

	if err := query.Model(&CommandLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Order("queued_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&logs).Error

	return logs, total, err
}
