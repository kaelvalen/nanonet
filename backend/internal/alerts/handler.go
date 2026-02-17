package alerts

import (
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
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	includeResolved := c.DefaultQuery("resolved", "false") == "true"

	alerts, err := h.service.GetAlerts(c.Request.Context(), serviceID, includeResolved)
	if err != nil {
		response.InternalError(c, "alertler alınamadı")
		return
	}

	response.Success(c, alerts)
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
