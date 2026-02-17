package metrics

import (
	"time"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		service: NewService(db),
	}
}

func (h *Handler) GetHistory(c *gin.Context) {
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
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
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
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

	metric.Time = time.Now()

	if err := h.service.InsertMetric(c.Request.Context(), &metric); err != nil {
		response.InternalError(c, "metrik kaydedilemedi")
		return
	}

	response.Created(c, metric)
}
