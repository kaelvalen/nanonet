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

// TimeRange kullanıcının seçtiği raporlama zaman aralığı.
type TimeRange string

const (
	TimeRange1h  TimeRange = "1h"
	TimeRange24h TimeRange = "24h"
	TimeRange7d  TimeRange = "7d"
	TimeRange30d TimeRange = "30d"
)

func (tr TimeRange) ToMinutes() int {
	switch tr {
	case TimeRange1h:
		return 60
	case TimeRange24h:
		return 1440
	case TimeRange7d:
		return 10080
	case TimeRange30d:
		return 43200
	default:
		return 1440
	}
}

func (tr TimeRange) Label() string {
	switch tr {
	case TimeRange1h:
		return "Son 1 Saat"
	case TimeRange24h:
		return "Son 24 Saat"
	case TimeRange7d:
		return "Son 7 Gün"
	case TimeRange30d:
		return "Son 30 Gün"
	default:
		return "Son 24 Saat"
	}
}

type ReportRequest struct {
	TimeRange TimeRange `json:"time_range" binding:"required"`
	ServiceID string    `json:"service_id"`
}

// ReportEvent tek bir tespit edilen olay.
type ReportEvent struct {
	Service     string `json:"service"`
	Time        string `json:"time"`
	Observation string `json:"observation"`
	RootCause   string `json:"root_cause"`
	Impact      string `json:"impact"`
	Action      string `json:"action"`
	Outcome     string `json:"outcome"`
	Category    string `json:"category"` // tamamlandı / müdahale_gerekli / izleniyor / trend
}

// ReportResult proaktif AI raporunun tam yapısı.
type ReportResult struct {
	PeriodLabel    string           `json:"period_label"`
	SystemScore    string           `json:"system_score"` // SAĞLIKLI / DİKKAT / KRİTİK
	Headline       string           `json:"headline"`
	TotalRequests  string           `json:"total_requests,omitempty"`
	CriticalEvents int              `json:"critical_events"`
	ResolvedEvents int              `json:"resolved_events"`
	Events         []ReportEvent    `json:"events"`
	Actions        []Recommendation `json:"actions"`
	RiskForecast   string           `json:"risk_forecast"`
	Confidence     float64          `json:"confidence,omitempty"`
}

type MetricsSummary struct {
	SampleCount int `json:"sample_count"`
	WindowMin   int `json:"window_minutes"`

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
	Trend           string           `json:"trend,omitempty"`
	Recommendations []Recommendation `json:"recommendations"`
	Confidence      float64          `json:"confidence,omitempty"`
}

type Recommendation struct {
	Action          string `json:"action"`
	Priority        string `json:"priority"`
	EstimatedImpact string `json:"estimated_impact,omitempty"`
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
	StopReason string `json:"stop_reason"`
}
