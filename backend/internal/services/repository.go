package services

import (
	"context"
	"encoding/json"
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

// GetServiceMap returns the stored service map layout for a user, or nil if none exists.
func (r *Repository) GetServiceMap(ctx context.Context, userID uuid.UUID) (json.RawMessage, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var row struct {
		ServiceMap *json.RawMessage `gorm:"column:service_map"`
	}
	err := r.db.WithContext(ctx).
		Raw("SELECT service_map FROM user_settings WHERE user_id = ?", userID).
		Scan(&row).Error
	if err != nil || row.ServiceMap == nil {
		return nil, err
	}
	return *row.ServiceMap, nil
}

// SaveServiceMap upserts the service map layout for a user.
func (r *Repository) SaveServiceMap(ctx context.Context, userID uuid.UUID, payload json.RawMessage) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	return r.db.WithContext(ctx).Exec(`
		INSERT INTO user_settings (user_id, service_map, updated_at)
		VALUES (?, ?, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			service_map = EXCLUDED.service_map,
			updated_at  = NOW()
	`, userID, payload).Error
}
