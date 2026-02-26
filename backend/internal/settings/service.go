package settings

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) Get(ctx context.Context, userID uuid.UUID) (*UserSettings, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var settings UserSettings
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&settings).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			settings = UserSettings{
				UserID:          userID,
				NotifCrit:       true,
				NotifWarn:       true,
				NotifDown:       true,
				NotifAI:         false,
				PollIntervalSec: 10,
				AutoRecovery:    false,
				AIAutoAnalyze:   true,
				AIWindowMinutes: 30,
				UpdatedAt:       time.Now(),
			}
			if err := s.db.WithContext(ctx).Create(&settings).Error; err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}
	return &settings, nil
}

func (s *Service) Update(ctx context.Context, userID uuid.UUID, req UpdateSettingsRequest) (*UserSettings, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	existing, err := s.Get(ctx, userID)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{"updated_at": time.Now()}

	if req.NotifCrit != nil {
		updates["notif_crit"] = *req.NotifCrit
	}
	if req.NotifWarn != nil {
		updates["notif_warn"] = *req.NotifWarn
	}
	if req.NotifDown != nil {
		updates["notif_down"] = *req.NotifDown
	}
	if req.NotifAI != nil {
		updates["notif_ai"] = *req.NotifAI
	}
	if req.PollIntervalSec != nil {
		if *req.PollIntervalSec < 5 || *req.PollIntervalSec > 300 {
			return nil, errors.New("poll_interval_sec 5 ile 300 arasında olmalı")
		}
		updates["poll_interval_sec"] = *req.PollIntervalSec
	}
	if req.AutoRecovery != nil {
		updates["auto_recovery"] = *req.AutoRecovery
	}
	if req.AIAutoAnalyze != nil {
		updates["ai_auto_analyze"] = *req.AIAutoAnalyze
	}
	if req.AIWindowMinutes != nil {
		if *req.AIWindowMinutes < 5 || *req.AIWindowMinutes > 1440 {
			return nil, errors.New("ai_window_minutes 5 ile 1440 arasında olmalı")
		}
		updates["ai_window_minutes"] = *req.AIWindowMinutes
	}

	if err := s.db.WithContext(ctx).Model(existing).Updates(updates).Error; err != nil {
		return nil, err
	}

	return s.Get(ctx, userID)
}
