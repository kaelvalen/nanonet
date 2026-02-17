package auth

import (
	"strings"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
}

func NewHandler(db *gorm.DB, jwtSecret string) *Handler {
	return &Handler{
		service: NewService(db, jwtSecret),
	}
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	user, err := h.service.Register(req.Email, req.Password)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "duplicate") || strings.Contains(errMsg, "unique") || strings.Contains(errMsg, "already exists") {
			response.Error(c, 409, "bu email adresi zaten kullanılıyor")
			return
		}
		response.InternalError(c, "kullanıcı oluşturulamadı")
		return
	}

	tokens, err := h.service.GenerateTokens(user.ID)
	if err != nil {
		response.InternalError(c, "token oluşturulamadı")
		return
	}

	response.Created(c, gin.H{
		"user":   user,
		"tokens": tokens,
	})
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	user, err := h.service.Login(req.Email, req.Password)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	tokens, err := h.service.GenerateTokens(user.ID)
	if err != nil {
		response.InternalError(c, "token oluşturulamadı")
		return
	}

	response.Success(c, gin.H{
		"user":   user,
		"tokens": tokens,
	})
}

func (h *Handler) Refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID, err := h.service.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, "geçersiz refresh token")
		return
	}

	tokens, err := h.service.GenerateTokens(userID)
	if err != nil {
		response.InternalError(c, "token oluşturulamadı")
		return
	}

	response.Success(c, tokens)
}

func (h *Handler) Logout(c *gin.Context) {
	response.Success(c, gin.H{"message": "çıkış başarılı"})
}
