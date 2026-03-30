package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ── Senaryo tipleri ──────────────────────────────────────────────────────────

type Scenario string

const (
	ScenarioHealthy         Scenario = "healthy"
	ScenarioDegraded        Scenario = "degraded"
	ScenarioDown            Scenario = "down"
	ScenarioSpike           Scenario = "spike"
	ScenarioMemoryLeak      Scenario = "memory_leak"
	ScenarioFlapping        Scenario = "flapping"
	ScenarioHighLatency     Scenario = "high_latency"
	ScenarioErrorBurst      Scenario = "error_burst"
	ScenarioConnectionLeak  Scenario = "connection_leak"
	ScenarioSlowStart       Scenario = "slow_start"
	ScenarioDatabaseIssue   Scenario = "database_issue"
	ScenarioNetworkJitter   Scenario = "network_jitter"
	ScenarioResourceStarved Scenario = "resource_starved"
	ScenarioCircuitBreaker  Scenario = "circuit_breaker"
	ScenarioRandomCrash     Scenario = "random_crash"
	ScenarioLoadSpike       Scenario = "load_spike"
	ScenarioDependencyIssue Scenario = "dependency_issue"
)

// ── Servis durumu ────────────────────────────────────────────────────────────

type ServiceState struct {
	mu                sync.RWMutex
	scenario          Scenario
	requestCount      uint64
	errorCount        uint64
	startTime         time.Time
	memoryBase        float64
	memoryLeak        float64
	cpuBase           float64
	latencyBase       float64
	version           string
	name              string
	scenarioSince     time.Time
	lastRequestTime   time.Time
	concurrentReqs    int32
	peakMemory        float64
	uptime            time.Duration
	responseTimeHist  []float64
	circuitState      string // "closed", "open", "half-open"
	circuitFailures   int
	lastCircuitChange time.Time
}

func newServiceState() *ServiceState {
	scenario := parseScenario(os.Getenv("SCENARIO"))
	name := os.Getenv("SERVICE_NAME")
	if name == "" {
		name = "mock-service"
	}
	s := &ServiceState{
		scenario:          scenario,
		startTime:         time.Now(),
		memoryBase:        40.0 + rand.Float64()*30.0,
		cpuBase:           15.0 + rand.Float64()*10.0,
		latencyBase:       50.0 + rand.Float64()*30.0,
		version:           "2.1.0",
		name:              name,
		scenarioSince:     time.Now(),
		lastRequestTime:   time.Now(),
		responseTimeHist:  make([]float64, 0, 1000),
		circuitState:      "closed",
		lastCircuitChange: time.Now(),
	}
	if scenario == ScenarioMemoryLeak {
		s.memoryLeak = 0.05
	}
	return s
}

func parseScenario(s string) Scenario {
	switch Scenario(strings.ToLower(s)) {
	case ScenarioDegraded, ScenarioDown, ScenarioSpike, ScenarioMemoryLeak,
		ScenarioFlapping, ScenarioHighLatency, ScenarioErrorBurst, ScenarioConnectionLeak,
		ScenarioSlowStart, ScenarioDatabaseIssue, ScenarioNetworkJitter, ScenarioResourceStarved,
		ScenarioCircuitBreaker, ScenarioRandomCrash, ScenarioLoadSpike, ScenarioDependencyIssue:
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
	atomic.StoreUint64(&s.requestCount, 0)
	atomic.StoreUint64(&s.errorCount, 0)
	s.memoryBase = 40.0 + rand.Float64()*30.0
	s.cpuBase = 15.0 + rand.Float64()*10.0
	s.latencyBase = 50.0 + rand.Float64()*30.0
	s.circuitState = "closed"
	s.circuitFailures = 0
	if sc == ScenarioMemoryLeak {
		s.memoryLeak = 0.5
	} else {
		s.memoryLeak = 0
	}
	log.Printf("[%s] Senaryo değiştirildi: %s", s.name, sc)
}

// ── Snapshot tipi ─────────────────────────────────────────────────────────────

type snapshot struct {
	CPU           float64
	MemoryMB      float64
	LatencyMs     float64
	ErrorRate     float64
	Status        string
	Code          int
	OpenPorts     []int
	Connections   int
	Threads       int
	QueueSize     int
	ThroughputRPS float64
	CircuitState  string
	PeakMemoryMB  float64
}

// ── calculateLatencyLocked: mu zaten alınmışken çağrılır ─────────────────────
// Deadlock oluşmaması için kendi lock'unu almaz.
func (s *ServiceState) calculateLatencyLocked() float64 {
	if len(s.responseTimeHist) == 0 {
		return s.latencyBase
	}
	sorted := make([]float64, len(s.responseTimeHist))
	copy(sorted, s.responseTimeHist)
	sort.Float64s(sorted)
	index := int(float64(len(sorted)) * 0.95)
	if index >= len(sorted) {
		index = len(sorted) - 1
	}
	return sorted[index]
}

// calculateLatency: harici çağrılar için kendi RLock'unu alır.
func (s *ServiceState) calculateLatency() float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.calculateLatencyLocked()
}

