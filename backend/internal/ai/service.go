package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	apiKey string
	client *http.Client
}

func NewService(db *gorm.DB, apiKey string) *Service {
	return &Service{
		db:     db,
		apiKey: apiKey,
		client: &http.Client{Timeout: 30 * time.Second},
	}
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

type AnalysisResult struct {
	Summary         string   `json:"summary"`
	RootCause       string   `json:"root_cause"`
	Recommendations []string `json:"recommendations"`
}

func (s *Service) AnalyzeMetrics(serviceID uuid.UUID, metricsData string) (*AnalysisResult, error) {
	prompt := fmt.Sprintf(`Sen bir DevOps uzmanısın. Aşağıdaki mikroservis metriklerini analiz et ve sorunları tespit et.

Metrikler:
%s

Lütfen şu formatta JSON yanıt ver:
{
  "summary": "Genel durum özeti (2-3 cümle)",
  "root_cause": "Tespit edilen ana sorun veya performans darboğazı",
  "recommendations": ["Somut aksiyon önerisi 1", "Somut aksiyon önerisi 2", "Somut aksiyon önerisi 3"]
}

Öneriler spesifik ve uygulanabilir olmalı (örn: "CPU kullanımını azaltmak için worker thread sayısını 4'e düşür").`, metricsData)

	reqBody := ClaudeRequest{
		Model:     "claude-3-5-sonnet-20241022",
		MaxTokens: 1024,
		Messages: []Message{
			{Role: "user", Content: prompt},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Claude API hatası: %s", string(body))
	}

	var claudeResp ClaudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return nil, err
	}

	if len(claudeResp.Content) == 0 {
		return nil, fmt.Errorf("boş yanıt")
	}

	var result AnalysisResult
	if err := json.Unmarshal([]byte(claudeResp.Content[0].Text), &result); err != nil {
		return nil, err
	}

	return &result, nil
}
