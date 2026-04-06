package ws

import (
	"context"
	"fmt"
	"log"
	"time"

	"nanonet-backend/internal/alerts"
	"nanonet-backend/internal/logs"
	"nanonet-backend/internal/metrics"
	"nanonet-backend/internal/security"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// securityScanInterval güvenlik taramaları arasındaki varsayılan süre.
const securityScanInterval = 6 * time.Hour

type MetricsBroadcaster struct {
	hub          *Hub
	db           *gorm.DB
	metricsRepo  *metrics.Repository
	logsRepo     *logs.Repository
	alertService *alerts.Service
	pollInterval time.Duration
}

func NewMetricsBroadcaster(hub *Hub, db *gorm.DB, alertSvc *alerts.Service, logsRepo *logs.Repository, pollInterval time.Duration) *MetricsBroadcaster {
	mb := &MetricsBroadcaster{
		hub:          hub,
		db:           db,
		metricsRepo:  metrics.NewRepository(db),
		logsRepo:     logsRepo,
		alertService: alertSvc,
		pollInterval: pollInterval,
	}

	hub.SetOnMetric(mb.handleAgentMetric)

	return mb
}

func (mb *MetricsBroadcaster) Start(ctx context.Context) {
	ticker := time.NewTicker(mb.pollInterval)
	defer ticker.Stop()

	// Güvenlik taramaları daha seyrek çalışır
	secTicker := time.NewTicker(securityScanInterval)
	defer secTicker.Stop()

	log.Printf("MetricsBroadcaster başlatıldı (interval: %s, security: %s)", mb.pollInterval, securityScanInterval)

	// İlk başlatmada bir tarama çalıştır
	go security.ScanAllServices(ctx, mb.db)

	for {
		select {
		case <-ctx.Done():
			log.Println("MetricsBroadcaster durduruluyor...")
			return
		case <-ticker.C:
			mb.broadcastLatestMetrics(ctx)
		case <-secTicker.C:
			go security.ScanAllServices(ctx, mb.db)
		}
	}
}

func (mb *MetricsBroadcaster) handleAgentMetric(serviceID string, msg AgentMessage) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	svcID, err := uuid.Parse(serviceID)
	if err != nil {
		log.Printf("Geçersiz service_id: %s", serviceID)
		return
	}

	metric := &metrics.Metric{
		Time:      time.Now(),
		ServiceID: svcID,
	}

	if msg.System != nil {
		if v, ok := msg.System["cpu_percent"].(float64); ok {
			f := float32(v)
			metric.CPUPercent = &f
		}
		if v, ok := msg.System["memory_used_mb"].(float64); ok {
			f := float32(v)
			metric.MemoryUsedMB = &f
		}
		if v, ok := msg.System["disk_used_gb"].(float64); ok {
			f := float32(v)
			metric.DiskUsedGB = &f
		}
	}

	// App bloğu varsa (mock servis / uygulama metrikleri) system değerlerini override et
	if msg.App != nil {
		if v, ok := msg.App["cpu_percent"].(float64); ok && v > 0 {
			f := float32(v)
			metric.CPUPercent = &f
		}
		if v, ok := msg.App["memory_used_mb"].(float64); ok && v > 0 {
			f := float32(v)
			metric.MemoryUsedMB = &f
		}
	}

	if msg.Service != nil {
		if v, ok := msg.Service["latency_ms"].(float64); ok {
			f := float32(v)
			metric.LatencyMS = &f
		}
		if v, ok := msg.Service["error_rate"].(float64); ok {
			f := float32(v)
			metric.ErrorRate = &f
		}
		if v, ok := msg.Service["status"].(string); ok {
			metric.Status = v
		}
	}

	if err := mb.metricsRepo.Insert(ctx, metric); err != nil {
		log.Printf("Metrik kayıt hatası [service=%s]: %v", serviceID, err)
		return
	}

	// service_logs'a yaz
	go mb.writeAgentLog(svcID, metric, msg)

	if metric.Status != "" {
		go func(id uuid.UUID, status string) {
			updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer updateCancel()
			mb.db.WithContext(updateCtx).
				Table("services").
				Where("id = ?", id).
				Updates(map[string]interface{}{
					"status":     status,
					"updated_at": time.Now(),
				})
		}(svcID, metric.Status)
	}

	// Normalize and broadcast to dashboards so frontend gets consistent data shape
	broadcast := map[string]any{
		"time":   metric.Time,
		"status": metric.Status,
	}
	if metric.CPUPercent != nil {
		broadcast["cpu_percent"] = *metric.CPUPercent
	}
	if metric.MemoryUsedMB != nil {
		broadcast["memory_used_mb"] = *metric.MemoryUsedMB
	}
	if metric.LatencyMS != nil {
		broadcast["latency_ms"] = *metric.LatencyMS
	}
	if metric.ErrorRate != nil {
		broadcast["error_rate"] = *metric.ErrorRate
	}
	if metric.DiskUsedGB != nil {
		broadcast["disk_used_gb"] = *metric.DiskUsedGB
	}
	mb.hub.BroadcastToDashboards(svcID.String(), broadcast)

	if err := mb.alertService.CheckMetricAndCreateAlert(ctx, svcID, metric); err != nil {
		log.Printf("Alert kontrol hatası [service=%s]: %v", serviceID, err)
	}
}

