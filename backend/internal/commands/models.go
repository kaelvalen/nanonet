package commands

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type CommandLog struct {
	ID          uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ServiceID   uuid.UUID       `gorm:"type:uuid;not null" json:"service_id"`
	UserID      uuid.UUID       `gorm:"type:uuid;not null" json:"user_id"`
	CommandID   string          `gorm:"type:varchar(100);not null" json:"command_id"`
	Action      string          `gorm:"type:varchar(50);not null" json:"action"`
	Status      string          `gorm:"type:varchar(20);not null;default:'queued'" json:"status"`
	Payload     json.RawMessage `gorm:"type:jsonb" json:"payload,omitempty"`
	QueuedAt    time.Time       `gorm:"not null;default:now()" json:"queued_at"`
	CompletedAt *time.Time      `json:"completed_at,omitempty"`
	DurationMS  *int            `json:"duration_ms,omitempty"`
}

func (CommandLog) TableName() string {
	return "command_logs"
}
