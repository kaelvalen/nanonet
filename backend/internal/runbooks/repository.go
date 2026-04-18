package runbooks

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, b *Runbook) error {
	return r.db.WithContext(ctx).Create(b).Error
}

func (r *Repository) Save(ctx context.Context, b *Runbook) error {
	return r.db.WithContext(ctx).Save(b).Error
}

func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).Delete(&Runbook{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) Get(ctx context.Context, userID, id uuid.UUID) (*Runbook, error) {
	var b Runbook
	if err := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).First(&b).Error; err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Runbook, error) {
	var out []Runbook
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("name ASC").
		Find(&out).Error
	return out, err
}

// FindMatching returns enabled runbooks owned by userID that match either the
// specific service or the global wildcard, and where the alert type matches
// (or the runbook's alert_type is "*").
func (r *Repository) FindMatching(ctx context.Context, userID, serviceID uuid.UUID, alertType string) ([]Runbook, error) {
	var out []Runbook
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND enabled = true", userID).
		Where("(service_id IS NULL OR service_id = ?)", serviceID).
		Where("(alert_type = ? OR alert_type = '*')", alertType).
		Find(&out).Error
	return out, err
}

func (r *Repository) RecentFireCount(ctx context.Context, runbookID uuid.UUID, since time.Time) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&Fire{}).
		Where("runbook_id = ? AND fired_at >= ?", runbookID, since).
		Count(&n).Error
	return n, err
}

// MarkFired increments fire_count and last_fired_at, and inserts an audit row,
// in a single transaction.
func (r *Repository) MarkFired(ctx context.Context, b *Runbook, fire *Fire) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&Runbook{}).Where("id = ?", b.ID).Updates(map[string]any{
			"last_fired_at": &now,
			"fire_count":    gorm.Expr("fire_count + 1"),
			"updated_at":    now,
		}).Error; err != nil {
			return err
		}
		return tx.Create(fire).Error
	})
}

// LogSkip just inserts an audit row without bumping last_fired_at — the
// runbook didn't actually do anything (cooldown / rate limit / disabled match).
func (r *Repository) LogSkip(ctx context.Context, fire *Fire) error {
	return r.db.WithContext(ctx).Create(fire).Error
}

func (r *Repository) RecentFires(ctx context.Context, runbookID uuid.UUID, limit int) ([]Fire, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var out []Fire
	err := r.db.WithContext(ctx).
		Where("runbook_id = ?", runbookID).
		Order("fired_at DESC").
		Limit(limit).
		Find(&out).Error
	return out, err
}
