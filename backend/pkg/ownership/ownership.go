package ownership

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IsServiceOwner reports whether serviceID belongs to userID.
// Single authoritative implementation — used by all packages instead of duplicating the query.
func IsServiceOwner(ctx context.Context, db *gorm.DB, serviceID, userID uuid.UUID) bool {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var count int64
	db.WithContext(ctx).
		Table("services").
		Where("id = ? AND user_id = ?", serviceID, userID).
		Count(&count)
	return count > 0
}
