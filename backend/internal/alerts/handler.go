package alerts

import (
	"strconv"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{service: svc}
}

func (h *Handler) List(c *gin.Context) {
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

	if !h.service.IsServiceOwner(c.Request.Context(), serviceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	includeResolved := c.DefaultQuery("resolved", "false") == "true"

	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	alerts, total, err := h.service.GetAlertsPage(c.Request.Context(), serviceID, includeResolved, limit, offset)
	if err != nil {
		response.InternalError(c, "alertler alınamadı")
		return
	}

	response.Success(c, gin.H{
		"alerts": alerts,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handler) Resolve(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	alertID, err := uuid.Parse(c.Param("alertId"))
	if err != nil {
		response.BadRequest(c, "geçersiz alert ID")
		return
	}

	if err := h.service.ResolveAlert(c.Request.Context(), alertID, userID); err != nil {
		response.NotFound(c, "alert bulunamadı veya yetki yok")
		return
	}

	response.Success(c, gin.H{"message": "alert çözümlendi"})
}

func (h *Handler) GetActive(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	alerts, err := h.service.GetActiveAlerts(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "aktif alertler alınamadı")
		return
	}

	response.Success(c, alerts)
}

// GetAlertRules returns the per-service alert thresholds (or defaults if none stored).
func (h *Handler) GetAlertRules(c *gin.Context) {
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

	if !h.service.IsServiceOwner(c.Request.Context(), serviceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	rule, err := h.service.GetAlertRule(c.Request.Context(), serviceID)
	if err != nil {
		response.InternalError(c, "alert kuralları alınamadı")
		return
	}

	if rule == nil {
		// Return defaults shaped like ServiceAlertRule.
		response.Success(c, gin.H{
			"service_id":           serviceID,
			"cpu_threshold":        DefaultAlertRules.CPUThreshold,
			"memory_threshold_mb":  DefaultAlertRules.MemoryThreshold,
			"latency_threshold_ms": DefaultAlertRules.LatencyThreshold,
			"error_rate_threshold": DefaultAlertRules.ErrorRateThreshold,
			"is_default":           true,
		})
		return
	}

	response.Success(c, rule)
}

// UpsertAlertRules creates or updates per-service alert thresholds.
func (h *Handler) UpsertAlertRules(c *gin.Context) {
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

	if !h.service.IsServiceOwner(c.Request.Context(), serviceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	var req struct {
		CPUThreshold       float32 `json:"cpu_threshold" binding:"required,min=1,max=100"`
		MemoryThresholdMB  float32 `json:"memory_threshold_mb" binding:"required,min=1"`
		LatencyThresholdMS float32 `json:"latency_threshold_ms" binding:"required,min=1"`
		ErrorRateThreshold float32 `json:"error_rate_threshold" binding:"required,min=0,max=100"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	rule := &ServiceAlertRule{
		ServiceID:          serviceID,
		CPUThreshold:       req.CPUThreshold,
		MemoryThresholdMB:  req.MemoryThresholdMB,
		LatencyThresholdMS: req.LatencyThresholdMS,
		ErrorRateThreshold: req.ErrorRateThreshold,
	}

	if err := h.service.UpsertAlertRule(c.Request.Context(), rule); err != nil {
		response.InternalError(c, "alert kuralları güncellenemedi")
		return
	}

	response.Success(c, rule)
}
