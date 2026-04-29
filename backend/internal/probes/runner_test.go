package probes

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRunner_HTTPProbeDoesNotFollowRedirects(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/redirect", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/ok", http.StatusFound)
	})
	mux.HandleFunc("/ok", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	r := NewRunner(nil, nil)
	p := Probe{
		Kind:           "http",
		Target:         srv.URL + "/redirect",
		ExpectedStatus: 200,
		TimeoutSeconds: 2,
	}

	res := r.execHTTP(context.Background(), p)
	if res.httpStatus == nil || *res.httpStatus != http.StatusFound {
		t.Fatalf("expected status 302 (no redirect follow), got: %+v", res)
	}
	if res.status == "up" {
		t.Fatalf("expected probe not up on redirect, got: %+v", res)
	}
	// Ensure it didn't take the full timeout (sanity).
	if res.latency > int((2 * time.Second).Milliseconds()) {
		t.Fatalf("unexpected latency: %+v", res)
	}
}
