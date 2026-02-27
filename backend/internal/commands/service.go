package commands

import (
	"context"
	"encoding/json"

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
	payloadJSON, _ := json.Marshal(payload)

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

func (s *Service) GetHistory(ctx context.Context, serviceID uuid.UUID, limit, offset int) ([]CommandLog, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetByServiceID(ctx, serviceID, limit, offset)
}

func (s *Service) IsServiceOwner(ctx context.Context, serviceID, userID uuid.UUID) bool {
	return s.repo.IsServiceOwner(ctx, serviceID, userID)
}
