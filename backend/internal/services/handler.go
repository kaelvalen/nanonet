package services

import (
	"encoding/json"
	"log/slog"
	"time"

	"nanonet-backend/internal/commands"
	"nanonet-backend/internal/ws"
	"nanonet-backend/pkg/audit"
	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service    *ServiceLayer
	hub        *ws.Hub
	cmdService *commands.Service
	audit      *audit.Logger
}

func NewHandler(db *gorm.DB, hub *ws.Hub) *Handler {
	return &Handler{
		service:    NewServiceLayer(db),
		hub:        hub,
		cmdService: commands.NewService(db),
		audit:      audit.New(db),
	}
}

// sendCommand creates a command, logs it, sends it to the agent, and writes the response.
// Returns false if LogCommand failed (response already written).
func (h *Handler) sendCommand(c *gin.Context, id, userID uuid.UUID, action string, payload map[string]interface{}) (commandID, status string, sent bool, ok bool) {
	commandID = uuid.New().String()
	command := map[string]interface{}{
		"type":       "command",
		"command_id": commandID,
		"action":     action,
	}
	for k, v := range payload {
		command[k] = v
	}

	if err := h.cmdService.LogCommand(c.Request.Context(), id, userID, commandID, action, command); err != nil {
		response.InternalError(c, "komut kaydedilemedi")
		return "", "", false, false
	}

	sent = h.hub.SendCommandToAgent(id.String(), command)
	if sent {
		status = "sent"
	} else {
		status = "queued"
	}
	dbStatus := "queued"
	if sent {
		dbStatus = "sent"
	}
	if err := h.cmdService.UpdateStatus(c.Request.Context(), commandID, dbStatus, nil); err != nil {
		slog.Warn("komut durumu güncellenemedi", slog.String("command_id", commandID), slog.String("error", err.Error()))
	}
	return commandID, status, sent, true
}

func (h *Handler) Create(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	var req CreateServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	service, err := h.service.Create(c.Request.Context(), userID, req)
	if err != nil {
		response.InternalError(c, "servis oluşturulamadı")
		return
	}

	h.audit.Record(c.Request.Context(), audit.Entry{
		UserID:       &userID,
		Action:       audit.ActionServiceCreate,
		ResourceType: "service",
		ResourceID:   &service.ID,
		IPAddress:    c.ClientIP(),
		UserAgent:    c.GetHeader("User-Agent"),
		Status:       audit.StatusSuccess,
		Details:      map[string]any{"name": service.Name, "host": service.Host, "port": service.Port},
	})

	response.Created(c, service)
}

func (h *Handler) Get(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	service, err := h.service.Get(c.Request.Context(), id, userID)
	if err != nil {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	type serviceWithAgent struct {
		Service
		AgentConnected bool `json:"agent_connected"`
	}

	response.Success(c, serviceWithAgent{
		Service:        *service,
		AgentConnected: h.hub.IsAgentConnected(id.String()),
	})
}

func (h *Handler) List(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	services, err := h.service.List(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "servisler listelenemedi")
		return
	}

	type serviceWithAgent struct {
		Service
		AgentConnected bool `json:"agent_connected"`
	}

	result := make([]serviceWithAgent, 0, len(services))
	for _, svc := range services {
		result = append(result, serviceWithAgent{
			Service:        svc,
			AgentConnected: h.hub.IsAgentConnected(svc.ID.String()),
		})
	}

	response.Success(c, result)
}

func (h *Handler) Update(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	var req UpdateServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	service, err := h.service.Update(c.Request.Context(), id, userID, req)
	if err != nil {
		response.InternalError(c, "servis güncellenemedi")
		return
	}

	response.Success(c, service)
}

func (h *Handler) Delete(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if err := h.service.Delete(c.Request.Context(), id, userID); err != nil {
		response.InternalError(c, "servis silinemedi")
		return
	}

	h.audit.Record(c.Request.Context(), audit.Entry{
		UserID:       &userID,
		Action:       audit.ActionServiceDelete,
		ResourceType: "service",
		ResourceID:   &id,
		IPAddress:    c.ClientIP(),
		UserAgent:    c.GetHeader("User-Agent"),
		Status:       audit.StatusSuccess,
	})

	response.Success(c, gin.H{"message": "servis silindi"})
}

