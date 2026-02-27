package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"nanonet-backend/pkg/mailer"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type PasswordResetToken struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null"`
	TokenHash string     `gorm:"type:varchar(64);unique;not null"`
	ExpiresAt time.Time  `gorm:"not null"`
	UsedAt    *time.Time `gorm:"default:null"`
	CreatedAt time.Time  `gorm:"not null;default:now()"`
}

func generateResetToken() (plain string, hashed string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	plain = hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(plain))
	hashed = hex.EncodeToString(sum[:])
	return
}

// ForgotPassword generates a reset token and sends a reset email via m.
// Always returns nil error to prevent email enumeration — errors are logged internally.
func (s *Service) ForgotPassword(email string, m *mailer.Mailer, frontendURL string) error {
	var user User
	if dbErr := s.db.Where("email = ?", email).First(&user).Error; dbErr != nil {
		if errors.Is(dbErr, gorm.ErrRecordNotFound) {
			return nil
		}
		return dbErr
	}

	// Invalidate existing unused tokens
	s.db.Model(&PasswordResetToken{}).
		Where("user_id = ? AND used_at IS NULL AND expires_at > NOW()", user.ID).
		Update("expires_at", time.Now())

	plain, hashed, err := generateResetToken()
	if err != nil {
		return err
	}

	prt := &PasswordResetToken{
		UserID:    user.ID,
		TokenHash: hashed,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	if err = s.db.Create(prt).Error; err != nil {
		return err
	}

	resetURL := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, plain)

	if m != nil && m.Enabled() {
		if sendErr := m.SendPasswordReset(user.Email, resetURL); sendErr != nil {
			// Log but don't surface — token is already created, user can retry
			fmt.Printf("[MAILER ERROR] email=%s err=%v\n", user.Email, sendErr)
		} else {
			fmt.Printf("[MAILER OK] reset email sent to %s\n", user.Email)
		}
	} else {
		fmt.Printf("[MAILER SKIP] not configured — reset URL: %s\n", resetURL)
	}

	return nil
}

// ResetPassword validates the token and sets a new password.
func (s *Service) ResetPassword(plainToken, newPassword string) error {
	sum := sha256.Sum256([]byte(plainToken))
	hashed := hex.EncodeToString(sum[:])

	var prt PasswordResetToken
	if err := s.db.
		Where("token_hash = ? AND used_at IS NULL AND expires_at > NOW()", hashed).
		First(&prt).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("geçersiz veya süresi dolmuş sıfırlama bağlantısı")
		}
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return err
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&User{}).
			Where("id = ?", prt.UserID).
			Update("password_hash", string(hash)).Error; err != nil {
			return err
		}
		now := time.Now()
		return tx.Model(&prt).Update("used_at", now).Error
	})
}
