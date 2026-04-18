package alerts

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"nanonet-backend/internal/metrics"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const emailCooldown = 45 * time.Minute

// alertNotifier is satisfied by pkg/mailer.Mailer without a direct import cycle.
type alertNotifier interface {
	Enabled() bool
	SendAlert(toEmail, serviceName, alertType, message, severity string) error
}

// multiNotifier is satisfied by *notifications.Service. Declared locally to
// avoid the alerts → notifications import cycle.
type multiNotifier interface {
	Dispatch(ctx context.Context, userID uuid.UUID, ev MultiNotifierEvent) int
}

// incidentRecorder is satisfied by *incidents.Service. Local interface so the
// alerts package doesn't depend on internal/incidents (which would create a
// cycle once incidents grows AI-generated postmortems backed by ai.Service).
type incidentRecorder interface {
	RecordAlert(ctx context.Context, in IncidentRecorderInput) error
	MaybeResolveByAlert(ctx context.Context, alertID uuid.UUID) error
}

// runbookTrigger is satisfied by *runbooks.Service. Same import-cycle reason
// as incidentRecorder above.
type runbookTrigger interface {
	OnAlert(ctx context.Context, in RunbookTriggerInput)
}

// RunbookTriggerInput is what we hand the runbook engine when an alert fires.
type RunbookTriggerInput struct {
	UserID    uuid.UUID
	ServiceID uuid.UUID
	AlertID   uuid.UUID
	AlertType string
	Severity  string
	Message   string
}

// IncidentRecorderInput mirrors incidents.AlertInput without importing it.
type IncidentRecorderInput struct {
	UserID      uuid.UUID
	ServiceID   uuid.UUID
	AlertID     uuid.UUID
	Type        string
	Severity    string
	Message     string
	TriggeredAt time.Time
	ServiceName string
}

// MultiNotifierEvent mirrors notifications.Event without importing it.
// The notifications package adapts this struct in cmd/main.go via a small shim.
type MultiNotifierEvent struct {
	Kind        string
	Title       string
	Message     string
	Severity    string
	ServiceID   *uuid.UUID
	ServiceName string
	AlertID     *uuid.UUID
	AlertType   string
	Timestamp   time.Time
}

type Service struct {
	repo      *Repository
	rules     AlertRule
	maint     maintenanceChecker
	notifier  alertNotifier
	multi     multiNotifier
	incidents incidentRecorder
	runbooks  runbookTrigger
	db        *gorm.DB
	muCool    sync.Mutex
	cooldowns map[string]time.Time // key: "serviceID:alertType" → cooldown bitiş zamanı
}

func NewService(db *gorm.DB) *Service {
	return &Service{
		repo:      NewRepository(db),
		rules:     DefaultAlertRules,
		db:        db,
		cooldowns: make(map[string]time.Time),
	}
}

func (s *Service) emailCooldownActive(serviceID uuid.UUID, alertType string) bool {
	key := serviceID.String() + ":" + alertType
	s.muCool.Lock()
	defer s.muCool.Unlock()
	until, ok := s.cooldowns[key]
	return ok && time.Now().Before(until)
}

func (s *Service) setEmailCooldown(serviceID uuid.UUID, alertType string) {
	key := serviceID.String() + ":" + alertType
	s.muCool.Lock()
	s.cooldowns[key] = time.Now().Add(emailCooldown)
	s.muCool.Unlock()
}

// SetMaintenanceChecker wires in a maintenance window checker after construction.
func (s *Service) SetMaintenanceChecker(m maintenanceChecker) {
	s.maint = m
}

// SetNotifier wires in an email notifier after construction.
func (s *Service) SetNotifier(n alertNotifier) {
	s.notifier = n
}

// SetMultiNotifier wires in the multi-channel notifier (slack/discord/webhook…).
func (s *Service) SetMultiNotifier(n multiNotifier) {
	s.multi = n
}

// SetIncidentRecorder wires in the incident auto-grouper.
func (s *Service) SetIncidentRecorder(r incidentRecorder) {
	s.incidents = r
}

