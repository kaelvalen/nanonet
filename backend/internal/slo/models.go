package slo

import (
	"time"

	"github.com/google/uuid"
)

type SLI string

const (
	SLIAvailability SLI = "availability"
	SLILatency      SLI = "latency"
	SLIErrorRate    SLI = "error_rate"
)

// SLO is a per-service objective. We deliberately model it as a self-contained
// row with both the SLI definition and the objective: this keeps reads cheap
// and makes the math obvious.
type SLO struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	ServiceID  uuid.UUID `gorm:"type:uuid;not null;index" json:"service_id"`
	Name       string    `gorm:"type:varchar(120);not null" json:"name"`
	SLIType    SLI       `gorm:"type:varchar(20);not null" json:"sli_type"`
	Threshold  *float64  `json:"threshold,omitempty"`    // ms or %
	Target     float64   `gorm:"not null" json:"target"` // e.g. 99.9
	WindowDays int       `gorm:"not null;default:30" json:"window_days"`
	Enabled    bool      `gorm:"not null;default:true" json:"enabled"`
	CreatedAt  time.Time `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt  time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (SLO) TableName() string { return "slos" }

type CreateSLORequest struct {
	ServiceID  uuid.UUID `json:"service_id"  binding:"required"`
	Name       string    `json:"name"        binding:"required,min=1,max=120"`
	SLIType    SLI       `json:"sli_type"    binding:"required,oneof=availability latency error_rate"`
	Threshold  *float64  `json:"threshold"`
	Target     float64   `json:"target"      binding:"required,gt=0,lt=100"`
	WindowDays int       `json:"window_days" binding:"required,min=1,max=90"`
}

type UpdateSLORequest struct {
	Name       *string  `json:"name"        binding:"omitempty,min=1,max=120"`
	SLIType    *SLI     `json:"sli_type"    binding:"omitempty,oneof=availability latency error_rate"`
	Threshold  *float64 `json:"threshold"`
	Target     *float64 `json:"target"      binding:"omitempty,gt=0,lt=100"`
	WindowDays *int     `json:"window_days" binding:"omitempty,min=1,max=90"`
	Enabled    *bool    `json:"enabled"`
}

// Compliance is the computed view returned by GET /slos/:id/compliance.
type Compliance struct {
	SLO             SLO             `json:"slo"`
	WindowStart     time.Time       `json:"window_start"`
	WindowEnd       time.Time       `json:"window_end"`
	TotalSamples    int             `json:"total_samples"`
	GoodSamples     int             `json:"good_samples"`
	BadSamples      int             `json:"bad_samples"`
	CurrentSLI      float64         `json:"current_sli"`       // 0-100
	ErrorBudgetUsed float64         `json:"error_budget_used"` // 0-100, % of allowed errors consumed
	BurnRate        float64         `json:"burn_rate"`         // current burn vs target
	Healthy         bool            `json:"healthy"`           // current_sli >= target
	Burndown        []BurndownPoint `json:"burndown"`
}

type BurndownPoint struct {
	Timestamp       time.Time `json:"timestamp"`
	BudgetRemaining float64   `json:"budget_remaining"` // %
	SLI             float64   `json:"sli"`
}
