package notifications

import (
	"github.com/gin-gonic/gin"

	"nanonet-backend/pkg/response"
)

type PushHandler struct {
	svc *PushService
}

func NewPushHandler(svc *PushService) *PushHandler {
	return &PushHandler{svc: svc}
}

func (h *PushHandler) Register(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	var req RegisterPushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	if err := h.svc.RegisterToken(c.Request.Context(), userID, req.Token, req.Platform); err != nil {
		response.InternalError(c, "token kaydedilemedi")
		return
	}
	response.Created(c, gin.H{"ok": true})
}

func (h *PushHandler) Delete(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	if err := h.svc.DeleteToken(c.Request.Context(), userID, req.Token); err != nil {
		response.InternalError(c, "token silinemedi")
		return
	}
	response.Success(c, gin.H{"ok": true})
}

func (h *PushHandler) GetPreference(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	pref, err := h.svc.GetPreference(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "tercihler alınamadı")
		return
	}
	response.Success(c, pref)
}

func (h *PushHandler) UpdatePreference(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	var req UpdatePushPreferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	pref, _ := h.svc.GetPreference(c.Request.Context(), userID)
	pref.UserID = userID
	if req.Enabled != nil {
		pref.Enabled = *req.Enabled
	}
	if req.MinSeverity != nil {
		pref.MinSeverity = *req.MinSeverity
	}
	if err := h.svc.UpsertPreference(c.Request.Context(), pref); err != nil {
		response.InternalError(c, "tercihler güncellenemedi")
		return
	}
	response.Success(c, pref)
}
