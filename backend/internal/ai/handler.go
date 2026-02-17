package ai

import (
	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
}

func NewHandler(db *gorm.DB, apiKey string) *Handler {
	return &Handler{
		service: NewService(db, apiKey),
	}
}

func (h *Handler) Analyze(c *gin.Context) {
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	var req struct {
		MetricsData string `json:"metrics_data" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	result, err := h.service.AnalyzeMetrics(serviceID, req.MetricsData)
	if err != nil {
		response.InternalError(c, "analiz başarısız")
		return
	}

	response.Success(c, result)
}
