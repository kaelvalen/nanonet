package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Action string

const (
	ActionLogin         Action = "auth.login"
	ActionLoginFailed   Action = "auth.login_failed"
	ActionRegister      Action = "auth.register"
	ActionLogout        Action = "auth.logout"
	ActionServiceCreate Action = "service.create"
	ActionServiceDelete Action = "service.delete"
	ActionCommandExec   Action = "command.exec"
	ActionAIAnalyze     Action = "ai.analyze"
)

type Status string

const (
	StatusSuccess Status = "success"
	StatusFailure Status = "failure"
	StatusBlocked Status = "blocked"
)

type Log struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID       *uuid.UUID `gorm:"type:uuid"`
	Action       Action     `gorm:"type:varchar(100);not null"`
	ResourceType string     `gorm:"type:varchar(50);not null"`
	ResourceID   *uuid.UUID `gorm:"type:uuid"`
	IPAddress    string     `gorm:"type:varchar(45)"`
	UserAgent    string     `gorm:"type:text"`
	Status       Status     `gorm:"type:varchar(20);not null"`
	Details      []byte     `gorm:"type:jsonb"`
	CreatedAt    time.Time  `gorm:"not null;default:now()"`
}

func (Log) TableName() string { return "audit_logs" }

type Logger struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Logger {
	return &Logger{db: db}
}

type Entry struct {
	UserID       *uuid.UUID
	Action       Action
	ResourceType string
	ResourceID   *uuid.UUID
	IPAddress    string
	UserAgent    string
	Status       Status
	Details      map[string]any
}

func (l *Logger) Record(ctx context.Context, e Entry) {
	var detailsJSON []byte
	if len(e.Details) > 0 {
		detailsJSON, _ = json.Marshal(e.Details)
	}

	record := &Log{
		UserID:       e.UserID,
		Action:       e.Action,
		ResourceType: e.ResourceType,
		ResourceID:   e.ResourceID,
		IPAddress:    e.IPAddress,
		UserAgent:    e.UserAgent,
		Status:       e.Status,
		Details:      detailsJSON,
	}

	go func() {
		dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := l.db.WithContext(dbCtx).Create(record).Error; err != nil {
			_ = err
		}
	}()
}