func (mb *MetricsBroadcaster) writeAgentLog(svcID uuid.UUID, metric *metrics.Metric, msg AgentMessage) {
	if mb.logsRepo == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	level := "info"
	message := ""
	fields := map[string]interface{}{}

	if metric.CPUPercent != nil {
		fields["cpu_percent"] = *metric.CPUPercent
	}
	if metric.MemoryUsedMB != nil {
		fields["memory_used_mb"] = *metric.MemoryUsedMB
	}
	if metric.LatencyMS != nil {
		fields["latency_ms"] = *metric.LatencyMS
	}
	if metric.Status != "" {
		fields["status"] = metric.Status
	}

	// error_rate: agent 0-100 arası yüzde olarak gönderir (örn: 5.0 = %5)
	if metric.ErrorRate != nil {
		rate := float64(*metric.ErrorRate)
		fields["error_rate"] = rate
		if rate > 5.0 {
			level = "error"
			message = fmt.Sprintf("Yüksek hata oranı: %.1f%%", rate)
		}
	}

	switch metric.Status {
	case "down":
		level = "error"
		message = "Servis erişilemiyor"
	case "degraded":
		if level != "error" {
			level = "warn"
		}
		if message == "" {
			message = "Servis performans sorunu yaşıyor"
		}
	}

	if metric.CPUPercent != nil && *metric.CPUPercent > 90 {
		if level == "info" {
			level = "warn"
			message = fmt.Sprintf("Yüksek CPU kullanımı: %.1f%%", *metric.CPUPercent)
		}
	}
	if metric.LatencyMS != nil && *metric.LatencyMS > 1000 {
		if level == "info" {
			level = "warn"
			message = fmt.Sprintf("Yüksek gecikme: %.0fms", *metric.LatencyMS)
		}
	}

	// Sadece warn/error logları yaz — normal info metrikleri gereksiz gürültü
	if level == "info" {
		return
	}

	entry := &logs.ServiceLog{
		Time:      time.Now(),
		ServiceID: svcID,
		Level:     level,
		Source:    "agent",
		Message:   message,
		Fields:    fields,
	}
	if err := mb.logsRepo.Insert(ctx, entry); err != nil {
		log.Printf("[WARN] Agent log yazılamadı [service=%s]: %v", svcID, err)
	}
}

func (mb *MetricsBroadcaster) broadcastLatestMetrics(ctx context.Context) {
	latestMetrics, err := mb.metricsRepo.GetLatestPerService(ctx)
	if err != nil {
		log.Printf("Son metrikler alınamadı: %v", err)
		return
	}

	for _, latest := range latestMetrics {
		broadcast := map[string]interface{}{
			"time":   latest.Time,
			"status": latest.Status,
		}
		if latest.CPUPercent != nil {
			broadcast["cpu_percent"] = *latest.CPUPercent
		}
		if latest.MemoryUsedMB != nil {
			broadcast["memory_used_mb"] = *latest.MemoryUsedMB
		}
		if latest.LatencyMS != nil {
			broadcast["latency_ms"] = *latest.LatencyMS
		}
		if latest.ErrorRate != nil {
			broadcast["error_rate"] = *latest.ErrorRate
		}
		if latest.DiskUsedGB != nil {
			broadcast["disk_used_gb"] = *latest.DiskUsedGB
		}
		mb.hub.BroadcastToDashboards(latest.ServiceID.String(), broadcast)
	}
}
