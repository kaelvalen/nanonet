package probes

import (
	"time"

	"github.com/google/uuid"
)

// Probe is a server-side synthetic check executed by the runner on a fixed
// interval. The runtime fields (LastRunAt etc.) are owned by the runner.
type Probe struct {
	ID                  uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID              uuid.UUID  `gorm:"type:uuid;not null;index"                       json:"user_id"`
	Name                string     `gorm:"type:varchar(120);not null"                     json:"name"                  binding:"required,min=2,max=120"`
	Kind                string     `gorm:"type:varchar(10);not null;default:'http'"       json:"kind"                  binding:"required,oneof=http tcp"`
	Target              string     `gorm:"type:varchar(500);not null"                     json:"target"                binding:"required,min=4,max=500"`
	Method              string     `gorm:"type:varchar(10);not null;default:'GET'"        json:"method"`
	ExpectedStatus      int        `gorm:"not null;default:200"                           json:"expected_status"`
	BodyContains        *string    `gorm:"type:text"                                       json:"body_contains,omitempty"`
	IntervalSeconds     int        `gorm:"not null;default:60"                            json:"interval_seconds"      binding:"min=30,max=3600"`
	TimeoutSeconds      int        `gorm:"not null;default:10"                            json:"timeout_seconds"       binding:"min=1,max=60"`
	Enabled             bool       `gorm:"not null;default:true"                          json:"enabled"`
	CreatedAt           time.Time  `gorm:"not null;default:now()"                         json:"created_at"`
	UpdatedAt           time.Time  `gorm:"not null;default:now()"                         json:"updated_at"`
	LastRunAt           *time.Time `                                                     json:"last_run_at,omitempty"`
	LastStatus          *string    `gorm:"type:varchar(10)"                                json:"last_status,omitempty"`
	LastLatencyMS       *int       `                                                     json:"last_latency_ms,omitempty"`
	LastError           *string    `gorm:"type:text"                                       json:"last_error,omitempty"`
	ConsecutiveFailures int        `gorm:"not null;default:0"                             json:"consecutive_failures"`
}

func (Probe) TableName() string { return "probes" }

// Run is a single execution record kept for the trend chart.
type Run struct {
	ID         int64     `gorm:"primaryKey"                          json:"id"`
	ProbeID    uuid.UUID `gorm:"type:uuid;not null;index"            json:"probe_id"`
	RanAt      time.Time `gorm:"not null;default:now()"              json:"ran_at"`
	Status     string    `gorm:"type:varchar(10);not null"           json:"status"`
	LatencyMS  int       `gorm:"not null"                            json:"latency_ms"`
	HTTPStatus *int      `gorm:"column:http_status"                  json:"http_status,omitempty"`
	Error      *string   `gorm:"type:text"                           json:"error,omitempty"`
}

func (Run) TableName() string { return "probe_runs" }

// CreateRequest mirrors the Probe payload accepted from the API.
type CreateRequest struct {
	Name            string  `json:"name"            binding:"required,min=2,max=120"`
	Kind            string  `json:"kind"            binding:"required,oneof=http tcp"`
	Target          string  `json:"target"          binding:"required,min=4,max=500"`
	Method          string  `json:"method,omitempty"`
	ExpectedStatus  int     `json:"expected_status,omitempty"`
	BodyContains    *string `json:"body_contains,omitempty"`
	IntervalSeconds int     `json:"interval_seconds" binding:"required,min=30,max=3600"`
	TimeoutSeconds  int     `json:"timeout_seconds"  binding:"required,min=1,max=60"`
	Enabled         *bool   `json:"enabled,omitempty"`
}

type UpdateRequest struct {
	Name            *string `json:"name,omitempty"            binding:"omitempty,min=2,max=120"`
	Target          *string `json:"target,omitempty"          binding:"omitempty,min=4,max=500"`
	Method          *string `json:"method,omitempty"`
	ExpectedStatus  *int    `json:"expected_status,omitempty"`
	BodyContains    *string `json:"body_contains,omitempty"`
	IntervalSeconds *int    `json:"interval_seconds,omitempty" binding:"omitempty,min=30,max=3600"`
	TimeoutSeconds  *int    `json:"timeout_seconds,omitempty"  binding:"omitempty,min=1,max=60"`
	Enabled         *bool   `json:"enabled,omitempty"`
}
