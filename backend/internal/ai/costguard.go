package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ErrBudgetExceeded — kullanıcının aylık AI bütçesi aşıldı.
var ErrBudgetExceeded = errors.New("aylık AI bütçesi aşıldı")

// ModelPricing is per-million-token USD pricing. Source: Anthropic public
// pricing as of mid-2025. Update here when models change.
type ModelPricing struct {
	InputUSDPerMTok  float64
	OutputUSDPerMTok float64
}

var modelPricing = map[string]ModelPricing{
	// Haiku family
	"claude-3-5-haiku-20241022": {InputUSDPerMTok: 0.80, OutputUSDPerMTok: 4.00},
	"claude-3-haiku-20240307":   {InputUSDPerMTok: 0.25, OutputUSDPerMTok: 1.25},
	// Sonnet family
	"claude-3-5-sonnet-20241022": {InputUSDPerMTok: 3.00, OutputUSDPerMTok: 15.00},
	"claude-3-7-sonnet-20250219": {InputUSDPerMTok: 3.00, OutputUSDPerMTok: 15.00},
	// Opus family
	"claude-3-opus-20240229": {InputUSDPerMTok: 15.00, OutputUSDPerMTok: 75.00},
}

func priceFor(model string) ModelPricing {
	if p, ok := modelPricing[model]; ok {
		return p
	}
	// Sensible default (sonnet-tier) so unknown models still cost something
	// instead of silently being free.
	return ModelPricing{InputUSDPerMTok: 3.0, OutputUSDPerMTok: 15.0}
}

// EstimateCost returns USD cost for an exact (model, in, out) tuple.
func EstimateCost(model string, inputTokens, outputTokens int) float64 {
	p := priceFor(model)
	return float64(inputTokens)/1_000_000.0*p.InputUSDPerMTok +
		float64(outputTokens)/1_000_000.0*p.OutputUSDPerMTok
}

// UsageRow is what we expose to handlers / the dashboard.
type UsageRow struct {
	ID           uuid.UUID  `gorm:"column:id"            json:"id"`
	UserID       uuid.UUID  `gorm:"column:user_id"       json:"user_id"`
	ServiceID    *uuid.UUID `gorm:"column:service_id"   json:"service_id,omitempty"`
	Model        string     `gorm:"column:model"         json:"model"`
	Kind         string     `gorm:"column:kind"          json:"kind"`
	InputTokens  int        `gorm:"column:input_tokens"  json:"input_tokens"`
	OutputTokens int        `gorm:"column:output_tokens" json:"output_tokens"`
	CostUSD      float64    `gorm:"column:cost_usd"      json:"cost_usd"`
	CacheHit     bool       `gorm:"column:cache_hit"     json:"cache_hit"`
	LatencyMS    int        `gorm:"column:latency_ms"    json:"latency_ms"`
	CreatedAt    time.Time  `gorm:"column:created_at"    json:"created_at"`
}

func (UsageRow) TableName() string { return "ai_usage" }

// UsageSummary is a month-to-date roll-up plus the user's configured budget.
type UsageSummary struct {
	MonthSpendUSD      float64   `json:"month_spend_usd"`
	MonthInputTokens   int       `json:"month_input_tokens"`
	MonthOutputTokens  int       `json:"month_output_tokens"`
	MonthCallCount     int       `json:"month_call_count"`
	CacheHitCount      int       `json:"month_cache_hits"`
	BudgetUSD          *float64  `json:"budget_usd,omitempty"`
	BudgetUsedPct      *float64  `json:"budget_used_pct,omitempty"`
	BudgetRemainingUSD *float64  `json:"budget_remaining_usd,omitempty"`
	WindowStart        time.Time `json:"window_start"`
}

// CostGuard wraps the Claude call with budget enforcement, prompt caching, and
// usage logging. It owns the *gorm.DB so it can write/read all three tables.
type CostGuard struct {
	db       *gorm.DB
	cacheTTL time.Duration
}

func NewCostGuard(db *gorm.DB) *CostGuard {
	return &CostGuard{db: db, cacheTTL: time.Hour}
}

// CheckBudget returns ErrBudgetExceeded if the user has set a monthly budget
// and the current month-to-date spend already meets/exceeds it.
func (g *CostGuard) CheckBudget(ctx context.Context, userID uuid.UUID) error {
	var budget *float64
	if err := g.db.WithContext(ctx).Raw(`
		SELECT ai_monthly_budget_usd FROM user_settings WHERE user_id = ?
	`, userID).Scan(&budget).Error; err != nil {
		// No settings row yet → no budget configured. Allow.
		return nil
	}
	if budget == nil || *budget <= 0 {
		return nil
	}
	spend, err := g.MonthSpend(ctx, userID)
	if err != nil {
		return nil // best-effort — never block on a metering failure
	}
	if spend >= *budget {
		return ErrBudgetExceeded
	}
	return nil
}

// MonthSpend returns the current calendar month's spend for userID.
func (g *CostGuard) MonthSpend(ctx context.Context, userID uuid.UUID) (float64, error) {
	var spend float64
	err := g.db.WithContext(ctx).Raw(`
		SELECT COALESCE(SUM(cost_usd), 0) FROM ai_usage
		WHERE user_id = ? AND created_at >= date_trunc('month', NOW())
	`, userID).Scan(&spend).Error
	return spend, err
}

