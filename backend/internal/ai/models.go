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
	WindowMinutes int `json:"window_minutes" binding:"omitempty,min=1,max=1440"`
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