// SetRunbookTrigger wires in the runbook automation engine.
func (s *Service) SetRunbookTrigger(r runbookTrigger) {
	s.runbooks = r
}

func (s *Service) CheckMetricAndCreateAlert(ctx context.Context, serviceID uuid.UUID, metric *metrics.Metric) error {
	// Skip all alert creation during active maintenance windows.
	if s.maint != nil {
		active, err := s.maint.IsActiveNow(ctx, serviceID)
		if err != nil {
			slog.Warn("Maintenance check failed", slog.String("service_id", serviceID.String()), slog.String("error", err.Error()))
		} else if active {
			return nil
		}
	}

	// Load per-service thresholds; fall back to defaults on error or absence.
	cpuThreshold := s.rules.CPUThreshold
	memThreshold := s.rules.MemoryThreshold
	latencyThreshold := s.rules.LatencyThreshold
	errorRateThreshold := s.rules.ErrorRateThreshold

	if rule, err := s.repo.GetAlertRule(ctx, serviceID); err != nil {
		slog.Warn("Alert rule lookup failed", slog.String("service_id", serviceID.String()), slog.String("error", err.Error()))
	} else if rule != nil {
		cpuThreshold = rule.CPUThreshold
		memThreshold = rule.MemoryThresholdMB
		latencyThreshold = rule.LatencyThresholdMS
		errorRateThreshold = rule.ErrorRateThreshold
	}

	var newAlerts []Alert
	var resolveTypes []string

	// CPU
	if metric.CPUPercent != nil {
		if *metric.CPUPercent > cpuThreshold {
			newAlerts = append(newAlerts, Alert{
				ServiceID: serviceID,
				Type:      "high_cpu",
				Severity:  "warn",
				Message:   fmt.Sprintf("CPU kullanımı yüksek: %.2f%%", *metric.CPUPercent),
			})
		} else {
			resolveTypes = append(resolveTypes, "high_cpu")
		}
	}

	// Memory
	if metric.MemoryUsedMB != nil {
		if *metric.MemoryUsedMB > memThreshold {
			newAlerts = append(newAlerts, Alert{
				ServiceID: serviceID,
				Type:      "high_memory",
				Severity:  "warn",
				Message:   fmt.Sprintf("Bellek kullanımı yüksek: %.2f MB", *metric.MemoryUsedMB),
			})
		} else {
			resolveTypes = append(resolveTypes, "high_memory")
		}
	}

	// Latency
	if metric.LatencyMS != nil {
		if *metric.LatencyMS > latencyThreshold {
			newAlerts = append(newAlerts, Alert{
				ServiceID: serviceID,
				Type:      "high_latency",
				Severity:  "crit",
				Message:   fmt.Sprintf("Yüksek gecikme: %.2f ms", *metric.LatencyMS),
			})
		} else {
			resolveTypes = append(resolveTypes, "high_latency")
		}
	}

	// Error rate
	if metric.ErrorRate != nil {
		if *metric.ErrorRate > errorRateThreshold {
			newAlerts = append(newAlerts, Alert{
				ServiceID: serviceID,
				Type:      "high_error_rate",
				Severity:  "crit",
				Message:   fmt.Sprintf("Yüksek hata oranı: %.2f%%", *metric.ErrorRate),
			})
		} else {
			resolveTypes = append(resolveTypes, "high_error_rate")
		}
	}

	// Service status
	switch metric.Status {
	case "down":
		newAlerts = append(newAlerts, Alert{
			ServiceID: serviceID,
			Type:      "service_down",
			Severity:  "crit",
			Message:   "Servis çalışmıyor",
		})
	case "up":
		resolveTypes = append(resolveTypes, "service_down")
	}

	// Tek bulk UPDATE — tüm resolve edilecek tipleri tek sorguda çöz
	if len(resolveTypes) > 0 {
		resolved, _ := s.repo.ResolveByTypes(ctx, serviceID, resolveTypes)
		// Incident close hook — async, best effort.
		if s.incidents != nil {
			for _, id := range resolved {
				go func(aid uuid.UUID) {
					ctx2, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					_ = s.incidents.MaybeResolveByAlert(ctx2, aid)
				}(id)
			}
		}
	}

	if len(newAlerts) > 0 {
		activeTypes, err := s.repo.GetActiveAlertTypes(ctx, serviceID)
		if err != nil {
			return err
		}
		for _, alert := range newAlerts {
			if activeTypes[alert.Type] {
				continue
			}
			if err := s.repo.Create(ctx, &alert); err != nil {
				return err
			}
			// Email bildirimi — sadece crit/warn, async, cooldown korumalı
			if s.notifier != nil && s.notifier.Enabled() && alert.Severity != "info" &&
				!s.emailCooldownActive(serviceID, alert.Type) {
				s.setEmailCooldown(serviceID, alert.Type)
				go s.sendAlertEmail(serviceID, alert)
			}
			// Çok-kanallı bildirim (slack/discord/webhook/pagerduty) — async
			if s.multi != nil {
				go s.dispatchMulti(serviceID, alert)
			}
			// Incident auto-grouping — async, best effort
			if s.incidents != nil {
				go s.recordIncident(serviceID, alert)
			}
			// Runbook automation (restart/exec/etc) — async, best effort
			if s.runbooks != nil {
				go s.fireRunbook(serviceID, alert)
			}
		}
	}

	return nil
}

