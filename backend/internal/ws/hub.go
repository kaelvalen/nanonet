package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"nanonet-backend/pkg/agentsign"
)

type AgentMessage struct {
	Type         string                   `json:"type"`
	AgentID      string                   `json:"agent_id,omitempty"`
	AgentVersion string                   `json:"agent_version,omitempty"`
	ServiceID    string                   `json:"service_id,omitempty"`
	CommandID    string                   `json:"command_id,omitempty"`
	Status       string                   `json:"status,omitempty"`
	Output       *string                  `json:"output,omitempty"`
	Error        *string                  `json:"error,omitempty"`
	Data         map[string]interface{}   `json:"data,omitempty"`
	Labels       map[string]string        `json:"labels,omitempty"`
	System       map[string]interface{}   `json:"system,omitempty"`
	App          map[string]interface{}   `json:"app,omitempty"`
	Service      map[string]interface{}   `json:"service,omitempty"`
	Process      map[string]interface{}   `json:"process,omitempty"`
	Dependencies []map[string]interface{} `json:"dependencies,omitempty"`
	Timestamp    string                   `json:"timestamp,omitempty"`
}

type OnMetricFunc func(serviceID string, msg AgentMessage)
type OnCommandResultFunc func(commandID, status string, msg AgentMessage)
type OnDependenciesFunc func(serviceID string, deps []map[string]interface{})

// OnAgentHeartbeatFunc is called whenever an agent reports presence: either an
// explicit "heartbeat" message or any "metrics" frame. Backend uses it to bump
// services.agent_last_heartbeat_at + agent_version.
type OnAgentHeartbeatFunc func(serviceID, agentVersion string, at time.Time)

type Hub struct {
	dashboardClients map[*Client]bool
	agentClients     map[*Client]bool
	broadcast        chan []byte
	register         chan *Client
	unregister       chan *Client
	mu               sync.RWMutex
	maxConnections   int

	onMetric        OnMetricFunc
	onCommandResult OnCommandResultFunc
	onDependencies  OnDependenciesFunc
	onHeartbeat     OnAgentHeartbeatFunc

	// pendingCommands — agent çevrimdışıyken biriken komutlar (in-memory fallback).
	pendingCommands map[string][]pendingCommand // serviceID -> []command
	pendingMu       sync.Mutex

	// redisClient is nil when Redis is not configured (in-memory mode).
	redisClient *redis.Client

	// signer — agent komutlarını imzalamak için opsiyonel HMAC signer.
	// `NANONET_AGENT_SIGN_SECRET` env'i set değilse no-op davranır.
	signer *agentsign.Signer
}

type pendingCommand struct {
	Data      []byte
	QueuedAt  string
	CommandID string
}

func NewHub(maxConnections int) *Hub {
	if maxConnections <= 0 {
		maxConnections = 1000
	}
	return &Hub{
		dashboardClients: make(map[*Client]bool),
		agentClients:     make(map[*Client]bool),
		broadcast:        make(chan []byte, 1024),
		register:         make(chan *Client),
		unregister:       make(chan *Client),
		maxConnections:   maxConnections,
		pendingCommands:  make(map[string][]pendingCommand),
		signer:           agentsign.NewFromEnv(),
	}
}

// SetSigner replaces the default env-derived signer (test/override).
func (h *Hub) SetSigner(s *agentsign.Signer) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.signer = s
}

// NewHubWithRedis creates a Hub backed by Redis for multi-instance deployments.
func NewHubWithRedis(maxConnections int, rdb *redis.Client) *Hub {
	h := NewHub(maxConnections)
	h.redisClient = rdb
	return h
}

func (h *Hub) SetOnMetric(fn OnMetricFunc) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onMetric = fn
}

func (h *Hub) SetOnCommandResult(fn OnCommandResultFunc) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onCommandResult = fn
}

func (h *Hub) SetOnDependencies(fn OnDependenciesFunc) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onDependencies = fn
}

