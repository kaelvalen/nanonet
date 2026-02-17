package ws

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"nanonet-backend/internal/metrics"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MetricsBroadcaster struct {
	hub           *Hub
	metricsRepo   *metrics.Repository
	pollInterval  time.Duration
}

func NewMetricsBroadcaster(hub *Hub, db *gorm.DB, pollInterval time.Duration) *MetricsBroadcaster {
	return &MetricsBroadcaster{
		hub:          hub,
		metricsRepo:  metrics.NewRepository(db),
		pollInterval: pollInterval,
	}
}

func (mb *MetricsBroadcaster) Start(ctx context.Context) {
	ticker := time.NewTicker(mb.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			mb.broadcastLatestMetrics(ctx)
		}
	}
}

func (mb *MetricsBroadcaster) broadcastLatestMetrics(ctx context.Context) {
	// Bu fonksiyon tüm servislerin son metriklerini broadcast eder
	// Gerçek implementasyonda servis listesini alıp her biri için metrik çekecek
	// Şimdilik placeholder
}

func (mb *MetricsBroadcaster) BroadcastMetric(serviceID uuid.UUID, metric *metrics.Metric) {
	message := map[string]interface{}{
		"type":       "metric_update",
		"service_id": serviceID.String(),
		"data": map[string]interface{}{
			"time":           metric.Time,
			"cpu_percent":    metric.CPUPercent,
			"memory_used_mb": metric.MemoryUsedMB,
			"latency_ms":     metric.LatencyMS,
			"error_rate":     metric.ErrorRate,
			"status":         metric.Status,
			"disk_used_gb":   metric.DiskUsedGB,
		},
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		log.Printf("Metrik serialize hatası: %v", err)
		return
	}

	mb.hub.broadcast <- jsonData
}

func (mb *MetricsBroadcaster) BroadcastAlert(serviceID uuid.UUID, alertType, severity, message string) {
	alertMsg := map[string]interface{}{
		"type":       "alert",
		"service_id": serviceID.String(),
		"data": map[string]interface{}{
			"alert_type": alertType,
			"severity":   severity,
			"message":    message,
			"timestamp":  time.Now(),
		},
	}

	jsonData, err := json.Marshal(alertMsg)
	if err != nil {
		log.Printf("Alert serialize hatası: %v", err)
		return
	}

	mb.hub.broadcast <- jsonData
}