// CreateManualAlert inserts an alert that does not originate from a metric
// sample (e.g. agent_stale, agent_down). It is dedup-safe: if an active alert
// of the same type already exists for the service, it is a no-op. Notifier
// dispatch + incident recording + runbook trigger run async, mirroring the
// metric pathway.
func (s *Service) CreateManualAlert(ctx context.Context, serviceID uuid.UUID, alertType, severity, message string) error {
	activeTypes, err := s.repo.GetActiveAlertTypes(ctx, serviceID)
	if err != nil {
		return err
	}
	if activeTypes[alertType] {
		return nil
	}
	alert := Alert{
		ServiceID: serviceID,
		Type:      alertType,
		Severity:  severity,
		Message:   message,
	}
	if err := s.repo.Create(ctx, &alert); err != nil {
		return err
	}
	if s.notifier != nil && s.notifier.Enabled() && alert.Severity != "info" &&
		!s.emailCooldownActive(serviceID, alert.Type) {
		s.setEmailCooldown(serviceID, alert.Type)
		go s.sendAlertEmail(serviceID, alert)
	}
	if s.multi != nil {
		go s.dispatchMulti(serviceID, alert)
	}
	if s.incidents != nil {
		go s.recordIncident(serviceID, alert)
	}
	if s.runbooks != nil {
		go s.fireRunbook(serviceID, alert)
	}
	return nil
}

func (s *Service) GetAlerts(ctx context.Context, serviceID uuid.UUID, includeResolved bool) ([]Alert, error) {
	return s.repo.GetByServiceID(ctx, serviceID, includeResolved)
}

func (s *Service) GetAlertsPage(ctx context.Context, serviceID uuid.UUID, includeResolved bool, limit, offset int) ([]Alert, int64, error) {
	return s.repo.GetByServiceIDPage(ctx, serviceID, includeResolved, limit, offset)
}

func (s *Service) ResolveAlert(ctx context.Context, alertID, userID uuid.UUID) error {
	if err := s.repo.ResolveByUser(ctx, alertID, userID); err != nil {
		return err
	}
	if s.incidents != nil {
		go func() {
			ctx2, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = s.incidents.MaybeResolveByAlert(ctx2, alertID)
		}()
	}
	return nil
}

func (s *Service) SnoozeAlert(ctx context.Context, alertID, userID uuid.UUID, minutes int) error {
	if minutes <= 0 {
		minutes = 15
	}
	return s.repo.SnoozeByUser(ctx, alertID, userID, time.Duration(minutes)*time.Minute)
}

func (s *Service) GetActiveAlerts(ctx context.Context, userID uuid.UUID) ([]Alert, error) {
	return s.repo.GetActiveAlerts(ctx, userID)
}

func (s *Service) GetAlertRule(ctx context.Context, serviceID uuid.UUID) (*ServiceAlertRule, error) {
	return s.repo.GetAlertRule(ctx, serviceID)
}

