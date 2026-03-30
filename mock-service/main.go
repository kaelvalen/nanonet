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
	ScenarioHealthy         Scenario = "healthy"          // Normal operasyon
	ScenarioDegraded        Scenario = "degraded"         // Yavaş yanıt, yüksek latency
	ScenarioDown            Scenario = "down"             // Servis tamamen çökmüş
	ScenarioSpike           Scenario = "spike"            // CPU/bellek ani artış
	ScenarioMemoryLeak      Scenario = "memory_leak"      // Bellek sürekli artıyor
	ScenarioFlapping        Scenario = "flapping"         // Up/down dalgalanması
	ScenarioHighLatency     Scenario = "high_latency"     // Sadece latency yüksek
	ScenarioErrorBurst      Scenario = "error_burst"      // Ani hata patlaması
	ScenarioConnectionLeak  Scenario = "connection_leak"  // Bağlantı sızıntısı
	ScenarioSlowStart       Scenario = "slow_start"       // Yavaş başlangıç
	ScenarioDatabaseIssue   Scenario = "database_issue"   // Veritabanı sorunları
	ScenarioNetworkJitter   Scenario = "network_jitter"   // Ağ kararsızlığı
	ScenarioResourceStarved Scenario = "resource_starved" // Kaynak yetersizliği
	ScenarioCircuitBreaker  Scenario = "circuit_breaker"  // Circuit breaker davranışı
	ScenarioRandomCrash     Scenario = "random_crash"     // Rastgele çökme
	ScenarioLoadSpike       Scenario = "load_spike"       // Yük artışı simülasyonu
	ScenarioDependencyIssue Scenario = "dependency_issue" // Bağımlılık sorunları
)

// ── Servis durumu ────────────────────────────────────────────────────────────

type ServiceState struct {
	mu                sync.RWMutex
	scenario          Scenario
	requestCount      uint64
	errorCount        uint64
	startTime         time.Time
	memoryBase        float64 // MB
	memoryLeak        float64 // her istek başına eklenen MB
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

// ── Metrik hesapları ─────────────────────────────────────────────────────────

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
}

