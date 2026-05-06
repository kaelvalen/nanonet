package notifications

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"nanonet-backend/pkg/push"
)

type PushService struct {
	db     *gorm.DB
	client *push.Client
}

func NewPushService(db *gorm.DB, client *push.Client) *PushService {
	return &PushService{db: db, client: client}
}

func (s *PushService) RegisterToken(ctx context.Context, userID uuid.UUID, token, platform string) error {
	t := &UserPushToken{UserID: userID, Token: token, Platform: platform}
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "token"}}, DoNothing: true}).
		Create(t).Error
}

func (s *PushService) DeleteToken(ctx context.Context, userID uuid.UUID, token string) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND token = ?", userID, token).
		Delete(&UserPushToken{}).Error
}

func (s *PushService) UpsertPreference(ctx context.Context, pref *UserPushPreference) error {
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"enabled", "min_severity", "updated_at"}),
		}).Create(pref).Error
}

func (s *PushService) GetPreference(ctx context.Context, userID uuid.UUID) (*UserPushPreference, error) {
	var pref UserPushPreference
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&pref).Error
	if err == gorm.ErrRecordNotFound {
		return &UserPushPreference{UserID: userID, Enabled: true, MinSeverity: "warn"}, nil
	}
	return &pref, err
}

// SendToUser sends push notifications to all registered tokens for a user,
// filtered by the user's severity preference.
func (s *PushService) SendToUser(ctx context.Context, userID uuid.UUID, title, body, severity string) {
	pref, err := s.GetPreference(ctx, userID)
	if err != nil || !pref.Enabled {
		return
	}
	if !severityMeets(severity, pref.MinSeverity) {
		return
	}

	var tokens []UserPushToken
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).Find(&tokens).Error; err != nil || len(tokens) == 0 {
		return
	}

	msgs := make([]push.Message, 0, len(tokens))
	for _, t := range tokens {
		msgs = append(msgs, push.Message{To: t.Token, Title: title, Body: body})
	}

	if err := s.client.Send(ctx, msgs); err != nil {
		slog.Warn("push send failed", slog.String("user_id", userID.String()), slog.String("error", err.Error()))
	}
}

// severityMeets returns true if got meets or exceeds the minimum required severity.
// Severity order: info < warn < crit
func severityMeets(got, min string) bool {
	order := map[string]int{"info": 0, "warn": 1, "crit": 2}
	return order[got] >= order[min]
}

func pushTitle(serviceName, alertType string) string {
	return fmt.Sprintf("[%s] %s", serviceName, alertType)
}
