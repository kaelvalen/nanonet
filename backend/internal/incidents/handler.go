package incidents

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

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	out, err := h.svc.List(c.Request.Context(), uid, limit)
	if err != nil {
		response.InternalError(c, "incidents alınamadı")
		return
	}
	response.Success(c, gin.H{"incidents": out})
}

func (h *Handler) Get(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	id, ok := mustID(c)
	if !ok {
		return
	}
	out, err := h.svc.Detail(c.Request.Context(), uid, id)
	if err != nil {
		respondNotFoundOr(c, err, "incident bulunamadı")
		return
	}
	response.Success(c, out)
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
	out, err := h.svc.Update(c.Request.Context(), uid, id, req)
	if err != nil {
		respondNotFoundOr(c, err, "incident bulunamadı")
		return
	}
	response.Success(c, out)
}

func (h *Handler) Resolve(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	id, ok := mustID(c)
	if !ok {
		return
	}
	out, err := h.svc.Resolve(c.Request.Context(), uid, id)
	if err != nil {
		respondNotFoundOr(c, err, "incident bulunamadı")
		return
	}
	response.Success(c, out)
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
		respondNotFoundOr(c, err, "incident bulunamadı")
		return
	}
	response.Success(c, gin.H{"deleted": true})
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
