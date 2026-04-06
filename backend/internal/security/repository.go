package security

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Save yeni bir tarama sonucunu kaydeder ve scan.ID + CreatedAt'ı doldurur.
// jsonb sütunlar için explicit cast kullanır; pgx/database-sql otomatik
// tip dönüşümü yapmadığından GORM Create/serializer yaklaşımı kırılır.
func (r *Repository) Save(ctx context.Context, scan *Scan) error {
	missingJSON, err := json.Marshal(scan.MissingHeaders)
	if err != nil {
		missingJSON = []byte("[]")
	}
	findingsJSON, err := json.Marshal(scan.Findings)
	if err != nil {
		findingsJSON = []byte("[]")
	}

	return r.db.WithContext(ctx).Raw(`
		INSERT INTO security_scans
			(service_id, scanned_at, tls_enabled, tls_valid, tls_expiry, tls_days_left,
			 tls_issuer, tls_version, missing_headers, server_header,
			 redirect_to_https, risk_score, findings)
		VALUES
			(?, ?, ?, ?, ?, ?,
			 ?, ?, ?::jsonb, ?,
			 ?, ?, ?::jsonb)
		RETURNING id, created_at
	`,
		scan.ServiceID, scan.ScannedAt, scan.TLSEnabled, scan.TLSValid,
		scan.TLSExpiry, scan.TLSDaysLeft,
		scan.TLSIssuer, scan.TLSVersion, string(missingJSON), scan.ServerHeader,
		scan.RedirectToHTTPS, scan.RiskScore, string(findingsJSON),
	).Row().Scan(&scan.ID, &scan.CreatedAt)
}

// GetLatestPerService kullanıcıya ait her servisin son tarama sonucunu döndürür.
func (r *Repository) GetLatestPerService(ctx context.Context, userID uuid.UUID) ([]Scan, error) {
	rows, err := r.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (ss.service_id)
			ss.id, ss.service_id, ss.scanned_at, ss.tls_enabled, ss.tls_valid,
			ss.tls_expiry, ss.tls_days_left, ss.tls_issuer, ss.tls_version,
			ss.missing_headers, ss.server_header, ss.redirect_to_https,
			ss.risk_score, ss.findings, ss.created_at
		FROM security_scans ss
		JOIN services s ON s.id = ss.service_id
		WHERE s.user_id = ?
		ORDER BY ss.service_id, ss.scanned_at DESC
	`, userID).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRows(rows)
}

// GetForService bir servisin tarama geçmişini döndürür.
func (r *Repository) GetForService(ctx context.Context, serviceID uuid.UUID, limit int) ([]Scan, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := r.db.WithContext(ctx).Raw(`
		SELECT id, service_id, scanned_at, tls_enabled, tls_valid,
			tls_expiry, tls_days_left, tls_issuer, tls_version,
			missing_headers, server_header, redirect_to_https,
			risk_score, findings, created_at
		FROM security_scans
		WHERE service_id = ?
		ORDER BY scanned_at DESC
		LIMIT ?
	`, serviceID, limit).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRows(rows)
}

// scanRows *sql.Rows'u Scan dilimine dönüştürür.
func scanRows(rows *sql.Rows) ([]Scan, error) {
	var result []Scan
	for rows.Next() {
		var s Scan
		var missingRaw, findingsRaw []byte
		err := rows.Scan(
			&s.ID, &s.ServiceID, &s.ScannedAt, &s.TLSEnabled, &s.TLSValid,
			&s.TLSExpiry, &s.TLSDaysLeft, &s.TLSIssuer, &s.TLSVersion,
			&missingRaw, &s.ServerHeader, &s.RedirectToHTTPS,
			&s.RiskScore, &findingsRaw, &s.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if len(missingRaw) > 0 {
			_ = json.Unmarshal(missingRaw, &s.MissingHeaders)
		}
		if s.MissingHeaders == nil {
			s.MissingHeaders = []string{}
		}
		if len(findingsRaw) > 0 {
			_ = json.Unmarshal(findingsRaw, &s.Findings)
		}
		if s.Findings == nil {
			s.Findings = []Finding{}
		}
		result = append(result, s)
	}
	return result, rows.Err()
}
