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
	var alerts []Alert

	if metric.CPUPercent != nil && *metric.CPUPercent > s.rules.CPUThreshold {
		alerts = append(alerts, Alert{
			ServiceID: serviceID,
			Type:      "high_cpu",
			Severity:  "warn",
			Message:   fmt.Sprintf("CPU kullanımı yüksek: %.2f%%", *metric.CPUPercent),
		})
	}

	if metric.MemoryUsedMB != nil && *metric.MemoryUsedMB > s.rules.MemoryThreshold {
		alerts = append(alerts, Alert{
			ServiceID: serviceID,
			Type:      "high_memory",
			Severity:  "warn",
			Message:   fmt.Sprintf("Bellek kullanımı yüksek: %.2f MB", *metric.MemoryUsedMB),
		})
	}

	if metric.LatencyMS != nil && *metric.LatencyMS > s.rules.LatencyThreshold {
		alerts = append(alerts, Alert{
			ServiceID: serviceID,
			Type:      "high_latency",
			Severity:  "crit",
			Message:   fmt.Sprintf("Yüksek gecikme: %.2f ms", *metric.LatencyMS),
		})
	}

	if metric.ErrorRate != nil && *metric.ErrorRate > s.rules.ErrorRateThreshold {
		alerts = append(alerts, Alert{
			ServiceID: serviceID,
			Type:      "high_error_rate",
			Severity:  "crit",
			Message:   fmt.Sprintf("Yüksek hata oranı: %.2f%%", *metric.ErrorRate),
		})
	}

	if metric.Status == "down" {
		alerts = append(alerts, Alert{
			ServiceID: serviceID,
			Type:      "service_down",
			Severity:  "crit",
			Message:   "Servis çalışmıyor",
		})
	}

	for _, alert := range alerts {
		exists, err := s.repo.HasActiveAlert(ctx, serviceID, alert.Type)
		if err != nil {
			return err
		}
		if exists {
			continue
		}
		if err := s.repo.Create(ctx, &alert); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) GetAlerts(ctx context.Context, serviceID uuid.UUID, includeResolved bool) ([]Alert, error) {
	return s.repo.GetByServiceID(ctx, serviceID, includeResolved)
}

func (s *Service) ResolveAlert(ctx context.Context, alertID, userID uuid.UUID) error {
	return s.repo.ResolveByUser(ctx, alertID, userID)
}

func (s *Service) GetActiveAlerts(ctx context.Context, userID uuid.UUID) ([]Alert, error) {
	return s.repo.GetActiveAlerts(ctx, userID)
}
