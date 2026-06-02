package billing

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrLimitReached  = errors.New("plan limiti aşıldı")
	ErrFeatureGated  = errors.New("bu özellik planınıza dahil değil")
	ErrNotFound      = errors.New("abonelik bulunamadı")
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// GetPlans returns all available plans ordered by tier.
func (s *Service) GetPlans(ctx context.Context) ([]Plan, error) {
	var plans []Plan
	return plans, s.db.WithContext(ctx).Order("tier ASC").Find(&plans).Error
}

// GetSubscription returns the active subscription for a user (creates free if missing).
func (s *Service) GetSubscription(ctx context.Context, userID uuid.UUID) (*Subscription, error) {
	var sub Subscription
	err := s.db.WithContext(ctx).
		Preload("Plan").
		Where("user_id = ?", userID).
		First(&sub).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Auto-provision free plan
		return s.provisionFree(ctx, userID)
	}
	return &sub, err
}

// GetPlan returns the plan for a user directly (fast path, no JOIN).
func (s *Service) GetPlan(ctx context.Context, userID uuid.UUID) (*Plan, error) {
	sub, err := s.GetSubscription(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &sub.Plan, nil
}

// ChangePlan switches a user to a different plan.
// In production this would integrate with Stripe; here it's immediate.
func (s *Service) ChangePlan(ctx context.Context, userID uuid.UUID, planID string) (*Subscription, error) {
	var plan Plan
	if err := s.db.WithContext(ctx).First(&plan, "id = ?", planID).Error; err != nil {
		return nil, fmt.Errorf("plan bulunamadı: %s", planID)
	}

	now := time.Now()
	end := now.AddDate(0, 1, 0)

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&Subscription{}).
			Where("user_id = ?", userID).
			Updates(map[string]any{
				"plan_id":               planID,
				"status":                "active",
				"current_period_start":  now,
				"current_period_end":    end,
				"cancel_at_period_end":  false,
				"updated_at":            now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			sub := &Subscription{
				UserID:             userID,
				PlanID:             planID,
				Status:             "active",
				CurrentPeriodStart: now,
				CurrentPeriodEnd:   &end,
			}
			if err := tx.Create(sub).Error; err != nil {
				return err
			}
		}
		// Update denormalized plan_tier on users table
		return tx.Exec("UPDATE users SET plan_tier = ? WHERE id = ?", plan.Tier, userID).Error
	})
	if err != nil {
		return nil, err
	}
	return s.GetSubscription(ctx, userID)
}

// CancelSubscription marks the subscription to cancel at period end.
func (s *Service) CancelSubscription(ctx context.Context, userID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Model(&Subscription{}).
		Where("user_id = ?", userID).
		Updates(map[string]any{
			"cancel_at_period_end": true,
			"updated_at":           time.Now(),
		}).Error
}

// GetUsage returns current usage counts for a user this billing period.
func (s *Service) GetUsage(ctx context.Context, userID uuid.UUID) (*UsageStats, error) {
	var stats UsageStats

	if err := s.db.WithContext(ctx).Raw(
		"SELECT COUNT(*) FROM services WHERE user_id = ?", userID,
	).Scan(&stats.ServicesUsed).Error; err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Raw(
		"SELECT COUNT(*) FROM services WHERE user_id = ? AND agent_status IN ('healthy','stale')", userID,
	).Scan(&stats.AgentsUsed).Error; err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Raw(
		"SELECT COUNT(*) FROM probes WHERE user_id = ?", userID,
	).Scan(&stats.ProbesUsed).Error; err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Raw(
		"SELECT COUNT(*) FROM service_alert_rules WHERE service_id IN (SELECT id FROM services WHERE user_id = ?)", userID,
	).Scan(&stats.AlertRulesUsed).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	if err := s.db.WithContext(ctx).Raw(
		"SELECT COALESCE(SUM(input_tokens+output_tokens),0) FROM ai_usage WHERE user_id = ? AND created_at >= ?",
		userID, monthStart,
	).Scan(&stats.AITokensUsed).Error; err != nil {
		return nil, err
	}

	return &stats, nil
}

// CheckServiceLimit returns ErrLimitReached if the user is at their service limit.
func (s *Service) CheckServiceLimit(ctx context.Context, userID uuid.UUID) error {
	plan, err := s.GetPlan(ctx, userID)
	if err != nil {
		return nil // don't block on billing errors
	}
	if plan.MaxServices <= 0 {
		return nil // unlimited
	}
	var count int64
	s.db.WithContext(ctx).Model(&struct{}{}).Table("services").
		Where("user_id = ?", userID).Count(&count)
	if int(count) >= plan.MaxServices {
		return fmt.Errorf("%w: maksimum %d servis (plan: %s)", ErrLimitReached, plan.MaxServices, plan.Name)
	}
	return nil
}

// CheckProbeLimit returns ErrLimitReached if the user is at their probe limit.
func (s *Service) CheckProbeLimit(ctx context.Context, userID uuid.UUID) error {
	plan, err := s.GetPlan(ctx, userID)
	if err != nil {
		return nil
	}
	if plan.MaxProbes <= 0 {
		return nil
	}
	var count int64
	s.db.WithContext(ctx).Model(&struct{}{}).Table("probes").
		Where("user_id = ?", userID).Count(&count)
	if int(count) >= plan.MaxProbes {
		return fmt.Errorf("%w: maksimum %d probe (plan: %s)", ErrLimitReached, plan.MaxProbes, plan.Name)
	}
	return nil
}

// CheckFeature returns ErrFeatureGated if the plan doesn't include the feature.
func (s *Service) CheckFeature(ctx context.Context, userID uuid.UUID, feature string) error {
	plan, err := s.GetPlan(ctx, userID)
	if err != nil {
		return nil
	}
	switch feature {
	case "k8s":
		if !plan.K8sEnabled {
			return fmt.Errorf("%w: Kubernetes (plan: %s)", ErrFeatureGated, plan.Name)
		}
	case "slo":
		if !plan.SLOEnabled {
			return fmt.Errorf("%w: SLO (plan: %s)", ErrFeatureGated, plan.Name)
		}
	case "runbooks":
		if !plan.RunbooksEnabled {
			return fmt.Errorf("%w: Runbook'lar (plan: %s)", ErrFeatureGated, plan.Name)
		}
	case "ai":
		if plan.AITokensMonthly == 0 {
			return fmt.Errorf("%w: AI özelliği (plan: %s)", ErrFeatureGated, plan.Name)
		}
	}
	return nil
}

func (s *Service) provisionFree(ctx context.Context, userID uuid.UUID) (*Subscription, error) {
	sub := &Subscription{
		UserID: userID,
		PlanID: "free",
		Status: "active",
		CurrentPeriodStart: time.Now(),
	}
	if err := s.db.WithContext(ctx).Create(sub).Error; err != nil {
		return nil, err
	}
	return s.GetSubscription(ctx, userID)
}
