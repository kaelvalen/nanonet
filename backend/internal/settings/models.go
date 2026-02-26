package settings

import (
	"time"

	"github.com/google/uuid"
)

type UserSettings struct {
	UserID           uuid.UUID `gorm:"type:uuid;primary_key" json:"user_id"`
	NotifCrit        bool      `gorm:"not null;default:true" json:"notif_crit"`
	NotifWarn        bool      `gorm:"not null;default:true" json:"notif_warn"`
	NotifDown        bool      `gorm:"not null;default:true" json:"notif_down"`
	NotifAI          bool      `gorm:"not null;default:false" json:"notif_ai"`
	PollIntervalSec  int       `gorm:"not null;default:10" json:"poll_interval_sec"`
	AutoRecovery     bool      `gorm:"not null;default:false" json:"auto_recovery"`
	AIAutoAnalyze    bool      `gorm:"not null;default:true" json:"ai_auto_analyze"`
	AIWindowMinutes  int       `gorm:"not null;default:30" json:"ai_window_minutes"`
	UpdatedAt        time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (UserSettings) TableName() string {
	return "user_settings"
}

type UpdateSettingsRequest struct {
	NotifCrit       *bool `json:"notif_crit"`
	NotifWarn       *bool `json:"notif_warn"`
	NotifDown       *bool `json:"notif_down"`
	NotifAI         *bool `json:"notif_ai"`
	PollIntervalSec *int  `json:"poll_interval_sec"`
	AutoRecovery    *bool `json:"auto_recovery"`
	AIAutoAnalyze   *bool `json:"ai_auto_analyze"`
	AIWindowMinutes *int  `json:"ai_window_minutes"`
}
