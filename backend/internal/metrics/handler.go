package metrics

import (
	"fmt"
	"time"

	"nanonet-backend/pkg/ownership"
	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
	db      *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		service: NewService(db),
		db:      db,
	}
}

func (h *Handler) GetHistory(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "invalid user")
		return
	}

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid service ID")
		return
	}

	if !ownership.IsServiceOwner(c.Request.Context(), h.db, serviceID, userID) {
		response.NotFound(c, "service not found")
		return
	}

	durationStr := c.DefaultQuery("duration", "1h")
	duration, err := time.ParseDuration(durationStr)
	if err != nil {
		response.BadRequest(c, "invalid duration format (examples: 1h, 30m, 24h)")
		return
	}
	if duration > 7*24*time.Hour {
		response.BadRequest(c, "duration cannot exceed 7 days")
		return
	}
	if duration < time.Minute {
		response.BadRequest(c, "duration must be at least 1 minute")
		return
	}

	limitStr := c.DefaultQuery("limit", "500")
	var limit int
	if _, err := fmt.Sscan(limitStr, &limit); err != nil || limit <= 0 {
		limit = 500
	}
	if limit > 2000 {
		limit = 2000
	}

	metrics, err := h.service.GetHistory(c.Request.Context(), serviceID, duration, limit)
	if err != nil {
		response.InternalError(c, "failed to fetch metrics")
		return
	}

	response.Success(c, gin.H{
		"metrics":    metrics,
		"count":      len(metrics),
		"duration":   durationStr,
		"service_id": serviceID,
	})
}

func (h *Handler) GetAggregated(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "invalid user")
		return
	}

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid service ID")
		return
	}

	if !ownership.IsServiceOwner(c.Request.Context(), h.db, serviceID, userID) {
		response.NotFound(c, "service not found")
		return
	}

	durationStr := c.DefaultQuery("duration", "24h")
	duration, err := time.ParseDuration(durationStr)
	if err != nil {
		response.BadRequest(c, "invalid duration format (examples: 1h, 24h, 7d)")
		return
	}
	if duration > 30*24*time.Hour {
		response.BadRequest(c, "duration cannot exceed 30 days")
		return
	}

	validBuckets := map[string]bool{
		"1 minute": true, "5 minutes": true, "15 minutes": true,
		"30 minutes": true, "1 hour": true, "6 hours": true, "1 day": true,
	}
	bucketSize := c.DefaultQuery("bucket", "1 minute")
	if !validBuckets[bucketSize] {
		response.BadRequest(c, "invalid bucket size; valid: 1 minute, 5 minutes, 15 minutes, 30 minutes, 1 hour, 6 hours, 1 day")
		return
	}

	metrics, err := h.service.GetAggregated(c.Request.Context(), serviceID, duration, bucketSize)
	if err != nil {
		response.InternalError(c, "failed to fetch aggregated metrics")
		return
	}

	response.Success(c, gin.H{
		"metrics":    metrics,
		"duration":   durationStr,
		"bucket":     bucketSize,
		"service_id": serviceID,
	})
}

