package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testSecret = "test-secret-key-minimum-32-chars-x!"

func newTestService() *Service {
	return &Service{jwtSecret: testSecret}
}

// ── GenerateTokens ────────────────────────────────────────────────

func TestGenerateTokens_ReturnsNonEmptyTokens(t *testing.T) {
	svc := newTestService()
	id := uuid.New()

	resp, err := svc.GenerateTokens(id)
	require.NoError(t, err)
	assert.NotEmpty(t, resp.AccessToken)
	assert.NotEmpty(t, resp.RefreshToken)
	assert.Equal(t, int64((24 * time.Hour).Seconds()), resp.ExpiresIn)
}

func TestGenerateTokens_AccessAndRefreshAreDifferent(t *testing.T) {
	svc := newTestService()
	resp, err := svc.GenerateTokens(uuid.New())
	require.NoError(t, err)
	assert.NotEqual(t, resp.AccessToken, resp.RefreshToken)
}

// ── ValidateToken ─────────────────────────────────────────────────

func TestValidateToken_ValidAccess(t *testing.T) {
	svc := newTestService()
	id := uuid.New()

	resp, err := svc.GenerateTokens(id)
	require.NoError(t, err)

	parsedID, err := svc.ValidateToken(resp.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, id, parsedID)
}

func TestValidateToken_WrongSecret(t *testing.T) {
	svc := newTestService()
	other := &Service{jwtSecret: "another-secret-32-chars-yyyyyyyyy!"}

	resp, err := svc.GenerateTokens(uuid.New())
	require.NoError(t, err)

	_, err = other.ValidateToken(resp.AccessToken)
	assert.Error(t, err, "yanlış secret ile doğrulama başarısız olmalı")
}

func TestValidateToken_MalformedToken(t *testing.T) {
	svc := newTestService()
	_, err := svc.ValidateToken("not.a.token")
	assert.Error(t, err)
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	svc := newTestService()
	id := uuid.New()

	// -1 saniyelik süreli token oluştur (zaten süresi dolmuş)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": id.String(),
		"exp": time.Now().Add(-time.Second).Unix(),
		"iat": time.Now().Add(-2 * time.Second).Unix(),
		"typ": "access",
	})
	signed, err := token.SignedString([]byte(testSecret))
	require.NoError(t, err)

	_, err = svc.ValidateToken(signed)
	assert.Error(t, err, "süresi dolmuş token reddedilmeli")
}

func TestValidateToken_EmptyString(t *testing.T) {
	svc := newTestService()
	_, err := svc.ValidateToken("")
	assert.Error(t, err)
}

// ── ValidateRefreshToken ──────────────────────────────────────────

func TestValidateRefreshToken_Valid(t *testing.T) {
	svc := newTestService()
	id := uuid.New()

	resp, err := svc.GenerateTokens(id)
	require.NoError(t, err)

	parsedID, expiry, err := svc.ValidateRefreshToken(resp.RefreshToken)
	require.NoError(t, err)
	assert.Equal(t, id, parsedID)
	assert.True(t, expiry.After(time.Now()), "expiry gelecekte olmalı")
}

func TestValidateRefreshToken_RejectsAccessToken(t *testing.T) {
	svc := newTestService()
	resp, err := svc.GenerateTokens(uuid.New())
	require.NoError(t, err)

	// access token'ı refresh olarak kullanmaya çalış
	_, _, err = svc.ValidateRefreshToken(resp.AccessToken)
	assert.Error(t, err, "access token refresh token olarak kabul edilmemeli")
}

func TestValidateRefreshToken_WrongSecret(t *testing.T) {
	svc := newTestService()
	other := &Service{jwtSecret: "different-secret-32-chars-zzzzzz!"}

	resp, err := svc.GenerateTokens(uuid.New())
	require.NoError(t, err)

	_, _, err = other.ValidateRefreshToken(resp.RefreshToken)
	assert.Error(t, err)
}

func TestValidateRefreshToken_Expired(t *testing.T) {
	svc := newTestService()
	id := uuid.New()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": id.String(),
		"exp": time.Now().Add(-time.Second).Unix(),
		"iat": time.Now().Add(-2 * time.Second).Unix(),
		"typ": "refresh",
	})
	signed, err := token.SignedString([]byte(testSecret))
	require.NoError(t, err)

	_, _, err = svc.ValidateRefreshToken(signed)
	assert.Error(t, err)
}

// ── generateToken (iç metod) ──────────────────────────────────────

func TestGenerateToken_SubjectMatchesUserID(t *testing.T) {
	svc := newTestService()
	id := uuid.New()

	tokenStr, err := svc.generateToken(id, time.Hour, "access")
	require.NoError(t, err)

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte(testSecret), nil
	})
	require.NoError(t, err)
	require.True(t, token.Valid)

	claims, ok := token.Claims.(jwt.MapClaims)
	require.True(t, ok)
	assert.Equal(t, id.String(), claims["sub"])
	assert.Equal(t, "access", claims["typ"])
}

func TestGenerateToken_ExpiryClaim(t *testing.T) {
	svc := newTestService()
	before := time.Now()
	tokenStr, err := svc.generateToken(uuid.New(), 2*time.Hour, "access")
	require.NoError(t, err)

	token, _ := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte(testSecret), nil
	})
	claims := token.Claims.(jwt.MapClaims)
	exp := time.Unix(int64(claims["exp"].(float64)), 0)

	assert.True(t, exp.After(before.Add(time.Hour)), "expiry en az 1 saat sonra olmalı")
	assert.True(t, exp.Before(before.Add(3*time.Hour)), "expiry 3 saatten önce olmalı")
}
