package services

import (
	"time"

	"github.com/google/uuid"
)

type Service struct {
	ID              uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	Name            string     `gorm:"type:varchar(100);not null" json:"name"`
	Host            string     `gorm:"type:varchar(255);not null" json:"host"`
	Port            int        `gorm:"not null" json:"port"`
	HealthEndpoint  string     `gorm:"type:varchar(255);not null;default:'/health'" json:"health_endpoint"`
	PollIntervalSec int        `gorm:"not null;default:10" json:"poll_interval_sec"`
	Status          string     `gorm:"type:varchar(20);not null;default:'unknown'" json:"status"`
	AgentID         *uuid.UUID `gorm:"type:uuid" json:"agent_id,omitempty"`
	CreatedAt       time.Time  `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"not null;default:now()" json:"updated_at"`
}

type CreateServiceRequest struct {
	Name            string `json:"name" binding:"required,min=2,max=100"`
	Host            string `json:"host" binding:"required"`
	Port            int    `json:"port" binding:"required,min=1,max=65535"`
	HealthEndpoint  string `json:"health_endpoint" binding:"required"`
	PollIntervalSec int    `json:"poll_interval_sec" binding:"required,min=5,max=300"`
}

type UpdateServiceRequest struct {
	Name            *string `json:"name,omitempty" binding:"omitempty,min=2,max=100"`
	Host            *string `json:"host,omitempty"`
	Port            *int    `json:"port,omitempty" binding:"omitempty,min=1,max=65535"`
	HealthEndpoint  *string `json:"health_endpoint,omitempty"`
	PollIntervalSec *int    `json:"poll_interval_sec,omitempty" binding:"omitempty,min=5,max=300"`
}