func (s *ServiceState) calculateRPS() float64 {
	elapsed := time.Since(s.startTime).Seconds()
	if elapsed == 0 {
		return 0
	}
	return float64(atomic.LoadUint64(&s.requestCount)) / elapsed
}

// ── Circuit breaker: caller mu.Lock tutuyor ───────────────────────────────────
func (s *ServiceState) updateCircuitBreaker() {
	now := time.Now()

	if s.circuitState == "open" {
		if now.Sub(s.lastCircuitChange) > 30*time.Second {
			s.circuitState = "half-open"
			s.lastCircuitChange = now
			s.circuitFailures = 0
			log.Printf("[%s] Circuit breaker: half-open", s.name)
		}
		return
	}

	// Sliding window: 5 saniye geçtiyse sayacı sıfırla
	if now.Sub(s.lastCircuitChange) > 5*time.Second {
		s.circuitFailures = 0
		s.lastCircuitChange = now
		if s.circuitState == "half-open" {
			s.circuitState = "closed"
			log.Printf("[%s] Circuit breaker: closed", s.name)
		}
	}

	// Hata sayacını artır (her CB çağrısı bir hata = CB senaryosunda her request hatalı)
	s.circuitFailures++

	if s.circuitFailures >= 3 {
		s.circuitState = "open"
		s.lastCircuitChange = now
		s.circuitFailures = 0
		log.Printf("[%s] Circuit breaker: open", s.name)
	}
}

