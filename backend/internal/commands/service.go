package commands

import (
	"context"
	"encoding/json"
	"fmt"
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

func (s *Service) LogCommand(ctx context.Context, serviceID, userID uuid.UUID, commandID, action string, payload interface{}) error {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("payload serialization failed: %w", err)
	}

	log := &CommandLog{
		ServiceID: serviceID,
		UserID:    userID,
		CommandID: commandID,
		Action:    action,
		Status:    "queued",
		Payload:   payloadJSON,
	}

	return s.repo.Create(ctx, log)
}

func (s *Service) UpdateStatus(ctx context.Context, commandID, status string, durationMS *int) error {
	return s.repo.UpdateStatus(ctx, commandID, status, durationMS)
}

// CompleteFromAgent persists agent result frames (success/failed) with output/error text.
func (s *Service) CompleteFromAgent(ctx context.Context, commandID, status string, output, errMsg *string) error {
	return s.repo.CompleteFromAgent(ctx, commandID, status, output, errMsg)
}

func (s *Service) GetHistory(ctx context.Context, serviceID uuid.UUID, limit, offset int) ([]CommandLog, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetByServiceID(ctx, serviceID, limit, offset)
}

func (s *Service) HasInFlightCommand(ctx context.Context, serviceID uuid.UUID, action string) (bool, error) {
	return s.repo.HasInFlightCommand(ctx, serviceID, action)
}

func (s *Service) MarkStalledCommandsTimeout(ctx context.Context, threshold time.Time) error {
	return s.repo.MarkStalledCommandsTimeout(ctx, threshold)
}
