package metrics

import (
	"context"
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

	durationStr := c.DefaultQuery("duration", "1h")
	duration, err := time.ParseDuration(durationStr)
	if err != nil {
		response.BadRequest(c, "geçersiz duration formatı")
		return
	}

	metrics, err := h.service.GetHistory(c.Request.Context(), serviceID, duration)
	if err != nil {
		response.InternalError(c, "metrikler alınamadı")
		return
	}

	response.Success(c, metrics)
}

func (h *Handler) GetAggregated(c *gin.Context) {
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

	bucketSize := c.DefaultQuery("bucket", "1 minute")

	metrics, err := h.service.GetAggregated(c.Request.Context(), serviceID, duration, bucketSize)
	if err != nil {
		response.InternalError(c, "aggregate metrikler alınamadı")
		return
	}

	response.Success(c, metrics)
}

func (h *Handler) InsertMetric(c *gin.Context) {
	var metric Metric
	if err := c.ShouldBindJSON(&metric); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if metric.ServiceID == uuid.Nil {
		response.BadRequest(c, "service_id zorunlu")
		return
	}

	// Servisin var olduğunu doğrula
	var count int64
	if err := h.db.WithContext(c.Request.Context()).
		Table("services").
		Where("id = ?", metric.ServiceID).
		Count(&count).Error; err != nil || count == 0 {
		response.NotFound(c, "servis bulunamadı")
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
