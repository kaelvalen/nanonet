package incidents

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, in *Incident) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return r.db.WithContext(ctx).Create(in).Error
}

func (r *Repository) Save(ctx context.Context, in *Incident) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	in.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(in).Error
}

func (r *Repository) Get(ctx context.Context, userID, id uuid.UUID) (*Incident, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var in Incident
	if err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&in).Error; err != nil {
		return nil, err
	}
	return &in, nil
}

func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	res := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&Incident{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// FindOpenForService returns the most recent unresolved incident for a service,
// provided it started within the correlation window. Used by the auto-grouper.
func (r *Repository) FindOpenForService(ctx context.Context, serviceID uuid.UUID, window time.Duration) (*Incident, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var in Incident
	err := r.db.WithContext(ctx).
		Where("service_id = ? AND resolved_at IS NULL AND started_at > ?", serviceID, time.Now().Add(-window)).
		Order("started_at DESC").
		First(&in).Error
	if err != nil {
		return nil, err
	}
	return &in, nil
}

func (r *Repository) AttachAlert(ctx context.Context, incidentID, alertID uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	// ON CONFLICT DO NOTHING so re-attaching the same alert is idempotent.
	return r.db.WithContext(ctx).Exec(`
		INSERT INTO incident_alerts (incident_id, alert_id)
		VALUES (?, ?)
		ON CONFLICT DO NOTHING
	`, incidentID, alertID).Error
}

// CountAlerts returns how many alerts are attached.
func (r *Repository) CountAlerts(ctx context.Context, incidentID uuid.UUID) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var n int64
	err := r.db.WithContext(ctx).
		Table("incident_alerts").
		Where("incident_id = ?", incidentID).
		Count(&n).Error
	return int(n), err
}

// AnyOpenAlerts reports whether the incident has at least one un-resolved alert.
func (r *Repository) AnyOpenAlerts(ctx context.Context, incidentID uuid.UUID) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var n int64
	err := r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM incident_alerts ia
		JOIN alerts a ON a.id = ia.alert_id
		WHERE ia.incident_id = ? AND a.resolved_at IS NULL
	`, incidentID).Scan(&n).Error
	return n > 0, err
}

// LastAlertResolvedAt returns the most recent resolved_at across the
// incident's attached alerts. Used to set incident.resolved_at.
func (r *Repository) LastAlertResolvedAt(ctx context.Context, incidentID uuid.UUID) (*time.Time, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var t *time.Time
	err := r.db.WithContext(ctx).Raw(`
		SELECT MAX(a.resolved_at)
		FROM incident_alerts ia
		JOIN alerts a ON a.id = ia.alert_id
		WHERE ia.incident_id = ?
	`, incidentID).Scan(&t).Error
	return t, err
}

// IncidentIDsForAlert returns every incident an alert is attached to. We only
// expect a single row, but the join is many-to-many so we treat it as a slice.
func (r *Repository) IncidentIDsForAlert(ctx context.Context, alertID uuid.UUID) ([]uuid.UUID, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var ids []uuid.UUID
	err := r.db.WithContext(ctx).Raw(`
		SELECT incident_id FROM incident_alerts WHERE alert_id = ?
	`, alertID).Scan(&ids).Error
	return ids, err
}

// ListByUser returns incidents joined with their service name, newest first.
func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]ListItem, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	type row struct {
		Incident
		ServiceName string `gorm:"column:service_name"`
		AlertCount  int    `gorm:"column:alert_count"`
	}
	var rows []row
	err := r.db.WithContext(ctx).Raw(`
		SELECT i.*,
		       s.name AS service_name,
		       COALESCE((SELECT COUNT(*) FROM incident_alerts ia WHERE ia.incident_id = i.id), 0) AS alert_count
		FROM incidents i
		JOIN services s ON s.id = i.service_id
		WHERE i.user_id = ?
		ORDER BY i.started_at DESC
		LIMIT ?
	`, userID, limit).Scan(&rows).Error
	out := make([]ListItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, ListItem(r))
	}
	return out, err
}

// AttachedAlerts returns the alerts bound to an incident in chronological order.
func (r *Repository) AttachedAlerts(ctx context.Context, incidentID uuid.UUID) ([]AlertRow, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var rows []AlertRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT a.id, a.type, a.severity, a.message, a.triggered_at, a.resolved_at
		FROM incident_alerts ia
		JOIN alerts a ON a.id = ia.alert_id
		WHERE ia.incident_id = ?
		ORDER BY a.triggered_at ASC
	`, incidentID).Scan(&rows).Error
	return rows, err
}

// AlertRow is a minimal projection of alerts for timeline rendering.
type AlertRow struct {
	ID          uuid.UUID  `gorm:"column:id"`
	Type        string     `gorm:"column:type"`
	Severity    string     `gorm:"column:severity"`
	Message     string     `gorm:"column:message"`
	TriggeredAt time.Time  `gorm:"column:triggered_at"`
	ResolvedAt  *time.Time `gorm:"column:resolved_at"`
}

// CommandsInWindow returns the commands executed against a service inside
// the incident window — useful for "who poked the system mid-incident".
func (r *Repository) CommandsInWindow(ctx context.Context, serviceID uuid.UUID, from, to time.Time) ([]CommandRow, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var rows []CommandRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT action, status, output, queued_at
		FROM command_logs
		WHERE service_id = ? AND queued_at BETWEEN ? AND ?
		ORDER BY queued_at ASC
	`, serviceID, from, to).Scan(&rows).Error
	return rows, err
}

type CommandRow struct {
	Action   string    `gorm:"column:action"`
	Status   string    `gorm:"column:status"`
	Output   *string   `gorm:"column:output"`
	QueuedAt time.Time `gorm:"column:queued_at"`
}

// ServiceName fetches the service display name.
func (r *Repository) ServiceName(ctx context.Context, serviceID uuid.UUID) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var name string
	err := r.db.WithContext(ctx).Raw(`SELECT name FROM services WHERE id = ?`, serviceID).Scan(&name).Error
	return name, err
}
