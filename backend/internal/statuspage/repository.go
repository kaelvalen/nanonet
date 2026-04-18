package statuspage

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

func (r *Repository) Create(ctx context.Context, p *StatusPage) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *Repository) Update(ctx context.Context, p *StatusPage) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	p.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	res := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&StatusPage{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) Get(ctx context.Context, userID, id uuid.UUID) (*StatusPage, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var p StatusPage
	if err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]StatusPage, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var out []StatusPage
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&out).Error
	return out, err
}

// GetPublicBySlug fetches an enabled page by slug. Used by anonymous visitors.
func (r *Repository) GetPublicBySlug(ctx context.Context, slug string) (*StatusPage, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var p StatusPage
	if err := r.db.WithContext(ctx).
		Where("slug = ? AND enabled = true", slug).
		First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}
