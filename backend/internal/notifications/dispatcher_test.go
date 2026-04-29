package notifications

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nanonet-backend/pkg/netguard"
)

type stubEmail struct{}

func (s stubEmail) Enabled() bool                        { return false }
func (s stubEmail) SendAlert(_, _, _, _, _ string) error { return nil }

func TestDispatcher_DoesNotFollowRedirects(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/redirect", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/ok", http.StatusFound)
	})
	mux.HandleFunc("/ok", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`ok`))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	d := NewDispatcher(stubEmail{}, netguardOptionsAllowAll())

	ch := &Channel{
		Type: ChannelWebhook,
		Config: map[string]any{
			"url": srv.URL + "/redirect",
		},
	}
	ev := Event{
		Kind:      "test",
		Title:     "t",
		Message:   "m",
		Severity:  "info",
		Timestamp: time.Now(),
	}

	_, err := d.Send(context.Background(), ch, ev)
	if err == nil {
		t.Fatalf("expected redirect to be treated as error")
	}
}

// netguardOptionsAllowAll returns a guard config that doesn't block test server URLs.
func netguardOptionsAllowAll() netguard.Options {
	return netguard.Options{AllowPrivate: true}
}
