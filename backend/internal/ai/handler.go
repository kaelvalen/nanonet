package ai

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

func NewHandler(db *gorm.DB, apiKey string) *Handler {
	return &Handler{
		service: NewService(db, apiKey),
	}
}

func (h *Handler) Analyze(c *gin.Context) {
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

	var req AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.WindowMinutes = 30
	}
	if req.WindowMinutes <= 0 {
		req.WindowMinutes = 30
	}

	result, err := h.service.Analyze(c.Request.Context(), userID, serviceID, req.WindowMinutes)
	if err != nil {
		if err.Error() == "AI analiz limiti aşıldı, lütfen 1 dakika bekleyin" {
			response.Error(c, 429, err.Error())
			return
		}
		response.InternalError(c, "analiz geçici olarak kullanılamıyor")
		return
	}

	response.Success(c, gin.H{"insight": result})
}

func (h *Handler) GetInsights(c *gin.Context) {
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	insights, total, err := h.service.GetInsights(c.Request.Context(), serviceID, limit, offset)
	if err != nil {
		response.InternalError(c, "insight'lar alınamadı")
		return
	}

	response.Success(c, gin.H{
		"insights": insights,
		"total":    total,
		"page":     page,
	})
}
