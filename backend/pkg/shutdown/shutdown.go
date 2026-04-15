package shutdown

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

type ShutdownFunc func(ctx context.Context) error

type Manager struct {
	shutdownFuncs []ShutdownFunc
	timeout       time.Duration
	mu            sync.Mutex
}

func NewManager(timeout time.Duration) *Manager {
	return &Manager{
		shutdownFuncs: make([]ShutdownFunc, 0),
		timeout:       timeout,
	}
}

// Register adds a shutdown function to be called on graceful shutdown
func (m *Manager) Register(fn ShutdownFunc) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.shutdownFuncs = append(m.shutdownFuncs, fn)
}

// Shutdown gracefully shuts down all registered functions
func (m *Manager) Shutdown(server *http.Server) {
	m.mu.Lock()
	funcs := make([]ShutdownFunc, len(m.shutdownFuncs))
	copy(funcs, m.shutdownFuncs)
	m.mu.Unlock()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), m.timeout)
	defer cancel()

	// Shutdown HTTP server
	if server != nil {
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("Server shutdown error: %v", err)
		}
	}

	// Call all registered shutdown functions
	var wg sync.WaitGroup
	for _, fn := range funcs {
		wg.Add(1)
		go func(f ShutdownFunc) {
			defer wg.Done()
			if err := f(ctx); err != nil {
				log.Printf("Shutdown function error: %v", err)
			}
		}(fn)
	}

	wg.Wait()
	log.Println("Shutdown complete")
}

// DefaultShutdown provides a default shutdown manager with 30s timeout
func DefaultShutdown(server *http.Server) {
	NewManager(30 * time.Second).Shutdown(server)
}
