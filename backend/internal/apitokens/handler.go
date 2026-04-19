package apitokens

import (
	"net/http"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// List — GET /api/v1/api-tokens
func (h *Handler) List(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}
	rows, err := h.svc.Repo().ListByUser(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "API token listesi alınamadı")
		return
	}
	response.Success(c, gin.H{
		"tokens":           rows,
		"available_scopes": AvailableScopes,
	})
}

// Create — POST /api/v1/api-tokens
func (h *Handler) Create(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	out, err := h.svc.Create(c.Request.Context(), userID, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"data": out,
	})
}

// Revoke — DELETE /api/v1/api-tokens/:id
func (h *Handler) Revoke(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz token id")
		return
	}
	if err := h.svc.Repo().Revoke(c.Request.Context(), userID, id); err != nil {
		response.InternalError(c, "token iptal edilemedi")
		return
	}
	response.Success(c, gin.H{"revoked": true})
}
