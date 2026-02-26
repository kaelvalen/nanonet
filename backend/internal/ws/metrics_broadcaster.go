package ws

import (
	"context"
	"log"
	"time"

	"nanonet-backend/internal/alerts"
	"nanonet-backend/internal/metrics"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MetricsBroadcaster struct {
	hub          *Hub
	db           *gorm.DB
	metricsRepo  *metrics.Repository
	alertService *alerts.Service
	pollInterval time.Duration
}

func NewMetricsBroadcaster(hub *Hub, db *gorm.DB, pollInterval time.Duration) *MetricsBroadcaster {
	mb := &MetricsBroadcaster{
		hub:          hub,
		db:           db,
		metricsRepo:  metrics.NewRepository(db),
		alertService: alerts.NewService(db),
		pollInterval: pollInterval,
	}

	hub.SetOnMetric(mb.handleAgentMetric)

	return mb
}

func (mb *MetricsBroadcaster) Start(ctx context.Context) {
	ticker := time.NewTicker(mb.pollInterval)
	defer ticker.Stop()

	log.Printf("MetricsBroadcaster başlatıldı (interval: %s)", mb.pollInterval)

	for {
		select {
		case <-ctx.Done():
			log.Println("MetricsBroadcaster durduruluyor...")
			return
		case <-ticker.C:
			mb.broadcastLatestMetrics(ctx)
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

	if metric.Status != "" {
		mb.db.WithContext(ctx).
			Table("services").
			Where("id = ?", svcID).
			Updates(map[string]interface{}{
				"status":     metric.Status,
				"updated_at": time.Now(),
			})
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

func (mb *MetricsBroadcaster) broadcastLatestMetrics(ctx context.Context) {
	type svcRow struct {
		ID     uuid.UUID `gorm:"column:id"`
		Status string    `gorm:"column:status"`
	}

	var services []svcRow
	if err := mb.db.WithContext(ctx).
		Table("services").
		Select("id, status").
		Find(&services).Error; err != nil {
		log.Printf("Servis listesi alınamadı: %v", err)
		return
	}

	for _, svc := range services {
		latestMetrics, err := mb.metricsRepo.GetHistory(ctx, svc.ID, 1*time.Minute, 1)
		if err != nil || len(latestMetrics) == 0 {
			continue
		}

		latest := latestMetrics[len(latestMetrics)-1]
		mb.hub.BroadcastToDashboards(svc.ID.String(), map[string]interface{}{
			"time":           latest.Time,
			"cpu_percent":    latest.CPUPercent,
			"memory_used_mb": latest.MemoryUsedMB,
			"latency_ms":     latest.LatencyMS,
			"error_rate":     latest.ErrorRate,
			"status":         latest.Status,
			"disk_used_gb":   latest.DiskUsedGB,
		})
	}
}
