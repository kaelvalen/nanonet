package probes

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"nanonet-backend/pkg/netguard"
)

// ErrInvalidTarget — kullanıcı geçersiz/izin verilmeyen bir probe hedefi
// verdiğinde döner. Handler bunu 400 olarak çevirir (500 değil).
var ErrInvalidTarget = errors.New("invalid probe target")

type Service struct {
	repo         *Repository
	guardOptions netguard.Options
}

func NewService(db *gorm.DB, guard netguard.Options) *Service {
	return &Service{repo: NewRepository(db), guardOptions: guard}
}

func (s *Service) Repo() *Repository { return s.repo }

func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateRequest) (*Probe, error) {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	method := strings.ToUpper(strings.TrimSpace(req.Method))
	if method == "" {
		method = "GET"
	}
	expected := req.ExpectedStatus
	if expected == 0 {
		expected = 200
	}
	if err := netguard.ValidateProbeTarget(ctx, req.Kind, req.Target, s.guardOptions); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidTarget, err)
	}
	p := &Probe{
		UserID:          userID,
		Name:            strings.TrimSpace(req.Name),
		Kind:            req.Kind,
		Target:          strings.TrimSpace(req.Target),
		Method:          method,
		ExpectedStatus:  expected,
		BodyContains:    req.BodyContains,
		IntervalSeconds: req.IntervalSeconds,
		TimeoutSeconds:  req.TimeoutSeconds,
		Enabled:         enabled,
	}
	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) Update(ctx context.Context, userID, id uuid.UUID, req UpdateRequest) (*Probe, error) {
	p, err := s.repo.Get(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		p.Name = strings.TrimSpace(*req.Name)
	}
	if req.Target != nil {
		p.Target = strings.TrimSpace(*req.Target)
	}
	if req.Method != nil {
		p.Method = strings.ToUpper(strings.TrimSpace(*req.Method))
	}
	if req.ExpectedStatus != nil {
		p.ExpectedStatus = *req.ExpectedStatus
	}
	if req.BodyContains != nil {
		p.BodyContains = req.BodyContains
	}
	if req.IntervalSeconds != nil {
		p.IntervalSeconds = *req.IntervalSeconds
	}
	if req.TimeoutSeconds != nil {
		p.TimeoutSeconds = *req.TimeoutSeconds
	}
	if req.Enabled != nil {
		p.Enabled = *req.Enabled
	}
	if err := netguard.ValidateProbeTarget(ctx, p.Kind, p.Target, s.guardOptions); err != nil {
		return nil, fmt.Errorf("probe target rejected: %w", err)
	}
	if err := s.repo.Save(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return s.repo.Delete(ctx, userID, id)
}

func (s *Service) Get(ctx context.Context, userID, id uuid.UUID) (*Probe, error) {
	return s.repo.Get(ctx, userID, id)
}

func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]Probe, error) {
	return s.repo.ListByUser(ctx, userID)
}

func (s *Service) Runs(ctx context.Context, userID, id uuid.UUID, limit int) ([]Run, error) {
	if _, err := s.repo.Get(ctx, userID, id); err != nil {
		return nil, err
	}
	return s.repo.RecentRuns(ctx, id, limit)
}
