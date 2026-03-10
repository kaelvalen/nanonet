package maintenance

import (
	"time"

	"github.com/google/uuid"
)

type MaintenanceWindow struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ServiceID uuid.UUID  `gorm:"type:uuid;not null" json:"service_id"`
	StartsAt  time.Time  `json:"starts_at"`
	EndsAt    time.Time  `json:"ends_at"`
	Reason    *string    `json:"reason,omitempty"`
	CreatedBy *uuid.UUID `gorm:"type:uuid" json:"created_by,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

func (MaintenanceWindow) TableName() string { return "maintenance_windows" }

type CreateRequest struct {
	StartsAt string  `json:"starts_at" binding:"required"`
	EndsAt   string  `json:"ends_at" binding:"required"`
	Reason   *string `json:"reason"`
}
