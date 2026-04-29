package notifications

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"nanonet-backend/pkg/netguard"
)

// Service is the public façade. Other packages (alerts, incidents, ai) call
// Service.Dispatch with a logical Event and the service handles channel lookup,
// per-channel cooldown dedup, async fan-out and delivery logging.
type Service struct {
	repo       *Repository
	dispatcher *Dispatcher

	// per-channel/event cooldown tracking — keyed "channelID:dedupKey"
	mu        sync.Mutex
	cooldowns map[string]time.Time
}

func NewService(db *gorm.DB, email EmailSender, guard netguard.Options) *Service {
	return &Service{
		repo:       NewRepository(db),
		dispatcher: NewDispatcher(email, guard),
		cooldowns:  make(map[string]time.Time),
	}
}

// CRUD passthroughs for the handler.

func (s *Service) Create(ctx context.Context, ch *Channel) error { return s.repo.Create(ctx, ch) }
func (s *Service) Update(ctx context.Context, ch *Channel) error { return s.repo.Update(ctx, ch) }
func (s *Service) Delete(ctx context.Context, u, id uuid.UUID) error {
	return s.repo.Delete(ctx, u, id)
}
func (s *Service) Get(ctx context.Context, u, id uuid.UUID) (*Channel, error) {
	return s.repo.GetByID(ctx, u, id)
}
func (s *Service) List(ctx context.Context, u uuid.UUID) ([]Channel, error) {
	return s.repo.ListByUser(ctx, u)
}
func (s *Service) Deliveries(ctx context.Context, channelID uuid.UUID, limit int) ([]Delivery, error) {
	return s.repo.ListDeliveries(ctx, channelID, limit)
}

// Dispatch fans the event out to every matching enabled channel for the user.
// It runs synchronously (typically called from a goroutine in the alert path)
// and returns the number of channels that actually fired.
func (s *Service) Dispatch(ctx context.Context, userID uuid.UUID, ev Event) int {
	channels, err := s.repo.EnabledChannelsForService(ctx, userID, ev.ServiceID, ev.Severity)
	if err != nil {
		slog.Warn("notification channel lookup failed",
			slog.String("user_id", userID.String()),
			slog.String("error", err.Error()))
		return 0
	}

	fired := 0
	for i := range channels {
		ch := channels[i]
		if !s.tryClaimCooldown(&ch, ev) {
			s.logSkip(ctx, ch.ID, ev, "skipped_cooldown")
			continue
		}
		s.deliver(ctx, &ch, ev)
		fired++
	}
	return fired
}

// SendTest is the explicit "Test" button path — bypasses cooldown.
func (s *Service) SendTest(ctx context.Context, ch *Channel) error {
	ev := Event{
		Kind:      "test",
		Title:     "NanoNet Test Bildirimi",
		Message:   "Bu kanal başarıyla yapılandırıldı. 🎉",
		Severity:  "info",
		Timestamp: time.Now(),
	}
	res, err := s.dispatcher.Send(ctx, ch, ev)
	d := newDelivery(ch.ID, ev, res, err, "")
	if err != nil {
		errMsg := err.Error()
		d.Status = "failed"
		d.Error = &errMsg
	} else {
		d.Status = "success"
	}
	_ = s.repo.RecordDelivery(ctx, d)
	if err == nil {
		_ = s.repo.MarkUsed(ctx, ch.ID, "")
	} else {
		_ = s.repo.MarkUsed(ctx, ch.ID, err.Error())
	}
	return err
}

// ─── internals ──────────────────────────────────────────────────────────────

func (s *Service) deliver(ctx context.Context, ch *Channel, ev Event) {
	// Each delivery gets its own deadline so one slow channel can't stall others.
	dctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	res, err := s.dispatcher.Send(dctx, ch, ev)
	d := newDelivery(ch.ID, ev, res, err, "")
	if err != nil {
		errMsg := err.Error()
		d.Status = "failed"
		d.Error = &errMsg
		slog.Warn("notification delivery failed",
			slog.String("channel_id", ch.ID.String()),
			slog.String("type", string(ch.Type)),
			slog.String("error", errMsg))
	} else {
		d.Status = "success"
	}

	// Persist using the caller context when possible so shutdown/cancellation
	// can stop outbound fan-out and DB writes. If the context is already done
	// (common when called from a short-lived request), fall back to background
	// to avoid losing delivery logs.
	persistParent := ctx
	if persistParent == nil || persistParent.Err() != nil {
		persistParent = context.Background()
	}
	pctx, pcancel := context.WithTimeout(persistParent, 5*time.Second)
	defer pcancel()

	_ = s.repo.RecordDelivery(pctx, d)
	if err == nil {
		_ = s.repo.MarkUsed(pctx, ch.ID, "")
	} else {
		_ = s.repo.MarkUsed(pctx, ch.ID, err.Error())
	}
}

func (s *Service) logSkip(ctx context.Context, chID uuid.UUID, ev Event, status string) {
	_ = s.repo.RecordDelivery(ctx, &Delivery{
		ChannelID: chID,
		AlertID:   ev.AlertID,
		ServiceID: ev.ServiceID,
		Status:    status,
	})
}

func (s *Service) tryClaimCooldown(ch *Channel, ev Event) bool {
	if ch.CooldownSec <= 0 {
		return true
	}
	key := ch.ID.String() + ":" + dedupKey(ev)
	now := time.Now()

	s.mu.Lock()
	defer s.mu.Unlock()
	if until, ok := s.cooldowns[key]; ok && now.Before(until) {
		return false
	}
	s.cooldowns[key] = now.Add(time.Duration(ch.CooldownSec) * time.Second)
	// Opportunistic GC so the map doesn't grow unbounded.
	if len(s.cooldowns) > 1024 {
		for k, v := range s.cooldowns {
			if now.After(v) {
				delete(s.cooldowns, k)
			}
		}
	}
	return true
}

func dedupKey(ev Event) string {
	parts := ev.AlertType
	if parts == "" {
		parts = ev.Kind
	}
	if ev.ServiceID != nil {
		parts += ":" + ev.ServiceID.String()
	}
	return parts
}

func newDelivery(channelID uuid.UUID, ev Event, res SendResult, err error, status string) *Delivery {
	d := &Delivery{
		ChannelID:  channelID,
		AlertID:    ev.AlertID,
		ServiceID:  ev.ServiceID,
		Status:     status,
		HTTPStatus: res.HTTPStatus,
	}
	if res.DurationMS > 0 {
		dms := res.DurationMS
		d.DurationMS = &dms
	}
	_ = err // err is recorded by the caller after status assignment
	return d
}

// ErrNotFound is returned by handlers as 404.
var ErrNotFound = errors.New("notification channel not found")
