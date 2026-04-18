package notifications

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

func (r *Repository) Create(ctx context.Context, ch *Channel) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return r.db.WithContext(ctx).Create(ch).Error
}

func (r *Repository) Update(ctx context.Context, ch *Channel) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	ch.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(ch).Error
}

func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	res := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&Channel{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, userID, id uuid.UUID) (*Channel, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var ch Channel
	if err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&ch).Error; err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Channel, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var out []Channel
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at ASC").
		Find(&out).Error
	return out, err
}

// EnabledChannelsForService returns every enabled channel that should receive
// events for the given service & severity. service may be nil for non-service
// events; in that case only channels with empty service_ids match.
func (r *Repository) EnabledChannelsForService(ctx context.Context, userID uuid.UUID, serviceID *uuid.UUID, severity string) ([]Channel, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	q := r.db.WithContext(ctx).
		Model(&Channel{}).
		Where("user_id = ? AND enabled = true", userID).
		Where("? = ANY(severities)", severity)

	if serviceID != nil {
		// match if filter empty OR includes this service
		q = q.Where("cardinality(service_ids) = 0 OR ?::text = ANY(service_ids)", serviceID.String())
	} else {
		q = q.Where("cardinality(service_ids) = 0")
	}

	var out []Channel
	err := q.Find(&out).Error
	return out, err
}

func (r *Repository) MarkUsed(ctx context.Context, id uuid.UUID, errMsg string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	now := time.Now()
	updates := map[string]any{"last_used_at": now, "updated_at": now}
	if errMsg == "" {
		updates["last_error"] = nil
		updates["last_error_at"] = nil
	} else {
		updates["last_error"] = errMsg
		updates["last_error_at"] = now
	}
	return r.db.WithContext(ctx).
		Model(&Channel{}).
		Where("id = ?", id).
		Updates(updates).Error
}

func (r *Repository) RecordDelivery(ctx context.Context, d *Delivery) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return r.db.WithContext(ctx).Create(d).Error
}

func (r *Repository) ListDeliveries(ctx context.Context, channelID uuid.UUID, limit int) ([]Delivery, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var out []Delivery
	err := r.db.WithContext(ctx).
		Where("channel_id = ?", channelID).
		Order("created_at DESC").
		Limit(limit).
		Find(&out).Error
	return out, err
}
