package billing

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Plan struct {
	ID                  string    `gorm:"primaryKey"            json:"id"`
	Name                string    `                              json:"name"`
	Tier                int       `                              json:"tier"`
	PriceMonthlyUSD     float64   `gorm:"column:price_monthly_usd" json:"price_monthly_usd"`
	MaxServices         int       `                              json:"max_services"`
	MaxAgents           int       `                              json:"max_agents"`
	MaxProbes           int       `                              json:"max_probes"`
	MaxAlertRules       int       `                              json:"max_alert_rules"`
	AITokensMonthly     int64     `                              json:"ai_tokens_monthly"`
	MetricRetentionDays int       `                              json:"metric_retention_days"`
	LogRetentionDays    int       `                              json:"log_retention_days"`
	K8sEnabled          bool      `                              json:"k8s_enabled"`
	SLOEnabled          bool      `                              json:"slo_enabled"`
	RunbooksEnabled     bool      `                              json:"runbooks_enabled"`
	TeamMembers         int       `                              json:"team_members"`
	CreatedAt           time.Time `                              json:"created_at"`
}

func (Plan) TableName() string { return "plans" }

type Subscription struct {
	ID                  uuid.UUID  `gorm:"type:uuid;primaryKey"  json:"id"`
	UserID              uuid.UUID  `gorm:"type:uuid"             json:"user_id"`
	PlanID              string     `                              json:"plan_id"`
	Plan                Plan       `gorm:"foreignKey:PlanID"     json:"plan"`
	Status              string     `                              json:"status"` // active, canceled, past_due, trialing
	CurrentPeriodStart  time.Time  `                              json:"current_period_start"`
	CurrentPeriodEnd    *time.Time `                              json:"current_period_end"`
	CancelAtPeriodEnd   bool       `                              json:"cancel_at_period_end"`
	StripeCustomerID    *string    `gorm:"column:stripe_customer_id"       json:"-"`
	StripeSubscriptionID *string   `gorm:"column:stripe_subscription_id"   json:"-"`
	CreatedAt           time.Time  `                              json:"created_at"`
	UpdatedAt           time.Time  `                              json:"updated_at"`
}

func (Subscription) TableName() string { return "subscriptions" }

func (s *Subscription) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

// UsageStats holds current usage counts for a user.
type UsageStats struct {
	ServicesUsed   int   `json:"services_used"`
	AgentsUsed     int   `json:"agents_used"`
	ProbesUsed     int   `json:"probes_used"`
	AlertRulesUsed int   `json:"alert_rules_used"`
	AITokensUsed   int64 `json:"ai_tokens_used"`
}

// PlanSummary is what the API returns — subscription + usage + limits.
type PlanSummary struct {
	Subscription Subscription `json:"subscription"`
	Usage        UsageStats   `json:"usage"`
}
