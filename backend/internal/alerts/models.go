package alerts

import (
	"context"
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

// AlertRule holds per-service alert thresholds. The zero value is not usable;
// use DefaultAlertRules or load from the service_alert_rules table.
type AlertRule struct {
	CPUThreshold       float32
	MemoryThreshold    float32
	LatencyThreshold   float32
	ErrorRateThreshold float32
}

// DefaultAlertRules are applied when no per-service rule exists.
var DefaultAlertRules = AlertRule{
	CPUThreshold:       80.0,
	MemoryThreshold:    2048.0, // MB — was 85.0 (MB, not %)
	LatencyThreshold:   1000.0,
	ErrorRateThreshold: 5.0,
}

// ServiceAlertRule is the persisted, per-service alert threshold config.
type ServiceAlertRule struct {
	ServiceID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"service_id"`
	CPUThreshold       float32   `json:"cpu_threshold"`
	MemoryThresholdMB  float32   `json:"memory_threshold_mb"`
	LatencyThresholdMS float32   `json:"latency_threshold_ms"`
	ErrorRateThreshold float32   `json:"error_rate_threshold"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (ServiceAlertRule) TableName() string { return "service_alert_rules" }

// maintenanceChecker is satisfied by maintenance.Repository without a direct import cycle.
type maintenanceChecker interface {
	IsActiveNow(ctx context.Context, serviceID uuid.UUID) (bool, error)
}