func (s *ServiceState) computeSnapshot() snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()

	atomic.AddUint64(&s.requestCount, 1)
	s.lastRequestTime = time.Now()

	// Memory leak birikimi
	s.memoryBase += s.memoryLeak
	if s.memoryBase > s.peakMemory {
		s.peakMemory = s.memoryBase
	}

	// Response time history
	latency := s.calculateLatency()
	if len(s.responseTimeHist) >= 1000 {
		s.responseTimeHist = s.responseTimeHist[1:]
	}
	s.responseTimeHist = append(s.responseTimeHist, latency)

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

	// Circuit breaker logic
	if sc == ScenarioCircuitBreaker {
		s.updateCircuitBreaker()
		if s.circuitState == "open" {
			return snapshot{
				CPU:           0,
				MemoryMB:      s.memoryBase,
				LatencyMs:     0,
				ErrorRate:     1.0,
				Status:        "down",
				Code:          http.StatusServiceUnavailable,
				OpenPorts:     []int{8000},
				Connections:   0,
				Threads:       0,
				QueueSize:     0,
				ThroughputRPS: s.calculateRPS(),
			}
		}
	}

	// Random crash
	if sc == ScenarioRandomCrash && rand.Float32() < 0.01 { // 1% crash chance
		atomic.AddUint64(&s.errorCount, 1)
		return snapshot{
			CPU:           0,
			MemoryMB:      0,
			LatencyMs:     0,
			ErrorRate:     1.0,
			Status:        "down",
			Code:          http.StatusInternalServerError,
			ThroughputRPS: s.calculateRPS(),
		}
	}

	switch sc {
	case ScenarioDown:
		atomic.AddUint64(&s.errorCount, 1)
		return snapshot{
			CPU:           0,
			MemoryMB:      0,
			LatencyMs:     0,
			ErrorRate:     1.0,
			Status:        "down",
			Code:          http.StatusServiceUnavailable,
			ThroughputRPS: s.calculateRPS(),
		}

	case ScenarioDegraded:
		cpu := 60.0 + rand.Float64()*25.0
		mem := s.memoryBase + rand.Float64()*20.0
		lat := 800.0 + rand.Float64()*1200.0
		er := 0.05 + rand.Float64()*0.1
		return snapshot{
			CPU:           cpu,
			MemoryMB:      mem,
			LatencyMs:     lat,
			ErrorRate:     er,
			Status:        "degraded",
			Code:          http.StatusOK,
			OpenPorts:     []int{8000, 8080},
			Connections:   int(rand.Int31n(50) + 10),
			Threads:       int(rand.Int31n(20) + 5),
			QueueSize:     int(rand.Int31n(100)),
			ThroughputRPS: s.calculateRPS(),
		}

	case ScenarioSpike:
		t := time.Since(s.scenarioSince).Seconds()
		spike := math.Sin(t*0.1)*0.5 + 0.5
		cpu := 30.0 + spike*70.0 + rand.Float64()*10.0
		mem := s.memoryBase + spike*30.0 + rand.Float64()*10.0
		lat := s.latencyBase + spike*500.0 + rand.Float64()*100.0
		er := spike * 0.1

		status := "up"
		code := http.StatusOK
		if cpu > 80 {
			status = "degraded"
			code = http.StatusTooManyRequests
		}

		return snapshot{
			CPU:           cpu,
			MemoryMB:      mem,
			LatencyMs:     lat,
			ErrorRate:     er,
			Status:        status,
			Code:          code,
			OpenPorts:     []int{8000},
			Connections:   int(spike * 100),
			Threads:       int(spike * 50),
			QueueSize:     int(spike * 200),
			ThroughputRPS: s.calculateRPS(),
		}

	case ScenarioMemoryLeak:
		cpu := 20.0 + (s.memoryBase/100.0)*30.0 + rand.Float64()*10.0
		mem := s.memoryBase
		lat := s.latencyBase + (s.memoryBase/100.0)*20.0 + rand.Float64()*50.0
		er := 0.0
		if s.memoryBase > 200 {
			er = 0.1
			cpu = 90.0 + rand.Float64()*10.0
		}

		status := "up"
		code := http.StatusOK
		if s.memoryBase > 200 {
			status = "degraded"
			code = http.StatusTooManyRequests
		}

		return snapshot{
			CPU:           cpu,
			MemoryMB:      mem,
			LatencyMs:     lat,
			ErrorRate:     er,
			Status:        status,
			Code:          code,
			ThroughputRPS: s.calculateRPS(),
		}

	case ScenarioHighLatency:
		cpu := s.cpuBase + rand.Float64()*10.0
		mem := s.memoryBase + rand.Float64()*10.0
		lat := 2000.0 + rand.Float64()*3000.0 + math.Sin(float64(time.Now().Unix())*0.1)*500.0
		er := 0.02 + rand.Float64()*0.03

		status := "up"
		code := http.StatusOK
		if lat > 4000 {
			status = "degraded"
			code = http.StatusGatewayTimeout
		}

		return snapshot{
			CPU:           cpu,
			MemoryMB:      mem,
			LatencyMs:     lat,
			ErrorRate:     er,
			Status:        status,
			Code:          code,
			OpenPorts:     []int{8000, 8443},
			Connections:   int(rand.Int31n(30) + 5),
			ThroughputRPS: s.calculateRPS(),
		}

	case ScenarioErrorBurst:
		t := time.Since(s.scenarioSince).Seconds()
		burst := math.Mod(t, 30) < 5 // 5 saniye hata patlaması, 25 saniye normal
		if burst {
			atomic.AddUint64(&s.errorCount, 1)
			return snapshot{
				CPU:           80.0 + rand.Float64()*15.0,
				MemoryMB:      s.memoryBase + rand.Float64()*20.0,
				LatencyMs:     100.0 + rand.Float64()*200.0,
				ErrorRate:     0.8 + rand.Float64()*0.2,
				Status:        "down",
				Code:          http.StatusInternalServerError,
				ThroughputRPS: s.calculateRPS(),
			}
		}
		return s.generateHealthySnapshot()

	case ScenarioConnectionLeak:
		concurrent := atomic.LoadInt32(&s.concurrentReqs)
		s.memoryBase += float64(concurrent) * 0.01
		cpu := s.cpuBase + float64(concurrent)*0.5 + rand.Float64()*10.0
		mem := s.memoryBase
		lat := s.latencyBase + float64(concurrent)*2.0 + rand.Float64()*50.0
		er := 0.0
		if concurrent > 50 {
			er = 0.3
			cpu = 85.0 + rand.Float64()*10.0
		}

		status := "up"
		code := http.StatusOK
		if concurrent > 50 {
			status = "degraded"
			code = http.StatusTooManyRequests
		}

		return snapshot{
			CPU:           cpu,
			MemoryMB:      mem,
			LatencyMs:     lat,
			ErrorRate:     er,
			Status:        status,
			Code:          code,
			Connections:   int(concurrent) * 2,
			Threads:       int(concurrent),
			QueueSize:     int(concurrent) * 5,
			ThroughputRPS: s.calculateRPS(),
		}

	case ScenarioDatabaseIssue:
		dbLatency := 500.0 + rand.Float64()*2000.0
		if rand.Float32() < 0.3 { // 30% timeout
			atomic.AddUint64(&s.errorCount, 1)
			return snapshot{
				CPU:           40.0 + rand.Float64()*20.0,
				MemoryMB:      s.memoryBase + rand.Float64()*10.0,
				LatencyMs:     30000.0, // 30s timeout
				ErrorRate:     1.0,
				Status:        "down",
				Code:          http.StatusGatewayTimeout,
				ThroughputRPS: s.calculateRPS(),
			}
		}
		return snapshot{
			CPU:           s.cpuBase + rand.Float64()*10.0,
			MemoryMB:      s.memoryBase + rand.Float64()*10.0,
			LatencyMs:     dbLatency,
			ErrorRate:     0.1,
			Status:        "degraded",
			Code:          http.StatusOK,
			ThroughputRPS: s.calculateRPS(),
		}

	case ScenarioNetworkJitter:
		baseLat := s.latencyBase
		jitter := rand.Float64()*1000.0 - 500.0 // ±500ms jitter
		lat := baseLat + jitter
		if lat < 0 {
			lat = 10.0
		}
		er := 0.0
		if math.Abs(jitter) > 400.0 {
			er = 0.05
		}

		status := "up"
		code := http.StatusOK
		if er > 0 {
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
		}

	case ScenarioResourceStarved:
		cpu := 5.0 + rand.Float64()*10.0
		mem := s.memoryBase * 0.3 // Sadece %30 memory
		lat := s.latencyBase*5.0 + rand.Float64()*1000.0
		er := 0.2 + rand.Float64()*0.3
		return snapshot{
			CPU:           cpu,
			MemoryMB:      mem,
			LatencyMs:     lat,
			ErrorRate:     er,
			Status:        "degraded",
			Code:          http.StatusTooManyRequests,
			ThroughputRPS: s.calculateRPS() * 0.2,
		}

	case ScenarioLoadSpike:
		hour := time.Now().Hour()
		var loadFactor float64
		// Saatlik trafik paterni
		switch {
		case hour >= 9 && hour <= 11:
			loadFactor = 0.8 + rand.Float64()*0.2 // Sabah yoğunluğu
		case hour >= 14 && hour <= 16:
			loadFactor = 0.9 + rand.Float64()*0.1 // Öğleden sonra zirve
		case hour >= 20 && hour <= 22:
			loadFactor = 0.6 + rand.Float64()*0.3 // Akşam kullanımı
		default:
			loadFactor = 0.2 + rand.Float64()*0.2 // Düşük trafik
		}

		cpu := s.cpuBase + loadFactor*60.0 + rand.Float64()*10.0
		mem := s.memoryBase + loadFactor*40.0 + rand.Float64()*10.0
		lat := s.latencyBase + loadFactor*800.0 + rand.Float64()*200.0
		er := loadFactor * 0.15

		status := "up"
		code := http.StatusOK
		if loadFactor > 0.85 {
			status = "degraded"
			code = http.StatusTooManyRequests
		}

		return snapshot{
			CPU:           cpu,
			MemoryMB:      mem,
			LatencyMs:     lat,
			ErrorRate:     er,
			Status:        status,
			Code:          code,
			Connections:   int(loadFactor * 150),
			Threads:       int(loadFactor * 80),
			QueueSize:     int(loadFactor * 300),
			ThroughputRPS: s.calculateRPS() * loadFactor,
		}

	case ScenarioDependencyIssue:
		// Bağımlı servislerden bir yavaş
		depLatency := 1000.0 + rand.Float64()*2000.0
		if rand.Float32() < 0.4 { // 40% dependency failure
			atomic.AddUint64(&s.errorCount, 1)
			return snapshot{
				CPU:           30.0 + rand.Float64()*20.0,
				MemoryMB:      s.memoryBase + rand.Float64()*10.0,
				LatencyMs:     5000.0,
				ErrorRate:     0.6,
				Status:        "degraded",
				Code:          http.StatusBadGateway,
				ThroughputRPS: s.calculateRPS(),
			}
		}
		return snapshot{
			CPU:           s.cpuBase + rand.Float64()*10.0,
			MemoryMB:      s.memoryBase + rand.Float64()*10.0,
			LatencyMs:     depLatency,
			ErrorRate:     0.1,
			Status:        "degraded",
			Code:          http.StatusOK,
			ThroughputRPS: s.calculateRPS(),
		}

	default: // ScenarioHealthy
		return s.generateHealthySnapshot()
	}
}

