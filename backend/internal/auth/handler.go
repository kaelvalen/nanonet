package auth

import (
	"errors"
	"strings"
	"time"

	"nanonet-backend/pkg/mailer"
	"nanonet-backend/pkg/response"
	"nanonet-backend/pkg/tokenblacklist"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Handler struct {
	service     *Service
	blacklist   *tokenblacklist.Blacklist
	mailer      *mailer.Mailer
	frontendURL string
}

func NewHandler(db *gorm.DB, jwtSecret string, m *mailer.Mailer, frontendURL string) *Handler {
	return &Handler{
		service:     NewService(db, jwtSecret),
		blacklist:   tokenblacklist.Default,
		mailer:      m,
		frontendURL: frontendURL,
	}
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
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
		response.ValidationError(c, err)
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
		response.ValidationError(c, err)
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

// AgentToken generates a long-lived token suitable for agent processes.
func (h *Handler) AgentToken(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "authorization gerekli")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.BadRequest(c, "geçersiz user_id")
		return
	}

	token, err := h.service.GenerateAgentToken(userID)
	if err != nil {
		response.InternalError(c, "agent token oluşturulamadı")
		return
	}

	response.Success(c, gin.H{
		"agent_token": token,
		"expires_in":  int64((3650 * 24 * time.Hour).Seconds()),
	})
}

func (h *Handler) Logout(c *gin.Context) {
	tokenString := c.GetString("token")
	if tokenString != "" {
		h.blacklist.Add(tokenString, time.Now().Add(24*time.Hour))
	}
	response.Success(c, gin.H{"message": "çıkış başarılı"})
}

func (h *Handler) Me(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "authorization gerekli")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.BadRequest(c, "geçersiz user_id")
		return
	}

	user, err := h.service.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "kullanıcı bulunamadı")
			return
		}
		response.InternalError(c, "kullanıcı bilgisi alınamadı")
		return
	}

	response.Success(c, user)
}

func (h *Handler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	if err := h.service.ForgotPassword(req.Email, h.mailer, h.frontendURL); err != nil {
		response.InternalError(c, "işlem gerçekleştirilemedi")
		return
	}

	// Enumeration saldırılarını önlemek için her durumda aynı yanıt
	response.Success(c, gin.H{"message": "Eğer bu email kayıtlıysa sıfırlama bağlantısı gönderildi"})
}

func (h *Handler) ResetPassword(c *gin.Context) {
	var req struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=12"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	if err := h.service.ResetPassword(req.Token, req.NewPassword); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Şifre başarıyla sıfırlandı, lütfen giriş yapın"})
}

func (h *Handler) ChangePassword(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=12"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	user, err := h.service.GetUserByID(userID)
	if err != nil {
		response.NotFound(c, "kullanıcı bulunamadı")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		response.Unauthorized(c, "mevcut şifre hatalı")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		response.InternalError(c, "şifre işlenemedi")
		return
	}

	if err := h.service.UpdatePasswordHash(userID, string(hash)); err != nil {
		response.InternalError(c, "şifre güncellenemedi")
		return
	}

	tokenString := c.GetString("token")
	if tokenString != "" {
		h.blacklist.Add(tokenString, time.Now().Add(24*time.Hour))
	}

	response.Success(c, gin.H{"message": "şifre güncellendi, lütfen tekrar giriş yapın"})
}
