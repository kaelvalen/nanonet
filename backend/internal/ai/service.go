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
	"time"

	"nanonet-backend/internal/metrics"
	"nanonet-backend/pkg/ratelimit"

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
	rateLimiter *ratelimit.Limiter
	guard       *CostGuard
}

func NewService(db *gorm.DB, apiKey string) *Service {
	return &Service{
		db:          db,
		apiKey:      apiKey,
		client:      &http.Client{Timeout: 60 * time.Second},
		repo:        NewRepository(db),
		metricsRepo: metrics.NewRepository(db),
		rateLimiter: ratelimit.New(10, time.Minute),
		guard:       NewCostGuard(db),
	}
}

// CostGuard exposes the cost guard so handlers (e.g. /ai/usage) can read it
// without re-instantiating.
func (s *Service) CostGuard() *CostGuard { return s.guard }

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

	raw, err := s.callClaudeGuarded(ctx, userID, &serviceID, "analysis", prompt, model, MaxTokensDefault)
	if err != nil {
		return nil, fmt.Errorf("AI analizi başarısız: %w", err)
	}
	var result AnalysisResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("AI yanıtı parse edilemedi (raw: %.200s): %w", string(raw), err)
	}

	// Insight'ı kaydet
	go s.saveInsight(serviceID, model, &result)

	return &result, nil
}

// callClaude tek Claude isteği yapar ve ham JSON'u döner; caller kendi struct'ına Unmarshal eder.
// Geriye dönük uyumluluk için sarmalayıcı — gerçek implementasyon callClaudeRaw.
func (s *Service) callClaude(prompt, model string, maxTokens int) ([]byte, error) {
	out, _, err := s.callClaudeRaw(prompt, model, maxTokens)
	return out, err
}

// callClaudeRaw, çıktı metnine ek olarak token kullanımını da döndürür. Maliyet
// hesaplaması ve kullanım kaydı (ai_usage) bunu gerektirir.
func (s *Service) callClaudeRaw(prompt, model string, maxTokens int) ([]byte, ClaudeUsage, error) {
	reqBody := ClaudeRequest{
		Model:     model,
		MaxTokens: maxTokens,
		Messages: []Message{
			{Role: "user", Content: prompt},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, ClaudeUsage{}, err
	}

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, ClaudeUsage{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, ClaudeUsage{}, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[Claude API] HTTP %d hatası (body: %.200s)", resp.StatusCode, string(body))
		return nil, ClaudeUsage{}, fmt.Errorf("claude API hatası (HTTP %d)", resp.StatusCode)
	}

	var claudeResp ClaudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return nil, ClaudeUsage{}, err
	}
	if len(claudeResp.Content) == 0 {
		return nil, claudeResp.Usage, fmt.Errorf("claude boş yanıt döndü")
	}
	if claudeResp.StopReason == "max_tokens" {
		return nil, claudeResp.Usage, fmt.Errorf("AI yanıtı token limitinde kesildi; maxTokens değerini artırın")
	}

	rawText := strings.TrimSpace(claudeResp.Content[0].Text)
	if idx := strings.Index(rawText, "{"); idx > 0 {
		rawText = rawText[idx:]
	}
	if idx := strings.LastIndex(rawText, "}"); idx >= 0 && idx < len(rawText)-1 {
		rawText = rawText[:idx+1]
	}
	return []byte(rawText), claudeResp.Usage, nil
}

