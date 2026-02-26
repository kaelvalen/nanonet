package main

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ── Senaryo tipleri ──────────────────────────────────────────────────────────

type Scenario string

const (
	ScenarioHealthy     Scenario = "healthy"      // Normal operasyon
	ScenarioDegraded    Scenario = "degraded"     // Yavaş yanıt, yüksek latency
	ScenarioDown        Scenario = "down"         // Servis tamamen çökmüş
	ScenarioSpike       Scenario = "spike"        // CPU/bellek ani artış
	ScenarioMemoryLeak  Scenario = "memory_leak"  // Bellek sürekli artıyor
	ScenarioFlapping    Scenario = "flapping"     // Up/down dalgalanması
	ScenarioHighLatency Scenario = "high_latency" // Sadece latency yüksek
	ScenarioErrorBurst  Scenario = "error_burst"  // Ani hata patlaması
)

// ── Servis durumu ────────────────────────────────────────────────────────────

type ServiceState struct {
	mu            sync.RWMutex
	scenario      Scenario
	requestCount  uint64
	startTime     time.Time
	memoryBase    float64 // MB — memory leak için artar
	memoryLeak    float64 // her istek başına eklenen MB
	errorCount    uint64
	version       string
	name          string
	scenarioSince time.Time
}

func newServiceState() *ServiceState {
	scenario := parseScenario(os.Getenv("SCENARIO"))
	name := os.Getenv("SERVICE_NAME")
	if name == "" {
		name = "mock-service"
	}
	s := &ServiceState{
		scenario:      scenario,
		startTime:     time.Now(),
		memoryBase:    40.0 + rand.Float64()*30.0,
		version:       "2.0.0",
		name:          name,
		scenarioSince: time.Now(),
	}
	if scenario == ScenarioMemoryLeak {
		s.memoryLeak = 0.05
	}
	return s
}

func parseScenario(s string) Scenario {
	switch Scenario(strings.ToLower(s)) {
	case ScenarioDegraded, ScenarioDown, ScenarioSpike,
		ScenarioMemoryLeak, ScenarioFlapping, ScenarioHighLatency, ScenarioErrorBurst:
		return Scenario(strings.ToLower(s))
	default:
		return ScenarioHealthy
	}
}

func (s *ServiceState) currentScenario() Scenario {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.scenario
}

func (s *ServiceState) setScenario(sc Scenario) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.scenario = sc
	s.scenarioSince = time.Now()
	if sc == ScenarioMemoryLeak {
		s.memoryLeak = 0.05
	} else {
		s.memoryLeak = 0
	}
	log.Printf("[%s] Senaryo değiştirildi: %s", s.name, sc)
}

// ── Metrik hesapları ─────────────────────────────────────────────────────────

type snapshot struct {
	CPU       float64
	MemoryMB  float64
	LatencyMs float64
	ErrorRate float64
	Status    string
	Code      int
}

