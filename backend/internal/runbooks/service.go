package runbooks

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Dispatcher is the WS hub indirection — keeps the runbooks package free of
// any hub import.
type Dispatcher interface {
	SendCommandToAgent(serviceID string, command map[string]interface{}) bool
}

// CommandLogger lets us record dispatched commands the same way manual ones
// are logged (so the command history view stays unified).
type CommandLogger interface {
	LogCommand(ctx context.Context, serviceID, userID uuid.UUID, commandID, action string, payload interface{}) error
}

type Service struct {
	repo   *Repository
	disp   Dispatcher
	logger *slog.Logger
	cmdLog CommandLogger
}

func NewService(db *gorm.DB, disp Dispatcher, cmdLog CommandLogger, logger *slog.Logger) *Service {
	return &Service{
		repo:   NewRepository(db),
		disp:   disp,
		cmdLog: cmdLog,
		logger: logger,
	}
}

// AlertInput is what alerts.Service hands us. Mirrors alerts.RunbookTriggerInput.
type AlertInput struct {
	UserID    uuid.UUID
	ServiceID uuid.UUID
	AlertID   uuid.UUID
	AlertType string
	Severity  string
	Message   string
}

// OnAlert is the entry point: find matching runbooks, evaluate cooldown and
// rate limits, then dispatch any that should run.
func (s *Service) OnAlert(ctx context.Context, in AlertInput) {
	matching, err := s.repo.FindMatching(ctx, in.UserID, in.ServiceID, in.AlertType)
	if err != nil {
		s.logger.Warn("Runbook lookup failed", slog.String("error", err.Error()))
		return
	}
	if len(matching) == 0 {
		return
	}
	for i := range matching {
		s.evaluate(ctx, &matching[i], in)
	}
}

func (s *Service) evaluate(ctx context.Context, b *Runbook, in AlertInput) {
	if !meetsSeverity(in.Severity, b.MinSeverity) {
		return
	}
	now := time.Now()
	if b.LastFiredAt != nil && b.CooldownSeconds > 0 {
		if now.Sub(*b.LastFiredAt) < time.Duration(b.CooldownSeconds)*time.Second {
			s.audit(ctx, b, in, "skipped_cooldown", "cooldown active")
			return
		}
	}
	count, err := s.repo.RecentFireCount(ctx, b.ID, now.Add(-time.Hour))
	if err == nil && count >= int64(b.MaxPerHour) {
		s.audit(ctx, b, in, "skipped_rate", "max_per_hour reached")
		return
	}

	cmdID := uuid.NewString()
	payload := map[string]interface{}{
		"type":       "command",
		"command_id": cmdID,
		"action":     b.Action,
		"args":       map[string]any(b.Args),
		"runbook_id": b.ID.String(),
		"alert_id":   in.AlertID.String(),
		"timestamp":  now.UTC().Format(time.RFC3339),
	}
	delivered := false
	if s.disp != nil {
		delivered = s.disp.SendCommandToAgent(in.ServiceID.String(), payload)
	}

	if s.cmdLog != nil {
		if err := s.cmdLog.LogCommand(ctx, in.ServiceID, in.UserID, cmdID, b.Action, payload); err != nil {
			s.logger.Warn("Runbook command log failed",
				slog.String("runbook_id", b.ID.String()),
				slog.String("error", err.Error()),
			)
		}
	}

	status := "dispatched"
	note := "delivered to agent"
	if !delivered {
		// Still counts toward the rate limit — agent will pick it up via the
		// queue when it reconnects.
		note = "queued (no agent online)"
	}
	if err := s.repo.MarkFired(ctx, b, &Fire{
		RunbookID: b.ID,
		ServiceID: in.ServiceID,
		AlertID:   &in.AlertID,
		FiredAt:   now,
		Status:    status,
		Note:      &note,
	}); err != nil {
		s.logger.Warn("Runbook mark-fired failed",
			slog.String("runbook_id", b.ID.String()),
			slog.String("error", err.Error()),
		)
	}

	s.logger.Info("Runbook dispatched",
		slog.String("runbook_id", b.ID.String()),
		slog.String("service_id", in.ServiceID.String()),
		slog.String("alert_type", in.AlertType),
		slog.String("action", b.Action),
		slog.Bool("delivered_live", delivered),
	)
}

func (s *Service) audit(ctx context.Context, b *Runbook, in AlertInput, status, note string) {
	n := note
	if err := s.repo.LogSkip(ctx, &Fire{
		RunbookID: b.ID,
		ServiceID: in.ServiceID,
		AlertID:   &in.AlertID,
		FiredAt:   time.Now(),
		Status:    status,
		Note:      &n,
	}); err != nil {
		s.logger.Debug("Runbook audit log failed", slog.String("error", err.Error()))
	}
}

// CRUD passthroughs ------------------------------------------------------

func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateRequest) (*Runbook, error) {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	args := req.Args
	if args == nil {
		args = JSONMap{}
	}
	b := &Runbook{
		UserID:          userID,
		Name:            strings.TrimSpace(req.Name),
		ServiceID:       req.ServiceID,
		AlertType:       strings.TrimSpace(req.AlertType),
		MinSeverity:     req.MinSeverity,
		Action:          req.Action,
		Args:            args,
		Enabled:         enabled,
		CooldownSeconds: req.CooldownSeconds,
		MaxPerHour:      req.MaxPerHour,
	}
	if err := s.repo.Create(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *Service) Update(ctx context.Context, userID, id uuid.UUID, req UpdateRequest) (*Runbook, error) {
	b, err := s.repo.Get(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		b.Name = strings.TrimSpace(*req.Name)
	}
	if req.ServiceID != nil {
		b.ServiceID = req.ServiceID
	}
	if req.AlertType != nil {
		b.AlertType = strings.TrimSpace(*req.AlertType)
	}
	if req.MinSeverity != nil {
		b.MinSeverity = *req.MinSeverity
	}
	if req.Action != nil {
		b.Action = *req.Action
	}
	if req.Args != nil {
		b.Args = *req.Args
	}
	if req.Enabled != nil {
		b.Enabled = *req.Enabled
	}
	if req.CooldownSeconds != nil {
		b.CooldownSeconds = *req.CooldownSeconds
	}
	if req.MaxPerHour != nil {
		b.MaxPerHour = *req.MaxPerHour
	}
	if err := s.repo.Save(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return s.repo.Delete(ctx, userID, id)
}

func (s *Service) Get(ctx context.Context, userID, id uuid.UUID) (*Runbook, error) {
	return s.repo.Get(ctx, userID, id)
}

func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]Runbook, error) {
	return s.repo.ListByUser(ctx, userID)
}

func (s *Service) Fires(ctx context.Context, userID, id uuid.UUID, limit int) ([]Fire, error) {
	if _, err := s.repo.Get(ctx, userID, id); err != nil {
		return nil, err
	}
	return s.repo.RecentFires(ctx, id, limit)
}

// meetsSeverity returns true when actual ≥ minimum on the info<warn<crit ladder.
func meetsSeverity(actual, minimum string) bool {
	rank := func(s string) int {
		switch strings.ToLower(s) {
		case "crit", "critical":
			return 3
		case "warn", "warning":
			return 2
		case "info":
			return 1
		}
		return 0
	}
	return rank(actual) >= rank(minimum)
}
