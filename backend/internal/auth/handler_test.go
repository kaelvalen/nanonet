package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── stubs ─────────────────────────────────────────────────────────

type stubBlacklist struct{}

func (s *stubBlacklist) Add(_ context.Context, _ string, _ time.Duration) error { return nil }
func (s *stubBlacklist) IsBlacklisted(_ context.Context, _ string) bool         { return false }

// ── helpers ───────────────────────────────────────────────────────

func newTestRouter(handler *Handler) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.POST("/register", handler.Register)
	r.POST("/login", handler.Login)
	r.POST("/forgot-password", handler.ForgotPassword)
	return r
}

func postJSON(router *gin.Engine, path string, body any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func decodeBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&m))
	return m
}

func newHandlerNoDB() *Handler {
	return &Handler{
		service:     &Service{jwtSecret: "test-secret-key-minimum-32-chars-x!"},
		blacklist:   &stubBlacklist{},
		frontendURL: "http://localhost:3000",
	}
}

// ── Register: validation ──────────────────────────────────────────

func TestRegister_MissingEmail(t *testing.T) {
	router := newTestRouter(newHandlerNoDB())
	w := postJSON(router, "/register", map[string]string{"password": "validpassword123"})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	body := decodeBody(t, w)
	assert.Equal(t, false, body["success"])
}

func TestRegister_InvalidEmail(t *testing.T) {
	router := newTestRouter(newHandlerNoDB())
	w := postJSON(router, "/register", map[string]string{
		"email":    "not-an-email",
		"password": "validpassword123",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRegister_PasswordTooShort(t *testing.T) {
	router := newTestRouter(newHandlerNoDB())
	w := postJSON(router, "/register", map[string]string{
		"email":    "user@example.com",
		"password": "short",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRegister_EmptyBody(t *testing.T) {
	router := newTestRouter(newHandlerNoDB())
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ── Login: validation ─────────────────────────────────────────────

func TestLogin_MissingBothFields(t *testing.T) {
	router := newTestRouter(newHandlerNoDB())
	w := postJSON(router, "/login", map[string]string{})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestLogin_MissingPassword(t *testing.T) {
	router := newTestRouter(newHandlerNoDB())
	w := postJSON(router, "/login", map[string]string{"email": "user@example.com"})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestLogin_InvalidEmailFormat(t *testing.T) {
	router := newTestRouter(newHandlerNoDB())
	w := postJSON(router, "/login", map[string]string{
		"email":    "not-valid",
		"password": "somepassword",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ── ForgotPassword: validation ────────────────────────────────────

func TestForgotPassword_InvalidEmail(t *testing.T) {
	router := newTestRouter(newHandlerNoDB())
	w := postJSON(router, "/forgot-password", map[string]string{"email": "bad"})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestForgotPassword_MissingEmail(t *testing.T) {
	router := newTestRouter(newHandlerNoDB())
	w := postJSON(router, "/forgot-password", map[string]string{})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// Valid email format passes validation check — only validation path tested here
func TestForgotPassword_ValidFormat_PassesValidation(t *testing.T) {
	// Test that valid email format is accepted (not 400) — DB calls are skipped
	// We verify validation logic only, not service execution
	handler := newHandlerNoDB()

	// Directly verify the binding works by calling with invalid vs valid
	invalidW := postJSON(newTestRouter(handler), "/forgot-password", map[string]string{"email": "bad"})
	assert.Equal(t, http.StatusBadRequest, invalidW.Code, "invalid email should be 400")

	validW := postJSON(newTestRouter(handler), "/forgot-password", map[string]string{"email": "user@example.com"})
	// Valid format passes validation but nil DB causes panic → gin recovery → 500
	// Either way it must NOT be 400 (validation failure)
	assert.NotEqual(t, http.StatusBadRequest, validW.Code, "valid email format should not be 400")
}

// ── Middleware ────────────────────────────────────────────────────

func TestMiddleware_NoAuthHeader(t *testing.T) {
	m := NewMiddleware("test-secret-key-minimum-32-chars-x!", &stubBlacklist{})
	r := gin.New()
	r.GET("/protected", m.Required(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestMiddleware_InvalidToken(t *testing.T) {
	m := NewMiddleware("test-secret-key-minimum-32-chars-x!", &stubBlacklist{})
	r := gin.New()
	r.GET("/protected", m.Required(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer garbage.token.here")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestMiddleware_ValidToken(t *testing.T) {
	secret := "test-secret-key-minimum-32-chars-x!"
	svc := &Service{jwtSecret: secret}
	userID := uuid.New()

	token, err := svc.generateToken(userID, time.Hour, "access")
	require.NoError(t, err)

	m := NewMiddleware(secret, &stubBlacklist{})
	r := gin.New()
	r.GET("/protected", m.Required(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"user_id": c.GetString("user_id")})
	})
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	body := decodeBody(t, w)
	assert.Equal(t, userID.String(), body["user_id"])
}

func TestMiddleware_AgentTokenRejected(t *testing.T) {
	secret := "test-secret-key-minimum-32-chars-x!"
	svc := &Service{jwtSecret: secret}
	userID := uuid.New()

	agentToken, err := svc.generateToken(userID, time.Hour, "agent")
	require.NoError(t, err)

	m := NewMiddleware(secret, &stubBlacklist{})
	r := gin.New()
	r.GET("/protected", m.Required(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+agentToken)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestMiddleware_BlacklistedToken(t *testing.T) {
	secret := "test-secret-key-minimum-32-chars-x!"
	svc := &Service{jwtSecret: secret}
	userID := uuid.New()

	token, err := svc.generateToken(userID, time.Hour, "access")
	require.NoError(t, err)

	blacklisted := &alwaysBlacklisted{}
	m := NewMiddleware(secret, blacklisted)
	r := gin.New()
	r.GET("/protected", m.Required(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

type alwaysBlacklisted struct{}

func (a *alwaysBlacklisted) Add(_ context.Context, _ string, _ time.Duration) error { return nil }
func (a *alwaysBlacklisted) IsBlacklisted(_ context.Context, _ string) bool         { return true }