func (s *ServiceState) computeSnapshot() snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()

	req := atomic.LoadUint64(&s.requestCount)
	elapsed := time.Since(s.startTime).Seconds()
	_ = elapsed

	// Memory leak birikimi
	s.memoryBase += s.memoryLeak * float64(req) * 0.001

	sc := s.scenario

	// Flapping: 8 saniyelik periyotta up/down değişir
	if sc == ScenarioFlapping {
		cycle := int(time.Since(s.scenarioSince).Seconds()) % 8
		if cycle >= 4 {
			sc = ScenarioDown
		} else {
			sc = ScenarioHealthy
		}
	}

	switch sc {
	case ScenarioDown:
		atomic.AddUint64(&s.errorCount, 1)
		return snapshot{CPU: 0, MemoryMB: 0, LatencyMs: 0, ErrorRate: 1.0, Status: "down", Code: http.StatusServiceUnavailable}

	case ScenarioDegraded:
		cpu := 60.0 + rand.Float64()*25.0
		mem := s.memoryBase + rand.Float64()*20.0
		lat := 800.0 + rand.Float64()*1200.0
		er := 0.05 + rand.Float64()*0.1
		return snapshot{CPU: cpu, MemoryMB: mem, LatencyMs: lat, ErrorRate: er, Status: "degraded", Code: http.StatusOK}

	case ScenarioSpike:
		// Sinüs dalgası ile CPU spike simülasyonu
		t := time.Since(s.scenarioSince).Seconds()
		spikeFactor := (math.Sin(t/5.0) + 1.0) / 2.0
		cpu := 30.0 + spikeFactor*70.0
		mem := s.memoryBase + spikeFactor*200.0
		lat := 20.0 + spikeFactor*500.0
		return snapshot{CPU: cpu, MemoryMB: mem, LatencyMs: lat, ErrorRate: 0.01, Status: "up", Code: http.StatusOK}

	case ScenarioMemoryLeak:
		cpu := 15.0 + rand.Float64()*20.0
		mem := s.memoryBase // sürekli artıyor
		lat := 30.0 + rand.Float64()*50.0
		return snapshot{CPU: cpu, MemoryMB: mem, LatencyMs: lat, ErrorRate: 0.0, Status: "up", Code: http.StatusOK}

	case ScenarioHighLatency:
		cpu := 20.0 + rand.Float64()*15.0
		mem := s.memoryBase + rand.Float64()*10.0
		lat := 2000.0 + rand.Float64()*3000.0
		return snapshot{CPU: cpu, MemoryMB: mem, LatencyMs: lat, ErrorRate: 0.02, Status: "degraded", Code: http.StatusOK}

	case ScenarioErrorBurst:
		cpu := 50.0 + rand.Float64()*30.0
		mem := s.memoryBase + rand.Float64()*40.0
		lat := 100.0 + rand.Float64()*400.0
		er := 0.3 + rand.Float64()*0.5
		atomic.AddUint64(&s.errorCount, 1)
		return snapshot{CPU: cpu, MemoryMB: mem, LatencyMs: lat, ErrorRate: er, Status: "degraded", Code: http.StatusOK}

	default: // healthy
		cpu := 5.0 + rand.Float64()*25.0
		mem := s.memoryBase + rand.Float64()*10.0
		lat := 5.0 + rand.Float64()*45.0
		return snapshot{CPU: cpu, MemoryMB: mem, LatencyMs: lat, ErrorRate: 0.0, Status: "up", Code: http.StatusOK}
	}
}

// ── Global state ─────────────────────────────────────────────────────────────

var state = newServiceState()

// ── Main ─────────────────────────────────────────────────────────────────────

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/scenario", scenarioHandler)
	mux.HandleFunc("/api/users", usersHandler)
	mux.HandleFunc("/api/orders", ordersHandler)
	mux.HandleFunc("/api/products", productsHandler)
	mux.HandleFunc("/", rootHandler)

	log.Printf("[%s] Mock Service v2 başlatılıyor | port=%s | senaryo=%s",
		state.name, port, state.currentScenario())
	log.Printf("  GET  /health           — sağlık durumu")
	log.Printf("  GET  /metrics          — sistem metrikleri")
	log.Printf("  GET  /scenario         — aktif senaryo")
	log.Printf("  POST /scenario         — senaryo değiştir: {\"scenario\":\"spike\"}")
	log.Printf("  GET  /api/users        — kullanıcı listesi")
	log.Printf("  GET  /api/orders       — sipariş listesi")
	log.Printf("  GET  /api/products     — ürün listesi")
	log.Printf("Senaryolar: healthy degraded down spike memory_leak flapping high_latency error_burst")

	if err := http.ListenAndServe(":"+port, middleware(mux)); err != nil {
		log.Fatalf("Server başlatılamadı: %v", err)
	}
}

// ── Middleware ───────────────────────────────────────────────────────────────

func middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&state.requestCount, 1)
		start := time.Now()

		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("X-Service-Name", state.name)
		w.Header().Set("X-Scenario", string(state.currentScenario()))

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Down senaryosunda tüm istekleri reddet (health hariç)
		if state.currentScenario() == ScenarioDown && r.URL.Path != "/scenario" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]any{
				"status":  "down",
				"message": "service unavailable",
			})
			log.Printf("DOWN  %s %s - %v", r.Method, r.URL.Path, time.Since(start))
			return
		}

		// High latency / degraded gecikmesi simülasyonu
		snap := state.computeSnapshot()
		if snap.LatencyMs > 0 && r.URL.Path == "/health" {
			jitter := time.Duration(snap.LatencyMs*0.3) * time.Millisecond
			time.Sleep(jitter)
		}

		next.ServeHTTP(w, r)
		log.Printf("%-6s %s - %v", r.Method, r.URL.Path, time.Since(start))
	})
}

// ── Handler'lar ──────────────────────────────────────────────────────────────

