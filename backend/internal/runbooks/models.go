package runbooks

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// JSONMap is a small JSONB shim that GORM can read from / write to without
// pulling in datatypes.JSON.
type JSONMap map[string]any

func (m JSONMap) Value() (driver.Value, error) { return json.Marshal(m) }

func (m *JSONMap) Scan(src any) error {
	if src == nil {
		*m = JSONMap{}
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, m)
	case string:
		return json.Unmarshal([]byte(v), m)
	default:
		return errors.New("runbooks.JSONMap: unsupported scan type")
	}
}

// Runbook is a user-defined "when alert X fires, do Y" rule.
type Runbook struct {
	ID              uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null;index"                       json:"user_id"`
	Name            string     `gorm:"type:varchar(120);not null"                     json:"name"             binding:"required,min=2,max=120"`
	ServiceID       *uuid.UUID `gorm:"type:uuid"                                       json:"service_id,omitempty"`
	AlertType       string     `gorm:"type:varchar(40);not null"                      json:"alert_type"        binding:"required"`
	MinSeverity     string     `gorm:"type:varchar(10);not null;default:'warn'"       json:"min_severity"      binding:"required,oneof=info warn crit"`
	Action          string     `gorm:"type:varchar(30);not null"                      json:"action"            binding:"required,oneof=restart stop start exec scale webhook"`
	Args            JSONMap    `gorm:"type:jsonb;not null;default:'{}'::jsonb"        json:"args"`
	Enabled         bool       `gorm:"not null;default:true"                          json:"enabled"`
	CooldownSeconds int        `gorm:"not null;default:600"                           json:"cooldown_seconds"  binding:"min=0,max=86400"`
	MaxPerHour      int        `gorm:"not null;default:6"                             json:"max_per_hour"      binding:"min=1,max=60"`
	LastFiredAt     *time.Time `                                                     json:"last_fired_at,omitempty"`
	FireCount       int64      `gorm:"not null;default:0"                             json:"fire_count"`
	CreatedAt       time.Time  `gorm:"not null;default:now()"                         json:"created_at"`
	UpdatedAt       time.Time  `gorm:"not null;default:now()"                         json:"updated_at"`
}

func (Runbook) TableName() string { return "runbooks" }

// Fire is an audit record of one execution attempt.
type Fire struct {
	ID         int64     `gorm:"primaryKey"               json:"id"`
	RunbookID  uuid.UUID `gorm:"type:uuid;not null;index" json:"runbook_id"`
	ServiceID  uuid.UUID `gorm:"type:uuid;not null"       json:"service_id"`
	AlertID    *uuid.UUID `gorm:"type:uuid"               json:"alert_id,omitempty"`
	FiredAt    time.Time `gorm:"not null;default:now()"   json:"fired_at"`
	Status     string    `gorm:"type:varchar(20);not null" json:"status"`
	Note       *string   `gorm:"type:text"                 json:"note,omitempty"`
}

func (Fire) TableName() string { return "runbook_fires" }

type CreateRequest struct {
	Name            string     `json:"name"            binding:"required,min=2,max=120"`
	ServiceID       *uuid.UUID `json:"service_id,omitempty"`
	AlertType       string     `json:"alert_type"      binding:"required"`
	MinSeverity     string     `json:"min_severity"    binding:"required,oneof=info warn crit"`
	Action          string     `json:"action"          binding:"required,oneof=restart stop start exec scale webhook"`
	Args            JSONMap    `json:"args,omitempty"`
	Enabled         *bool      `json:"enabled,omitempty"`
	CooldownSeconds int        `json:"cooldown_seconds" binding:"min=0,max=86400"`
	MaxPerHour      int        `json:"max_per_hour"     binding:"min=1,max=60"`
}

type UpdateRequest struct {
	Name            *string    `json:"name,omitempty"            binding:"omitempty,min=2,max=120"`
	ServiceID       *uuid.UUID `json:"service_id,omitempty"`
	AlertType       *string    `json:"alert_type,omitempty"`
	MinSeverity     *string    `json:"min_severity,omitempty"    binding:"omitempty,oneof=info warn crit"`
	Action          *string    `json:"action,omitempty"          binding:"omitempty,oneof=restart stop start exec scale webhook"`
	Args            *JSONMap   `json:"args,omitempty"`
	Enabled         *bool      `json:"enabled,omitempty"`
	CooldownSeconds *int       `json:"cooldown_seconds,omitempty" binding:"omitempty,min=0,max=86400"`
	MaxPerHour      *int       `json:"max_per_hour,omitempty"     binding:"omitempty,min=1,max=60"`
}
