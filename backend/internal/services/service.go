package services

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ServiceLayer struct {
	repo *Repository
}

func NewServiceLayer(db *gorm.DB) *ServiceLayer {
	return &ServiceLayer{
		repo: NewRepository(db),
	}
}

func (s *ServiceLayer) Create(ctx context.Context, userID uuid.UUID, req CreateServiceRequest) (*Service, error) {
	service := &Service{
		UserID:          userID,
		Name:            req.Name,
		Host:            req.Host,
		Port:            req.Port,
		HealthEndpoint:  req.HealthEndpoint,
		PollIntervalSec: req.PollIntervalSec,
		Status:          "unknown",
	}

	if err := s.repo.Create(ctx, service); err != nil {
		return nil, err
	}

	return service, nil
}

func (s *ServiceLayer) Get(ctx context.Context, id, userID uuid.UUID) (*Service, error) {
	return s.repo.GetByID(ctx, id, userID)
}

func (s *ServiceLayer) List(ctx context.Context, userID uuid.UUID) ([]Service, error) {
	return s.repo.List(ctx, userID)
}

func (s *ServiceLayer) Update(ctx context.Context, id, userID uuid.UUID, req UpdateServiceRequest) (*Service, error) {
	service, err := s.repo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		service.Name = *req.Name
	}
	if req.Host != nil {
		service.Host = *req.Host
	}
	if req.Port != nil {
		service.Port = *req.Port
	}
	if req.HealthEndpoint != nil {
		service.HealthEndpoint = *req.HealthEndpoint
	}
	if req.PollIntervalSec != nil {
		service.PollIntervalSec = *req.PollIntervalSec
	}

	if err := s.repo.Update(ctx, service); err != nil {
		return nil, err
	}

	return service, nil
}

func (s *ServiceLayer) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.Delete(ctx, id, userID)
}
