package services

import (
	"net"
	"net/url"
	"regexp"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	ID                   uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID               uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	Name                 string     `gorm:"type:varchar(100);not null" json:"name"`
	Host                 string     `gorm:"type:varchar(255);not null" json:"host"`
	Port                 int        `gorm:"not null" json:"port"`
	HealthEndpoint       string     `gorm:"type:varchar(255);not null;default:'/health'" json:"health_endpoint"`
	PollIntervalSec      int        `gorm:"not null;default:10" json:"poll_interval_sec"`
	Status               string     `gorm:"type:varchar(20);not null;default:'unknown'" json:"status"`
	AgentID              *uuid.UUID `gorm:"type:uuid" json:"agent_id,omitempty"`
	AgentVersion         *string    `gorm:"column:agent_version" json:"agent_version,omitempty"`
	AgentLastHeartbeatAt *time.Time `gorm:"column:agent_last_heartbeat_at" json:"agent_last_heartbeat_at,omitempty"`
	AgentStatus          string     `gorm:"column:agent_status;not null;default:'unknown'" json:"agent_status"`
	CreatedAt            time.Time  `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt            time.Time  `gorm:"not null;default:now()" json:"updated_at"`
}

type CreateServiceRequest struct {
	Name            string `json:"name" binding:"required,min=2,max=100"`
	Host            string `json:"host" binding:"required"`
	Port            int    `json:"port" binding:"required,min=1,max=65535"`
	HealthEndpoint  string `json:"health_endpoint" binding:"required"`
	PollIntervalSec int    `json:"poll_interval_sec" binding:"required,min=5,max=300"`
}

var hostnameRegex = regexp.MustCompile(`^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))*$`)

func (r *CreateServiceRequest) Validate() map[string]string {
	errors := make(map[string]string)

	// Validate host is either IP or valid hostname
	if net.ParseIP(r.Host) == nil {
		if !hostnameRegex.MatchString(r.Host) {
			if _, err := url.Parse(r.Host); err != nil {
				errors["host"] = "must be a valid IP address, hostname, or URL"
			}
		}
	}

	if len(r.HealthEndpoint) > 255 {
		errors["health_endpoint"] = "must be less than 255 characters"
	}

	return errors
}

type UpdateServiceRequest struct {
	Name            *string `json:"name,omitempty" binding:"omitempty,min=2,max=100"`
	Host            *string `json:"host,omitempty"`
	Port            *int    `json:"port,omitempty" binding:"omitempty,min=1,max=65535"`
	HealthEndpoint  *string `json:"health_endpoint,omitempty"`
	PollIntervalSec *int    `json:"poll_interval_sec,omitempty" binding:"omitempty,min=5,max=300"`
}

func (r *UpdateServiceRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if r.Host != nil {
		if net.ParseIP(*r.Host) == nil {
			if !hostnameRegex.MatchString(*r.Host) {
				if _, err := url.Parse(*r.Host); err != nil {
					errors["host"] = "must be a valid IP address, hostname, or URL"
				}
			}
		}
	}

	if r.HealthEndpoint != nil && len(*r.HealthEndpoint) > 255 {
		errors["health_endpoint"] = "must be less than 255 characters"
	}

	return errors
}
