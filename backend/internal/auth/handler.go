package auth

import (
	"errors"
	"strings"
	"time"

	"nanonet-backend/pkg/audit"
	"nanonet-backend/pkg/mailer"
	"nanonet-backend/pkg/middleware"
	"nanonet-backend/pkg/response"
	"nanonet-backend/pkg/tokenblacklist"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// refreshCookieMaxAge — refresh JWT'nin cookie ömrü (saniye).
// service.GenerateTokens 30 gün üretiyor; cookie ömrünü aynı seviyede tut,
// browser cookie'yi yenileme öncesi atmasın.
const refreshCookieMaxAge = 30 * 24 * 60 * 60

type Handler struct {
	service       *Service
	blacklist     tokenblacklist.Blacklist
	mailer        *mailer.Mailer
	frontendURL   string
	audit         *audit.Logger
	secureCookies bool
}

func NewHandler(db *gorm.DB, jwtSecret string, m *mailer.Mailer, frontendURL string, bl tokenblacklist.Blacklist, secureCookies bool) *Handler {
	return &Handler{
		service:       NewService(db, jwtSecret),
		blacklist:     bl,
		mailer:        m,
		frontendURL:   frontendURL,
		audit:         audit.New(db),
		secureCookies: secureCookies,
	}
}

// issueAuthCookies — refresh ve csrf cookie'lerini set eder; CSRF token'ını
// üretip JSON response'una da koyar (frontend ilk istekten itibaren X-CSRF
// header'ını gönderebilsin diye).
//
// Hata durumunda CSRF token boş döner; çağıran login akışı yine de devam
// edebilir, ancak frontend bir sonraki refresh'te yeni cookie alır.
func (h *Handler) issueAuthCookies(c *gin.Context, refreshToken string) string {
	middleware.SetRefreshCookie(c, h.secureCookies, refreshToken, refreshCookieMaxAge)
	csrf, err := middleware.GenerateCSRFToken()
	if err != nil {
		return ""
	}
	middleware.SetCSRFCookie(c, h.secureCookies, csrf, refreshCookieMaxAge)
	return csrf
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

	h.audit.Record(c.Request.Context(), audit.Entry{
		UserID:       &user.ID,
		Action:       audit.ActionRegister,
		ResourceType: "user",
		ResourceID:   &user.ID,
		IPAddress:    c.ClientIP(),
		UserAgent:    c.GetHeader("User-Agent"),
		Status:       audit.StatusSuccess,
	})

	csrf := h.issueAuthCookies(c, tokens.RefreshToken)
	response.Created(c, gin.H{
		"user":       user,
		"tokens":     tokens,
		"csrf_token": csrf,
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

	h.audit.Record(c.Request.Context(), audit.Entry{
		UserID:       &user.ID,
		Action:       audit.ActionLogin,
		ResourceType: "user",
		ResourceID:   &user.ID,
		IPAddress:    c.ClientIP(),
		UserAgent:    c.GetHeader("User-Agent"),
		Status:       audit.StatusSuccess,
	})

	csrf := h.issueAuthCookies(c, tokens.RefreshToken)
	response.Success(c, gin.H{
		"user": user,
		"tokens": gin.H{
			"access_token":  tokens.AccessToken,
			"refresh_token": tokens.RefreshToken,
			"expires_in":    tokens.ExpiresIn,
		},
		"csrf_token": csrf,
	})
}

// MobileRefresh accepts refresh token from request body (mobile clients can't use HttpOnly cookies).
func (h *Handler) MobileRefresh(c *gin.Context) {
	var req MobileRefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Unauthorized(c, "refresh_token gerekli")
		return
	}

	if h.blacklist.IsBlacklisted(c.Request.Context(), req.RefreshToken) {
		response.Unauthorized(c, "geçersiz refresh token")
		return
	}

	userID, expiry, err := h.service.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, "geçersiz refresh token")
		return
	}

	tokens, err := h.service.GenerateTokens(userID)
	if err != nil {
		response.InternalError(c, "token oluşturulamadı")
		return
	}

	if ttl := time.Until(expiry); ttl > 0 {
		_ = h.blacklist.Add(c.Request.Context(), req.RefreshToken, ttl)
	}

	response.Success(c, gin.H{
		"tokens": gin.H{
			"access_token":  tokens.AccessToken,
			"refresh_token": tokens.RefreshToken,
			"expires_in":    tokens.ExpiresIn,
		},
	})
}