// callClaudeGuarded sarar: bütçe kontrolü → cache lookup → gerçek istek →
// cache + ai_usage kaydı. Sıfır hata durumunda ham JSON döner.
func (s *Service) callClaudeGuarded(ctx context.Context, userID uuid.UUID, serviceID *uuid.UUID, kind, prompt, model string, maxTokens int) ([]byte, error) {
	if s.guard != nil {
		if err := s.guard.CheckBudget(ctx, userID); err != nil {
			return nil, err
		}
		if hit, _ := s.guard.LookupCache(ctx, model, prompt); hit != nil {
			s.guard.LogUsage(ctx, UsageRow{
				UserID:       userID,
				ServiceID:    serviceID,
				Model:        model,
				Kind:         kind,
				InputTokens:  hit.InputTokens,
				OutputTokens: hit.OutputTokens,
				CostUSD:      0,
				CacheHit:     true,
			})
			return []byte(hit.ResponseJSON), nil
		}
	}
	start := time.Now()
	raw, usage, err := s.callClaudeRaw(prompt, model, maxTokens)
	latency := int(time.Since(start).Milliseconds())
	if err != nil {
		return nil, err
	}
	if s.guard != nil {
		s.guard.StoreCache(ctx, model, prompt, string(raw), usage.InputTokens, usage.OutputTokens)
		s.guard.LogUsage(ctx, UsageRow{
			UserID:       userID,
			ServiceID:    serviceID,
			Model:        model,
			Kind:         kind,
			InputTokens:  usage.InputTokens,
			OutputTokens: usage.OutputTokens,
			CacheHit:     false,
			LatencyMS:    latency,
		})
	}
	return raw, nil
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

func (s *Service) GetAllInsights(ctx context.Context, userID uuid.UUID, limit, offset int) ([]AIInsight, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetByUserID(ctx, userID, limit, offset)
}

// GenerateReport kullanıcının seçtiği zaman aralığı için proaktif SRE raporu üretir.
// Tek servis veya tüm servisler (serviceID="" ise global) için çalışır.
func (s *Service) GenerateReport(ctx context.Context, userID uuid.UUID, req ReportRequest) (*ReportResult, error) {
	if !s.rateLimiter.Allow(userID.String()) {
		return nil, ErrRateLimitExceeded
	}

	windowMinutes := req.TimeRange.ToMinutes()
	duration := time.Duration(windowMinutes) * time.Minute
	periodLabel := req.TimeRange.Label()

	type svcInfo struct {
		ID     uuid.UUID `gorm:"column:id"`
		Name   string    `gorm:"column:name"`
		Host   string    `gorm:"column:host"`
		Port   int       `gorm:"column:port"`
		Status string    `gorm:"column:status"`
	}

	var services []svcInfo
	query := s.db.WithContext(ctx).Table("services").Where("user_id = ?", userID)
	if req.ServiceID != "" {
		query = query.Where("id = ?", req.ServiceID)
	}
	if err := query.Find(&services).Error; err != nil || len(services) == 0 {
		return nil, fmt.Errorf("servis bulunamadı")
	}

	var svcListText strings.Builder
	for _, svc := range services {
		fmt.Fprintf(&svcListText, "- %s (%s:%d) — durum: %s\n",
			SanitizeForPrompt(svc.Name), SanitizeForPrompt(svc.Host), svc.Port, svc.Status)
	}

	var statsText strings.Builder
	var trendParts []string

	for _, svc := range services {
		dbStats, err := s.metricsRepo.GetStatsSummary(ctx, svc.ID, duration)
		if err != nil || dbStats.SampleCount == 0 {
			fmt.Fprintf(&statsText, "### %s\nBu dönemde veri yok.\n\n", svc.Name)
			continue
		}
		recentData, _ := s.metricsRepo.GetHistory(ctx, svc.ID, duration, 50)
		summary := buildSummaryFromDB(dbStats, recentData, windowMinutes)
		summaryJSON, _ := json.Marshal(summary)
		fmt.Fprintf(&statsText, "### %s\n%s\n\n", SanitizeForPrompt(svc.Name), string(summaryJSON))
		trendParts = append(trendParts, fmt.Sprintf("%s: %s", svc.Name, buildTrendText(recentData)))
	}

	trendText := strings.Join(trendParts, "\n")
	if trendText == "" {
		trendText = "Yeterli trend verisi yok."
	}

	var alertsText strings.Builder
	svcIDs := make([]string, 0, len(services))
	for _, svc := range services {
		svcIDs = append(svcIDs, svc.ID.String())
	}

	var recentAlerts []struct {
		ServiceID   string     `gorm:"column:service_id"`
		Type        string     `gorm:"column:type"`
		Severity    string     `gorm:"column:severity"`
		Message     string     `gorm:"column:message"`
		TriggeredAt time.Time  `gorm:"column:triggered_at"`
		ResolvedAt  *time.Time `gorm:"column:resolved_at"`
	}
	s.db.WithContext(ctx).Table("alerts").
		Select("service_id, type, severity, message, triggered_at, resolved_at").
		Where("service_id IN ? AND triggered_at > NOW() - INTERVAL '1 second' * ?", svcIDs, windowMinutes*60).
		Order("triggered_at DESC").
		Limit(20).
		Find(&recentAlerts)

	if len(recentAlerts) == 0 {
		alertsText.WriteString("Bu dönemde alert bulunmuyor.")
	} else {
		for _, a := range recentAlerts {
			resolved := "aktif"
			if a.ResolvedAt != nil {
				resolved = "çözüldü"
			}
			fmt.Fprintf(&alertsText, "- [%s][%s] %s: %s (%s)\n",
				a.Severity, resolved, a.Type, SanitizeForPrompt(a.Message), a.TriggeredAt.Format("02 Jan 15:04"))
		}
	}

	now := time.Now()
	startTime := now.Add(-duration)
	timeFrom := startTime.Format("02 Jan 15:04")
	timeTo := now.Format("02 Jan 15:04")

	prompt := fmt.Sprintf(ProactiveReportPromptTemplate,
		svcListText.String(),
		timeFrom, timeTo,
		statsText.String(),
		trendText,
		alertsText.String(),
		periodLabel,
	)

	raw, err := s.callClaudeGuarded(ctx, userID, nil, "report", prompt, ModelSonnet, 4096)
	if err != nil {
		return nil, fmt.Errorf("AI raporu başarısız: %w", err)
	}
	var result ReportResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("rapor parse edilemedi (raw: %.200s): %w", string(raw), err)
	}
	return &result, nil
}