func (h *Hub) SetOnAgentHeartbeat(fn OnAgentHeartbeatFunc) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onHeartbeat = fn
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			totalConnections := len(h.dashboardClients) + len(h.agentClients)
			if totalConnections >= h.maxConnections {
				slog.Warn("Max bağlantı limiti aşıldı", slog.Int("max", h.maxConnections), slog.String("client_id", client.id))
				close(client.send)
				h.mu.Unlock()
				break
			}
			if client.clientType == AgentClient {
				h.agentClients[client] = true
				slog.Info("Agent bağlandı", slog.String("agent_id", client.id), slog.String("service_id", client.serviceID))
				h.mu.Unlock()
				// Bağlanan agent için bekleyen komutları ilet
				h.deliverPendingCommands(client)
			} else {
				h.dashboardClients[client] = true
				slog.Info("Dashboard client bağlandı", slog.String("client_id", client.id), slog.String("user_id", client.userID))
				h.mu.Unlock()
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if client.clientType == AgentClient {
				if _, ok := h.agentClients[client]; ok {
					delete(h.agentClients, client)
					close(client.send)
					slog.Info("Agent ayrıldı", slog.String("agent_id", client.id), slog.String("service_id", client.serviceID))
				}
			} else {
				if _, ok := h.dashboardClients[client]; ok {
					delete(h.dashboardClients, client)
					close(client.send)
					slog.Info("Dashboard client ayrıldı", slog.String("client_id", client.id))
				}
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.dashboardClients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.dashboardClients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

// StartRedis subscribes to Redis pub/sub channels and fans out messages to local
// clients. Call this in a goroutine when Redis is configured.
func (h *Hub) StartRedis(ctx context.Context) {
	if h.redisClient == nil {
		return
	}

	pubsub := h.redisClient.PSubscribe(ctx,
		"nanonet:broadcast:*", // metric/alert broadcasts
		"nanonet:cmd:*",       // cross-node agent commands
	)
	defer func() { _ = pubsub.Close() }()

	slog.Info("Redis pub/sub dinleyici başlatıldı")

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			switch {
			case strings.HasPrefix(msg.Channel, "nanonet:broadcast:"):
				// Forward to local dashboard clients via the broadcast channel.
				h.broadcast <- []byte(msg.Payload)
			case strings.HasPrefix(msg.Channel, "nanonet:cmd:"):
				serviceID := strings.TrimPrefix(msg.Channel, "nanonet:cmd:")
				h.tryDeliverToLocalAgent(serviceID, []byte(msg.Payload))
			}
		}
	}
}

// tryDeliverToLocalAgent attempts to send a command to a locally connected agent.
func (h *Hub) tryDeliverToLocalAgent(serviceID string, data []byte) {
	h.mu.RLock()
	var targets []*Client
	for client := range h.agentClients {
		if client.serviceID == serviceID {
			targets = append(targets, client)
		}
	}
	h.mu.RUnlock()

	for _, client := range targets {
		select {
		case client.send <- data:
		default:
		}
	}
}

func (h *Hub) HandleAgentMessage(client *Client, rawMessage []byte) {
	var msg AgentMessage
	if err := json.Unmarshal(rawMessage, &msg); err != nil {
		slog.Warn("Agent mesaj parse hatası", slog.String("client_id", client.id), slog.String("error", err.Error()))
		return
	}

	switch msg.Type {
	case "metrics":
		serviceID := msg.ServiceID
		if serviceID == "" {
			serviceID = client.serviceID
		}
		if serviceID == "" {
			slog.Warn("Agent metrik mesajında service_id eksik", slog.String("client_id", client.id))
			return
		}

		h.mu.RLock()
		fn := h.onMetric
		hb := h.onHeartbeat
		h.mu.RUnlock()

		if hb != nil {
			hb(serviceID, msg.AgentVersion, time.Now())
		}
		if fn != nil {
			fn(serviceID, msg)
		}

	case "heartbeat":
		serviceID := msg.ServiceID
		if serviceID == "" {
			serviceID = client.serviceID
		}
		if serviceID == "" {
			return
		}
		h.mu.RLock()
		hb := h.onHeartbeat
		h.mu.RUnlock()
		if hb != nil {
			hb(serviceID, msg.AgentVersion, time.Now())
		}

	case "ack":
		slog.Debug("Agent komut ACK", slog.String("client_id", client.id), slog.String("command_id", msg.CommandID))
		h.BroadcastCommandStatus(client.serviceID, msg.CommandID, "received")

	case "result":
		slog.Debug("Agent komut sonucu", slog.String("client_id", client.id), slog.String("command_id", msg.CommandID), slog.String("status", msg.Status))

		h.mu.RLock()
		fn := h.onCommandResult
		h.mu.RUnlock()

		if fn != nil {
			fn(msg.CommandID, msg.Status, msg)
		}

		h.BroadcastCommandResult(client.serviceID, msg.CommandID, msg.Status, msg.Output, msg.Error)

	case "dependencies":
		serviceID := msg.ServiceID
		if serviceID == "" {
			serviceID = client.serviceID
		}
		if serviceID == "" || len(msg.Dependencies) == 0 {
			return
		}
		h.mu.RLock()
		fn := h.onDependencies
		h.mu.RUnlock()
		if fn != nil {
			fn(serviceID, msg.Dependencies)
		}

	default:
		slog.Warn("Agent bilinmeyen mesaj tipi", slog.String("client_id", client.id), slog.String("type", msg.Type))
	}
}

