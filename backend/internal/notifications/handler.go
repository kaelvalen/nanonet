package notifications

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"nanonet-backend/pkg/audit"
	"nanonet-backend/pkg/response"
)

type Handler struct {
	service *Service
	audit   *audit.Logger
}

func NewHandler(svc *Service, db *gorm.DB) *Handler {
	return &Handler{service: svc, audit: audit.New(db)}
}

func (h *Handler) List(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	out, err := h.service.List(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "kanallar alınamadı")
		return
	}
	if out == nil {
		out = []Channel{}
	}
	response.Success(c, gin.H{"channels": out})
}

func (h *Handler) Create(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	var req CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	cooldown := 300
	if req.CooldownSec != nil {
		cooldown = *req.CooldownSec
	}
	severities := req.Severities
	if len(severities) == 0 {
		severities = []string{"warn", "crit"}
	}

	ch := &Channel{
		UserID:      userID,
		Name:        req.Name,
		Type:        req.Type,
		Enabled:     enabled,
		Config:      req.Config,
		Severities:  severities,
		ServiceIDs:  req.ServiceIDs,
		CooldownSec: cooldown,
	}
	if err := h.service.Create(c.Request.Context(), ch); err != nil {
		response.InternalError(c, "kanal oluşturulamadı")
		return
	}

	h.audit.Record(c.Request.Context(), audit.Entry{
		UserID: &userID, Action: "notification.create", ResourceType: "notification_channel",
		ResourceID: &ch.ID, IPAddress: c.ClientIP(), UserAgent: c.GetHeader("User-Agent"),
		Status:  audit.StatusSuccess,
		Details: map[string]any{"type": ch.Type, "name": ch.Name},
	})

	response.Created(c, ch)
}

func (h *Handler) Update(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c)
	if !ok {
		return
	}

	ch, err := h.service.Get(c.Request.Context(), userID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "kanal bulunamadı")
			return
		}
		response.InternalError(c, "kanal okunamadı")
		return
	}

	var req UpdateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	if req.Name != nil {
		ch.Name = *req.Name
	}
	if req.Enabled != nil {
		ch.Enabled = *req.Enabled
	}
	if req.Config != nil {
		ch.Config = req.Config
	}
	if req.Severities != nil {
		ch.Severities = req.Severities
	}
	if req.ServiceIDs != nil {
		ch.ServiceIDs = req.ServiceIDs
	}
	if req.CooldownSec != nil {
		ch.CooldownSec = *req.CooldownSec
	}

	if err := h.service.Update(c.Request.Context(), ch); err != nil {
		response.InternalError(c, "kanal güncellenemedi")
		return
	}
	response.Success(c, ch)
}

func (h *Handler) Delete(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c)
	if !ok {
		return
	}
	if err := h.service.Delete(c.Request.Context(), userID, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "kanal bulunamadı")
			return
		}
		response.InternalError(c, "kanal silinemedi")
		return
	}
	h.audit.Record(c.Request.Context(), audit.Entry{
		UserID: &userID, Action: "notification.delete", ResourceType: "notification_channel",
		ResourceID: &id, IPAddress: c.ClientIP(), UserAgent: c.GetHeader("User-Agent"),
		Status: audit.StatusSuccess,
	})
	response.Success(c, gin.H{"deleted": true})
}

func (h *Handler) Test(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c)
	if !ok {
		return
	}
	ch, err := h.service.Get(c.Request.Context(), userID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "kanal bulunamadı")
			return
		}
		response.InternalError(c, "kanal okunamadı")
		return
	}
	if err := h.service.SendTest(c.Request.Context(), ch); err != nil {
		response.Error(c, 502, "Test gönderimi başarısız: "+err.Error())
		return
	}
	response.Success(c, gin.H{"sent": true})
}

func (h *Handler) Deliveries(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	id, ok := parseID(c)
	if !ok {
		return
	}
	if _, err := h.service.Get(c.Request.Context(), userID, id); err != nil {
		response.NotFound(c, "kanal bulunamadı")
		return
	}
	limit := 50
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}
	out, err := h.service.Deliveries(c.Request.Context(), id, limit)
	if err != nil {
		response.InternalError(c, "geçmiş alınamadı")
		return
	}
	if out == nil {
		out = []Delivery{}
	}
	response.Success(c, gin.H{"deliveries": out})
}

func parseUser(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return uuid.Nil, false
	}
	return id, true
}

func parseID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz kanal ID")
		return uuid.Nil, false
	}
	return id, true
}
