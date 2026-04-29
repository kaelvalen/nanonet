package probes

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

// Runner is the synthetic-check loop. On each tick it asks the repo for due
// probes, executes them in parallel (bounded), and writes results back.
type Runner struct {
	repo   *Repository
	client *http.Client
	logger *slog.Logger
	// Optional alert hook fired once after `failureThreshold` consecutive
	// failures, and again on recovery. Wired up from main.go.
	onTransition func(ctx context.Context, p Probe, status string)
}

func NewRunner(repo *Repository, logger *slog.Logger) *Runner {
	return &Runner{
		repo:   repo,
		logger: logger,
		client: &http.Client{
			Timeout: 30 * time.Second, // hard ceiling; per-probe timeout is tighter
			// Don't follow redirects. Otherwise a probe target may redirect to
			// private/reserved networks and become an SSRF gadget.
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
			Transport: &http.Transport{
				MaxIdleConnsPerHost: 4,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

func (r *Runner) SetOnTransition(fn func(ctx context.Context, p Probe, status string)) {
	r.onTransition = fn
}

const failureThreshold = 3

// Start runs the loop until ctx is cancelled. tick controls how often we poll
// for due probes (recommended: 10–15s for responsive behaviour without DB churn).
func (r *Runner) Start(ctx context.Context, tick time.Duration) {
	t := time.NewTicker(tick)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-t.C:
			due, err := r.repo.ListDue(ctx, now)
			if err != nil {
				r.logger.Warn("Probe ListDue failed", slog.String("error", err.Error()))
				continue
			}
			// Bound concurrency so a burst of due probes can't exhaust sockets.
			sem := make(chan struct{}, 8)
			for i := range due {
				p := due[i]
				sem <- struct{}{}
				go func() {
					defer func() { <-sem }()
					r.runOne(ctx, p)
				}()
			}
		}
	}
}

func (r *Runner) runOne(ctx context.Context, p Probe) {
	prevStatus := ""
	if p.LastStatus != nil {
		prevStatus = *p.LastStatus
	}
	prevFailures := p.ConsecutiveFailures

	res := r.execute(ctx, p)

	now := time.Now()
	p.LastRunAt = &now
	status := res.status
	p.LastStatus = &status
	p.LastLatencyMS = &res.latency
	if res.errMsg != "" {
		s := res.errMsg
		p.LastError = &s
	} else {
		p.LastError = nil
	}
	if status == "up" {
		p.ConsecutiveFailures = 0
	} else {
		p.ConsecutiveFailures = prevFailures + 1
	}

	run := &Run{
		ProbeID:    p.ID,
		RanAt:      now,
		Status:     status,
		LatencyMS:  res.latency,
		HTTPStatus: res.httpStatus,
	}
	if res.errMsg != "" {
		s := res.errMsg
		run.Error = &s
	}

	if err := r.repo.UpdateRunResult(ctx, &p, run); err != nil {
		r.logger.Warn("Probe sonucu kaydedilemedi",
			slog.String("probe_id", p.ID.String()),
			slog.String("error", err.Error()),
		)
		return
	}

	// Edge transitions for alerting:
	//   • Up → Down: only after `failureThreshold` consecutive failures.
	//   • Down → Up: any time we transition back.
	if r.onTransition != nil {
		switch {
		case status != "up" && p.ConsecutiveFailures == failureThreshold:
			r.onTransition(ctx, p, "down")
		case status == "up" && prevStatus != "" && prevStatus != "up":
			r.onTransition(ctx, p, "up")
		}
	}
}

type execResult struct {
	status     string // "up" | "down" | "degraded"
	latency    int
	httpStatus *int
	errMsg     string
}

func (r *Runner) execute(parent context.Context, p Probe) execResult {
	timeout := time.Duration(p.TimeoutSeconds) * time.Second
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()

	switch strings.ToLower(p.Kind) {
	case "tcp":
		return r.execTCP(ctx, p)
	default:
		return r.execHTTP(ctx, p)
	}
}

func (r *Runner) execHTTP(ctx context.Context, p Probe) execResult {
	method := strings.ToUpper(strings.TrimSpace(p.Method))
	if method == "" {
		method = http.MethodGet
	}
	req, err := http.NewRequestWithContext(ctx, method, p.Target, nil)
	if err != nil {
		return execResult{status: "down", latency: 0, errMsg: "geçersiz URL: " + err.Error()}
	}
	req.Header.Set("User-Agent", "nanonet-probe/1.0")

	start := time.Now()
	resp, err := r.client.Do(req)
	lat := int(time.Since(start).Milliseconds())
	if err != nil {
		return execResult{status: "down", latency: lat, errMsg: err.Error()}
	}
	defer func() { _ = resp.Body.Close() }()

	hs := resp.StatusCode
	res := execResult{latency: lat, httpStatus: &hs}

	expected := p.ExpectedStatus
	if expected == 0 {
		expected = 200
	}
	if hs != expected {
		res.status = "down"
		res.errMsg = fmt.Sprintf("beklenen %d, alınan %d", expected, hs)
		return res
	}

	if p.BodyContains != nil && *p.BodyContains != "" {
		// Read up to 256 KiB so a misconfigured target can't exhaust memory.
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
		if !strings.Contains(string(body), *p.BodyContains) {
			res.status = "down"
			res.errMsg = "body assertion failed"
			return res
		}
	}

	// Soft "degraded" tier above ~80% of timeout — useful signal before the hard fail.
	if lat > int((timeoutMS(p)*8)/10) {
		res.status = "degraded"
	} else {
		res.status = "up"
	}
	return res
}

func (r *Runner) execTCP(ctx context.Context, p Probe) execResult {
	target := strings.TrimSpace(p.Target)
	if !strings.Contains(target, ":") {
		return execResult{status: "down", errMsg: "tcp hedefi host:port formatında olmalı"}
	}
	dialer := &net.Dialer{}
	start := time.Now()
	conn, err := dialer.DialContext(ctx, "tcp", target)
	lat := int(time.Since(start).Milliseconds())
	if err != nil {
		return execResult{status: "down", latency: lat, errMsg: err.Error()}
	}
	_ = conn.Close()
	if lat > int((timeoutMS(p)*8)/10) {
		return execResult{status: "degraded", latency: lat}
	}
	return execResult{status: "up", latency: lat}
}

func timeoutMS(p Probe) int { return p.TimeoutSeconds * 1000 }