func healthHandler(w http.ResponseWriter, r *http.Request) {
	snap := state.computeSnapshot()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(snap.Code)
	json.NewEncoder(w).Encode(map[string]any{
		"status":    snap.Status,
		"service":   state.name,
		"scenario":  string(state.currentScenario()),
		"timestamp": time.Now().UTC(),
		"uptime":    time.Since(state.startTime).String(),
		"requests":  atomic.LoadUint64(&state.requestCount),
		"errors":    atomic.LoadUint64(&state.errorCount),
		"version":   state.version,
	})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	snap := state.computeSnapshot()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"service":        state.name,
		"scenario":       string(state.currentScenario()),
		"cpu_percent":    round2(snap.CPU),
		"memory_used_mb": round2(snap.MemoryMB),
		"latency_ms":     round2(snap.LatencyMs),
		"error_rate":     round2(snap.ErrorRate),
		"status":         snap.Status,
		"requests":       atomic.LoadUint64(&state.requestCount),
		"errors":         atomic.LoadUint64(&state.errorCount),
		"uptime_seconds": time.Since(state.startTime).Seconds(),
		"timestamp":      time.Now().UTC(),
	})
}

func scenarioHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		json.NewEncoder(w).Encode(map[string]any{
			"current": string(state.currentScenario()),
			"service": state.name,
			"since":   state.scenarioSince,
			"available": []string{
				"healthy", "degraded", "down", "spike",
				"memory_leak", "flapping", "high_latency", "error_burst",
			},
		})
		return
	}

	if r.Method == http.MethodPost {
		var body struct {
			Scenario string `json:"scenario"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Scenario == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": "scenario alanı gerekli"})
			return
		}
		state.setScenario(parseScenario(body.Scenario))
		json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"current": string(state.currentScenario()),
		})
		return
	}

	w.WriteHeader(http.StatusMethodNotAllowed)
}

func usersHandler(w http.ResponseWriter, r *http.Request) {
	snap := state.computeSnapshot()
	if snap.ErrorRate > rand.Float64() {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{"error": "internal server error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	users := []map[string]any{
		{"id": 1, "name": "Alice Johnson", "email": "alice@example.com", "role": "admin", "active": true},
		{"id": 2, "name": "Bob Smith", "email": "bob@example.com", "role": "user", "active": true},
		{"id": 3, "name": "Charlie Brown", "email": "charlie@example.com", "role": "user", "active": false},
		{"id": 4, "name": "Diana Prince", "email": "diana@example.com", "role": "moderator", "active": true},
		{"id": 5, "name": "Eve Torres", "email": "eve@example.com", "role": "user", "active": true},
	}
	json.NewEncoder(w).Encode(map[string]any{"success": true, "data": users, "count": len(users)})
}

func ordersHandler(w http.ResponseWriter, r *http.Request) {
	snap := state.computeSnapshot()
	if snap.ErrorRate > rand.Float64() {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{"error": "database connection timeout"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	orders := []map[string]any{
		{"id": "ORD-001", "user_id": 1, "total": 1099.98, "status": "delivered", "items": 2},
		{"id": "ORD-002", "user_id": 2, "total": 29.99, "status": "processing", "items": 1},
		{"id": "ORD-003", "user_id": 4, "total": 449.97, "status": "shipped", "items": 3},
		{"id": "ORD-004", "user_id": 1, "total": 79.99, "status": "pending", "items": 1},
	}
	json.NewEncoder(w).Encode(map[string]any{"success": true, "data": orders, "count": len(orders)})
}

func productsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	products := []map[string]any{
		{"id": 1, "name": "Laptop Pro", "price": 999.99, "stock": 15, "category": "electronics"},
		{"id": 2, "name": "Wireless Mouse", "price": 29.99, "stock": 50, "category": "accessories"},
		{"id": 3, "name": "Mechanical Keyboard", "price": 79.99, "stock": 30, "category": "accessories"},
		{"id": 4, "name": "4K Monitor", "price": 299.99, "stock": 8, "category": "electronics"},
		{"id": 5, "name": "Noise-Canceling Headphones", "price": 149.99, "stock": 25, "category": "audio"},
		{"id": 6, "name": "USB-C Hub", "price": 49.99, "stock": 100, "category": "accessories"},
	}
	json.NewEncoder(w).Encode(map[string]any{"success": true, "data": products, "count": len(products)})
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]any{"error": "not found"})
		return
	}
	snap := state.computeSnapshot()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"service":   state.name,
		"version":   state.version,
		"scenario":  string(state.currentScenario()),
		"status":    snap.Status,
		"uptime":    time.Since(state.startTime).String(),
		"requests":  atomic.LoadUint64(&state.requestCount),
		"timestamp": time.Now().UTC(),
		"endpoints": []string{
			"GET  /health",
			"GET  /metrics",
			"GET  /scenario",
			"POST /scenario  {\"scenario\":\"...\"}",
			"GET  /api/users",
			"GET  /api/orders",
			"GET  /api/products",
		},
	})
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

func round2(f float64) float64 {
	return math.Round(f*100) / 100
}
