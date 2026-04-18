package dependencies

import (
	"context"
	"errors"
	"strings"
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

// UpsertBatch increments sample_count and bumps last_seen_at for existing
// rows, otherwise inserts. Filters out clearly invalid observations to keep
// the table tidy.
func (r *Repository) UpsertBatch(ctx context.Context, serviceID uuid.UUID, obs []Observation) error {
	if len(obs) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	now := time.Now()
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, o := range obs {
			host := strings.TrimSpace(o.TargetHost)
			if host == "" || o.TargetPort < 1 || o.TargetPort > 65535 {
				continue
			}
			proto := strings.ToLower(strings.TrimSpace(o.Protocol))
			if proto == "" {
				proto = "tcp"
			}
			res := tx.Exec(`
				INSERT INTO service_dependencies
					(service_id, target_host, target_port, protocol, process_name, sample_count, first_seen_at, last_seen_at)
				VALUES (?, ?, ?, ?, ?, 1, ?, ?)
				ON CONFLICT (service_id, target_host, target_port, protocol)
				DO UPDATE SET
					sample_count = service_dependencies.sample_count + 1,
					last_seen_at = EXCLUDED.last_seen_at,
					process_name = COALESCE(EXCLUDED.process_name, service_dependencies.process_name)
			`, serviceID, host, o.TargetPort, proto, o.ProcessName, now, now)
			if res.Error != nil {
				return res.Error
			}
		}
		return nil
	})
}

func (r *Repository) ListByService(ctx context.Context, serviceID uuid.UUID) ([]Dependency, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var out []Dependency
	err := r.db.WithContext(ctx).
		Where("service_id = ?", serviceID).
		Order("promoted DESC, last_seen_at DESC").
		Find(&out).Error
	return out, err
}

func (r *Repository) Promote(ctx context.Context, serviceID, depID uuid.UUID, promoted bool) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	res := r.db.WithContext(ctx).Model(&Dependency{}).
		Where("id = ? AND service_id = ?", depID, serviceID).
		Update("promoted", promoted)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, serviceID, depID uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	res := r.db.WithContext(ctx).
		Where("id = ? AND service_id = ?", depID, serviceID).
		Delete(&Dependency{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// PruneStale deletes non-promoted rows that haven't been observed for a while,
// so the discovery view doesn't slowly fill with one-off destinations.
func (r *Repository) PruneStale(ctx context.Context, olderThan time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cutoff := time.Now().Add(-olderThan)
	err := r.db.WithContext(ctx).
		Where("promoted = false AND last_seen_at < ?", cutoff).
		Delete(&Dependency{}).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return nil
}