// LookupCache fetches a cached response if the (model, prompt) pair has been
// seen within the TTL. Returns nil when there is no fresh hit.
func (g *CostGuard) LookupCache(ctx context.Context, model, prompt string) (*CachedResponse, error) {
	hash := promptHash(model, prompt)
	var row struct {
		ResponseJSON string    `gorm:"column:response_json"`
		InputTokens  int       `gorm:"column:input_tokens"`
		OutputTokens int       `gorm:"column:output_tokens"`
		ExpiresAt    time.Time `gorm:"column:expires_at"`
	}
	err := g.db.WithContext(ctx).Raw(`
		SELECT response_json, input_tokens, output_tokens, expires_at
		FROM ai_prompt_cache WHERE prompt_hash = ?
	`, hash).Scan(&row).Error
	if err != nil || row.ResponseJSON == "" {
		return nil, nil //nolint:nilnil // intentional: no hit
	}
	if time.Now().After(row.ExpiresAt) {
		// Best-effort delete; failure is fine — pruner will catch it.
		_ = g.db.WithContext(ctx).Exec(`DELETE FROM ai_prompt_cache WHERE prompt_hash = ?`, hash).Error
		return nil, nil //nolint:nilnil
	}
	return &CachedResponse{
		ResponseJSON: row.ResponseJSON,
		InputTokens:  row.InputTokens,
		OutputTokens: row.OutputTokens,
	}, nil
}

// StoreCache writes (or upserts) a cache entry.
func (g *CostGuard) StoreCache(ctx context.Context, model, prompt, responseJSON string, in, out int) {
	hash := promptHash(model, prompt)
	expires := time.Now().Add(g.cacheTTL)
	_ = g.db.WithContext(ctx).Exec(`
		INSERT INTO ai_prompt_cache (prompt_hash, model, response_json, input_tokens, output_tokens, expires_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (prompt_hash) DO UPDATE SET
			model = EXCLUDED.model,
			response_json = EXCLUDED.response_json,
			input_tokens = EXCLUDED.input_tokens,
			output_tokens = EXCLUDED.output_tokens,
			expires_at = EXCLUDED.expires_at
	`, hash, model, responseJSON, in, out, expires).Error
}

// LogUsage appends a billing row. Always best-effort; never blocks the caller.
func (g *CostGuard) LogUsage(ctx context.Context, in UsageRow) {
	if in.CostUSD == 0 && (in.InputTokens > 0 || in.OutputTokens > 0) {
		in.CostUSD = EstimateCost(in.Model, in.InputTokens, in.OutputTokens)
	}
	if in.CreatedAt.IsZero() {
		in.CreatedAt = time.Now()
	}
	_ = g.db.WithContext(ctx).Exec(`
		INSERT INTO ai_usage
			(user_id, service_id, model, kind, input_tokens, output_tokens, cost_usd, cache_hit, latency_ms, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		in.UserID, in.ServiceID, in.Model, in.Kind,
		in.InputTokens, in.OutputTokens, in.CostUSD,
		in.CacheHit, in.LatencyMS, in.CreatedAt,
	).Error
}

// PruneCache deletes expired cache rows. Run periodically.
func (g *CostGuard) PruneCache(ctx context.Context) error {
	return g.db.WithContext(ctx).Exec(`DELETE FROM ai_prompt_cache WHERE expires_at < NOW()`).Error
}

// Summary computes the dashboard view.
func (g *CostGuard) Summary(ctx context.Context, userID uuid.UUID) (*UsageSummary, error) {
	var row struct {
		Spend     float64 `gorm:"column:spend"`
		InTok     int     `gorm:"column:in_tok"`
		OutTok    int     `gorm:"column:out_tok"`
		Calls     int     `gorm:"column:calls"`
		CacheHits int     `gorm:"column:cache_hits"`
	}
	if err := g.db.WithContext(ctx).Raw(`
		SELECT COALESCE(SUM(cost_usd), 0)            AS spend,
		       COALESCE(SUM(input_tokens), 0)        AS in_tok,
		       COALESCE(SUM(output_tokens), 0)       AS out_tok,
		       COUNT(*)                               AS calls,
		       COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0) AS cache_hits
		FROM ai_usage
		WHERE user_id = ? AND created_at >= date_trunc('month', NOW())
	`, userID).Scan(&row).Error; err != nil {
		return nil, err
	}

	out := &UsageSummary{
		MonthSpendUSD:     row.Spend,
		MonthInputTokens:  row.InTok,
		MonthOutputTokens: row.OutTok,
		MonthCallCount:    row.Calls,
		CacheHitCount:     row.CacheHits,
		WindowStart:       startOfMonth(time.Now()),
	}

	var budget *float64
	_ = g.db.WithContext(ctx).Raw(`
		SELECT ai_monthly_budget_usd FROM user_settings WHERE user_id = ?
	`, userID).Scan(&budget).Error
	if budget != nil && *budget > 0 {
		out.BudgetUSD = budget
		used := (row.Spend / *budget) * 100
		remaining := *budget - row.Spend
		if remaining < 0 {
			remaining = 0
		}
		out.BudgetUsedPct = &used
		out.BudgetRemainingUSD = &remaining
	}
	return out, nil
}

// RecentCalls returns the N most recent usage rows for the dashboard table.
func (g *CostGuard) RecentCalls(ctx context.Context, userID uuid.UUID, limit int) ([]UsageRow, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var out []UsageRow
	err := g.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&out).Error
	return out, err
}

// CachedResponse is what LookupCache returns on a hit.
type CachedResponse struct {
	ResponseJSON string
	InputTokens  int
	OutputTokens int
}

func promptHash(model, prompt string) string {
	h := sha256.New()
	h.Write([]byte(model))
	h.Write([]byte{0})
	h.Write([]byte(strings.TrimSpace(prompt)))
	return hex.EncodeToString(h.Sum(nil))
}

func startOfMonth(t time.Time) time.Time {
	y, m, _ := t.Date()
	return time.Date(y, m, 1, 0, 0, 0, 0, t.Location())
}
