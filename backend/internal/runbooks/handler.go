package runbooks

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"nanonet-backend/pkg/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	out, err := h.svc.List(c.Request.Context(), uid)
	if err != nil {
		response.InternalError(c, "runbook'lar alınamadı")
		return
	}
	if out == nil {
		out = []Runbook{}
	}
	response.Success(c, gin.H{"runbooks": out})
}

func (h *Handler) Create(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	b, err := h.svc.Create(c.Request.Context(), uid, req)
	if err != nil {
		response.InternalError(c, "runbook oluşturulamadı")
		return
	}
	response.Created(c, gin.H{"runbook": b})
}

func (h *Handler) Update(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	id, ok := mustID(c)
	if !ok {
		return
	}
	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	b, err := h.svc.Update(c.Request.Context(), uid, id, req)
	if err != nil {
		respondNotFoundOr(c, err, "runbook bulunamadı")
		return
	}
	response.Success(c, gin.H{"runbook": b})
}

func (h *Handler) Delete(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	id, ok := mustID(c)
	if !ok {
		return
	}
	if err := h.svc.Delete(c.Request.Context(), uid, id); err != nil {
		respondNotFoundOr(c, err, "runbook bulunamadı")
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

func (h *Handler) Fires(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	id, ok := mustID(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	out, err := h.svc.Fires(c.Request.Context(), uid, id, limit)
	if err != nil {
		respondNotFoundOr(c, err, "runbook bulunamadı")
		return
	}
	if out == nil {
		out = []Fire{}
	}
	response.Success(c, gin.H{"fires": out})
}

func mustUser(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return uuid.Nil, false
	}
	return id, true
}

func mustID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz ID")
		return uuid.Nil, false
	}
	return id, true
}

func respondNotFoundOr(c *gin.Context, err error, msg string) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFound(c, msg)
		return
	}
	response.InternalError(c, "veritabanı hatası")
}
