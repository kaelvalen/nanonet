package incidents

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CorrelationWindow controls how far back we look for an open incident before
// creating a new one. Tuned for "noisy alerting cluster" rather than long
// outages — operators can resolve manually if needed.
const CorrelationWindow = 30 * time.Minute

type Service struct {
	repo *Repository
}

func NewService(db *gorm.DB) *Service {
	return &Service{repo: NewRepository(db)}
}

// AlertInput is the minimal projection the alerts package hands us when
// recording a new alert. We avoid importing the alerts package directly to
// keep the dependency direction one-way.
type AlertInput struct {
	UserID      uuid.UUID
	ServiceID   uuid.UUID
	AlertID     uuid.UUID
	Type        string
	Severity    string
	Message     string
	TriggeredAt time.Time
	ServiceName string
}

// RecordAlert attaches an alert to the most recent open incident on the
// service, or opens a new one. Severity is monotonically promoted (info →
// warn → crit). Title is derived from the first/most-severe alert.
func (s *Service) RecordAlert(ctx context.Context, in AlertInput) (*Incident, error) {
	open, err := s.repo.FindOpenForService(ctx, in.ServiceID, CorrelationWindow)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if open == nil {
		title := fmt.Sprintf("%s · %s", fallback(in.ServiceName, "service"), in.Type)
		open = &Incident{
			UserID:    in.UserID,
			ServiceID: in.ServiceID,
			Title:     title,
			Severity:  in.Severity,
			StartedAt: in.TriggeredAt,
		}
		if err := s.repo.Create(ctx, open); err != nil {
			return nil, err
		}
	} else if severityRank(in.Severity) > severityRank(open.Severity) {
		open.Severity = in.Severity
		if err := s.repo.Save(ctx, open); err != nil {
			return nil, err
		}
	}
	if err := s.repo.AttachAlert(ctx, open.ID, in.AlertID); err != nil {
		return nil, err
	}
	return open, nil
}

// MaybeResolveByAlert is called when an alert's resolved_at is set. If no
// other open alerts remain on its incident, we close the incident.
func (s *Service) MaybeResolveByAlert(ctx context.Context, alertID uuid.UUID) error {
	ids, err := s.repo.IncidentIDsForAlert(ctx, alertID)
	if err != nil {
		return err
	}
	for _, id := range ids {
		stillOpen, err := s.repo.AnyOpenAlerts(ctx, id)
		if err != nil {
			return err
		}
		if stillOpen {
			continue
		}
		// All alerts closed → resolve the incident at the latest resolved_at.
		when, err := s.repo.LastAlertResolvedAt(ctx, id)
		if err != nil || when == nil {
			continue
		}
		// We don't need user-scoping here because the alert→incident link
		// already implies ownership.
		if err := s.repo.SaveResolvedAt(ctx, id, *when); err != nil {
			return err
		}
	}
	return nil
}

// SaveResolvedAt is exposed on the repo to keep the partial-update tight.
// Defined here so callers don't need to know about the persistence layer.
func (r *Repository) SaveResolvedAt(ctx context.Context, id uuid.UUID, t time.Time) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return r.db.WithContext(ctx).Model(&Incident{}).
		Where("id = ?", id).
		Updates(map[string]any{"resolved_at": t, "updated_at": time.Now()}).Error
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, limit int) ([]ListItem, error) {
	out, err := s.repo.ListByUser(ctx, userID, limit)
	if out == nil {
		out = []ListItem{}
	}
	return out, err
}

// Detail returns the incident plus an interleaved timeline of alert + command events.
func (s *Service) Detail(ctx context.Context, userID, id uuid.UUID) (*Detail, error) {
	inc, err := s.repo.Get(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	count, _ := s.repo.CountAlerts(ctx, inc.ID)
	name, _ := s.repo.ServiceName(ctx, inc.ServiceID)

	alerts, _ := s.repo.AttachedAlerts(ctx, inc.ID)
	end := time.Now()
	if inc.ResolvedAt != nil {
		end = *inc.ResolvedAt
	}
	cmds, _ := s.repo.CommandsInWindow(ctx, inc.ServiceID, inc.StartedAt.Add(-2*time.Minute), end.Add(2*time.Minute))

	timeline := make([]TimelineEvent, 0, len(alerts)*2+len(cmds))
	for _, a := range alerts {
		timeline = append(timeline, TimelineEvent{
			Kind:      "alert",
			Timestamp: a.TriggeredAt,
			Title:     a.Type,
			Detail:    a.Message,
			Severity:  a.Severity,
		})
		if a.ResolvedAt != nil {
			timeline = append(timeline, TimelineEvent{
				Kind:      "alert_resolved",
				Timestamp: *a.ResolvedAt,
				Title:     a.Type,
				Severity:  a.Severity,
			})
		}
	}
	for _, c := range cmds {
		timeline = append(timeline, TimelineEvent{
			Kind:      "command",
			Timestamp: c.QueuedAt,
			Title:     c.Action,
			Detail:    c.Status,
		})
	}
	sort.SliceStable(timeline, func(i, j int) bool {
		return timeline[i].Timestamp.Before(timeline[j].Timestamp)
	})

	return &Detail{
		Incident:    *inc,
		ServiceName: name,
		AlertCount:  count,
		Timeline:    timeline,
	}, nil
}

func (s *Service) Update(ctx context.Context, userID, id uuid.UUID, req UpdateRequest) (*Incident, error) {
	inc, err := s.repo.Get(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if req.Title != nil {
		inc.Title = *req.Title
	}
	if req.Summary != nil {
		inc.Summary = req.Summary
	}
	if req.Postmortem != nil {
		inc.Postmortem = req.Postmortem
	}
	if err := s.repo.Save(ctx, inc); err != nil {
		return nil, err
	}
	return inc, nil
}

func (s *Service) Resolve(ctx context.Context, userID, id uuid.UUID) (*Incident, error) {
	inc, err := s.repo.Get(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if inc.ResolvedAt == nil {
		now := time.Now()
		inc.ResolvedAt = &now
		if err := s.repo.Save(ctx, inc); err != nil {
			return nil, err
		}
	}
	return inc, nil
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return s.repo.Delete(ctx, userID, id)
}

func severityRank(s string) int {
	switch s {
	case "crit":
		return 3
	case "warn":
		return 2
	case "info":
		return 1
	}
	return 0
}

func fallback(s, def string) string {
	if s == "" {
		return def
	}
	return s
}
