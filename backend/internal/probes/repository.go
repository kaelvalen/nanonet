package probes

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, p *Probe) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *Repository) Save(ctx context.Context, p *Probe) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *Repository) Get(ctx context.Context, userID, id uuid.UUID) (*Probe, error) {
	var p Probe
	if err := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).Delete(&Probe{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Probe, error) {
	var out []Probe
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("name ASC").
		Find(&out).Error
	return out, err
}

// ListDue returns enabled probes whose last_run_at + interval has elapsed.
// Runs unbounded by user — this is invoked by the runner only.
func (r *Repository) ListDue(ctx context.Context, now time.Time) ([]Probe, error) {
	var out []Probe
	err := r.db.WithContext(ctx).
		Raw(`
			SELECT * FROM probes
			WHERE enabled = true
			  AND (last_run_at IS NULL OR last_run_at + (interval_seconds || ' seconds')::interval <= ?)
		`, now).Scan(&out).Error
	return out, err
}

// UpdateRunResult writes the new runtime state and appends a Run row in a
// single transaction so the UI never sees mismatched "last status" + history.
func (r *Repository) UpdateRunResult(ctx context.Context, p *Probe, run *Run) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Probe{}).Where("id = ?", p.ID).Updates(map[string]interface{}{
			"last_run_at":           p.LastRunAt,
			"last_status":           p.LastStatus,
			"last_latency_ms":       p.LastLatencyMS,
			"last_error":            p.LastError,
			"consecutive_failures":  p.ConsecutiveFailures,
			"updated_at":            time.Now(),
		}).Error; err != nil {
			return err
		}
		return tx.Create(run).Error
	})
}

func (r *Repository) RecentRuns(ctx context.Context, probeID uuid.UUID, limit int) ([]Run, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var out []Run
	err := r.db.WithContext(ctx).
		Where("probe_id = ?", probeID).
		Order("ran_at DESC").
		Limit(limit).
		Find(&out).Error
	return out, err
}

// PruneRuns removes runs older than the given retention window.
func (r *Repository) PruneRuns(ctx context.Context, olderThan time.Duration) error {
	cutoff := time.Now().Add(-olderThan)
	return r.db.WithContext(ctx).Where("ran_at < ?", cutoff).Delete(&Run{}).Error
}
