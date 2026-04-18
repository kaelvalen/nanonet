package apitokens

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, t *Token) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now()
	}
	return r.db.WithContext(ctx).Create(t).Error
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Token, error) {
	var out []Token
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&out).Error
	return out, err
}

func (r *Repository) FindActiveByHash(ctx context.Context, hash string) (*Token, error) {
	var t Token
	err := r.db.WithContext(ctx).
		Where("token_hash = ? AND revoked_at IS NULL", hash).
		First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil //nolint:nilnil // intentional: no match
		}
		return nil, err
	}
	if t.ExpiresAt != nil && time.Now().After(*t.ExpiresAt) {
		return nil, nil //nolint:nilnil
	}
	return &t, nil
}

// Revoke marks an API token as revoked. Idempotent.
func (r *Repository) Revoke(ctx context.Context, userID, tokenID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&Token{}).
		Where("id = ? AND user_id = ? AND revoked_at IS NULL", tokenID, userID).
		Update("revoked_at", now).Error
}

// TouchLastUsed updates last_used_at to NOW. Best-effort; ignored on error.
func (r *Repository) TouchLastUsed(ctx context.Context, id uuid.UUID) {
	now := time.Now()
	_ = r.db.WithContext(ctx).
		Model(&Token{}).
		Where("id = ?", id).
		Update("last_used_at", now).Error
}

// FindByID returns a token row regardless of revoked/expiry status.
func (r *Repository) FindByID(ctx context.Context, userID, id uuid.UUID) (*Token, error) {
	var t Token
	err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil //nolint:nilnil
		}
		return nil, err
	}
	return &t, nil
}

// helper for handlers/tests that need to wrap a slice of strings as pq.StringArray.
func ToStringArray(s []string) pq.StringArray { return pq.StringArray(s) }
