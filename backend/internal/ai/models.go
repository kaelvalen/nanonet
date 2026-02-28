package ai

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AIInsight struct {
	ID              uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	AlertID         uuid.UUID       `gorm:"type:uuid;not null" json:"alert_id"`
	Model           string          `gorm:"type:varchar(50);not null" json:"model"`
	Summary         string          `gorm:"type:text;not null" json:"summary"`
	RootCause       *string         `gorm:"type:text" json:"root_cause,omitempty"`
	Recommendations json.RawMessage `gorm:"type:jsonb" json:"recommendations,omitempty"`
	CreatedAt       time.Time       `gorm:"not null;default:now()" json:"created_at"`
}

func (AIInsight) TableName() string {
	return "ai_insights"
}

type AnalyzeRequest struct {
	WindowMinutes int  `json:"window_minutes" binding:"omitempty,min=1,max=1440"`
	DeepAnalysis  bool `json:"deep_analysis"`
}

type MetricsSummary struct {
	SampleCount int     `json:"sample_count"`
	WindowMin   int     `json:"window_minutes"`

	CPUMean   float64 `json:"cpu_mean"`
	CPUStddev float64 `json:"cpu_stddev"`
	CPUMin    float64 `json:"cpu_min"`
	CPUMax    float64 `json:"cpu_max"`

	MemMean   float64 `json:"mem_mean_mb"`
	MemStddev float64 `json:"mem_stddev_mb"`
	MemMin    float64 `json:"mem_min_mb"`
	MemMax    float64 `json:"mem_max_mb"`

	LatencyMean   float64 `json:"latency_mean_ms"`
	LatencyStddev float64 `json:"latency_stddev_ms"`
	LatencyMin    float64 `json:"latency_min_ms"`
	LatencyMax    float64 `json:"latency_max_ms"`
	LatencyP95    float64 `json:"latency_p95_ms"`

	ErrorRateMean float64 `json:"error_rate_mean"`
	SpikeCount    int     `json:"spike_count"`
	DownCount     int     `json:"down_count"`
	DegradedCount int     `json:"degraded_count"`

	TrendDirection string  `json:"trend_direction"`
	TrendDelta     float64 `json:"trend_delta_ms"`
}

type AnalysisResult struct {
	Summary         string           `json:"summary"`
	RootCause       string           `json:"root_cause"`
	Recommendations []Recommendation `json:"recommendations"`
	Confidence      float64          `json:"confidence,omitempty"`
}

type Recommendation struct {
	Action   string `json:"action"`
	Priority string `json:"priority"`
}

type ClaudeRequest struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	Messages  []Message `json:"messages"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ClaudeResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}
