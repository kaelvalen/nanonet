package alerts

import (
	"context"
	"fmt"
	"log"

	"nanonet-backend/internal/metrics"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	repo  *Repository
	rules AlertRule
	maint maintenanceChecker
}

func NewService(db *gorm.DB) *Service {
	return &Service{
		repo:  NewRepository(db),
		rules: DefaultAlertRules,
	}
}

// SetMaintenanceChecker wires in a maintenance window checker after construction.
func (s *Service) SetMaintenanceChecker(m maintenanceChecker) {
	s.maint = m
}

func (s *Service) CheckMetricAndCreateAlert(ctx context.Context, serviceID uuid.UUID, metric *metrics.Metric) error {
	// Skip all alert creation during active maintenance windows.
	if s.maint != nil {
		active, err := s.maint.IsActiveNow(ctx, serviceID)
		if err != nil {
			log.Printf("[WARN] Maintenance check failed for service %s: %v", serviceID, err)
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
		log.Printf("[WARN] Alert rule lookup failed for service %s: %v", serviceID, err)
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
	if metric.Status == "down" {
		newAlerts = append(newAlerts, Alert{
			ServiceID: serviceID,
			Type:      "service_down",
			Severity:  "crit",
			Message:   "Servis çalışmıyor",
		})
	} else if metric.Status == "up" {
		resolveTypes = append(resolveTypes, "service_down")
	}

	// Tek bulk UPDATE — tüm resolve edilecek tipleri tek sorguda çöz
	if len(resolveTypes) > 0 {
		_ = s.repo.ResolveByTypes(ctx, serviceID, resolveTypes)
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
		}
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
	return s.repo.ResolveByUser(ctx, alertID, userID)
}

func (s *Service) GetActiveAlerts(ctx context.Context, userID uuid.UUID) ([]Alert, error) {
	return s.repo.GetActiveAlerts(ctx, userID)
}

func (s *Service) IsServiceOwner(ctx context.Context, serviceID, userID uuid.UUID) bool {
	return s.repo.IsServiceOwner(ctx, serviceID, userID)
}

func (s *Service) GetAlertRule(ctx context.Context, serviceID uuid.UUID) (*ServiceAlertRule, error) {
	return s.repo.GetAlertRule(ctx, serviceID)
}

func (s *Service) UpsertAlertRule(ctx context.Context, rule *ServiceAlertRule) error {
	return s.repo.UpsertAlertRule(ctx, rule)
}
