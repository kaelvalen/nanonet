package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync/atomic"
	"time"
)

var (
	requestCount uint64
	startTime    = time.Now()
)

type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Uptime    string    `json:"uptime"`
	Requests  uint64    `json:"requests"`
	Version   string    `json:"version"`
}

type MetricsResponse struct {
	Requests      uint64        `json:"requests"`
	Uptime        time.Duration `json:"uptime_seconds"`
	MemoryUsageMB float64       `json:"memory_usage_mb"`
	CPUPercent    float64       `json:"cpu_percent"`
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	rand.Seed(time.Now().UnixNano())

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/metrics", metricsHandler)
	http.HandleFunc("/api/users", usersHandler)
	http.HandleFunc("/api/products", productsHandler)
	http.HandleFunc("/", rootHandler)

	log.Printf("🚀 Mock Service başlatılıyor...")
	log.Printf("📍 Port: %s", port)
	log.Printf("🔗 Endpoints:")
	log.Printf("   GET  /health       - Health check")
	log.Printf("   GET  /metrics      - Service metrics")
	log.Printf("   GET  /api/users    - Mock users data")
	log.Printf("   GET  /api/products - Mock products data")
	log.Printf("   GET  /             - Service info")
	log.Printf("")

	if err := http.ListenAndServe(":"+port, loggingMiddleware(http.DefaultServeMux)); err != nil {
		log.Fatalf("Server başlatılamadı: %v", err)
	}
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&requestCount, 1)
		start := time.Now()

		// Add CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)

		duration := time.Since(start)
		log.Printf("%s %s - %v", r.Method, r.URL.Path, duration)
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Simulate occasional degraded state (5% chance)
	status := "healthy"
	statusCode := http.StatusOK
	if rand.Float64() < 0.05 {
		status = "degraded"
		statusCode = http.StatusServiceUnavailable
	}

	response := HealthResponse{
		Status:    status,
		Timestamp: time.Now(),
		Uptime:    time.Since(startTime).String(),
		Requests:  atomic.LoadUint64(&requestCount),
		Version:   "1.0.0",
	}

	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(response)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Simulate realistic metrics
	response := MetricsResponse{
		Requests:      atomic.LoadUint64(&requestCount),
		Uptime:        time.Since(startTime),
		MemoryUsageMB: 50.0 + rand.Float64()*50.0, // 50-100 MB
		CPUPercent:    10.0 + rand.Float64()*30.0, // 10-40%
	}

	json.NewEncoder(w).Encode(response)
}

func usersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	users := []map[string]interface{}{
		{"id": 1, "name": "Alice Johnson", "email": "alice@example.com", "role": "admin"},
		{"id": 2, "name": "Bob Smith", "email": "bob@example.com", "role": "user"},
		{"id": 3, "name": "Charlie Brown", "email": "charlie@example.com", "role": "user"},
		{"id": 4, "name": "Diana Prince", "email": "diana@example.com", "role": "moderator"},
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    users,
		"count":   len(users),
	})
}

func productsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	products := []map[string]interface{}{
		{"id": 1, "name": "Laptop", "price": 999.99, "stock": 15},
		{"id": 2, "name": "Mouse", "price": 29.99, "stock": 50},
		{"id": 3, "name": "Keyboard", "price": 79.99, "stock": 30},
		{"id": 4, "name": "Monitor", "price": 299.99, "stock": 8},
		{"id": 5, "name": "Headphones", "price": 149.99, "stock": 25},
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    products,
		"count":   len(products),
	})
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	info := map[string]interface{}{
		"service":   "NanoNet Mock Service",
		"version":   "1.0.0",
		"uptime":    time.Since(startTime).String(),
		"requests":  atomic.LoadUint64(&requestCount),
		"timestamp": time.Now(),
		"endpoints": []string{
			"GET /health",
			"GET /metrics",
			"GET /api/users",
			"GET /api/products",
		},
	}

	json.NewEncoder(w).Encode(info)
}
