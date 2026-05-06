package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"nanonet-backend/pkg/audit"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Service struct {
	db          *gorm.DB
	jwtSecret   string
	auditLogger *audit.Logger
}

func NewService(db *gorm.DB, jwtSecret string) *Service {
	return &Service{
		db:          db,
		jwtSecret:   jwtSecret,
		auditLogger: audit.New(db),
	}
}

func (s *Service) Register(email, password string) (*User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}

	user := &User{
		Email:        email,
		PasswordHash: string(hash),
	}

	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Service) Login(email, password string) (*User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var user User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.auditLogger.Record(context.Background(), audit.Entry{
				Action:       audit.ActionLoginFailed,
				ResourceType: "user",
				Status:       audit.StatusFailure,
				Details:      map[string]any{"reason": "user_not_found", "email": email},
			})
			return nil, errors.New("geçersiz email veya şifre")
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		s.auditLogger.Record(context.Background(), audit.Entry{
			UserID:       &user.ID,
			Action:       audit.ActionLoginFailed,
			ResourceType: "user",
			ResourceID:   &user.ID,
			Status:       audit.StatusFailure,
			Details:      map[string]any{"reason": "invalid_password"},
		})
		return nil, errors.New("geçersiz email veya şifre")
	}

	return &user, nil
}

func (s *Service) GenerateTokens(userID uuid.UUID) (*TokenResponse, error) {
	accessToken, err := s.generateToken(userID, 24*time.Hour, "access")
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateToken(userID, 30*24*time.Hour, "refresh")
	if err != nil {
		return nil, err
	}

	return &TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64((24 * time.Hour).Seconds()),
	}, nil
}

func (s *Service) generateToken(userID uuid.UUID, duration time.Duration, tokenType string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"exp": time.Now().Add(duration).Unix(),
		"iat": time.Now().Unix(),
		"typ": tokenType,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// GenerateAgentToken creates a new opaque agent token, stores its SHA-256 hash
// in the database, and returns the raw token to the caller (shown only once).
func (s *Service) GenerateAgentToken(userID uuid.UUID, name string) (string, *AgentToken, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", nil, fmt.Errorf("token üretilemedi: %w", err)
	}
	tokenStr := "nnat_" + hex.EncodeToString(raw)

	sum := sha256.Sum256([]byte(tokenStr))
	hash := hex.EncodeToString(sum[:])

	rec := &AgentToken{
		UserID:    userID,
		TokenHash: hash,
		Name:      name,
	}
	if err := s.db.Create(rec).Error; err != nil {
		return "", nil, fmt.Errorf("token kaydedilemedi: %w", err)
	}
	return tokenStr, rec, nil
}

// ValidateAgentToken looks up the SHA-256 hash of the raw token and returns
// the owning user ID. It also updates last_used_at on a successful lookup.
func (s *Service) ValidateAgentToken(ctx context.Context, rawToken string) (uuid.UUID, error) {
	sum := sha256.Sum256([]byte(rawToken))
	hash := hex.EncodeToString(sum[:])

	var rec AgentToken
	err := s.db.WithContext(ctx).
		Where("token_hash = ? AND revoked_at IS NULL", hash).
		First(&rec).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return uuid.Nil, errors.New("geçersiz agent token")
		}
		return uuid.Nil, err
	}

	now := time.Now()
	_ = s.db.WithContext(ctx).Model(&rec).Update("last_used_at", now).Error
	return rec.UserID, nil
}

// RevokeAgentToken revokes a specific agent token by its ID, enforcing user ownership.
func (s *Service) RevokeAgentToken(ctx context.Context, tokenID, userID uuid.UUID) error {
	now := time.Now()
	res := s.db.WithContext(ctx).Model(&AgentToken{}).
		Where("id = ? AND user_id = ? AND revoked_at IS NULL", tokenID, userID).
		Update("revoked_at", now)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("token bulunamadı veya zaten iptal edilmiş")
	}
	return nil
}

// ListAgentTokens returns all non-revoked agent tokens for a user.
func (s *Service) ListAgentTokens(ctx context.Context, userID uuid.UUID) ([]AgentToken, error) {
	var tokens []AgentToken
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Order("created_at DESC").
		Find(&tokens).Error
	return tokens, err
}

// ValidateRefreshToken validates a refresh token and returns the user ID and token expiry time.
func (s *Service) ValidateRefreshToken(tokenString string) (uuid.UUID, time.Time, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("beklenmeyen imza algoritması: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return uuid.Nil, time.Time{}, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		if typ, _ := claims["typ"].(string); typ != "refresh" {
			return uuid.Nil, time.Time{}, errors.New("geçersiz token tipi: refresh token gerekli")
		}
		userIDStr, ok := claims["sub"].(string)
		if !ok {
			return uuid.Nil, time.Time{}, errors.New("geçersiz token payload")
		}
		var expiry time.Time
		if exp, ok := claims["exp"].(float64); ok {
			expiry = time.Unix(int64(exp), 0)
		}
		userID, err := uuid.Parse(userIDStr)
		return userID, expiry, err
	}

	return uuid.Nil, time.Time{}, errors.New("geçersiz token")
}

func (s *Service) GetUserByID(userID uuid.UUID) (*User, error) {
	var user User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Service) UpdatePasswordHash(userID uuid.UUID, hash string) error {
	return s.db.Model(&User{}).Where("id = ?", userID).Update("password_hash", hash).Error
}

// ChangePassword verifies the current password and replaces it with a new bcrypt hash.
func (s *Service) ChangePassword(userID uuid.UUID, currentPassword, newPassword string) error {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return errors.New("kullanıcı bulunamadı")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return errors.New("mevcut şifre hatalı")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return fmt.Errorf("şifre işlenemedi: %w", err)
	}
	return s.UpdatePasswordHash(userID, string(hash))
}

func (s *Service) ValidateToken(tokenString string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("beklenmeyen imza algoritması: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return uuid.Nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userIDStr, ok := claims["sub"].(string)
		if !ok {
			return uuid.Nil, errors.New("geçersiz token payload")
		}
		return uuid.Parse(userIDStr)
	}

	return uuid.Nil, errors.New("geçersiz token")
}