// ── computeSnapshot: mu.Lock alır ────────────────────────────────────────────
func (s *ServiceState) computeSnapshot() snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()

	atomic.AddUint64(&s.requestCount, 1)
	s.lastRequestTime = time.Now()

	// Memory leak birikimi — yalnızca burada bir kez yapılır
	s.memoryBase += s.memoryLeak
	if s.memoryBase > s.peakMemory {
		s.peakMemory = s.memoryBase
	}

	// Response time history — calculateLatencyLocked çağrılır (deadlock yok)
	latency := s.calculateLatencyLocked()
	if len(s.responseTimeHist) >= 1000 {
		s.responseTimeHist = s.responseTimeHist[1:]
	}
	s.responseTimeHist = append(s.responseTimeHist, latency)

	sc := s.scenario

	// Flapping
	if sc == ScenarioFlapping {
		if int(time.Since(s.scenarioSince).Seconds())%8 >= 4 {
			sc = ScenarioDown
		} else {
			sc = ScenarioHealthy
		}
	}

	// Circuit breaker
	if sc == ScenarioCircuitBreaker {
		s.updateCircuitBreaker()
		if s.circuitState == "open" {
			return snapshot{
				CPU:          0,
				MemoryMB:     s.memoryBase,
				LatencyMs:    0,
				ErrorRate:    1.0,
				Status:       "down",
				Code:         http.StatusServiceUnavailable,
				CircuitState: s.circuitState,
				PeakMemoryMB: s.peakMemory,
			}
		}
	}

	// Random crash
	if sc == ScenarioRandomCrash && rand.Float32() < 0.01 {
		atomic.AddUint64(&s.errorCount, 1)
		return snapshot{
			Status:       "down",
			Code:         http.StatusInternalServerError,
			ErrorRate:    1.0,
			CircuitState: s.circuitState,
			PeakMemoryMB: s.peakMemory,
		}
	}

	switch sc {
	case ScenarioDown:
		atomic.AddUint64(&s.errorCount, 1)
		return snapshot{
			Status:       "down",
			Code:         http.StatusServiceUnavailable,
			ErrorRate:    1.0,
			CircuitState: s.circuitState,
			PeakMemoryMB: s.peakMemory,
		}

	case ScenarioDegraded:
		return snapshot{
			CPU:           60.0 + rand.Float64()*25.0,
			MemoryMB:      s.memoryBase + rand.Float64()*20.0,
			LatencyMs:     800.0 + rand.Float64()*1200.0,
			ErrorRate:     0.05 + rand.Float64()*0.1,
			Status:        "degraded",
			Code:          http.StatusOK,
			OpenPorts:     []int{8000, 8080},
			Connections:   int(rand.Int31n(50) + 10),
			Threads:       int(rand.Int31n(20) + 5),
			QueueSize:     int(rand.Int31n(100)),
			ThroughputRPS: s.calculateRPS(),
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioSpike:
		t := time.Since(s.scenarioSince).Seconds()
		spike := math.Sin(t*0.1)*0.5 + 0.5
		cpu := 30.0 + spike*70.0 + rand.Float64()*10.0
		status := "up"
		code := http.StatusOK
		if cpu > 80 {
			status = "degraded"
			code = http.StatusTooManyRequests
		}
		return snapshot{
			CPU:           cpu,
			MemoryMB:      s.memoryBase + spike*30.0 + rand.Float64()*10.0,
			LatencyMs:     s.latencyBase + spike*500.0 + rand.Float64()*100.0,
			ErrorRate:     spike * 0.1,
			Status:        status,
			Code:          code,
			Connections:   int(spike * 100),
			Threads:       int(spike * 50),
			QueueSize:     int(spike * 200),
			ThroughputRPS: s.calculateRPS(),
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioMemoryLeak:
		// memoryBase zaten üstte artırıldı — double-write yok
		cpu := 20.0 + (s.memoryBase/100.0)*30.0 + rand.Float64()*10.0
		status := "up"
		code := http.StatusOK
		er := 0.0
		if s.memoryBase > 200 {
			er = 0.1
			cpu = 90.0 + rand.Float64()*10.0
			status = "degraded"
			code = http.StatusTooManyRequests
		}
		return snapshot{
			CPU:           cpu,
			MemoryMB:      s.memoryBase,
			LatencyMs:     s.latencyBase + (s.memoryBase/100.0)*20.0 + rand.Float64()*50.0,
			ErrorRate:     er,
			Status:        status,
			Code:          code,
			ThroughputRPS: s.calculateRPS(),
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioHighLatency:
		lat := 2000.0 + rand.Float64()*3000.0 + math.Sin(float64(time.Now().Unix())*0.1)*500.0
		status := "up"
		code := http.StatusOK
		if lat > 4000 {
			status = "degraded"
			code = http.StatusGatewayTimeout
		}
		return snapshot{
			CPU:           s.cpuBase + rand.Float64()*10.0,
			MemoryMB:      s.memoryBase + rand.Float64()*10.0,
			LatencyMs:     lat,
			ErrorRate:     0.02 + rand.Float64()*0.03,
			Status:        status,
			Code:          code,
			Connections:   int(rand.Int31n(30) + 5),
			ThroughputRPS: s.calculateRPS(),
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioErrorBurst:
		t := time.Since(s.scenarioSince).Seconds()
		if math.Mod(t, 30) < 5 { // 5s burst / 25s normal
			atomic.AddUint64(&s.errorCount, 1)
			return snapshot{
				CPU:           80.0 + rand.Float64()*15.0,
				MemoryMB:      s.memoryBase + rand.Float64()*20.0,
				LatencyMs:     100.0 + rand.Float64()*200.0,
				ErrorRate:     0.8 + rand.Float64()*0.2,
				Status:        "down",
				Code:          http.StatusInternalServerError,
				ThroughputRPS: s.calculateRPS(),
				CircuitState:  s.circuitState,
				PeakMemoryMB:  s.peakMemory,
			}
		}
		return s.healthySnapshotLocked()

	case ScenarioConnectionLeak:
		concurrent := atomic.LoadInt32(&s.concurrentReqs)
		s.memoryBase += float64(concurrent) * 0.01
		cpu := s.cpuBase + float64(concurrent)*0.5 + rand.Float64()*10.0
		er := 0.0
		status := "up"
		code := http.StatusOK
		if concurrent > 50 {
			er = 0.3
			cpu = 85.0 + rand.Float64()*10.0
			status = "degraded"
			code = http.StatusTooManyRequests
		}
		return snapshot{
			CPU:           cpu,
			MemoryMB:      s.memoryBase,
			LatencyMs:     s.latencyBase + float64(concurrent)*2.0 + rand.Float64()*50.0,
			ErrorRate:     er,
			Status:        status,
			Code:          code,
			Connections:   int(concurrent) * 2,
			Threads:       int(concurrent),
			QueueSize:     int(concurrent) * 5,
			ThroughputRPS: s.calculateRPS(),
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioSlowStart:
		elapsed := time.Since(s.scenarioSince).Seconds()
		factor := math.Min(elapsed/60.0, 1.0)
		if factor < 0.01 {
			factor = 0.01 // division by zero koruması
		}
		lat := s.latencyBase/factor + rand.Float64()*100.0
		if factor < 0.5 {
			lat *= 2.0
		}
		status := "up"
		if factor < 0.8 {
			status = "degraded"
		}
		return snapshot{
			CPU:           s.cpuBase*factor + rand.Float64()*5.0,
			MemoryMB:      s.memoryBase*factor + rand.Float64()*5.0,
			LatencyMs:     lat,
			ErrorRate:     0.0,
			Status:        status,
			Code:          http.StatusOK,
			ThroughputRPS: s.calculateRPS() * factor,
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioDatabaseIssue:
		if rand.Float32() < 0.3 { // %30 timeout
			atomic.AddUint64(&s.errorCount, 1)
			return snapshot{
				CPU:           40.0 + rand.Float64()*20.0,
				MemoryMB:      s.memoryBase + rand.Float64()*10.0,
				LatencyMs:     30000.0,
				ErrorRate:     1.0,
				Status:        "down",
				Code:          http.StatusGatewayTimeout,
				ThroughputRPS: s.calculateRPS(),
				CircuitState:  s.circuitState,
				PeakMemoryMB:  s.peakMemory,
			}
		}
		return snapshot{
			CPU:           s.cpuBase + rand.Float64()*10.0,
			MemoryMB:      s.memoryBase + rand.Float64()*10.0,
			LatencyMs:     500.0 + rand.Float64()*2000.0,
			ErrorRate:     0.1,
			Status:        "degraded",
			Code:          http.StatusOK,
			ThroughputRPS: s.calculateRPS(),
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioNetworkJitter:
		jitter := rand.Float64()*1000.0 - 500.0
		lat := s.latencyBase + jitter
		if lat < 0 {
			lat = 10.0
		}
		er := 0.0
		status := "up"
		code := http.StatusOK
		if math.Abs(jitter) > 400.0 {
			er = 0.05
			status = "degraded"
			code = http.StatusGatewayTimeout
		}
		return snapshot{
			CPU:           s.cpuBase + rand.Float64()*5.0,
			MemoryMB:      s.memoryBase + rand.Float64()*5.0,
			LatencyMs:     lat,
			ErrorRate:     er,
			Status:        status,
			Code:          code,
			ThroughputRPS: s.calculateRPS(),
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioResourceStarved:
		return snapshot{
			CPU:           5.0 + rand.Float64()*10.0,
			MemoryMB:      s.memoryBase * 0.3,
			LatencyMs:     s.latencyBase*5.0 + rand.Float64()*1000.0,
			ErrorRate:     0.2 + rand.Float64()*0.3,
			Status:        "degraded",
			Code:          http.StatusTooManyRequests,
			ThroughputRPS: s.calculateRPS() * 0.2,
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioLoadSpike:
		hour := time.Now().Hour()
		var loadFactor float64
		switch {
		case hour >= 9 && hour <= 11:
			loadFactor = 0.8 + rand.Float64()*0.2
		case hour >= 14 && hour <= 16:
			loadFactor = 0.9 + rand.Float64()*0.1
		case hour >= 20 && hour <= 22:
			loadFactor = 0.6 + rand.Float64()*0.3
		default:
			loadFactor = 0.2 + rand.Float64()*0.2
		}
		status := "up"
		code := http.StatusOK
		if loadFactor > 0.85 {
			status = "degraded"
			code = http.StatusTooManyRequests
		}
		return snapshot{
			CPU:           s.cpuBase + loadFactor*60.0 + rand.Float64()*10.0,
			MemoryMB:      s.memoryBase + loadFactor*40.0 + rand.Float64()*10.0,
			LatencyMs:     s.latencyBase + loadFactor*800.0 + rand.Float64()*200.0,
			ErrorRate:     loadFactor * 0.15,
			Status:        status,
			Code:          code,
			Connections:   int(loadFactor * 150),
			Threads:       int(loadFactor * 80),
			QueueSize:     int(loadFactor * 300),
			ThroughputRPS: s.calculateRPS() * loadFactor,
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	case ScenarioDependencyIssue:
		if rand.Float32() < 0.4 {
			atomic.AddUint64(&s.errorCount, 1)
			return snapshot{
				CPU:           30.0 + rand.Float64()*20.0,
				MemoryMB:      s.memoryBase + rand.Float64()*10.0,
				LatencyMs:     5000.0,
				ErrorRate:     0.6,
				Status:        "degraded",
				Code:          http.StatusBadGateway,
				ThroughputRPS: s.calculateRPS(),
				CircuitState:  s.circuitState,
				PeakMemoryMB:  s.peakMemory,
			}
		}
		return snapshot{
			CPU:           s.cpuBase + rand.Float64()*10.0,
			MemoryMB:      s.memoryBase + rand.Float64()*10.0,
			LatencyMs:     1000.0 + rand.Float64()*2000.0,
			ErrorRate:     0.1,
			Status:        "degraded",
			Code:          http.StatusOK,
			ThroughputRPS: s.calculateRPS(),
			CircuitState:  s.circuitState,
			PeakMemoryMB:  s.peakMemory,
		}

	default: // ScenarioHealthy
		return s.healthySnapshotLocked()
	}
}

// healthySnapshotLocked: mu zaten alınmışken çağrılır
func (s *ServiceState) healthySnapshotLocked() snapshot {
	return snapshot{
		CPU:           s.cpuBase + rand.Float64()*10.0,
		MemoryMB:      s.memoryBase + rand.Float64()*10.0,
		LatencyMs:     s.latencyBase + rand.Float64()*30.0,
		ErrorRate:     0.0,
		Status:        "up",
		Code:          http.StatusOK,
		OpenPorts:     []int{8000, 8080, 8443},
		Connections:   int(rand.Int31n(20) + 5),
		Threads:       int(rand.Int31n(10) + 3),
		QueueSize:     int(rand.Int31n(10)),
		ThroughputRPS: s.calculateRPS(),
		CircuitState:  s.circuitState,
		PeakMemoryMB:  s.peakMemory,
	}
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

func (s *ServiceState) handleHealth(w http.ResponseWriter, r *http.Request) {
	atomic.AddInt32(&s.concurrentReqs, 1)
	defer atomic.AddInt32(&s.concurrentReqs, -1)

	snap := s.computeSnapshot()

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service-Version", s.version)
	w.Header().Set("X-Service-Name", s.name)
	w.Header().Set("X-Request-ID", fmt.Sprintf("req-%d", atomic.LoadUint64(&s.requestCount)))

	if snap.Code >= 500 {
		atomic.AddUint64(&s.errorCount, 1)
	}

	w.WriteHeader(snap.Code)
	json.NewEncoder(w).Encode(snap)
}

func (s *ServiceState) handleMetrics(w http.ResponseWriter, r *http.Request) {
	atomic.AddInt32(&s.concurrentReqs, 1)
	defer atomic.AddInt32(&s.concurrentReqs, -1)

	// snap ile tüm protected alanlar lock içinde tek seferde okunur
	snap := s.computeSnapshot()

	metrics := map[string]interface{}{
		"timestamp":           time.Now().Unix(),
		"service_name":        s.name,
		"version":             s.version,
		"uptime_seconds":      time.Since(s.startTime).Seconds(),
		"total_requests":      atomic.LoadUint64(&s.requestCount),
		"total_errors":        atomic.LoadUint64(&s.errorCount),
		"cpu_percent":         snap.CPU,
		"memory_mb":           snap.MemoryMB,
		"latency_ms":          snap.LatencyMs,
		"error_rate":          snap.ErrorRate,
		"status":              snap.Status,
		"throughput_rps":      snap.ThroughputRPS,
		"concurrent_requests": atomic.LoadInt32(&s.concurrentReqs),
		"peak_memory_mb":      snap.PeakMemoryMB,   // snap'ten: race yok
		"open_ports":          snap.OpenPorts,
		"connections":         snap.Connections,
		"threads":             snap.Threads,
		"queue_size":          snap.QueueSize,
		"scenario":            string(s.currentScenario()), // kendi RLock'u var
		"circuit_breaker":     snap.CircuitState,           // snap'ten: race yok
		"response_time_p95":   snap.LatencyMs,              // snap'teki p95 değeri
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

func (s *ServiceState) handleInfo(w http.ResponseWriter, r *http.Request) {
	info := map[string]interface{}{
		"service":     s.name,
		"version":     s.version,
		"started_at":  s.startTime.Format(time.RFC3339),
		"scenario":    string(s.currentScenario()),
		"uptime":      time.Since(s.startTime).String(),
		"git_commit":  "abc123def",
		"build_time":  "2024-03-30T10:00:00Z",
		"go_version":  "go1.21.0",
		"environment": "development",
		"features": []string{
			"graceful_shutdown",
			"health_checks",
			"metrics_endpoint",
			"circuit_breaker",
			"rate_limiting",
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

func (s *ServiceState) handleScenario(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "GET" {
		json.NewEncoder(w).Encode(map[string]string{"current": string(s.currentScenario())})
		return
	}

	if r.Method == "POST" {
		var req struct {
			Scenario string `json:"scenario"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		newScenario := parseScenario(req.Scenario)
		s.setScenario(newScenario)
		json.NewEncoder(w).Encode(map[string]string{
			"message": fmt.Sprintf("Scenario changed to %s", newScenario),
		})
	}
}

func (s *ServiceState) handleLoad(w http.ResponseWriter, r *http.Request) {
	atomic.AddInt32(&s.concurrentReqs, 1)
	defer atomic.AddInt32(&s.concurrentReqs, -1)

	loadType := r.URL.Query().Get("type")

	switch loadType {
	case "cpu":
		for i := 0; i < 1000000; i++ {
			math.Sqrt(float64(i))
		}
	case "memory":
		data := make([]byte, 1024*1024)
		_ = data
	case "io":
		time.Sleep(100 * time.Millisecond)
	default:
		time.Sleep(10 * time.Millisecond)
	}

	snap := s.computeSnapshot()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(snap.Code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"load_type":    loadType,
		"processed_at": time.Now().Unix(),
		"worker_id":    rand.Intn(10),
		"queue_depth":  rand.Intn(100),
		"status":       snap.Status,
	})
}

func (s *ServiceState) handleChaos(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Action  string `json:"action"`
		Target  string `json:"target"`
		Percent int    `json:"percent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	message := fmt.Sprintf("Chaos action %s on %s with %d%% intensity", req.Action, req.Target, req.Percent)
	log.Printf("[%s] Chaos: %s", s.name, message)

	// Tüm state yazmaları lock içinde
	s.mu.Lock()
	switch req.Action {
	case "latency":
		s.latencyBase += float64(req.Percent) * 10.0
	case "memory":
		s.memoryLeak += float64(req.Percent) * 0.001
	}
	s.mu.Unlock()

	// Error injection: atomik counter; response henüz yazılmadıysa erken dön
	if req.Action == "error" && rand.Intn(100) < req.Percent {
		atomic.AddUint64(&s.errorCount, 1)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Chaos error injected"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": message})
}

// ── Main ─────────────────────────────────────────────────────────────────────

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	state := newServiceState()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", state.handleHealth)
	mux.HandleFunc("/metrics", state.handleMetrics)
	mux.HandleFunc("/info", state.handleInfo)
	mux.HandleFunc("/scenario", state.handleScenario)
	mux.HandleFunc("/load", state.handleLoad)
	mux.HandleFunc("/chaos", state.handleChaos)

	handler := requestLogger(state)(mux)

	log.Printf("[%s] Mock service starting on port %s with scenario: %s", state.name, port, state.scenario)

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func requestLogger(state *ServiceState) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			wrapped := &responseWriter{ResponseWriter: w, statusCode: 200}
			next.ServeHTTP(wrapped, r)
			log.Printf("[%s] %s %s %d %v", state.name, r.Method, r.URL.Path, wrapped.statusCode, time.Since(start))
		})
	}
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
