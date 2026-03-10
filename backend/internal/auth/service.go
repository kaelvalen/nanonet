package auth

import (
	"context"
	"errors"
	"fmt"
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

// ValidateRefreshToken refresh token'ını doğrular; access token ile kullanılamaz.
// GenerateAgentToken uzun ömürlü (1 yıl) agent token'ı üretir.
func (s *Service) GenerateAgentToken(userID uuid.UUID) (string, error) {
	return s.generateToken(userID, 3650*24*time.Hour, "agent")
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
