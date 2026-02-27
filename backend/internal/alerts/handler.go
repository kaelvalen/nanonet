package alerts

import (
	"strconv"

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
