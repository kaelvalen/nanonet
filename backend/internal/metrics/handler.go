package metrics

import (
	"time"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	repo *Repository
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		repo: NewRepository(db),
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

	metrics, err := h.repo.GetHistory(c.Request.Context(), serviceID, duration)
	if err != nil {
		response.InternalError(c, "metrikler alınamadı")
		return
	}

	response.Success(c, metrics)
}
