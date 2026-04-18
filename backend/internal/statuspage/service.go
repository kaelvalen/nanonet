package statuspage

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

type Service struct {
	repo *Repository
	db   *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{repo: NewRepository(db), db: db}
}

// CRUD passthroughs
func (s *Service) Create(ctx context.Context, p *StatusPage) error {
	return s.repo.Create(ctx, p)
}
func (s *Service) Update(ctx context.Context, p *StatusPage) error {
	return s.repo.Update(ctx, p)
}
func (s *Service) Delete(ctx context.Context, u, id uuid.UUID) error {
	return s.repo.Delete(ctx, u, id)
}
func (s *Service) Get(ctx context.Context, u, id uuid.UUID) (*StatusPage, error) {
	return s.repo.Get(ctx, u, id)
}
func (s *Service) List(ctx context.Context, u uuid.UUID) ([]StatusPage, error) {
	return s.repo.ListByUser(ctx, u)
}

// BuildPublicView assembles the anonymized public payload for a slug.
// All filtering happens in-process so we never leak ownership info to
// anonymous visitors.
func (s *Service) BuildPublicView(ctx context.Context, slug string) (*PublicView, error) {
	page, err := s.repo.GetPublicBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if len(page.ServiceIDs) == 0 {
		return &PublicView{
			Title:       page.Title,
			Description: page.Description,
			GeneratedAt: time.Now(),
			Overall:     "operational",
			Services:    []PublicService{},
			Incidents:   []PublicIncident{},
		}, nil
	}

	// Confirm services still belong to the page owner. We don't trust the
	// service_ids array on its own — a service could have been transferred
	// or deleted since the page was created.
	type svcRow struct {
		ID     uuid.UUID `gorm:"column:id"`
		Name   string    `gorm:"column:name"`
		Status string    `gorm:"column:status"`
	}
	var rows []svcRow
	if err := s.db.WithContext(ctx).Raw(`
		SELECT id, name, status
		FROM services
		WHERE user_id = ? AND id::text = ANY(?)
	`, page.UserID, pq.StringArray(page.ServiceIDs)).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return &PublicView{
			Title:       page.Title,
			Description: page.Description,
			GeneratedAt: time.Now(),
			Overall:     "operational",
			Services:    []PublicService{},
			Incidents:   []PublicIncident{},
		}, nil
	}

	ids := make([]uuid.UUID, 0, len(rows))
	idStrs := make(pq.StringArray, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ID)
		idStrs = append(idStrs, r.ID.String())
	}

	// Latest latency per service (single round trip).
	type latRow struct {
		ServiceID uuid.UUID `gorm:"column:service_id"`
		LatencyMS *float64  `gorm:"column:latency_ms"`
	}
	var lats []latRow
	_ = s.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (service_id) service_id, latency_ms
		FROM metrics
		WHERE service_id::text = ANY(?) AND time > NOW() - INTERVAL '15 minutes'
		ORDER BY service_id, time DESC
	`, idStrs).Scan(&lats).Error
	latByID := make(map[uuid.UUID]*float64, len(lats))
	for _, l := range lats {
		latByID[l.ServiceID] = l.LatencyMS
	}

	// Bulk uptime — 24h and 30d.
	uptime24 := bulkUptime(ctx, s.db, ids, idStrs, 24*time.Hour)
	uptime30d := bulkUptime(ctx, s.db, ids, idStrs, 30*24*time.Hour)

	// Public-friendly status mapping.
	pubServices := make([]PublicService, 0, len(rows))
	worst := 0 // 0 op, 1 degraded, 2 down
	for _, r := range rows {
		ps := PublicService{
			Name:      r.Name,
			Status:    mapPublicStatus(r.Status),
			Uptime24h: uptime24[r.ID],
			Uptime30d: uptime30d[r.ID],
			LatencyMS: latByID[r.ID],
		}
		switch ps.Status {
		case "down":
			if worst < 2 {
				worst = 2
			}
		case "degraded":
			if worst < 1 {
				worst = 1
			}
		}
		pubServices = append(pubServices, ps)
	}
	sort.Slice(pubServices, func(i, j int) bool {
		return pubServices[i].Name < pubServices[j].Name
	})

	// Recent incidents — last 14 days, severity in (warn,crit), capped at 25.
	type alertRow struct {
		Type        string     `gorm:"column:type"`
		Severity    string     `gorm:"column:severity"`
		TriggeredAt time.Time  `gorm:"column:triggered_at"`
		ResolvedAt  *time.Time `gorm:"column:resolved_at"`
		ServiceName string     `gorm:"column:name"`
	}
	var arows []alertRow
	_ = s.db.WithContext(ctx).Raw(`
		SELECT a.type, a.severity, a.triggered_at, a.resolved_at, s.name
		FROM alerts a
		JOIN services s ON s.id = a.service_id
		WHERE a.service_id::text = ANY(?)
		  AND a.severity IN ('warn','crit')
		  AND a.triggered_at > NOW() - INTERVAL '14 days'
		ORDER BY a.triggered_at DESC
		LIMIT 25
	`, idStrs).Scan(&arows).Error

	incidents := make([]PublicIncident, 0, len(arows))
	for _, a := range arows {
		incidents = append(incidents, PublicIncident{
			Title:     a.ServiceName + " · " + a.Type,
			Severity:  a.Severity,
			StartedAt: a.TriggeredAt,
			Resolved:  a.ResolvedAt != nil,
		})
	}

	return &PublicView{
		Title:       page.Title,
		Description: page.Description,
		GeneratedAt: time.Now(),
		Overall:     overallLabel(worst),
		Services:    pubServices,
		Incidents:   incidents,
	}, nil
}

// SlugAvailable returns true when no enabled or disabled page already uses the slug.
func (s *Service) SlugAvailable(ctx context.Context, slug string, ignoreID *uuid.UUID) (bool, error) {
	q := s.db.WithContext(ctx).Model(&StatusPage{}).Where("slug = ?", slug)
	if ignoreID != nil {
		q = q.Where("id <> ?", *ignoreID)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return true, nil
		}
		return false, err
	}
	return count == 0, nil
}

func mapPublicStatus(internal string) string {
	switch internal {
	case "up":
		return "up"
	case "down":
		return "down"
	case "degraded":
		return "degraded"
	default:
		return "unknown"
	}
}

func overallLabel(worst int) string {
	switch worst {
	case 2:
		return "down"
	case 1:
		return "degraded"
	default:
		return "operational"
	}
}

func bulkUptime(ctx context.Context, db *gorm.DB, ids []uuid.UUID, idStrs pq.StringArray, dur time.Duration) map[uuid.UUID]float64 {
	out := make(map[uuid.UUID]float64, len(ids))
	type row struct {
		ServiceID uuid.UUID `gorm:"column:service_id"`
		Uptime    float64   `gorm:"column:uptime"`
	}
	var rows []row
	since := time.Now().Add(-dur)
	if err := db.WithContext(ctx).Raw(`
		SELECT service_id,
		       COALESCE(
		         100.0 * SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)::float
		         / NULLIF(COUNT(*),0),
		         100.0
		       ) AS uptime
		FROM metrics
		WHERE service_id::text = ANY(?) AND time > ?
		GROUP BY service_id
	`, idStrs, since).Scan(&rows).Error; err != nil {
		return out
	}
	for _, r := range rows {
		out[r.ServiceID] = r.Uptime
	}
	for _, id := range ids {
		if _, ok := out[id]; !ok {
			out[id] = 100.0 // no data → assume operational rather than scary 0%
		}
	}
	return out
}
