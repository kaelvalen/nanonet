package dependencies

import (
	"time"

	"github.com/google/uuid"
)

// Dependency is a single (target_host, target_port, protocol) triple that the
// agent observed our service connecting to. Rows are upserted: agents send
// every observation, the repo bumps sample_count + last_seen_at.
type Dependency struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ServiceID    uuid.UUID `gorm:"type:uuid;not null;index" json:"service_id"`
	TargetHost   string    `gorm:"type:varchar(255);not null" json:"target_host"`
	TargetPort   int       `gorm:"not null" json:"target_port"`
	Protocol     string    `gorm:"type:varchar(10);not null;default:'tcp'" json:"protocol"`
	ProcessName  *string   `gorm:"type:varchar(120)" json:"process_name,omitempty"`
	Promoted     bool      `gorm:"not null;default:false" json:"promoted"`
	SampleCount  int       `gorm:"not null;default:1" json:"sample_count"`
	FirstSeenAt  time.Time `gorm:"not null;default:now()" json:"first_seen_at"`
	LastSeenAt   time.Time `gorm:"not null;default:now()" json:"last_seen_at"`
}

func (Dependency) TableName() string { return "service_dependencies" }

// Observation is a single row reported by the agent.
type Observation struct {
	TargetHost  string  `json:"target_host"`
	TargetPort  int     `json:"target_port"`
	Protocol    string  `json:"protocol"`
	ProcessName *string `json:"process_name,omitempty"`
}
