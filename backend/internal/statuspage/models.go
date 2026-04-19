package statuspage

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// StatusPage is a curated, public, read-only view over a subset of services.
type StatusPage struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Slug        string         `gorm:"type:varchar(64);not null;uniqueIndex" json:"slug"`
	Title       string         `gorm:"type:varchar(120);not null" json:"title"`
	Description *string        `gorm:"type:text" json:"description,omitempty"`
	ServiceIDs  pq.StringArray `gorm:"type:uuid[];not null;default:'{}'" json:"service_ids"`
	Enabled     bool           `gorm:"not null;default:true" json:"enabled"`
	CreatedAt   time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"not null;default:now()" json:"updated_at"`
}

func (StatusPage) TableName() string { return "status_pages" }

type CreateRequest struct {
	Slug        string   `json:"slug"        binding:"required,min=3,max=64"`
	Title       string   `json:"title"       binding:"required,min=1,max=120"`
	Description *string  `json:"description"`
	ServiceIDs  []string `json:"service_ids" binding:"required,dive,uuid"`
	Enabled     *bool    `json:"enabled"`
}

type UpdateRequest struct {
	Title       *string  `json:"title"       binding:"omitempty,min=1,max=120"`
	Description *string  `json:"description"`
	ServiceIDs  []string `json:"service_ids" binding:"omitempty,dive,uuid"`
	Enabled     *bool    `json:"enabled"`
}

// PublicView is the unauthenticated payload returned to anonymous visitors.
// We deliberately omit IDs and any owner metadata.
type PublicView struct {
	Title       string           `json:"title"`
	Description *string          `json:"description,omitempty"`
	GeneratedAt time.Time        `json:"generated_at"`
	Overall     string           `json:"overall"` // operational | degraded | down
	Services    []PublicService  `json:"services"`
	Incidents   []PublicIncident `json:"incidents"`
}

type PublicService struct {
	Name      string   `json:"name"`
	Status    string   `json:"status"`     // up | degraded | down | unknown
	Uptime24h float64  `json:"uptime_24h"` // 0-100
	Uptime30d float64  `json:"uptime_30d"` // 0-100
	LatencyMS *float64 `json:"latency_ms,omitempty"`
}

type PublicIncident struct {
	Title     string    `json:"title"`
	Severity  string    `json:"severity"`
	StartedAt time.Time `json:"started_at"`
	Resolved  bool      `json:"resolved"`
}
