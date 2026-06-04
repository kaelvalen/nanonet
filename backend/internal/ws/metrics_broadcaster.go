package ws

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
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

// infoLogInterval — sağlıklı servislerin info-level heartbeat logu ne sıklıkta yazılsın.
// Her metric poll'da log yazmak gürültü olur; 5 dakikada bir yeterli.
const infoLogInterval = 5 * time.Minute

type MetricsBroadcaster struct {
	hub          *Hub
	db           *gorm.DB
	metricsRepo  *metrics.Repository
	logsRepo     *logs.Repository
	alertService *alerts.Service
	pollInterval time.Duration

	// lastInfoLog — servis başına son info log zamanı (throttle için).
	lastInfoLog   map[uuid.UUID]time.Time
	lastInfoLogMu sync.Mutex

	// lastStatus — servis başına son bilinen status (geçiş logları için).
	lastStatus   map[uuid.UUID]string
	lastStatusMu sync.Mutex

	// scanInFlight — aktif çalışan ScanAllServices olup olmadığını gösterir.
	scanInFlight atomic.Int32
}

func NewMetricsBroadcaster(hub *Hub, db *gorm.DB, alertSvc *alerts.Service, logsRepo *logs.Repository, pollInterval time.Duration) *MetricsBroadcaster {
	mb := &MetricsBroadcaster{
		hub:          hub,
		db:           db,
		metricsRepo:  metrics.NewRepository(db),
		logsRepo:     logsRepo,
		alertService: alertSvc,
		pollInterval: pollInterval,
		lastInfoLog:  make(map[uuid.UUID]time.Time),
		lastStatus:   make(map[uuid.UUID]string),
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

	slog.Info("MetricsBroadcaster başlatıldı", slog.Duration("interval", mb.pollInterval), slog.Duration("security", securityScanInterval))

	// İlk başlatmada bir tarama çalıştır
	mb.runSecurityScan(ctx)

	for {
		select {
		case <-ctx.Done():
			slog.Info("MetricsBroadcaster durduruluyor")
			return
		case <-ticker.C:
			mb.broadcastLatestMetrics(ctx)
		case <-secTicker.C:
			mb.runSecurityScan(ctx)
		}
	}
}

// runSecurityScan — bir önceki ScanAllServices henüz bitmediyse yeni bir
// tarama başlatmaz. Aksi halde uzun süren bir tarama, bir sonraki tick ile
// üst üste binip DB'ye gereksiz yük bindirir.
func (mb *MetricsBroadcaster) runSecurityScan(ctx context.Context) {
	if !mb.scanInFlight.CompareAndSwap(0, 1) {
		slog.Warn("Security scan atlandı: önceki tarama hâlâ sürüyor")
		return
	}
	go func() {
		defer mb.scanInFlight.Store(0)
		defer func() {
			if r := recover(); r != nil {
				slog.Error("Security scan panikledi", slog.Any("panic", r))
			}
		}()
		security.ScanAllServices(ctx, mb.db)
	}()
}

func (mb *MetricsBroadcaster) handleAgentMetric(serviceID string, msg AgentMessage) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	svcID, err := uuid.Parse(serviceID)
	if err != nil {
		slog.Warn("Geçersiz service_id", slog.String("service_id", serviceID))
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
		slog.Error("Metrik kayıt hatası", slog.String("service_id", serviceID), slog.String("error", err.Error()))
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
		"time":            metric.Time,
		"status":          metric.Status,
		"agent_connected": true,
		"agent_status":    "healthy",
	}
	if msg.AgentVersion != "" {
		broadcast["agent_version"] = msg.AgentVersion
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
		slog.Warn("Alert kontrol hatası", slog.String("service_id", serviceID), slog.String("error", err.Error()))
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

	now := time.Now()

	// Status geçiş logu: up→down veya down→up gibi değişiklikler her zaman yaz.
	currentStatus := metric.Status
	mb.lastStatusMu.Lock()
	prev, hasPrev := mb.lastStatus[svcID]
	if currentStatus != "" {
		mb.lastStatus[svcID] = currentStatus
	}
	mb.lastStatusMu.Unlock()

	isStatusChange := hasPrev && prev != currentStatus && currentStatus != ""

	if level == "info" && !isStatusChange {
		// Sağlıklı info metrikleri: 5 dakikada bir yaz (heartbeat).
		mb.lastInfoLogMu.Lock()
		lastWritten := mb.lastInfoLog[svcID]
		shouldWrite := now.Sub(lastWritten) >= infoLogInterval
		if shouldWrite {
			mb.lastInfoLog[svcID] = now
		}
		mb.lastInfoLogMu.Unlock()

		if !shouldWrite {
			return
		}
		message = "Servis sağlıklı"
	}

	if isStatusChange && level == "info" {
		if currentStatus == "up" {
			message = fmt.Sprintf("Servis durumu normale döndü (%s → %s)", prev, currentStatus)
		} else {
			message = fmt.Sprintf("Servis durumu değişti: %s → %s", prev, currentStatus)
			level = "warn"
		}
	}

	if message == "" {
		message = "Servis sağlıklı"
	}

	entry := &logs.ServiceLog{
		Time:      now,
		ServiceID: svcID,
		Level:     level,
		Source:    "agent",
		Message:   message,
		Fields:    fields,
	}
	if err := mb.logsRepo.Insert(ctx, entry); err != nil {
		slog.Warn("Agent log yazılamadı", slog.String("service_id", svcID.String()), slog.String("error", err.Error()))
	}
}

func (mb *MetricsBroadcaster) broadcastLatestMetrics(ctx context.Context) {
	if mb.hub.GetConnectedDashboardCount() == 0 {
		return
	}
	latestMetrics, err := mb.metricsRepo.GetLatestPerService(ctx)
	if err != nil {
		slog.Error("Son metrikler alınamadı", slog.String("error", err.Error()))
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
