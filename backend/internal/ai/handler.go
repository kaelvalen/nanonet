package ai

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service     *Service
	chatService *ChatService
}

func NewHandler(db *gorm.DB, apiKey string) *Handler {
	return &Handler{
		service:     NewService(db, apiKey),
		chatService: NewChatService(db, apiKey),
	}
}

func (h *Handler) Chat(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	result, err := h.chatService.Chat(c.Request.Context(), userID, req)
	if err != nil {
		if errors.Is(err, ErrRateLimitExceeded) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
			return
		}
		log.Printf("[AI Chat ERROR] user=%s: %v", userID, err)
		response.InternalError(c, "AI asistanı geçici olarak kullanılamıyor")
		return
	}

	response.Success(c, result)
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

	result, err := h.service.Analyze(c.Request.Context(), userID, serviceID, req.WindowMinutes, req.DeepAnalysis)
	if err != nil {
		if errors.Is(err, ErrRateLimitExceeded) {
			response.Error(c, 429, err.Error())
			return
		}
		log.Printf("[AI Analyze ERROR] service=%s user=%s: %v", serviceID, userID, err)
		response.InternalError(c, "analiz geçici olarak kullanılamıyor")
		return
	}

	response.Success(c, gin.H{"insight": result})
}

func (h *Handler) GetInsights(c *gin.Context) {
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

// GenerateReport — POST /api/v1/ai/report
// Seçilen zaman aralığı için proaktif SRE raporu üretir.
func (h *Handler) GenerateReport(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	var req ReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "geçersiz istek: time_range zorunlu (1h/24h/7d/30d)")
		return
	}

	switch req.TimeRange {
	case TimeRange1h, TimeRange24h, TimeRange7d, TimeRange30d:
	default:
		response.BadRequest(c, "geçersiz time_range: 1h, 24h, 7d veya 30d olmalı")
		return
	}

	result, err := h.service.GenerateReport(c.Request.Context(), userID, req)
	if err != nil {
		if errors.Is(err, ErrRateLimitExceeded) {
			response.Error(c, 429, err.Error())
			return
		}
		log.Printf("[AI Report ERROR] user=%s: %v", userID, err)
		response.InternalError(c, "rapor oluşturulamıyor")
		return
	}

	response.Success(c, gin.H{"report": result})
}

// GetAllInsights — GET /api/v1/insights?limit=20&page=1
// Returns recent AI insights across all services owned by the authenticated user.
func (h *Handler) GetAllInsights(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if limit <= 0 {
		limit = 20
	}
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	insights, total, err := h.service.GetAllInsights(c.Request.Context(), userID, limit, offset)
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
