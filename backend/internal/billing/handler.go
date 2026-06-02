package billing

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"nanonet-backend/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{service: NewService(db)}
}

// GET /api/v1/billing/plans
func (h *Handler) GetPlans(c *gin.Context) {
	plans, err := h.service.GetPlans(c.Request.Context())
	if err != nil {
		response.InternalError(c, "planlar alınamadı")
		return
	}
	response.Success(c, plans)
}

// GET /api/v1/billing/subscription
func (h *Handler) GetSubscription(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	sub, err := h.service.GetSubscription(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "abonelik alınamadı")
		return
	}

	usage, err := h.service.GetUsage(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "kullanım bilgisi alınamadı")
		return
	}

	response.Success(c, PlanSummary{
		Subscription: *sub,
		Usage:        *usage,
	})
}

// POST /api/v1/billing/subscribe  body: {"plan_id":"pro"}
func (h *Handler) Subscribe(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	var req struct {
		PlanID string `json:"plan_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "plan_id gerekli")
		return
	}

	sub, err := h.service.ChangePlan(c.Request.Context(), userID, req.PlanID)
	if err != nil {
		response.Error(c, http.StatusUnprocessableEntity, err.Error())
		return
	}
	response.Success(c, sub)
}

// POST /api/v1/billing/cancel
func (h *Handler) Cancel(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	if err := h.service.CancelSubscription(c.Request.Context(), userID); err != nil {
		response.InternalError(c, "iptal işlemi başarısız")
		return
	}
	response.Success(c, gin.H{"canceled": true})
}
