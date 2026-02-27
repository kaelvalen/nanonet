package alerts

import (
	"context"
	"fmt"

	"nanonet-backend/internal/metrics"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	repo  *Repository
	rules AlertRule
}

func NewService(db *gorm.DB) *Service {
	return &Service{
		repo:  NewRepository(db),
		rules: DefaultAlertRules,
	}
}

func (s *Service) CheckMetricAndCreateAlert(ctx context.Context, serviceID uuid.UUID, metric *metrics.Metric) error {
	var newAlerts []Alert
	var resolveTypes []string

	// CPU
	if metric.CPUPercent != nil {
		if *metric.CPUPercent > s.rules.CPUThreshold {
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
		if *metric.MemoryUsedMB > s.rules.MemoryThreshold {
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
		if *metric.LatencyMS > s.rules.LatencyThreshold {
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
		if *metric.ErrorRate > s.rules.ErrorRateThreshold {
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
