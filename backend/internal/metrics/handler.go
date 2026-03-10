package metrics

import (
	"context"
	"fmt"
	"time"

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

// checkServiceOwnership servisin kimlik doğrulama yapan kullanıcıya ait olup olmadığını kontrol eder.
func (h *Handler) checkServiceOwnership(ctx context.Context, serviceID, userID uuid.UUID) bool {
	var count int64
	h.db.WithContext(ctx).
		Table("services").
		Where("id = ? AND user_id = ?", serviceID, userID).
		Count(&count)
	return count > 0
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

	if !h.checkServiceOwnership(c.Request.Context(), serviceID, userID) {
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

	if !h.checkServiceOwnership(c.Request.Context(), serviceID, userID) {
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
	if !h.checkServiceOwnership(c.Request.Context(), metric.ServiceID, userID) {
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

	if !h.checkServiceOwnership(c.Request.Context(), serviceID, userID) {
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
