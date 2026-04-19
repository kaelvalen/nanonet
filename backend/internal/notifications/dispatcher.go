package notifications

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// EmailSender is satisfied by *pkg/mailer.Mailer; declared locally to avoid
// import cycles and to make it trivial to stub in tests.
type EmailSender interface {
	Enabled() bool
	SendAlert(toEmail, serviceName, alertType, message, severity string) error
}

// Dispatcher knows how to translate a generic Event into the wire format of
// each channel type and POST/SMTP it out.
type Dispatcher struct {
	http  *http.Client
	email EmailSender
}

func NewDispatcher(email EmailSender) *Dispatcher {
	return &Dispatcher{
		http:  &http.Client{Timeout: 8 * time.Second},
		email: email,
	}
}

// SendResult captures observability bits for the delivery log.
type SendResult struct {
	HTTPStatus *int
	DurationMS int
}

// Send routes the event to the right channel implementation.
func (d *Dispatcher) Send(ctx context.Context, ch *Channel, ev Event) (SendResult, error) {
	start := time.Now()

	var (
		res SendResult
		err error
	)

	switch ch.Type {
	case ChannelSlack:
		res, err = d.sendSlack(ctx, ch, ev)
	case ChannelDiscord:
		res, err = d.sendDiscord(ctx, ch, ev)
	case ChannelWebhook:
		res, err = d.sendWebhook(ctx, ch, ev)
	case ChannelPagerDuty:
		res, err = d.sendPagerDuty(ctx, ch, ev)
	case ChannelEmail:
		err = d.sendEmail(ch, ev)
	default:
		err = fmt.Errorf("unsupported channel type: %s", ch.Type)
	}

	res.DurationMS = int(time.Since(start) / time.Millisecond)
	return res, err
}

// ─── Slack ──────────────────────────────────────────────────────────────────

func (d *Dispatcher) sendSlack(ctx context.Context, ch *Channel, ev Event) (SendResult, error) {
	url, _ := ch.Config["url"].(string)
	if url == "" {
		return SendResult{}, errors.New("slack channel missing 'url'")
	}

	color := severityColor(ev.Severity)
	payload := map[string]any{
		"text": fmt.Sprintf("*%s* — %s", ev.Title, ev.Message),
		"attachments": []map[string]any{
			{
				"color":  color,
				"title":  ev.Title,
				"text":   ev.Message,
				"footer": "NanoNet",
				"ts":     ev.Timestamp.Unix(),
				"fields": []map[string]any{
					{"title": "Severity", "value": strings.ToUpper(ev.Severity), "short": true},
					{"title": "Service", "value": fallback(ev.ServiceName, "—"), "short": true},
				},
			},
		},
	}
	if ev.URL != "" {
		payload["attachments"].([]map[string]any)[0]["title_link"] = ev.URL
	}
	return d.postJSON(ctx, url, payload, nil)
}

// ─── Discord ────────────────────────────────────────────────────────────────

func (d *Dispatcher) sendDiscord(ctx context.Context, ch *Channel, ev Event) (SendResult, error) {
	url, _ := ch.Config["url"].(string)
	if url == "" {
		return SendResult{}, errors.New("discord channel missing 'url'")
	}

	embed := map[string]any{
		"title":       ev.Title,
		"description": ev.Message,
		"color":       discordColor(ev.Severity),
		"timestamp":   ev.Timestamp.UTC().Format(time.RFC3339),
		"footer":      map[string]any{"text": "NanoNet"},
		"fields": []map[string]any{
			{"name": "Severity", "value": strings.ToUpper(ev.Severity), "inline": true},
			{"name": "Service", "value": fallback(ev.ServiceName, "—"), "inline": true},
		},
	}
	if ev.URL != "" {
		embed["url"] = ev.URL
	}
	payload := map[string]any{
		"username": "NanoNet",
		"embeds":   []any{embed},
	}
	return d.postJSON(ctx, url, payload, nil)
}

// ─── Generic webhook (with optional HMAC-SHA256 over the body) ───────────────

