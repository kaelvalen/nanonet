package health

import (
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type Handler struct {
	db    *gorm.DB
	redis *redis.Client
}

type HealthStatus struct {
	Status    string            `json:"status"`
	Timestamp string            `json:"timestamp"`
	Version   string            `json:"version"`
	Services  map[string]string `json:"services"`
	System    SystemInfo        `json:"system"`
}

type SystemInfo struct {
	GoVersion    string   `json:"go_version"`
	OS           string   `json:"os"`
	Arch         string   `json:"arch"`
	NumGoroutine int      `json:"num_goroutine"`
	MemStats     MemStats `json:"mem_stats"`
}

type MemStats struct {
	Alloc      uint64 `json:"alloc_bytes"`
	TotalAlloc uint64 `json:"total_alloc_bytes"`
	Sys        uint64 `json:"sys_bytes"`
	NumGC      uint32 `json:"num_gc"`
}

func NewHandler(db *gorm.DB, redis *redis.Client) *Handler {
	return &Handler{
		db:    db,
		redis: redis,
	}
}

func (h *Handler) Check(c *gin.Context) {
	services := make(map[string]string)
	status := "healthy"

	// Check database
	if h.db != nil {
		sqlDB, err := h.db.DB()
		if err != nil {
			services["database"] = "error: " + err.Error()
			status = "degraded"
		} else {
			ctx := c.Request.Context()
			if err := sqlDB.PingContext(ctx); err != nil {
				services["database"] = "unhealthy: " + err.Error()
				status = "degraded"
			} else {
				services["database"] = "healthy"
			}
		}
	} else {
		services["database"] = "not configured"
	}

	// Check Redis
	if h.redis != nil {
		ctx := c.Request.Context()
		if err := h.redis.Ping(ctx).Err(); err != nil {
			services["redis"] = "unhealthy: " + err.Error()
			status = "degraded"
		} else {
			services["redis"] = "healthy"
		}
	} else {
		services["redis"] = "not configured"
	}

	// Get system info
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	response := HealthStatus{
		Status:    status,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Version:   "1.0.0",
		Services:  services,
		System: SystemInfo{
			GoVersion:    runtime.Version(),
			OS:           runtime.GOOS,
			Arch:         runtime.GOARCH,
			NumGoroutine: runtime.NumGoroutine(),
			MemStats: MemStats{
				Alloc:      m.Alloc,
				TotalAlloc: m.TotalAlloc,
				Sys:        m.Sys,
				NumGC:      m.NumGC,
			},
		},
	}

	httpStatus := http.StatusOK
	if status == "degraded" {
		httpStatus = http.StatusServiceUnavailable
	}

	c.JSON(httpStatus, response)
}

func (h *Handler) Liveness(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "alive"})
}

func (h *Handler) Readiness(c *gin.Context) {
	// Check if critical services are ready
	ready := true

	if h.db != nil {
		sqlDB, err := h.db.DB()
		if err == nil {
			ctx := c.Request.Context()
			if err := sqlDB.PingContext(ctx); err != nil {
				ready = false
			}
		} else {
			ready = false
		}
	}

	if ready {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not_ready"})
	}
}
