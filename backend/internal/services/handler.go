package services

import (
	"time"

	"nanonet-backend/internal/commands"
	"nanonet-backend/internal/ws"
	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service    *ServiceLayer
	hub        *ws.Hub
	cmdService *commands.Service
}

func NewHandler(db *gorm.DB, hub *ws.Hub) *Handler {
	return &Handler{
		service:    NewServiceLayer(db),
		hub:        hub,
		cmdService: commands.NewService(db),
	}
}

func (h *Handler) Create(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	var req CreateServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	service, err := h.service.Create(c.Request.Context(), userID, req)
	if err != nil {
		response.InternalError(c, "servis oluşturulamadı")
		return
	}

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

	agentConnected := h.hub.IsAgentConnected(id.String())

	response.Success(c, gin.H{
		"service":         service,
		"agent_connected": agentConnected,
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
		response.BadRequest(c, err.Error())
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

	var req struct {
		TimeoutSec int `json:"timeout_sec"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.TimeoutSec = 30
	}
	if req.TimeoutSec <= 0 {
		req.TimeoutSec = 30
	}

	commandID := uuid.New().String()
	command := map[string]interface{}{
		"type":        "command",
		"command_id":  commandID,
		"action":      "restart",
		"timeout_sec": req.TimeoutSec,
	}

	go h.cmdService.LogCommand(c.Request.Context(), id, userID, commandID, "restart", command)

	sent := h.hub.SendCommandToAgent(id.String(), command)
	if !sent {
		response.Error(c, 503, "agent bağlı değil, komut gönderilemedi")
		return
	}

	response.Success(c, gin.H{
		"command_id": commandID,
		"status":     "queued",
		"queued_at":  time.Now(),
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

	commandID := uuid.New().String()
	command := map[string]interface{}{
		"type":       "command",
		"command_id": commandID,
		"action":     "stop",
		"graceful":   *req.Graceful,
	}

	go h.cmdService.LogCommand(c.Request.Context(), id, userID, commandID, "stop", command)

	sent := h.hub.SendCommandToAgent(id.String(), command)
	if !sent {
		response.Error(c, 503, "agent bağlı değil, komut gönderilemedi")
		return
	}

	response.Success(c, gin.H{
		"command_id": commandID,
		"status":     "queued",
		"queued_at":  time.Now(),
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

	if _, err := h.service.Get(c.Request.Context(), id, userID); err != nil {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	agentReachable := h.hub.IsAgentConnected(id.String())

	commandID := uuid.New().String()
	if agentReachable {
		command := map[string]interface{}{
			"type":       "command",
			"command_id": commandID,
			"action":     "ping",
		}
		h.hub.SendCommandToAgent(id.String(), command)
	}

	response.Success(c, gin.H{
		"agent_reachable":   agentReachable,
		"service_reachable": agentReachable,
		"latency_ms":        nil,
	})
}
