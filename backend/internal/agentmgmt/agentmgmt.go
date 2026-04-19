// Package agentmgmt tracks heartbeat liveness and exposes the latest published
// agent version. The data backs the "Agent stale" banner in the UI and the
// auto-update prompt the agent shows on startup.
package agentmgmt

import (
	"context"
	"errors"
	"net/http"
	"time"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// HeartbeatStaleAfter is how long without a heartbeat before we mark an agent
// as "stale". Slightly longer than the agent's default heartbeat interval so
// transient network blips don't churn the status.
const HeartbeatStaleAfter = 90 * time.Second

// HeartbeatDownAfter promotes the agent to "down" and triggers an alert.
const HeartbeatDownAfter = 5 * time.Minute

type Release struct {
	Channel     string    `gorm:"column:channel;primaryKey" json:"channel"`
	Version     string    `gorm:"column:version"            json:"version"`
	DownloadURL *string   `gorm:"column:download_url"       json:"download_url,omitempty"`
	Notes       *string   `gorm:"column:notes"              json:"notes,omitempty"`
	SHA256      *string   `gorm:"column:sha256"             json:"sha256,omitempty"`
	PublishedAt time.Time `gorm:"column:published_at"       json:"published_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"         json:"updated_at"`
}

func (Release) TableName() string { return "agent_releases" }

type Service struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Service { return &Service{db: db} }

// RecordHeartbeat updates services.agent_* for an active agent. Best-effort —
// errors are returned to the caller for logging but never block ingestion.
func (s *Service) RecordHeartbeat(ctx context.Context, serviceID, version string, at time.Time) error {
	sid, err := uuid.Parse(serviceID)
	if err != nil {
		return err
	}
	if at.IsZero() {
		at = time.Now()
	}
	updates := map[string]interface{}{
		"agent_last_heartbeat_at": at,
		"agent_status":            "healthy",
	}
	if version != "" {
		updates["agent_version"] = version
	}
	return s.db.WithContext(ctx).
		Table("services").
		Where("id = ?", sid).
		Updates(updates).Error
}

// LatestRelease returns the published version for a channel. Defaults to
// "stable". Returns nil when the table is empty (fresh installs before seeds).
func (s *Service) LatestRelease(ctx context.Context, channel string) (*Release, error) {
	if channel == "" {
		channel = "stable"
	}
	var r Release
	err := s.db.WithContext(ctx).Where("channel = ?", channel).First(&r).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil //nolint:nilnil
		}
		return nil, err
	}
	return &r, nil
}

// SetRelease publishes a new release row. Used by an admin endpoint or DB
// seed. Idempotent — upserts on channel.
func (s *Service) SetRelease(ctx context.Context, r Release) error {
	if r.Channel == "" {
		r.Channel = "stable"
	}
	r.UpdatedAt = time.Now()
	if r.PublishedAt.IsZero() {
		r.PublishedAt = r.UpdatedAt
	}
	return s.db.WithContext(ctx).Exec(`
		INSERT INTO agent_releases (channel, version, download_url, notes, sha256, published_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (channel) DO UPDATE SET
			version       = EXCLUDED.version,
			download_url  = EXCLUDED.download_url,
			notes         = EXCLUDED.notes,
			sha256        = EXCLUDED.sha256,
			published_at  = EXCLUDED.published_at,
			updated_at    = EXCLUDED.updated_at
	`, r.Channel, r.Version, r.DownloadURL, r.Notes, r.SHA256, r.PublishedAt, r.UpdatedAt).Error
}

// StaleEvaluation is the result of a periodic sweep: which services need
// notifications and which need their status downgraded.
type StaleEvaluation struct {
	NewlyStale []uuid.UUID
	NewlyDown  []uuid.UUID
}

// EvaluateStaleness scans all services with a known last-heartbeat and
// promotes their agent_status to "stale" or "down" based on the time since
// last contact. Idempotent: only services whose status actually changed are
// returned, so callers can fire alerts exactly once.
func (s *Service) EvaluateStaleness(ctx context.Context, now time.Time) (*StaleEvaluation, error) {
	type row struct {
		ID                   uuid.UUID  `gorm:"column:id"`
		AgentStatus          string     `gorm:"column:agent_status"`
		AgentLastHeartbeatAt *time.Time `gorm:"column:agent_last_heartbeat_at"`
	}
	var rows []row
	if err := s.db.WithContext(ctx).Raw(`
		SELECT id, agent_status, agent_last_heartbeat_at
		FROM services
		WHERE agent_last_heartbeat_at IS NOT NULL
	`).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := &StaleEvaluation{}
	for _, r := range rows {
		if r.AgentLastHeartbeatAt == nil {
			continue
		}
		age := now.Sub(*r.AgentLastHeartbeatAt)
		switch {
		case age >= HeartbeatDownAfter && r.AgentStatus != "down":
			_ = s.db.WithContext(ctx).Table("services").
				Where("id = ?", r.ID).
				Update("agent_status", "down").Error
			out.NewlyDown = append(out.NewlyDown, r.ID)
		case age >= HeartbeatStaleAfter && age < HeartbeatDownAfter && r.AgentStatus != "stale":
			_ = s.db.WithContext(ctx).Table("services").
				Where("id = ?", r.ID).
				Update("agent_status", "stale").Error
			out.NewlyStale = append(out.NewlyStale, r.ID)
		}
	}
	return out, nil
}

// Handler exposes the public endpoint /api/v1/agents/release used by agents
// to discover the latest version.
type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// LatestRelease — GET /api/v1/agents/release?channel=stable
//
// Authentication: agents present their access token (JWT or API token) so we
// only let known principals discover release URLs. The endpoint is otherwise
// open — every authed caller sees the same result.
func (h *Handler) LatestRelease(c *gin.Context) {
	channel := c.DefaultQuery("channel", "stable")
	r, err := h.svc.LatestRelease(c.Request.Context(), channel)
	if err != nil {
		response.InternalError(c, "release bilgisi alınamadı")
		return
	}
	if r == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "release tanımlı değil"})
		return
	}
	response.Success(c, r)
}
