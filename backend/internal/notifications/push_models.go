package notifications

import (
	"time"

	"github.com/google/uuid"
)

type UserPushToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Token     string    `gorm:"type:text;unique;not null" json:"token"`
	Platform  string    `gorm:"type:varchar(10);not null" json:"platform"`
	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
}

func (UserPushToken) TableName() string { return "user_push_tokens" }

type UserPushPreference struct {
	UserID      uuid.UUID `gorm:"type:uuid;primary_key" json:"user_id"`
	Enabled     bool      `gorm:"not null;default:true" json:"enabled"`
	MinSeverity string    `gorm:"type:varchar(10);not null;default:'warn'" json:"min_severity"`
	UpdatedAt   time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (UserPushPreference) TableName() string { return "user_push_preferences" }

type RegisterPushTokenRequest struct {
	Token    string `json:"token" binding:"required"`
	Platform string `json:"platform" binding:"required,oneof=ios android"`
}

type UpdatePushPreferenceRequest struct {
	Enabled     *bool   `json:"enabled"`
	MinSeverity *string `json:"min_severity" binding:"omitempty,oneof=info warn crit"`
}
