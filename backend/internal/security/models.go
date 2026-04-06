package security

import (
	"time"

	"github.com/google/uuid"
)

// Finding tek bir güvenlik bulgusu.
type Finding struct {
	Type        string `json:"type"`
	Severity    string `json:"severity"` // "low" | "medium" | "high" | "critical"
	Description string `json:"description"`
}

// Scan bir servis için tek bir güvenlik tarama sonucu.
type Scan struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ServiceID       uuid.UUID  `gorm:"type:uuid;not null"                            json:"service_id"`
	ScannedAt       time.Time  `gorm:"not null;default:now()"                        json:"scanned_at"`
	TLSEnabled      bool       `gorm:"not null;default:false"                        json:"tls_enabled"`
	TLSValid        bool       `gorm:"not null;default:false"                        json:"tls_valid"`
	TLSExpiry       *time.Time `                                                     json:"tls_expiry,omitempty"`
	TLSDaysLeft     *int       `                                                     json:"tls_days_left,omitempty"`
	TLSIssuer       string     `gorm:"type:text;not null;default:''"                 json:"tls_issuer"`
	TLSVersion      string     `gorm:"type:text;not null;default:''"                 json:"tls_version"`
	MissingHeaders  []string   `gorm:"-"                                             json:"missing_headers"`
	ServerHeader    string     `gorm:"type:text;not null;default:''"                 json:"server_header"`
	RedirectToHTTPS bool       `gorm:"not null;default:false"                        json:"redirect_to_https"`
	RiskScore       float64    `gorm:"not null;default:0"                            json:"risk_score"`
	Findings        []Finding  `gorm:"-"                                             json:"findings"`
	CreatedAt       time.Time  `gorm:"not null;default:now()"                        json:"created_at"`
}

func (Scan) TableName() string { return "security_scans" }

// ServiceScanSummary bir servisin son tarama sonucu + servis meta.
type ServiceScanSummary struct {
	ServiceID   uuid.UUID `json:"service_id"`
	ServiceName string    `json:"service_name"`
	ServiceHost string    `json:"service_host"`
	ServicePort int       `json:"service_port"`
	LatestScan  *Scan     `json:"latest_scan,omitempty"`
}

// OverviewResponse tüm servislerin güvenlik özetini içerir.
type OverviewResponse struct {
	SecurityScore float64              `json:"security_score"`
	TLSWarnings   int                  `json:"tls_warnings"`
	HeaderIssues  int                  `json:"header_issues"`
	Services      []ServiceScanSummary `json:"services"`
}
