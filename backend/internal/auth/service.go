package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Service struct {
	db        *gorm.DB
	jwtSecret string
}

func NewService(db *gorm.DB, jwtSecret string) *Service {
	return &Service{
		db:        db,
		jwtSecret: jwtSecret,
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
			return nil, errors.New("geçersiz email veya şifre")
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
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
func (s *Service) ValidateRefreshToken(tokenString string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("geçersiz imza metodu")
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return uuid.Nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		if typ, _ := claims["typ"].(string); typ != "refresh" {
			return uuid.Nil, errors.New("geçersiz token tipi: refresh token gerekli")
		}
		userIDStr, ok := claims["sub"].(string)
		if !ok {
			return uuid.Nil, errors.New("geçersiz token payload")
		}
		return uuid.Parse(userIDStr)
	}

	return uuid.Nil, errors.New("geçersiz token")
}

func (s *Service) ValidateToken(tokenString string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("geçersiz imza metodu")
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
