package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"nanonet-backend/internal/metrics"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ErrRateLimitExceeded — AI analiz limiti aşıldı.
var ErrRateLimitExceeded = errors.New("AI analiz limiti aşıldı, lütfen 1 dakika bekleyin")

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

const maxAIRateLimitUsers = 50000

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		counters: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
	go rl.cleanup()
	return rl
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.window)
		for userID, timestamps := range rl.counters {
			var valid []time.Time
			for _, t := range timestamps {
				if t.After(cutoff) {
					valid = append(valid, t)
				}
			}
			if len(valid) == 0 {
				delete(rl.counters, userID)
			} else {
				rl.counters[userID] = valid
			}
		}
		rl.mu.Unlock()
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

	// Haritanın sınırsız büyümesini önle
	if _, exists := rl.counters[userID]; !exists && len(rl.counters) >= maxAIRateLimitUsers {
		return true // izin ver ama kaydetme
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

func (s *Service) Analyze(ctx context.Context, userID, serviceID uuid.UUID, windowMinutes int, deepAnalysis bool) (*AnalysisResult, error) {
	if !s.rateLimiter.Allow(userID.String()) {
		return nil, ErrRateLimitExceeded
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

	// İstatistiksel özeti DB'den al (percentile_cont ile doğru P95)
	dbStats, err := s.metricsRepo.GetStatsSummary(ctx, serviceID, duration)
	if err != nil {
		return nil, fmt.Errorf("metrik özeti alınamadı: %w", err)
	}

	if dbStats.SampleCount == 0 {
		return &AnalysisResult{
			Summary:   "Analiz edilecek yeterli metrik verisi bulunamadı.",
			RootCause: "Henüz metrik kaydı yok veya belirtilen zaman aralığında veri bulunmuyor.",
			Recommendations: []Recommendation{
				{Action: "Agent'ın doğru yapılandırıldığından emin olun", Priority: "high"},
				{Action: "Servisin erişilebilir olduğunu kontrol edin", Priority: "medium"},
			},
		}, nil
	}

	// Trend ve spike hesabı için sadece küçük bir zaman serisi yeterli (son 50 nokta)
	recentData, _ := s.metricsRepo.GetHistory(ctx, serviceID, duration, 50)
	summary := buildSummaryFromDB(dbStats, recentData, windowMinutes)
	summaryJSON, err := json.Marshal(summary)
	if err != nil {
		return nil, fmt.Errorf("metrik özet serileştirme hatası: %w", err)
	}

	// Uptime yüzdesi (son 24 saat)
	uptimePct, _ := s.metricsRepo.GetUptime(ctx, serviceID, 24*time.Hour)

	// Trend metni oluştur
	trendText := buildTrendText(recentData)

	// Son alertler (son 5 adet)
	var recentAlerts []struct {
		Type        string    `gorm:"column:type"`
		Severity    string    `gorm:"column:severity"`
		Message     string    `gorm:"column:message"`
		TriggeredAt time.Time `gorm:"column:triggered_at"`
	}
	s.db.WithContext(ctx).Table("alerts").
		Select("type, severity, message, triggered_at").
		Where("service_id = ?", serviceID).
		Order("triggered_at DESC").
		Limit(5).
		Find(&recentAlerts)

	var alertsText strings.Builder
	if len(recentAlerts) == 0 {
		alertsText.WriteString("Son alert bulunmuyor.")
	} else {
		for _, a := range recentAlerts {
			fmt.Fprintf(&alertsText, "- [%s] %s: %s (%s)\n",
				a.Severity, a.Type, SanitizeForPrompt(a.Message), a.TriggeredAt.Format("15:04 02 Jan"))
		}
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
			fmt.Fprintf(&otherSvcInfo, "- %s (%s:%d): durum=%s\n", os.Name, os.Host, os.Port, os.Status)
		}
	}

	prompt := fmt.Sprintf(AnalysisPromptTemplate,
		SanitizeForPrompt(svc.Name),
		SanitizeForPrompt(svc.Host),
		svc.Port,
		SanitizeForPrompt(svc.HealthEndpoint),
		svc.Status,
		uptimePct,
		windowMinutes,
		summary.SampleCount,
		string(summaryJSON),
		trendText,
		alertsText.String(),
		otherSvcInfo.String(),
		windowMinutes,
	)

	model := ModelHaiku
	if deepAnalysis {
		model = ModelSonnet
	}

	result, err := s.callClaude(prompt, model)
	if err != nil {
		return nil, fmt.Errorf("AI analizi başarısız: %w", err)
	}

	// Insight'ı kaydet
	go s.saveInsight(serviceID, model, result)

	return result, nil
}

func (s *Service) callClaude(prompt, model string) (*AnalysisResult, error) {
	reqBody := ClaudeRequest{
		Model:     model,
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
		log.Printf("[Claude API] HTTP %d hatası (body: %.200s)", resp.StatusCode, string(body))
		return nil, fmt.Errorf("claude API hatası (HTTP %d)", resp.StatusCode)
	}

	var claudeResp ClaudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return nil, err
	}

	if len(claudeResp.Content) == 0 {
		return nil, fmt.Errorf("claude boş yanıt döndü")
	}

	if claudeResp.StopReason == "max_tokens" {
		return nil, fmt.Errorf("AI yanıtı token limitinde kesildi; MaxTokens değerini artırın")
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

func (s *Service) saveInsight(serviceID uuid.UUID, model string, result *AnalysisResult) {
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
		// Throttle: son 10 dakikada bu servis için ai_analysis alert açıldıysa yenisini oluşturma.
		var recentCount int64
		s.db.WithContext(ctx).Table("alerts").
			Where("service_id = ? AND type = 'ai_analysis' AND triggered_at > NOW() - INTERVAL '10 minutes'", serviceID).
			Count(&recentCount)
		if recentCount == 0 {
			alertID = uuid.New()
			if execErr := s.db.WithContext(ctx).Exec(
				`INSERT INTO alerts (id, service_id, type, severity, message, triggered_at)
				 VALUES (?, ?, 'ai_analysis', 'info', ?, NOW())`,
				alertID, serviceID, result.Summary,
			).Error; execErr != nil {
				log.Printf("[saveInsight] alert oluşturulamadı service=%s: %v", serviceID, execErr)
				return
			}
		} else {
			// Son aktif alert yoksa ve throttle varsa insight'ı atlama — sadece alert açma
			log.Printf("[saveInsight] alert throttled service=%s (son 10dk içinde mevcut)", serviceID)
			return
		}
	}

	recsJSON, _ := json.Marshal(result.Recommendations)

	// Özet uzunluğunu sınırla
	summary := result.Summary
	if len(summary) > 5000 {
		summary = summary[:5000]
	}
	rootCause := result.RootCause
	if len(rootCause) > 2000 {
		rootCause = rootCause[:2000]
	}

	insight := &AIInsight{
		AlertID:         alertID,
		Model:           model,
		Summary:         summary,
		RootCause:       &rootCause,
		Recommendations: recsJSON,
	}

	if err := s.repo.Create(ctx, insight); err != nil {
		log.Printf("[saveInsight] insight kaydedilemedi service=%s: %v", serviceID, err)
	}
}

func (s *Service) GetInsights(ctx context.Context, serviceID uuid.UUID, limit, offset int) ([]AIInsight, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetByServiceID(ctx, serviceID, limit, offset)
}

// IsServiceOwner servisin belirtilen kullanıcıya ait olup olmadığını kontrol eder.
func (s *Service) IsServiceOwner(ctx context.Context, serviceID, userID uuid.UUID) bool {
	var count int64
	s.db.WithContext(ctx).
		Table("services").
		Where("id = ? AND user_id = ?", serviceID, userID).
		Count(&count)
	return count > 0
}
