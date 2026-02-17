package services

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

func (r *Repository) Create(ctx context.Context, service *Service) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).Create(service).Error
}

func (r *Repository) GetByID(ctx context.Context, id, userID uuid.UUID) (*Service, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var service Service
	err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&service).Error
	return &service, err
}

func (r *Repository) List(ctx context.Context, userID uuid.UUID) ([]Service, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var services []Service
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&services).Error
	return services, err
}

func (r *Repository) Update(ctx context.Context, service *Service) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	service.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(service).Error
}

func (r *Repository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&Service{}).Error
}

func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).
		Model(&Service{}).
		Where("id = ?", id).
		Update("status", status).Error
}
