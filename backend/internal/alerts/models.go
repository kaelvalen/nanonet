package alerts

import (
	"time"

	"github.com/google/uuid"
)

type Alert struct {
	ID          uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ServiceID   uuid.UUID  `gorm:"type:uuid;not null" json:"service_id"`
	Type        string     `gorm:"type:varchar(50);not null" json:"type"`
	Severity    string     `gorm:"type:varchar(10);not null" json:"severity"`
	Message     string     `gorm:"type:text;not null" json:"message"`
	TriggeredAt time.Time  `gorm:"not null;default:now()" json:"triggered_at"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
}

type CreateAlertRequest struct {
	ServiceID uuid.UUID `json:"service_id" binding:"required"`
	Type      string    `json:"type" binding:"required"`
	Severity  string    `json:"severity" binding:"required,oneof=info warn crit"`
	Message   string    `json:"message" binding:"required"`
}

type AlertRule struct {
	CPUThreshold    float32
	MemoryThreshold float32
	LatencyThreshold float32
	ErrorRateThreshold float32
}

var DefaultAlertRules = AlertRule{
	CPUThreshold:       80.0,
	MemoryThreshold:    85.0,
	LatencyThreshold:   1000.0,
	ErrorRateThreshold: 5.0,
}
