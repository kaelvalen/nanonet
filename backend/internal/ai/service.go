package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"nanonet-backend/internal/metrics"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	db          *gorm.DB
	apiKey      string
	client      *http.Client
	repo        *Repository
	metricsRepo *metrics.Repository
	rateLimiter *RateLimiter
}

type RateLimiter struct {
	mu       sync.Mutex
	counters map[string][]time.Time
	limit    int
	window   time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		counters: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

func (rl *RateLimiter) Allow(userID string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	timestamps := rl.counters[userID]
	var valid []time.Time
	for _, t := range timestamps {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		rl.counters[userID] = valid
		return false
	}

	rl.counters[userID] = append(valid, now)
	return true
}

func NewService(db *gorm.DB, apiKey string) *Service {
	return &Service{
		db:          db,
		apiKey:      apiKey,
		client:      &http.Client{Timeout: 60 * time.Second},
		repo:        NewRepository(db),
		metricsRepo: metrics.NewRepository(db),
		rateLimiter: NewRateLimiter(10, time.Minute),
	}
}

func (s *Service) Analyze(ctx context.Context, userID, serviceID uuid.UUID, windowMinutes int) (*AnalysisResult, error) {
	if !s.rateLimiter.Allow(userID.String()) {
		return nil, fmt.Errorf("AI analiz limiti aşıldı, lütfen 1 dakika bekleyin")
	}

	if windowMinutes <= 0 {
		windowMinutes = 30
	}

	duration := time.Duration(windowMinutes) * time.Minute

	// Servis bilgilerini al
	type svcInfo struct {
		ID             uuid.UUID `gorm:"column:id"`
		Name           string    `gorm:"column:name"`
		Host           string    `gorm:"column:host"`
		Port           int       `gorm:"column:port"`
		HealthEndpoint string    `gorm:"column:health_endpoint"`
		Status         string    `gorm:"column:status"`
		UserID         uuid.UUID `gorm:"column:user_id"`
	}
	var svc svcInfo
	if err := s.db.WithContext(ctx).Table("services").
		Where("id = ? AND user_id = ?", serviceID, userID).
		First(&svc).Error; err != nil {
		return nil, fmt.Errorf("servis bulunamadı")
	}

	// Metrikleri al
	metricsData, err := s.metricsRepo.GetHistory(ctx, serviceID, duration, 500)
	if err != nil {
		return nil, fmt.Errorf("metrikler alınamadı: %w", err)
	}

	if len(metricsData) == 0 {
		return &AnalysisResult{
			Summary:   "Analiz edilecek yeterli metrik verisi bulunamadı.",
			RootCause: "Henüz metrik kaydı yok veya belirtilen zaman aralığında veri bulunmuyor.",
			Recommendations: []Recommendation{
				{Action: "Agent'ın doğru yapılandırıldığından emin olun", Priority: "high"},
				{Action: "Servisin erişilebilir olduğunu kontrol edin", Priority: "medium"},
			},
		}, nil
	}

	metricsJSON, err := json.Marshal(metricsData)
	if err != nil {
		return nil, fmt.Errorf("metrik serileştirme hatası: %w", err)
	}

	// Diğer servislerin durumu (cross-servis korelasyon)
	var otherServices []svcInfo
	s.db.WithContext(ctx).Table("services").
		Where("user_id = ? AND id != ?", userID, serviceID).
		Find(&otherServices)

	var otherSvcInfo strings.Builder
	if len(otherServices) == 0 {
		otherSvcInfo.WriteString("Başka servis bulunmuyor.")
	} else {
		for _, os := range otherServices {
			otherSvcInfo.WriteString(fmt.Sprintf("- %s (%s:%d): durum=%s\n", os.Name, os.Host, os.Port, os.Status))
		}
	}

	prompt := fmt.Sprintf(AnalysisPromptTemplate,
		SanitizeForPrompt(svc.Name),
		SanitizeForPrompt(svc.Host),
		svc.Port,
		SanitizeForPrompt(svc.HealthEndpoint),
		windowMinutes,
		string(metricsJSON),
		otherSvcInfo.String(),
	)

	result, err := s.callClaude(prompt)
	if err != nil {
		return nil, fmt.Errorf("AI analizi başarısız: %w", err)
	}

	// Insight'ı kaydet
	go s.saveInsight(serviceID, result)

	return result, nil
}

func (s *Service) callClaude(prompt string) (*AnalysisResult, error) {
	reqBody := ClaudeRequest{
		Model:     DefaultModel,
		MaxTokens: MaxTokensDefault,
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
		return nil, fmt.Errorf("Claude API hatası (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var claudeResp ClaudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return nil, err
	}

	if len(claudeResp.Content) == 0 {
		return nil, fmt.Errorf("Claude boş yanıt döndü")
	}

	rawText := claudeResp.Content[0].Text
	// Markdown code fence varsa temizle (```json ... ``` veya ``` ... ```)
	rawText = strings.TrimSpace(rawText)
	if idx := strings.Index(rawText, "{"); idx > 0 {
		rawText = rawText[idx:]
	}
	if idx := strings.LastIndex(rawText, "}"); idx >= 0 && idx < len(rawText)-1 {
		rawText = rawText[:idx+1]
	}

	var result AnalysisResult
	if err := json.Unmarshal([]byte(rawText), &result); err != nil {
		return nil, fmt.Errorf("AI yanıtı parse edilemedi (raw: %.200s): %w", rawText, err)
	}

	return &result, nil
}

func (s *Service) saveInsight(serviceID uuid.UUID, result *AnalysisResult) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Servisin en son aktif alert'ini bul veya yeni oluştur
	var alertID uuid.UUID
	err := s.db.WithContext(ctx).
		Table("alerts").
		Select("id").
		Where("service_id = ? AND resolved_at IS NULL", serviceID).
		Order("triggered_at DESC").
		Limit(1).
		Scan(&alertID).Error

	if err != nil || alertID == uuid.Nil {
		// Analiz için yeni bir alert oluştur
		alertID = uuid.New()
		s.db.WithContext(ctx).Exec(
			`INSERT INTO alerts (id, service_id, type, severity, message, triggered_at)
			 VALUES (?, ?, 'ai_analysis', 'info', ?, NOW())`,
			alertID, serviceID, result.Summary,
		)
	}

	recsJSON, _ := json.Marshal(result.Recommendations)

	insight := &AIInsight{
		AlertID:         alertID,
		Model:           DefaultModel,
		Summary:         result.Summary,
		RootCause:       &result.RootCause,
		Recommendations: recsJSON,
	}

	s.repo.Create(ctx, insight)
}

func (s *Service) GetInsights(ctx context.Context, serviceID uuid.UUID, limit, offset int) ([]AIInsight, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetByServiceID(ctx, serviceID, limit, offset)
}
