package ai

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

func (r *Repository) Create(ctx context.Context, insight *AIInsight) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).Create(insight).Error
}

func (r *Repository) GetByAlertID(ctx context.Context, alertID uuid.UUID) (*AIInsight, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var insight AIInsight
	err := r.db.WithContext(ctx).Where("alert_id = ?", alertID).First(&insight).Error
	return &insight, err
}

func (r *Repository) GetByServiceID(ctx context.Context, serviceID uuid.UUID, limit, offset int) ([]AIInsight, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var insights []AIInsight
	var total int64

	query := r.db.WithContext(ctx).
		Joins("JOIN alerts ON alerts.id = ai_insights.alert_id").
		Where("alerts.service_id = ?", serviceID)

	if err := query.Model(&AIInsight{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Order("ai_insights.created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&insights).Error

	return insights, total, err
}
