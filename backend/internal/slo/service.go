package slo

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
	return &Service{repo: NewRepository(db)}
}

func (s *Service) Create(ctx context.Context, sl *SLO) error {
	return s.repo.Create(ctx, sl)
}
func (s *Service) Update(ctx context.Context, sl *SLO) error {
	return s.repo.Update(ctx, sl)
}
func (s *Service) Delete(ctx context.Context, u, id uuid.UUID) error {
	return s.repo.Delete(ctx, u, id)
}
func (s *Service) Get(ctx context.Context, u, id uuid.UUID) (*SLO, error) {
	return s.repo.Get(ctx, u, id)
}
func (s *Service) ListByUser(ctx context.Context, u uuid.UUID) ([]SLO, error) {
	return s.repo.ListByUser(ctx, u)
}
func (s *Service) ListByService(ctx context.Context, u, sid uuid.UUID) ([]SLO, error) {
	return s.repo.ListByService(ctx, u, sid)
}

// ComputeCompliance evaluates the SLO against the live metrics window.
// Bucketing is done in-process rather than via a SQL window to keep it portable
// and to avoid coupling to TimescaleDB's continuous aggregates here.
func (s *Service) ComputeCompliance(ctx context.Context, sl *SLO) (*Compliance, error) {
	to := time.Now()
	from := to.Add(-time.Duration(sl.WindowDays) * 24 * time.Hour)

	samples, err := s.repo.FetchSamples(ctx, sl.ServiceID, from, to)
	if err != nil {
		return nil, err
	}

	good, bad := classifySamples(samples, sl)
	total := good + bad

	currentSLI := 100.0
	if total > 0 {
		currentSLI = (float64(good) / float64(total)) * 100
	}

	// Error budget: how much of the allowed "bad" share have we already burned?
	// allowed bad fraction = 1 - target/100
	allowedBad := (100.0 - sl.Target) / 100.0
	usedBudget := 0.0
	if allowedBad > 0 && total > 0 {
		usedBudget = (float64(bad) / float64(total)) / allowedBad * 100
	}

	// Burn rate: actual bad rate / allowed bad rate. >1 means burning faster
	// than the target permits.
	burn := 0.0
	if allowedBad > 0 && total > 0 {
		burn = (float64(bad) / float64(total)) / allowedBad
	}

	burndown := buildBurndown(samples, sl, from, to)

	return &Compliance{
		SLO:             *sl,
		WindowStart:     from,
		WindowEnd:       to,
		TotalSamples:    total,
		GoodSamples:     good,
		BadSamples:      bad,
		CurrentSLI:      currentSLI,
		ErrorBudgetUsed: usedBudget,
		BurnRate:        burn,
		Healthy:         currentSLI >= sl.Target,
		Burndown:        burndown,
	}, nil
}

func classifySamples(samples []Sample, sl *SLO) (good, bad int) {
	for _, s := range samples {
		if isGood(s, sl) {
			good++
		} else {
			bad++
		}
	}
	return
}

func isGood(s Sample, sl *SLO) bool {
	switch sl.SLIType {
	case SLILatency:
		if s.LatencyMS == nil || sl.Threshold == nil {
			return true // missing data → don't penalise
		}
		return float64(*s.LatencyMS) <= *sl.Threshold
	case SLIErrorRate:
		if s.ErrorRate == nil || sl.Threshold == nil {
			return true
		}
		return float64(*s.ErrorRate) <= *sl.Threshold
	default: // availability
		return s.Status == "up"
	}
}

// buildBurndown creates ~30 evenly-spaced cumulative buckets across the window
// so the UI can draw a budget-remaining curve.
func buildBurndown(samples []Sample, sl *SLO, from, to time.Time) []BurndownPoint {
	const buckets = 30
	if to.Before(from) || len(samples) == 0 {
		return []BurndownPoint{}
	}

	bucketDur := to.Sub(from) / buckets
	if bucketDur <= 0 {
		return []BurndownPoint{}
	}

	allowedBad := (100.0 - sl.Target) / 100.0
	out := make([]BurndownPoint, 0, buckets)

	cumGood, cumBad := 0, 0
	idx := 0
	for b := 1; b <= buckets; b++ {
		boundary := from.Add(time.Duration(b) * bucketDur)
		for idx < len(samples) && !samples[idx].Time.After(boundary) {
			if isGood(samples[idx], sl) {
				cumGood++
			} else {
				cumBad++
			}
			idx++
		}
		total := cumGood + cumBad
		sli := 100.0
		if total > 0 {
			sli = float64(cumGood) / float64(total) * 100
		}
		used := 0.0
		if allowedBad > 0 && total > 0 {
			used = (float64(cumBad) / float64(total)) / allowedBad * 100
		}
		remaining := 100.0 - used
		if remaining < 0 {
			remaining = 0
		}
		out = append(out, BurndownPoint{
			Timestamp:       boundary,
			BudgetRemaining: remaining,
			SLI:             sli,
		})
	}
	return out
}
