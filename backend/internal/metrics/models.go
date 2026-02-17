package metrics

import (
	"time"

	"github.com/google/uuid"
)

type Metric struct {
	Time          time.Time `gorm:"primaryKey" json:"time"`
	ServiceID     uuid.UUID `gorm:"type:uuid;primaryKey;not null" json:"service_id"`
	CPUPercent    *float32  `json:"cpu_percent,omitempty"`
	MemoryUsedMB  *float32  `json:"memory_used_mb,omitempty"`
	LatencyMS     *float32  `json:"latency_ms,omitempty"`
	ErrorRate     *float32  `gorm:"default:0.0" json:"error_rate,omitempty"`
	Status        string    `gorm:"type:varchar(20)" json:"status"`
	DiskUsedGB    *float32  `json:"disk_used_gb,omitempty"`
}

type MetricSnapshot struct {
	Time          time.Time `json:"time"`
	CPUPercent    float32   `json:"cpu_percent"`
	MemoryUsedMB  float32   `json:"memory_used_mb"`
	LatencyMS     float32   `json:"latency_ms"`
	ErrorRate     float32   `json:"error_rate"`
	Status        string    `json:"status"`
	DiskUsedGB    float32   `json:"disk_used_gb"`
}
