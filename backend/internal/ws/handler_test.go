package ws

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func signToken(t *testing.T, secret string, sub string, typ string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": sub,
		"typ": typ,
		"exp": time.Now().Add(time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return s
}

func TestValidateUserToken_RejectsAgentToken(t *testing.T) {
	h := &Handler{jwtSecret: "test-secret-key-minimum-32-chars-x!"}
	tok := signToken(t, h.jwtSecret, "user-1", "agent")
	if _, err := h.validateUserToken(tok); err == nil {
		t.Fatalf("expected agent token to be rejected")
	}
}

func TestValidateUserToken_AcceptsAccessToken(t *testing.T) {
	h := &Handler{jwtSecret: "test-secret-key-minimum-32-chars-x!"}
	tok := signToken(t, h.jwtSecret, "user-123", "access")
	sub, err := h.validateUserToken(tok)
	if err != nil {
		t.Fatalf("expected token accepted, got err: %v", err)
	}
	if sub != "user-123" {
		t.Fatalf("expected sub user-123, got: %q", sub)
	}
}

func TestExtractTokenType_InvalidReturnsEmpty(t *testing.T) {
	h := &Handler{jwtSecret: "test-secret-key-minimum-32-chars-x!"}
	if got := h.extractTokenType("garbage.token.here"); got != "" {
		t.Fatalf("expected empty typ, got: %q", got)
	}
}