func (h *Hub) HandleDashboardMessage(client *Client, rawMessage []byte) {
	var msg struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(rawMessage, &msg); err != nil {
		return
	}

	switch msg.Type {
	case "ping":
		pong, _ := json.Marshal(map[string]string{"type": "pong"})
		select {
		case client.send <- pong:
		default:
		}
	default:
		slog.Warn("Dashboard bilinmeyen mesaj tipi", slog.String("client_id", client.id), slog.String("type", msg.Type))
	}
}

// broadcastJSON publishes data to Redis when configured, otherwise sends it to the local broadcast channel.
func (h *Hub) broadcastJSON(serviceID string, data []byte) {
	if h.redisClient != nil {
		ctx := context.Background()
		if err := h.redisClient.Publish(ctx, "nanonet:broadcast:"+serviceID, string(data)).Err(); err != nil {
			slog.Error("Redis broadcast publish hatası", slog.String("error", err.Error()))
		}
		return
	}
	h.broadcast <- data
}

func (h *Hub) BroadcastToDashboards(serviceID string, data interface{}) {
	jsonData, err := json.Marshal(map[string]interface{}{
		"type":       "metric_update",
		"service_id": serviceID,
		"data":       data,
	})
	if err != nil {
		slog.Error("Metrik serialize hatası", slog.String("error", err.Error()))
		return
	}
	h.broadcastJSON(serviceID, jsonData)
}

func (h *Hub) BroadcastAlert(serviceID, alertType, severity, message string) {
	jsonData, err := json.Marshal(map[string]interface{}{
		"type":       "alert",
		"service_id": serviceID,
		"data": map[string]interface{}{
			"alert_type": alertType,
			"severity":   severity,
			"message":    message,
		},
	})
	if err != nil {
		slog.Error("Alert serialize hatası", slog.String("error", err.Error()))
		return
	}
	h.broadcastJSON(serviceID, jsonData)
}

func (h *Hub) BroadcastCommandStatus(serviceID, commandID, status string) {
	h.BroadcastCommandResult(serviceID, commandID, status, nil, nil)
}

