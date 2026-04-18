package apitokens

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Token is the persisted record (no plaintext secret).
type Token struct {
	ID         uuid.UUID      `gorm:"column:id;primaryKey" json:"id"`
	UserID     uuid.UUID      `gorm:"column:user_id"       json:"user_id"`
	Name       string         `gorm:"column:name"          json:"name"`
	Prefix     string         `gorm:"column:prefix"        json:"prefix"`
	TokenHash  string         `gorm:"column:token_hash"    json:"-"`
	Scopes     pq.StringArray `gorm:"column:scopes;type:text[]" json:"scopes"`
	LastUsedAt *time.Time     `gorm:"column:last_used_at"  json:"last_used_at,omitempty"`
	CreatedAt  time.Time      `gorm:"column:created_at"    json:"created_at"`
	ExpiresAt  *time.Time     `gorm:"column:expires_at"    json:"expires_at,omitempty"`
	RevokedAt  *time.Time     `gorm:"column:revoked_at"    json:"revoked_at,omitempty"`
}

func (Token) TableName() string { return "api_tokens" }

// CreateRequest is the JSON body for POST /api/v1/api-tokens.
type CreateRequest struct {
	Name      string   `json:"name"   binding:"required,max=120"`
	Scopes    []string `json:"scopes" binding:"required,min=1"`
	ExpiresIn int      `json:"expires_in_days"` // 0 = no expiry
}

// CreateResponse is returned only at create-time (contains the secret).
type CreateResponse struct {
	Token  Token  `json:"token"`
	Secret string `json:"secret"` // shown to the user exactly once
}

// AvailableScopes is the master list shown in the UI and validated server-side.
// Wildcard "*" implies every other scope.
var AvailableScopes = []string{
	"*",
	"services:read",
	"services:write",
	"alerts:read",
	"alerts:ack",
	"metrics:read",
	"logs:read",
	"incidents:read",
	"incidents:write",
	"ai:read",
	"slo:read",
}

func IsValidScope(s string) bool {
	for _, v := range AvailableScopes {
		if v == s {
			return true
		}
	}
	return false
}