func (s *Service) UpsertAlertRule(ctx context.Context, rule *ServiceAlertRule) error {
	return s.repo.UpsertAlertRule(ctx, rule)
}

// sendAlertEmail fetches the service owner email and sends alert notification.
func (s *Service) sendAlertEmail(serviceID uuid.UUID, alert Alert) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var row struct {
		Email       string `gorm:"column:email"`
		ServiceName string `gorm:"column:name"`
	}
	err := s.db.WithContext(ctx).Raw(`
		SELECT u.email, sv.name
		FROM services sv
		JOIN users u ON u.id = sv.user_id
		WHERE sv.id = ?
	`, serviceID).Scan(&row).Error
	if err != nil || row.Email == "" {
		slog.Warn("Alert email lookup failed", slog.String("service_id", serviceID.String()), slog.Any("error", err))
		return
	}

	if err := s.notifier.SendAlert(row.Email, row.ServiceName, alert.Type, alert.Message, alert.Severity); err != nil {
		slog.Warn("Alert email gönderilemedi", slog.String("service_id", serviceID.String()), slog.String("type", alert.Type), slog.String("error", err.Error()))
	}
}

// recordIncident attaches the alert to an open incident or opens a new one.
func (s *Service) recordIncident(serviceID uuid.UUID, alert Alert) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var row struct {
		UserID      uuid.UUID `gorm:"column:user_id"`
		ServiceName string    `gorm:"column:name"`
	}
	if err := s.db.WithContext(ctx).Raw(`
		SELECT user_id, name FROM services WHERE id = ?
	`, serviceID).Scan(&row).Error; err != nil || row.UserID == uuid.Nil {
		return
	}
	triggered := alert.TriggeredAt
	if triggered.IsZero() {
		triggered = time.Now()
	}
	if err := s.incidents.RecordAlert(ctx, IncidentRecorderInput{
		UserID:      row.UserID,
		ServiceID:   serviceID,
		AlertID:     alert.ID,
		Type:        alert.Type,
		Severity:    alert.Severity,
		Message:     alert.Message,
		TriggeredAt: triggered,
		ServiceName: row.ServiceName,
	}); err != nil {
		slog.Warn("Incident kaydedilemedi", slog.String("alert_id", alert.ID.String()), slog.String("error", err.Error()))
	}
}

// fireRunbook hands the alert to the runbook engine, which decides whether
// any user-defined automation should run.
func (s *Service) fireRunbook(serviceID uuid.UUID, alert Alert) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	var row struct {
		UserID uuid.UUID `gorm:"column:user_id"`
	}
	if err := s.db.WithContext(ctx).Raw(`
		SELECT user_id FROM services WHERE id = ?
	`, serviceID).Scan(&row).Error; err != nil || row.UserID == uuid.Nil {
		return
	}
	s.runbooks.OnAlert(ctx, RunbookTriggerInput{
		UserID:    row.UserID,
		ServiceID: serviceID,
		AlertID:   alert.ID,
		AlertType: alert.Type,
		Severity:  alert.Severity,
		Message:   alert.Message,
	})
}

// dispatchMulti looks up the service owner and forwards to the multi-channel notifier.
func (s *Service) dispatchMulti(serviceID uuid.UUID, alert Alert) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var row struct {
		UserID      uuid.UUID `gorm:"column:user_id"`
		ServiceName string    `gorm:"column:name"`
	}
	if err := s.db.WithContext(ctx).Raw(`
		SELECT user_id, name FROM services WHERE id = ?
	`, serviceID).Scan(&row).Error; err != nil || row.UserID == uuid.Nil {
		return
	}

	sid := serviceID
	aid := alert.ID
	s.multi.Dispatch(ctx, row.UserID, MultiNotifierEvent{
		Kind:        "alert",
		Title:       fmt.Sprintf("[%s] %s", row.ServiceName, alert.Type),
		Message:     alert.Message,
		Severity:    alert.Severity,
		ServiceID:   &sid,
		ServiceName: row.ServiceName,
		AlertID:     &aid,
		AlertType:   alert.Type,
		Timestamp:   time.Now(),
	})
}