func (s *ServiceState) generateHealthySnapshot() snapshot {
	cpu := s.cpuBase + rand.Float64()*10.0
	mem := s.memoryBase + rand.Float64()*10.0
	lat := s.latencyBase + rand.Float64()*30.0

	return snapshot{
		CPU:           cpu,
		MemoryMB:      mem,
		LatencyMs:     lat,
		ErrorRate:     0.0,
		Status:        "up",
		Code:          http.StatusOK,
		OpenPorts:     []int{8000, 8080, 8443},
		Connections:   int(rand.Int31n(20) + 5),
		Threads:       int(rand.Int31n(10) + 3),
		QueueSize:     int(rand.Int31n(10)),
		ThroughputRPS: s.calculateRPS(),
	}
}

func (s *ServiceState) calculateLatency() float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Response time history'den 95th percentile hesapla
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

func (s *ServiceState) calculateRPS() float64 {
	// Basit yaklaşım: toplam request / toplam süre (lifetime)
	// Gerçek sliding window için request timestamp'leri tutmak gerekirdi
	elapsed := time.Since(s.startTime).Seconds()
	if elapsed == 0 {
		return 0
	}
	reqs := float64(atomic.LoadUint64(&s.requestCount))
	return reqs / elapsed
}

func (s *ServiceState) updateCircuitBreaker() {
	now := time.Now()

	if s.circuitState == "open" {
		// 30 saniye sonra half-open'a geç
		if now.Sub(s.lastCircuitChange) > 30*time.Second {
			s.circuitState = "half-open"
			s.lastCircuitChange = now
			s.circuitFailures = 0
			log.Printf("[%s] Circuit breaker: half-open", s.name)
		}
		return
	}

	// Sliding window: son 5 saniyedeki hataları say
	// Her request'te circuitFailures artırılıyor, ama 5 saniye sonra otomatik reset
	if now.Sub(s.lastCircuitChange) > 5*time.Second {
		s.circuitFailures = 0
		s.lastCircuitChange = now

		if s.circuitState == "half-open" {
			s.circuitState = "closed"
			log.Printf("[%s] Circuit breaker: closed", s.name)
		}
	}

	// 5 saniye içinde 3 hata = open
	if s.circuitFailures >= 3 {
		s.circuitState = "open"
		s.lastCircuitChange = now
		s.circuitFailures = 0
		log.Printf("[%s] Circuit breaker: open", s.name)
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
		"peak_memory_mb":      s.peakMemory,
		"open_ports":          snap.OpenPorts,
		"connections":         snap.Connections,
		"threads":             snap.Threads,
		"queue_size":          snap.QueueSize,
		"scenario":            s.scenario,
		"circuit_breaker":     s.circuitState,
		"response_time_p95":   s.calculateLatency(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

func (s *ServiceState) handleInfo(w http.ResponseWriter, r *http.Request) {
	info := map[string]interface{}{
		"service":     s.name,
		"version":     s.version,
		"started_at":  s.startTime.Format(time.RFC3339),
		"scenario":    s.scenario,
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
	if r.Method == "GET" {
		current := map[string]string{
			"current": string(s.scenario),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(current)
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

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": fmt.Sprintf("Scenario changed to %s", newScenario),
		})
	}
}

func (s *ServiceState) handleLoad(w http.ResponseWriter, r *http.Request) {
	atomic.AddInt32(&s.concurrentReqs, 1)
	defer atomic.AddInt32(&s.concurrentReqs, -1)

	// Simulate different load patterns
	loadType := r.URL.Query().Get("type")

	switch loadType {
	case "cpu":
		// CPU intensive work
		for i := 0; i < 1000000; i++ {
			math.Sqrt(float64(i))
		}
	case "memory":
		// Memory allocation
		data := make([]byte, 1024*1024) // 1MB
		_ = data
	case "io":
		// Simulate I/O wait
		time.Sleep(100 * time.Millisecond)
	default:
		// Mixed load
		time.Sleep(10 * time.Millisecond)
	}

	snap := s.computeSnapshot()

	response := map[string]interface{}{
		"load_type":    loadType,
		"processed_at": time.Now().Unix(),
		"worker_id":    rand.Intn(10),
		"queue_depth":  rand.Intn(100),
		"status":       snap.Status,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(snap.Code)
	json.NewEncoder(w).Encode(response)
}

func (s *ServiceState) handleChaos(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
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

		// Apply chaos effects with lock
		s.mu.Lock()
		switch req.Action {
		case "latency":
			s.latencyBase += float64(req.Percent) * 10.0
		case "memory":
			s.memoryLeak += float64(req.Percent) * 0.001
		}
		s.mu.Unlock()

		// Error injection doesn't need lock (atomic)
		if req.Action == "error" {
			if rand.Intn(100) < req.Percent {
				atomic.AddUint64(&s.errorCount, 1)
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": "Chaos error injected"})
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": message})
	}
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

	// Add middleware for request tracking
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

			// Wrap ResponseWriter to capture status code
			wrapped := &responseWriter{ResponseWriter: w, statusCode: 200}

			next.ServeHTTP(wrapped, r)

			duration := time.Since(start)
			log.Printf("[%s] %s %s %d %v", state.name, r.Method, r.URL.Path, wrapped.statusCode, duration)
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