func (d *Dispatcher) sendWebhook(ctx context.Context, ch *Channel, ev Event) (SendResult, error) {
	url, _ := ch.Config["url"].(string)
	if url == "" {
		return SendResult{}, errors.New("webhook channel missing 'url'")
	}
	secret, _ := ch.Config["secret"].(string)

	body := map[string]any{
		"kind":         ev.Kind,
		"title":        ev.Title,
		"message":      ev.Message,
		"severity":     ev.Severity,
		"service_id":   stringerOrNil(ev.ServiceID),
		"service_name": ev.ServiceName,
		"alert_id":     stringerOrNil(ev.AlertID),
		"alert_type":   ev.AlertType,
		"timestamp":    ev.Timestamp.UTC().Format(time.RFC3339),
		"url":          ev.URL,
	}

	headers := map[string]string{}
	if secret != "" {
		raw, _ := json.Marshal(body)
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(raw)
		headers["X-NanoNet-Signature"] = "sha256=" + hex.EncodeToString(mac.Sum(nil))
	}

	return d.postJSON(ctx, url, body, headers)
}

// ─── PagerDuty Events API v2 ─────────────────────────────────────────────────

func (d *Dispatcher) sendPagerDuty(ctx context.Context, ch *Channel, ev Event) (SendResult, error) {
	key, _ := ch.Config["routing_key"].(string)
	if key == "" {
		return SendResult{}, errors.New("pagerduty channel missing 'routing_key'")
	}

	action := "trigger"
	if ev.Kind == "alert_resolved" {
		action = "resolve"
	}

	payload := map[string]any{
		"routing_key":  key,
		"event_action": action,
		"dedup_key":    pagerDutyDedupKey(ev),
		"payload": map[string]any{
			"summary":   fallback(ev.Title, ev.Message),
			"source":    fallback(ev.ServiceName, "nanonet"),
			"severity":  pagerDutySeverity(ev.Severity),
			"timestamp": ev.Timestamp.UTC().Format(time.RFC3339),
			"custom_details": map[string]any{
				"alert_type": ev.AlertType,
				"message":    ev.Message,
				"url":        ev.URL,
			},
		},
	}
	return d.postJSON(ctx, "https://events.pagerduty.com/v2/enqueue", payload, nil)
}

// ─── Email (delegated to the existing Mailer) ────────────────────────────────

func (d *Dispatcher) sendEmail(ch *Channel, ev Event) error {
	if d.email == nil || !d.email.Enabled() {
		return errors.New("email transport disabled (SMTP not configured)")
	}
	to, _ := ch.Config["to"].(string)
	if to == "" {
		return errors.New("email channel missing 'to'")
	}
	return d.email.SendAlert(to, ev.ServiceName, ev.AlertType, ev.Message, ev.Severity)
}

// ─── helpers ────────────────────────────────────────────────────────────────

func (d *Dispatcher) postJSON(ctx context.Context, url string, body any, headers map[string]string) (SendResult, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return SendResult{}, fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return SendResult{}, fmt.Errorf("request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "NanoNet-Notifier/1.0")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := d.http.Do(req)
	if err != nil {
		return SendResult{}, err
	}
	defer func() { _ = resp.Body.Close() }()

	status := resp.StatusCode
	res := SendResult{HTTPStatus: &status}

	if resp.StatusCode >= 300 {
		buf, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return res, fmt.Errorf("http %d: %s", resp.StatusCode, strings.TrimSpace(string(buf)))
	}
	return res, nil
}

func severityColor(s string) string {
	switch s {
	case "crit":
		return "#ef4444"
	case "warn":
		return "#f59e0b"
	default:
		return "#3b82f6"
	}
}

func discordColor(s string) int {
	switch s {
	case "crit":
		return 0xef4444
	case "warn":
		return 0xf59e0b
	default:
		return 0x3b82f6
	}
}

func pagerDutySeverity(s string) string {
	switch s {
	case "crit":
		return "critical"
	case "warn":
		return "warning"
	default:
		return "info"
	}
}

func pagerDutyDedupKey(ev Event) string {
	parts := []string{ev.AlertType}
	if ev.ServiceID != nil {
		parts = append(parts, ev.ServiceID.String())
	} else if ev.ServiceName != "" {
		parts = append(parts, ev.ServiceName)
	}
	return strings.Join(parts, ":")
}

func fallback(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func stringerOrNil(v fmt.Stringer) any {
	if v == nil {
		return nil
	}
	// Handle the typed-nil-pointer trap: *uuid.UUID(nil) is non-nil as Stringer.
	if rv := fmt.Sprintf("%v", v); rv == "<nil>" || rv == "" {
		return nil
	}
	return v.String()
}
