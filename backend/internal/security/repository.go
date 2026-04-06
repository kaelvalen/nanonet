package security

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Save yeni bir tarama sonucunu kaydeder.
func (r *Repository) Save(ctx context.Context, scan *Scan) error {
	return r.db.WithContext(ctx).Create(scan).Error
}

// GetLatestPerService kullanıcıya ait her servisin son tarama sonucunu döndürür.
func (r *Repository) GetLatestPerService(ctx context.Context, userID uuid.UUID) ([]Scan, error) {
	var scans []Scan
	err := r.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (ss.service_id)
			ss.*
		FROM security_scans ss
		JOIN services s ON s.id = ss.service_id
		WHERE s.user_id = ?
		ORDER BY ss.service_id, ss.scanned_at DESC
	`, userID).Scan(&scans).Error
	return scans, err
}

// GetForService bir servisin tarama geçmişini döndürür.
func (r *Repository) GetForService(ctx context.Context, serviceID uuid.UUID, limit int) ([]Scan, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var scans []Scan
	err := r.db.WithContext(ctx).
		Where("service_id = ?", serviceID).
		Order("scanned_at DESC").
		Limit(limit).
		Find(&scans).Error
	return scans, err
}
