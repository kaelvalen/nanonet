package ws

import (
	"encoding/json"
	"log"
	"sync"
)

type AgentMessage struct {
	Type      string                 `json:"type"`
	AgentID   string                 `json:"agent_id,omitempty"`
	ServiceID string                 `json:"service_id,omitempty"`
	CommandID string                 `json:"command_id,omitempty"`
	Status    string                 `json:"status,omitempty"`
	Output    *string                `json:"output,omitempty"`
	Error     *string                `json:"error,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	System    map[string]interface{} `json:"system,omitempty"`
	App       map[string]interface{} `json:"app,omitempty"`
	Service   map[string]interface{} `json:"service,omitempty"`
	Process   map[string]interface{} `json:"process,omitempty"`
	Timestamp string                 `json:"timestamp,omitempty"`
}

type OnMetricFunc func(serviceID string, msg AgentMessage)
type OnCommandResultFunc func(commandID, status string, msg AgentMessage)

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

	// pendingCommands — agent çevrimdışıyken biriken komutlar.
	// Agent tekrar bağlandığında otomatik olarak iletilir.
	pendingCommands map[string][]pendingCommand // serviceID -> []command
	pendingMu       sync.Mutex
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
	}
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

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			totalConnections := len(h.dashboardClients) + len(h.agentClients)
			if totalConnections >= h.maxConnections {
				log.Printf("[WARN] Max bağlantı limiti aşıldı (%d), bağlantı reddedildi: %s", h.maxConnections, client.id)
				close(client.send)
				h.mu.Unlock()
				break
			}
			if client.clientType == AgentClient {
				h.agentClients[client] = true
				log.Printf("Agent bağlandı: %s (service: %s)", client.id, client.serviceID)
				h.mu.Unlock()
				// Bağlanan agent için bekleyen komutları ilet
				h.deliverPendingCommands(client)
			} else {
				h.dashboardClients[client] = true
				log.Printf("Dashboard client bağlandı: %s (user: %s)", client.id, client.userID)
				h.mu.Unlock()
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if client.clientType == AgentClient {
				if _, ok := h.agentClients[client]; ok {
					delete(h.agentClients, client)
					close(client.send)
					log.Printf("Agent ayrıldı: %s (service: %s)", client.id, client.serviceID)
				}
			} else {
				if _, ok := h.dashboardClients[client]; ok {
					delete(h.dashboardClients, client)
					close(client.send)
					log.Printf("Dashboard client ayrıldı: %s", client.id)
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

func (h *Hub) HandleAgentMessage(client *Client, rawMessage []byte) {
	var msg AgentMessage
	if err := json.Unmarshal(rawMessage, &msg); err != nil {
		log.Printf("Agent mesaj parse hatası [%s]: %v", client.id, err)
		return
	}

	switch msg.Type {
	case "metrics":
		serviceID := msg.ServiceID
		if serviceID == "" {
			serviceID = client.serviceID
		}
		if serviceID == "" {
			log.Printf("Agent %s: metrik mesajında service_id eksik", client.id)
			return
		}

		h.mu.RLock()
		fn := h.onMetric
		h.mu.RUnlock()

		if fn != nil {
			// fn (handleAgentMetric) normalizes the data and broadcasts to dashboards
			fn(serviceID, msg)
		}

	case "ack":
		log.Printf("Agent %s: komut ACK alındı (command_id: %s)", client.id, msg.CommandID)
		h.BroadcastCommandStatus(client.serviceID, msg.CommandID, "received")

	case "result":
		log.Printf("Agent %s: komut sonucu alındı (command_id: %s, status: %s)", client.id, msg.CommandID, msg.Status)

		h.mu.RLock()
		fn := h.onCommandResult
		h.mu.RUnlock()

		if fn != nil {
			fn(msg.CommandID, msg.Status, msg)
		}

		h.BroadcastCommandResult(client.serviceID, msg.CommandID, msg.Status, msg.Output, msg.Error)

	default:
		log.Printf("Agent %s: bilinmeyen mesaj tipi: %s", client.id, msg.Type)
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
		log.Printf("Dashboard client %s: bilinmeyen mesaj tipi: %s", client.id, msg.Type)
	}
}

func (h *Hub) BroadcastToDashboards(serviceID string, data interface{}) {
	message := map[string]interface{}{
		"type":       "metric_update",
		"service_id": serviceID,
		"data":       data,
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		log.Printf("Metrik serialize hatası: %v", err)
		return
	}

	h.broadcast <- jsonData
}

func (h *Hub) BroadcastAlert(serviceID, alertType, severity, message string) {
	alertMsg := map[string]interface{}{
		"type":       "alert",
		"service_id": serviceID,
		"data": map[string]interface{}{
			"alert_type": alertType,
			"severity":   severity,
			"message":    message,
		},
	}

	jsonData, err := json.Marshal(alertMsg)
	if err != nil {
		log.Printf("Alert serialize hatası: %v", err)
		return
	}

	h.broadcast <- jsonData
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

	h.broadcast <- jsonData
}

// SendCommandToAgent — komutu servise bağlı TÜM agent'lara gönderir (multi-instance).
// Hiçbir agent bağlı değilse komut kuyruğa eklenir.
func (h *Hub) SendCommandToAgent(serviceID string, command map[string]interface{}) bool {
	jsonData, err := json.Marshal(command)
	if err != nil {
		log.Printf("Komut serialize hatası: %v", err)
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

	// Agent bağlı değilse kuyruğa ekle
	if len(targets) == 0 {
		cmdID, _ := command["command_id"].(string)
		h.queueCommand(serviceID, jsonData, cmdID)
		log.Printf("Agent çevrimdışı, komut kuyruğa eklendi: service=%s, command_id=%s", serviceID, cmdID)
		return false
	}

	// Tüm eşleşen agent'lara gönder
	sentCount := 0
	for _, client := range targets {
		select {
		case client.send <- jsonData:
			sentCount++
			log.Printf("Komut agent'a gönderildi: service=%s, agent=%s", serviceID, client.id)
		default:
			log.Printf("Agent send buffer dolu: %s", client.id)
		}
	}

	log.Printf("Komut %d/%d agent'a iletildi: service=%s", sentCount, len(targets), serviceID)
	return sentCount > 0
}

// queueCommand — agent offline iken komutu kuyruğa ekler.
func (h *Hub) queueCommand(serviceID string, data []byte, commandID string) {
	h.pendingMu.Lock()
	defer h.pendingMu.Unlock()

	// Kuyruk boyutunu sınırla (servis başına max 50 komut)
	queue := h.pendingCommands[serviceID]
	if len(queue) >= 50 {
		// En eski komutu çıkar
		queue = queue[1:]
	}

	h.pendingCommands[serviceID] = append(queue, pendingCommand{
		Data:      data,
		CommandID: commandID,
	})
}

// deliverPendingCommands — yeni bağlanan agent'a bekleyen komutları iletir.
func (h *Hub) deliverPendingCommands(client *Client) {
	h.pendingMu.Lock()
	queue, exists := h.pendingCommands[client.serviceID]
	if !exists || len(queue) == 0 {
		h.pendingMu.Unlock()
		return
	}
	// Kuyruğu temizle
	delete(h.pendingCommands, client.serviceID)
	h.pendingMu.Unlock()

	log.Printf("Agent %s için %d bekleyen komut iletiliyor", client.id, len(queue))
	for _, cmd := range queue {
		select {
		case client.send <- cmd.Data:
			log.Printf("Kuyruktan komut iletildi: command_id=%s", cmd.CommandID)
		default:
			log.Printf("Agent buffer dolu, kuyruk komutu atlanıyor: command_id=%s", cmd.CommandID)
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