func (h *Handler) InsertMetric(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	var metric Metric
	if err := c.ShouldBindJSON(&metric); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if metric.ServiceID == uuid.Nil {
		response.BadRequest(c, "service_id zorunlu")
		return
	}

	// Servisin var olduğunu VE mevcut kullanıcıya ait olduğunu doğrula
	if !ownership.IsServiceOwner(c.Request.Context(), h.db, metric.ServiceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	// Metrik değerlerini doğrula
	if metric.CPUPercent != nil && (*metric.CPUPercent < 0 || *metric.CPUPercent > 100) {
		response.BadRequest(c, "cpu_percent 0-100 arasında olmalı")
		return
	}
	if metric.MemoryUsedMB != nil && *metric.MemoryUsedMB < 0 {
		response.BadRequest(c, "memory_used_mb negatif olamaz")
		return
	}
	if metric.LatencyMS != nil && *metric.LatencyMS < 0 {
		response.BadRequest(c, "latency_ms negatif olamaz")
		return
	}
	if metric.ErrorRate != nil && (*metric.ErrorRate < 0 || *metric.ErrorRate > 100) {
		response.BadRequest(c, "error_rate 0-100 arasında olmalı")
		return
	}

	metric.Time = time.Now()

	if err := h.service.InsertMetric(c.Request.Context(), &metric); err != nil {
		response.InternalError(c, "metrik kaydedilemedi")
		return
	}

	response.Created(c, metric)
}

// GetRollup uzun vadeli (7 gün–90 gün) zaman serisi için rollup endpoint.
// ?duration=7d&bucket=1 hour  (varsayılan: duration=30d, bucket=1 day)
func (h *Handler) GetRollup(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if !ownership.IsServiceOwner(c.Request.Context(), h.db, serviceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	durationStr := c.DefaultQuery("duration", "30d")
	// "30d" → "720h" gibi gün birimini parse et
	duration, parseErr := parseDuration(durationStr)
	if parseErr != nil {
		response.BadRequest(c, "geçersiz duration (örnekler: 7d, 30d, 90d, 24h)")
		return
	}
	if duration > 90*24*time.Hour {
		response.BadRequest(c, "duration 90 günü aşamaz")
		return
	}
	if duration < time.Hour {
		response.BadRequest(c, "rollup için minimum duration 1 saattir")
		return
	}

	validBuckets := map[string]bool{
		"1 hour": true, "6 hours": true, "12 hours": true, "1 day": true, "7 days": true,
	}
	bucketSize := c.DefaultQuery("bucket", "1 day")
	if !validBuckets[bucketSize] {
		response.BadRequest(c, "geçersiz bucket; geçerliler: 1 hour, 6 hours, 12 hours, 1 day, 7 days")
		return
	}

	buckets, err := h.service.GetRollup(c.Request.Context(), serviceID, duration, bucketSize)
	if err != nil {
		response.InternalError(c, "rollup verisi alınamadı")
		return
	}

	response.Success(c, gin.H{
		"buckets":    buckets,
		"count":      len(buckets),
		"duration":   durationStr,
		"bucket":     bucketSize,
		"service_id": serviceID,
	})
}

// parseDuration "30d", "7d" gibi gün birimli string'leri de parse eder.
func parseDuration(s string) (time.Duration, error) {
	if len(s) > 1 && s[len(s)-1] == 'd' {
		var days int
		if _, err := fmt.Sscan(s[:len(s)-1], &days); err == nil && days > 0 {
			return time.Duration(days) * 24 * time.Hour, nil
		}
	}
	return time.ParseDuration(s)
}

// GetForecast returns a short-horizon Holt linear forecast for the requested
// metric (cpu | memory | latency | error_rate). Uses the most recent N samples
// from the existing GetHistory pipeline.
func (h *Handler) GetForecast(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "invalid user")
		return
	}
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid service ID")
		return
	}
	if !ownership.IsServiceOwner(c.Request.Context(), h.db, serviceID, userID) {
		response.NotFound(c, "service not found")
		return
	}

	metric := c.DefaultQuery("metric", "cpu")
	horizon := 12
	if v := c.Query("horizon"); v != "" {
		var n int
		if _, err := fmt.Sscan(v, &n); err == nil && n > 0 && n <= 96 {
			horizon = n
		}
	}

	samples, err := h.service.GetHistory(c.Request.Context(), serviceID, time.Hour, 200)
	if err != nil {
		response.InternalError(c, "failed to fetch metrics")
		return
	}
	if len(samples) < 4 {
		response.Success(c, gin.H{"forecast": Forecast{Series: []ForecastPoint{}}})
		return
	}

	times := make([]time.Time, 0, len(samples))
	values := make([]float64, 0, len(samples))
	for i := len(samples) - 1; i >= 0; i-- { // GetHistory returns DESC by time
		s := samples[i]
		var v *float32
		switch metric {
		case "memory":
			v = s.MemoryUsedMB
		case "latency":
			v = s.LatencyMS
		case "error_rate":
			v = s.ErrorRate
		default:
			v = s.CPUPercent
			metric = "cpu"
		}
		if v == nil {
			continue
		}
		times = append(times, s.Time)
		values = append(values, float64(*v))
	}

	var threshold *float64
	if t := c.Query("threshold"); t != "" {
		var f float64
		if _, err := fmt.Sscan(t, &f); err == nil {
			threshold = &f
		}
	}

	out := HoltLinearForecast(times, values, horizon, 0.4, 0.1, threshold)
	response.Success(c, gin.H{"forecast": out, "metric": metric})
}

