package metrics

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	repo *Repository
}

func NewService(db *gorm.DB) *Service {
	return &Service{
		repo: NewRepository(db),
	}
}

func (s *Service) InsertMetric(ctx context.Context, metric *Metric) error {
	return s.repo.Insert(ctx, metric)
}

func (s *Service) GetHistory(ctx context.Context, serviceID uuid.UUID, duration time.Duration, limit int) ([]Metric, error) {
	return s.repo.GetHistory(ctx, serviceID, duration, limit)
}

func (s *Service) GetAggregated(ctx context.Context, serviceID uuid.UUID, duration time.Duration, bucketSize string) ([]map[string]interface{}, error) {
	return s.repo.GetAggregated(ctx, serviceID, duration, bucketSize)
}

func (s *Service) GetLatestMetric(ctx context.Context, serviceID uuid.UUID) (*Metric, error) {
	metrics, err := s.repo.GetHistory(ctx, serviceID, 1*time.Minute, 1)
	if err != nil {
		return nil, err
	}
	if len(metrics) == 0 {
		return nil, nil
	}
	return &metrics[len(metrics)-1], nil
}

func (s *Service) GetUptime(ctx context.Context, serviceID uuid.UUID, duration time.Duration) (float64, error) {
	return s.repo.GetUptime(ctx, serviceID, duration)
}
