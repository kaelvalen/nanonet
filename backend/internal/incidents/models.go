package incidents

import (
	"time"

	"github.com/google/uuid"
)

// Incident is a logical grouping of one or more correlated alerts on the
// same service. We treat it as the "outage object" UI/postmortems hang off.
type Incident struct {
	ID         uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	ServiceID  uuid.UUID  `gorm:"type:uuid;not null;index" json:"service_id"`
	Title      string     `gorm:"type:varchar(200);not null" json:"title"`
	Severity   string     `gorm:"type:varchar(10);not null" json:"severity"`
	Summary    *string    `gorm:"type:text" json:"summary,omitempty"`
	Postmortem *string    `gorm:"type:text" json:"postmortem,omitempty"`
	StartedAt  time.Time  `gorm:"not null;default:now()" json:"started_at"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
	CreatedAt  time.Time  `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt  time.Time  `gorm:"not null;default:now()" json:"updated_at"`
}

func (Incident) TableName() string { return "incidents" }

// IncidentAlert is the join row binding alerts to an incident.
type IncidentAlert struct {
	IncidentID uuid.UUID `gorm:"type:uuid;primaryKey" json:"incident_id"`
	AlertID    uuid.UUID `gorm:"type:uuid;primaryKey" json:"alert_id"`
}

func (IncidentAlert) TableName() string { return "incident_alerts" }

// UpdateRequest is used by PATCH /incidents/:id to edit the human bits
// (summary, postmortem) without touching the auto-managed fields.
type UpdateRequest struct {
	Title      *string `json:"title"      binding:"omitempty,min=1,max=200"`
	Summary    *string `json:"summary"`
	Postmortem *string `json:"postmortem"`
}

// TimelineEvent is the union row returned by GET /incidents/:id.
// Kind drives which fields are populated.
type TimelineEvent struct {
	Kind      string    `json:"kind"` // "alert" | "alert_resolved" | "command" | "status_change"
	Timestamp time.Time `json:"timestamp"`
	Title     string    `json:"title"`
	Detail    string    `json:"detail,omitempty"`
	Severity  string    `json:"severity,omitempty"`
}

// Detail bundles an Incident with its denormalized timeline + service name.
type Detail struct {
	Incident    Incident        `json:"incident"`
	ServiceName string          `json:"service_name"`
	AlertCount  int             `json:"alert_count"`
	Timeline    []TimelineEvent `json:"timeline"`
}

// ListItem is a lightweight projection for the index page.
type ListItem struct {
	Incident
	ServiceName string `json:"service_name"`
	AlertCount  int    `json:"alert_count"`
}