func (h *Handler) GetUptime(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if !ownership.IsServiceOwner(c.Request.Context(), h.db, serviceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	durationStr := c.DefaultQuery("duration", "24h")
	duration, err := time.ParseDuration(durationStr)
	if err != nil {
		response.BadRequest(c, "geçersiz duration formatı")
		return
	}

	uptime, err := h.service.GetUptime(c.Request.Context(), serviceID, duration)
	if err != nil {
		response.InternalError(c, "uptime hesaplanamadı")
		return
	}

	response.Success(c, gin.H{
		"service_id":     serviceID,
		"uptime_percent": uptime,
		"duration":       durationStr,
	})
}

// GetGlobalSummary — GET /api/v1/metrics/summary?duration=24h
// Kullanıcının tüm servislerinin son 24 saatlik ortalama metriklerini döndürür.
func (h *Handler) GetGlobalSummary(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	durationStr := c.DefaultQuery("duration", "24h")
	duration, parseErr := time.ParseDuration(durationStr)
	if parseErr != nil {
		duration = 24 * time.Hour
	}

	result, err := h.service.GetGlobalSummary(c.Request.Context(), userID, duration)
	if err != nil {
		response.InternalError(c, "metrik özeti alınamadı")
		return
	}

	toFloat := func(p *float64) float64 {
		if p == nil {
			return 0
		}
		return *p
	}

	response.Success(c, gin.H{
		"avg_latency_ms":     toFloat(result.AvgLatency),
		"p95_latency_ms":     toFloat(result.P95Latency),
		"avg_cpu_percent":    toFloat(result.AvgCPU),
		"avg_error_rate":     toFloat(result.AvgErrorRate),
		"avg_memory_used_mb": toFloat(result.AvgMemoryUsedMB),
		"duration":           durationStr,
	})
}

// GetBulkUptime — GET /api/v1/services/uptime/summary?duration=24h
// Kullanıcının tüm servisleri için tek sorguda uptime özeti döndürür.
// N+1 sorununu önler.
func (h *Handler) GetBulkUptime(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	serviceIDs, err := h.service.GetServiceIDsByUser(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "servis listesi alınamadı")
		return
	}

	if len(serviceIDs) == 0 {
		response.Success(c, gin.H{"uptime": map[string]float64{}, "duration": c.DefaultQuery("duration", "24h"), "count": 0})
		return
	}

	durationStr := c.DefaultQuery("duration", "24h")
	var duration time.Duration
	switch durationStr {
	case "24h":
		duration = 24 * time.Hour
	case "7d":
		duration = 7 * 24 * time.Hour
	case "30d":
		duration = 30 * 24 * time.Hour
	default:
		var parseErr error
		duration, parseErr = time.ParseDuration(durationStr)
		if parseErr != nil {
			response.BadRequest(c, "geçersiz duration formatı (24h, 7d, 30d)")
			return
		}
	}

	results, err := h.service.GetBulkUptime(c.Request.Context(), serviceIDs, duration)
	if err != nil {
		response.InternalError(c, "uptime hesaplanamadı")
		return
	}

	// map[service_id] -> uptime_percent formatına çevir
	uptimeMap := make(map[string]float64, len(results))
	for _, r := range results {
		uptimeMap[r.ServiceID] = r.Uptime
	}

	response.Success(c, gin.H{
		"uptime":   uptimeMap,
		"duration": durationStr,
		"count":    len(uptimeMap),
	})
}
