package slo

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

func (r *Repository) Create(ctx context.Context, s *SLO) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return r.db.WithContext(ctx).Create(s).Error
}

func (r *Repository) Update(ctx context.Context, s *SLO) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	s.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(s).Error
}

func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	res := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&SLO{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) Get(ctx context.Context, userID, id uuid.UUID) (*SLO, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var s SLO
	if err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]SLO, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var out []SLO
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&out).Error
	return out, err
}

func (r *Repository) ListByService(ctx context.Context, userID, serviceID uuid.UUID) ([]SLO, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var out []SLO
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND service_id = ?", userID, serviceID).
		Order("created_at DESC").
		Find(&out).Error
	return out, err
}

// Sample is the minimal projection of metrics rows we need to compute SLI.
type Sample struct {
	Time      time.Time
	Status    string
	LatencyMS *float32
	ErrorRate *float32
}

// FetchSamples loads metric samples within the given window for the SLI calc.
// Range is bounded by the SLO window_days; we cap query depth defensively.
func (r *Repository) FetchSamples(ctx context.Context, serviceID uuid.UUID, from, to time.Time) ([]Sample, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	var out []Sample
	err := r.db.WithContext(ctx).Raw(`
		SELECT time, status, latency_ms, error_rate
		FROM metrics
		WHERE service_id = ? AND time BETWEEN ? AND ?
		ORDER BY time ASC
	`, serviceID, from, to).Scan(&out).Error
	return out, err
}
