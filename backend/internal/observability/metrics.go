// Package observability — Prometheus tabanlı runtime metrikleri.
//
// Bu paket tek bir global Registry kullanır (`prometheus.DefaultRegisterer`)
// ve `cmd/main.go` içinde middleware aracılığıyla beslenir. /metrics
// endpoint'inde HTTP üstünden export edilir; production'da basic-auth ile
// korunması beklenir (METRICS_BASIC_AUTH env).
//
// Kapsam:
//   - HTTP request histogram'u (route, method, status)
//   - WebSocket connection gauges (dashboards, agents)
//   - DB pool gauge'leri (open/in_use/idle)
//   - Rate limit denial counter (limiter adıyla)
package observability

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"gorm.io/gorm"
)

// HTTPRequestDuration — kanonik HTTP server histogram. Buckets HTTP işleri
// için makul: 5ms..10s arası, p50/p95/p99 görünmesi için yeterli.
var HTTPRequestDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "Request latency by route, method, and status.",
		Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
	},
	[]string{"route", "method", "status"},
)

// HTTPRequestsInFlight — anlık olarak işlenen istek sayısı.
var HTTPRequestsInFlight = promauto.NewGauge(prometheus.GaugeOpts{
	Name: "http_requests_in_flight",
	Help: "Number of HTTP requests currently being served.",
})

// WSConnections — açık WS bağlantıları (dashboard / agent).
var WSConnections = promauto.NewGaugeVec(
	prometheus.GaugeOpts{
		Name: "ws_connections",
		Help: "Open websocket connections by kind (dashboard|agent).",
	},
	[]string{"kind"},
)

// DBOpenConnections — gorm pool'undaki açık (in_use+idle) bağlantı sayısı.
var DBOpenConnections = promauto.NewGauge(prometheus.GaugeOpts{
	Name: "db_open_connections",
	Help: "Open DB connections (in_use + idle).",
})

// DBIdleConnections — boştaki bağlantılar; "kullanılmıyor" sinyali.
var DBIdleConnections = promauto.NewGauge(prometheus.GaugeOpts{
	Name: "db_idle_connections",
	Help: "Idle DB connections.",
})

// DBInUseConnections — aktif kullanılan bağlantılar.
var DBInUseConnections = promauto.NewGauge(prometheus.GaugeOpts{
	Name: "db_in_use_connections",
	Help: "DB connections currently in use.",
})

// RateLimitDenials — 429 ile geri çevrilen istek sayısı.
var RateLimitDenials = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "rate_limit_denials_total",
		Help: "Total number of rate-limited (HTTP 429) responses.",
	},
	[]string{"limiter"},
)

// HTTPMiddleware — gin için bir histogram + in-flight gauge sarıcı.
//
// Route etiketi olarak `c.FullPath()` kullanıyoruz; param'lı rotalar
// "/api/v1/services/:id" şeklinde gelir, bu da yüksek-cardinality'i
// engeller (binlerce farklı UUID etiketi olmaz).
func HTTPMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		HTTPRequestsInFlight.Inc()
		defer HTTPRequestsInFlight.Dec()

		c.Next()

		route := c.FullPath()
		if route == "" {
			route = "<unmatched>"
		}
		HTTPRequestDuration.WithLabelValues(
			route,
			c.Request.Method,
			strconv.Itoa(c.Writer.Status()),
		).Observe(time.Since(start).Seconds())
	}
}

// StartDBPoolCollector — gorm DB pool sayaçlarını periyodik olarak gauge'a
// yansıtır. Tek başına çağrılmalı (örn. main'de bir goroutine).
func StartDBPoolCollector(stop <-chan struct{}, db *gorm.DB, interval time.Duration) {
	if db == nil {
		return
	}
	sqlDB, err := db.DB()
	if err != nil {
		return
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			s := sqlDB.Stats()
			DBOpenConnections.Set(float64(s.OpenConnections))
			DBIdleConnections.Set(float64(s.Idle))
			DBInUseConnections.Set(float64(s.InUse))
		}
	}
}
