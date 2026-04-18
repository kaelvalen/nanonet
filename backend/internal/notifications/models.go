package notifications

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// ChannelType enumerates the supported destinations.
type ChannelType string

const (
	ChannelSlack     ChannelType = "slack"
	ChannelDiscord   ChannelType = "discord"
	ChannelWebhook   ChannelType = "webhook"
	ChannelEmail     ChannelType = "email"
	ChannelPagerDuty ChannelType = "pagerduty"
)

// JSONB is a thin gorm-friendly wrapper over a generic map serialized to/from
// jsonb. We use it for per-channel config so each driver can validate its own shape.
type JSONB map[string]any

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src any) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return errors.New("unsupported scan type for JSONB")
	}
}

// Channel is a single user-configured notification destination.
type Channel struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string         `gorm:"type:varchar(100);not null" json:"name"`
	Type        ChannelType    `gorm:"type:varchar(20);not null" json:"type"`
	Enabled     bool           `gorm:"not null;default:true" json:"enabled"`
	Config      JSONB          `gorm:"type:jsonb;not null;default:'{}'" json:"config"`
	Severities  pq.StringArray `gorm:"type:text[];not null;default:'{warn,crit}'" json:"severities"`
	ServiceIDs  pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"service_ids"`
	CooldownSec int            `gorm:"not null;default:300" json:"cooldown_sec"`
	LastUsedAt  *time.Time     `json:"last_used_at,omitempty"`
	LastError   *string        `json:"last_error,omitempty"`
	LastErrorAt *time.Time     `json:"last_error_at,omitempty"`
	CreatedAt   time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"not null;default:now()" json:"updated_at"`
}

func (Channel) TableName() string { return "notification_channels" }

// Delivery records a single send attempt for observability.
type Delivery struct {
	ID         uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ChannelID  uuid.UUID  `gorm:"type:uuid;not null;index" json:"channel_id"`
	AlertID    *uuid.UUID `gorm:"type:uuid" json:"alert_id,omitempty"`
	ServiceID  *uuid.UUID `gorm:"type:uuid" json:"service_id,omitempty"`
	Status     string     `gorm:"type:varchar(20);not null" json:"status"`
	HTTPStatus *int       `json:"http_status,omitempty"`
	Error      *string    `gorm:"type:text" json:"error,omitempty"`
	DurationMS *int       `json:"duration_ms,omitempty"`
	CreatedAt  time.Time  `gorm:"not null;default:now()" json:"created_at"`
}

func (Delivery) TableName() string { return "notification_deliveries" }

// CreateChannelRequest is the request body for POST /notifications/channels.
type CreateChannelRequest struct {
	Name        string      `json:"name"        binding:"required,min=1,max=100"`
	Type        ChannelType `json:"type"        binding:"required,oneof=slack discord webhook email pagerduty"`
	Enabled     *bool       `json:"enabled"`
	Config      JSONB       `json:"config"      binding:"required"`
	Severities  []string    `json:"severities"  binding:"omitempty,dive,oneof=info warn crit"`
	ServiceIDs  []string    `json:"service_ids" binding:"omitempty,dive,uuid"`
	CooldownSec *int        `json:"cooldown_sec" binding:"omitempty,gte=0,lte=86400"`
}

// UpdateChannelRequest is the request body for PUT /notifications/channels/:id.
type UpdateChannelRequest struct {
	Name        *string  `json:"name"        binding:"omitempty,min=1,max=100"`
	Enabled     *bool    `json:"enabled"`
	Config      JSONB    `json:"config"`
	Severities  []string `json:"severities"  binding:"omitempty,dive,oneof=info warn crit"`
	ServiceIDs  []string `json:"service_ids" binding:"omitempty,dive,uuid"`
	CooldownSec *int     `json:"cooldown_sec" binding:"omitempty,gte=0,lte=86400"`
}

// Event is the canonical payload handed to the dispatcher; channels translate it
// into their wire format (Slack blocks, Discord embeds, PagerDuty event, raw JSON…).
type Event struct {
	Kind        string     // "alert" | "alert_resolved" | "incident" | "test"
	Title       string     // short headline
	Message     string     // human-readable body
	Severity    string     // info | warn | crit
	ServiceID   *uuid.UUID // optional
	ServiceName string
	AlertID     *uuid.UUID
	AlertType   string
	Timestamp   time.Time
	URL         string // optional deep-link back into the dashboard
}