func (h *Hub) BroadcastCommandResult(serviceID, commandID, status string, output *string, errMsg *string) {
	msg := map[string]interface{}{
		"type":       "command_status",
		"service_id": serviceID,
		"command_id": commandID,
		"status":     status,
	}
	if output != nil {
		msg["output"] = *output
	}
	if errMsg != nil {
		msg["error"] = *errMsg
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.broadcastJSON(serviceID, jsonData)
}

// SendCommandToAgent — komutu servise bağlı TÜM agent'lara gönderir (multi-instance).
// Hiçbir agent bağlı değilse komut kuyruğa eklenir.
func (h *Hub) SendCommandToAgent(serviceID string, command map[string]interface{}) bool {
	// HMAC imzalama yapılandırılmışsa komut'a nonce + signature alanlarını ekle.
	// Agent tarafı `NANONET_AGENT_SIGN_SECRET` ile çalışıyorsa imzasız komutu
	// reddedecek; bu yüzden imzalamayı serialize öncesi yapıyoruz.
	if h.signer != nil && h.signer.IsEnabled() {
		h.signer.SignInPlace(command)
	}

	jsonData, err := json.Marshal(command)
	if err != nil {
		slog.Error("Komut serialize hatası", slog.String("error", err.Error()))
		return false
	}

	h.mu.RLock()
	var targets []*Client
	for client := range h.agentClients {
		if client.serviceID == serviceID {
			targets = append(targets, client)
		}
	}
	h.mu.RUnlock()

	if len(targets) == 0 {
		cmdID, _ := command["command_id"].(string)
		if h.redisClient != nil {
			// Publish for immediate cross-node delivery to other instances.
			ctx := context.Background()
			h.redisClient.Publish(ctx, "nanonet:cmd:"+serviceID, string(jsonData))
		}
		// Also queue for durability (agent might not be connected anywhere yet).
		h.queueCommand(serviceID, jsonData, cmdID)
		slog.Info("Agent çevrimdışı, komut kuyruğa eklendi", slog.String("service_id", serviceID), slog.String("command_id", cmdID))
		return false
	}

	sentCount := 0
	for _, client := range targets {
		select {
		case client.send <- jsonData:
			sentCount++
			slog.Debug("Komut agent'a gönderildi", slog.String("service_id", serviceID), slog.String("agent_id", client.id))
		default:
			slog.Warn("Agent send buffer dolu", slog.String("agent_id", client.id))
		}
	}

	slog.Debug("Komut agent'lara iletildi", slog.Int("sent", sentCount), slog.Int("total", len(targets)), slog.String("service_id", serviceID))
	return sentCount > 0
}

// queueCommand — agent offline iken komutu kuyruğa ekler.
func (h *Hub) queueCommand(serviceID string, data []byte, commandID string) {
	if h.redisClient != nil {
		ctx := context.Background()
		key := "nanonet:pc:" + serviceID
		h.redisClient.RPush(ctx, key, string(data))
		h.redisClient.Expire(ctx, key, 24*time.Hour)
		return
	}

	// In-memory fallback.
	h.pendingMu.Lock()
	defer h.pendingMu.Unlock()

	queue := h.pendingCommands[serviceID]
	if len(queue) >= 50 {
		queue = queue[1:]
	}

	h.pendingCommands[serviceID] = append(queue, pendingCommand{
		Data:      data,
		CommandID: commandID,
		QueuedAt:  time.Now().UTC().Format(time.RFC3339),
	})
}

// deliverPendingCommands — yeni bağlanan agent'a bekleyen komutları iletir.
func (h *Hub) deliverPendingCommands(client *Client) {
	if h.redisClient != nil {
		ctx := context.Background()
		key := "nanonet:pc:" + client.serviceID
		cmds, err := h.redisClient.LRange(ctx, key, 0, -1).Result()
		if err != nil || len(cmds) == 0 {
			return
		}
		h.redisClient.Del(ctx, key)
		slog.Debug("Redis'ten bekleyen komutlar iletiliyor", slog.String("agent_id", client.id), slog.Int("count", len(cmds)))
		for _, cmd := range cmds {
			select {
			case client.send <- []byte(cmd):
			default:
				slog.Warn("Agent buffer dolu, Redis kuyruk komutu atlandı", slog.String("agent_id", client.id))
			}
		}
		return
	}

	// In-memory fallback.
	h.pendingMu.Lock()
	queue, exists := h.pendingCommands[client.serviceID]
	if !exists || len(queue) == 0 {
		h.pendingMu.Unlock()
		return
	}
	delete(h.pendingCommands, client.serviceID)
	h.pendingMu.Unlock()

	slog.Debug("Bekleyen komutlar iletiliyor", slog.String("agent_id", client.id), slog.Int("count", len(queue)))
	for _, cmd := range queue {
		select {
		case client.send <- cmd.Data:
			slog.Debug("Kuyruktan komut iletildi", slog.String("command_id", cmd.CommandID))
		default:
			slog.Warn("Agent buffer dolu, kuyruk komutu atlandı", slog.String("command_id", cmd.CommandID))
		}
	}
}

// GetConnectedAgentsForService — bir servis için bağlı agent sayısını döndürür.
func (h *Hub) GetConnectedAgentsForService(serviceID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	count := 0
	for client := range h.agentClients {
		if client.serviceID == serviceID {
			count++
		}
	}
	return count
}

// GetPendingCommandCount — bekleyen komut sayısını döndürür.
func (h *Hub) GetPendingCommandCount(serviceID string) int {
	if h.redisClient != nil {
		ctx := context.Background()
		n, _ := h.redisClient.LLen(ctx, "nanonet:pc:"+serviceID).Result()
		return int(n)
	}
	h.pendingMu.Lock()
	defer h.pendingMu.Unlock()
	return len(h.pendingCommands[serviceID])
}

func (h *Hub) IsAgentConnected(serviceID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.agentClients {
		if client.serviceID == serviceID {
			return true
		}
	}
	return false
}

func (h *Hub) GetConnectedAgentCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.agentClients)
}

func (h *Hub) GetConnectedDashboardCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.dashboardClients)
}
