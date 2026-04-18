package ownership

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Role represents the access level a user has on a service.
type Role string

const (
	RoleNone     Role = ""
	RoleViewer   Role = "viewer"
	RoleOperator Role = "operator"
	RoleAdmin    Role = "admin"
	RoleOwner    Role = "owner"
)

// roleRank gives each role a numeric weight so we can compare with `>=`.
func roleRank(r Role) int {
	switch r {
	case RoleViewer:
		return 1
	case RoleOperator:
		return 2
	case RoleAdmin:
		return 3
	case RoleOwner:
		return 4
	default:
		return 0
	}
}

// AtLeast reports whether `have` satisfies `min`.
func AtLeast(have, min Role) bool { return roleRank(have) >= roleRank(min) }

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

// ServiceRole returns the highest role the user has on serviceID. Returns
// RoleNone when the user has no access at all. Owners always come back as
// RoleOwner regardless of any duplicate grant rows.
func ServiceRole(ctx context.Context, db *gorm.DB, serviceID, userID uuid.UUID) Role {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if IsServiceOwner(ctx, db, serviceID, userID) {
		return RoleOwner
	}
	var role string
	err := db.WithContext(ctx).
		Table("service_grants").
		Select("role").
		Where("service_id = ? AND grantee_user_id = ?", serviceID, userID).
		Scan(&role).Error
	if err != nil || role == "" {
		return RoleNone
	}
	return Role(role)
}

// HasServiceAccess reports whether userID's role on serviceID meets `min`.
// Owners satisfy any role requirement.
func HasServiceAccess(ctx context.Context, db *gorm.DB, serviceID, userID uuid.UUID, min Role) bool {
	return AtLeast(ServiceRole(ctx, db, serviceID, userID), min)
}

// AccessibleServiceIDs returns every service id the user can read (owned +
// granted). Used by list endpoints that previously filtered only by user_id.
func AccessibleServiceIDs(ctx context.Context, db *gorm.DB, userID uuid.UUID) ([]uuid.UUID, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var ids []uuid.UUID
	err := db.WithContext(ctx).Raw(`
		SELECT id FROM services WHERE user_id = ?
		UNION
		SELECT service_id FROM service_grants WHERE grantee_user_id = ?
	`, userID, userID).Scan(&ids).Error
	return ids, err
}