func (h *Handler) Restart(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if _, err := h.service.Get(c.Request.Context(), id, userID); err != nil {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	// Aynı anda birden fazla restart komutu gönderilmesini engelle
	if inFlight, err := h.cmdService.HasInFlightCommand(c.Request.Context(), id, "restart"); err == nil && inFlight {
		response.Error(c, 409, "bu servis için zaten bir restart komutu beklemede")
		return
	}

	var req struct {
		TimeoutSec int `json:"timeout_sec"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.TimeoutSec = 30
	}
	if req.TimeoutSec <= 0 {
		req.TimeoutSec = 30
	}

	cmdID, status, sent, ok := h.sendCommand(c, id, userID, "restart", map[string]interface{}{"timeout_sec": req.TimeoutSec})
	if !ok {
		return
	}
	response.Success(c, gin.H{
		"command_id":      cmdID,
		"status":          status,
		"queued_at":       time.Now(),
		"agent_connected": sent,
	})
}

func (h *Handler) Stop(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if _, err := h.service.Get(c.Request.Context(), id, userID); err != nil {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	// Aynı anda birden fazla stop komutu gönderilmesini engelle
	if inFlight, err := h.cmdService.HasInFlightCommand(c.Request.Context(), id, "stop"); err == nil && inFlight {
		response.Error(c, 409, "bu servis için zaten bir stop komutu beklemede")
		return
	}

	var req struct {
		Graceful *bool `json:"graceful"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		defaultGraceful := true
		req.Graceful = &defaultGraceful
	}
	if req.Graceful == nil {
		defaultGraceful := true
		req.Graceful = &defaultGraceful
	}

	cmdID, status, sent, ok := h.sendCommand(c, id, userID, "stop", map[string]interface{}{"graceful": *req.Graceful})
	if !ok {
		return
	}
	response.Success(c, gin.H{
		"command_id":      cmdID,
		"status":          status,
		"queued_at":       time.Now(),
		"agent_connected": sent,
	})
}

func (h *Handler) Exec(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if _, err := h.service.Get(c.Request.Context(), id, userID); err != nil {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	var req struct {
		Command    string `json:"command" binding:"required"`
		TimeoutSec int    `json:"timeout_sec"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	if req.TimeoutSec <= 0 {
		req.TimeoutSec = 30
	}
	if req.TimeoutSec > 300 {
		req.TimeoutSec = 300
	}

	cmdID, status, sent, ok := h.sendCommand(c, id, userID, "exec", map[string]interface{}{
		"command":     req.Command,
		"timeout_sec": req.TimeoutSec,
	})
	if !ok {
		return
	}
	response.Success(c, gin.H{
		"command_id":      cmdID,
		"status":          status,
		"queued_at":       time.Now(),
		"agent_connected": sent,
	})
}

func (h *Handler) Start(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if _, err := h.service.Get(c.Request.Context(), id, userID); err != nil {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	cmdID, status, sent, ok := h.sendCommand(c, id, userID, "start", nil)
	if !ok {
		return
	}
	response.Success(c, gin.H{
		"command_id":      cmdID,
		"status":          status,
		"queued_at":       time.Now(),
		"agent_connected": sent,
	})
}

func (h *Handler) Scale(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if _, err := h.service.Get(c.Request.Context(), id, userID); err != nil {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	var req struct {
		Instances  int    `json:"instances" binding:"required,min=0,max=32"`
		Strategy   string `json:"strategy"`
		WeightJSON string `json:"weight_config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	if req.Strategy == "" {
		req.Strategy = "round_robin"
	}
	allowedStrategies := map[string]bool{
		"round_robin": true,
		"least_conn":  true,
		"ip_hash":     true,
		"random":      true,
		"weighted":    true,
	}
	if !allowedStrategies[req.Strategy] {
		response.BadRequest(c, "geçersiz strateji — izin verilenler: round_robin, least_conn, ip_hash, random, weighted")
		return
	}

	cmdID, status, sent, ok := h.sendCommand(c, id, userID, "scale", map[string]interface{}{
		"instances":     req.Instances,
		"strategy":      req.Strategy,
		"weight_config": req.WeightJSON,
	})
	if !ok {
		return
	}
	response.Success(c, gin.H{
		"command_id":      cmdID,
		"status":          status,
		"instances":       req.Instances,
		"strategy":        req.Strategy,
		"queued_at":       time.Now(),
		"agent_connected": sent,
	})
}

func (h *Handler) Ping(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	svc, err := h.service.Get(c.Request.Context(), id, userID)
	if err != nil {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	agentReachable := h.hub.IsAgentConnected(id.String())

	var latencyMs *float64
	commandID := uuid.New().String()
	if agentReachable {
		start := time.Now()
		command := map[string]interface{}{
			"type":       "command",
			"command_id": commandID,
			"action":     "ping",
		}
		h.hub.SendCommandToAgent(id.String(), command)
		elapsed := float64(time.Since(start).Microseconds()) / 1000.0
		latencyMs = &elapsed
	}

	serviceStatus := svc.Status
	serviceReachable := serviceStatus == "up" || serviceStatus == "degraded"

	response.Success(c, gin.H{
		"agent_reachable":   agentReachable,
		"service_reachable": serviceReachable,
		"latency_ms":        latencyMs,
	})
}

// GetMap — GET /api/v1/services/map
// Returns the saved service map layout (nodes + edges) for the authenticated user.
func (h *Handler) GetMap(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	data, err := h.service.GetServiceMap(c.Request.Context(), userID)
	if err != nil || data == nil {
		response.Success(c, nil)
		return
	}

	response.Success(c, data)
}

// SaveMap — PUT /api/v1/services/map
// Persists the service map layout (nodes + edges) for the authenticated user.
func (h *Handler) SaveMap(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	var payload json.RawMessage
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.BadRequest(c, "geçersiz istek gövdesi")
		return
	}

	if err := h.service.SaveServiceMap(c.Request.Context(), userID, payload); err != nil {
		response.InternalError(c, "harita kaydedilemedi")
		return
	}

	response.Success(c, gin.H{"message": "harita kaydedildi"})
}