func (h *Handler) Refresh(c *gin.Context) {
	// Refresh token tek kaynaktan: HttpOnly cookie. Eski JSON-body fallback
	// kaldırıldı — XSS ile çalınabilen JS-erişimli token alanları artık yok.
	// Geriye dönük uyum için bir grace window gerekmez: SPA build'i bu
	// release'le birlikte cookie tabanlı akışa geçiyor.
	cookieToken, err := c.Cookie(middleware.CookieRefresh)
	if err != nil || cookieToken == "" {
		response.Unauthorized(c, "refresh cookie eksik")
		return
	}

	if h.blacklist.IsBlacklisted(c.Request.Context(), cookieToken) {
		response.Unauthorized(c, "geçersiz refresh token")
		return
	}

	userID, expiry, err := h.service.ValidateRefreshToken(cookieToken)
	if err != nil {
		response.Unauthorized(c, "geçersiz refresh token")
		return
	}

	tokens, err := h.service.GenerateTokens(userID)
	if err != nil {
		response.InternalError(c, "token oluşturulamadı")
		return
	}

	// Blacklist the consumed refresh token so it cannot be reused.
	if ttl := time.Until(expiry); ttl > 0 {
		_ = h.blacklist.Add(c.Request.Context(), cookieToken, ttl)
	}

	csrf := h.issueAuthCookies(c, tokens.RefreshToken)
	response.Success(c, gin.H{
		"tokens":     tokens,
		"csrf_token": csrf,
	})
}

// AgentToken generates a new opaque agent token stored in the database.
// The raw token is returned only once; subsequent requests cannot retrieve it.
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

	var req struct {
		Name string `json:"name"`
	}
	_ = c.ShouldBindJSON(&req)

	rawToken, rec, err := h.service.GenerateAgentToken(userID, req.Name)
	if err != nil {
		response.InternalError(c, "agent token oluşturulamadı")
		return
	}

	response.Success(c, gin.H{
		"token_id":    rec.ID,
		"agent_token": rawToken,
		"name":        rec.Name,
		"created_at":  rec.CreatedAt,
	})
}

// ListAgentTokens returns all active (non-revoked) agent tokens for the authenticated user.
func (h *Handler) ListAgentTokens(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	tokens, err := h.service.ListAgentTokens(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "token listesi alınamadı")
		return
	}

	response.Success(c, tokens)
}

// RevokeAgentToken revokes the agent token specified by :token_id.
func (h *Handler) RevokeAgentToken(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	tokenID, err := uuid.Parse(c.Param("token_id"))
	if err != nil {
		response.BadRequest(c, "geçersiz token_id")
		return
	}

	if err := h.service.RevokeAgentToken(c.Request.Context(), tokenID, userID); err != nil {
		response.Error(c, 404, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "token iptal edildi"})
}

func (h *Handler) Logout(c *gin.Context) {
	tokenString := c.GetString("token")
	if tokenString != "" {
		// Access tokens live for 24h; blacklist for the full window.
		_ = h.blacklist.Add(c.Request.Context(), tokenString, 24*time.Hour)
	}

	// Cookie'deki refresh JWT'yi de blacklist'le; sayfa kapansa bile token
	// 30 gün boyunca geçersiz kalsın.
	if rt, err := c.Cookie(middleware.CookieRefresh); err == nil && rt != "" {
		if _, expiry, vErr := h.service.ValidateRefreshToken(rt); vErr == nil {
			if ttl := time.Until(expiry); ttl > 0 {
				_ = h.blacklist.Add(c.Request.Context(), rt, ttl)
			}
		}
	}

	middleware.ClearAuthCookies(c, h.secureCookies)

	if userIDStr := c.GetString("user_id"); userIDStr != "" {
		if userID, err := uuid.Parse(userIDStr); err == nil {
			h.audit.Record(c.Request.Context(), audit.Entry{
				UserID:       &userID,
				Action:       audit.ActionLogout,
				ResourceType: "user",
				ResourceID:   &userID,
				IPAddress:    c.ClientIP(),
				UserAgent:    c.GetHeader("User-Agent"),
				Status:       audit.StatusSuccess,
			})
		}
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

	if err := h.service.ChangePassword(userID, req.CurrentPassword, req.NewPassword); err != nil {
		switch err.Error() {
		case "mevcut şifre hatalı":
			response.Unauthorized(c, err.Error())
		case "kullanıcı bulunamadı":
			response.NotFound(c, err.Error())
		default:
			response.InternalError(c, "şifre güncellenemedi")
		}
		return
	}

	h.audit.Record(c.Request.Context(), audit.Entry{
		UserID:       &userID,
		Action:       audit.ActionPasswordChanged,
		ResourceType: "user",
		ResourceID:   &userID,
		Status:       audit.StatusSuccess,
	})

	tokenString := c.GetString("token")
	if tokenString != "" {
		_ = h.blacklist.Add(c.Request.Context(), tokenString, 24*time.Hour)
	}

	response.Success(c, gin.H{"message": "şifre güncellendi, lütfen tekrar giriş yapın"})
}
