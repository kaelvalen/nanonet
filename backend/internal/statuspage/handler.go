package statuspage

import (
	"errors"
	"strings"

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

// ── Authenticated CRUD ─────────────────────────────────────────────

func (h *Handler) List(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	out, err := h.svc.List(c.Request.Context(), uid)
	if err != nil {
		response.InternalError(c, "status sayfaları alınamadı")
		return
	}
	if out == nil {
		out = []StatusPage{}
	}
	response.Success(c, gin.H{"pages": out})
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
	slug := strings.ToLower(strings.TrimSpace(req.Slug))
	avail, err := h.svc.SlugAvailable(c.Request.Context(), slug, nil)
	if err != nil {
		response.InternalError(c, "slug doğrulanamadı")
		return
	}
	if !avail {
		response.BadRequest(c, "slug zaten kullanımda")
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	p := &StatusPage{
		UserID:      uid,
		Slug:        slug,
		Title:       req.Title,
		Description: req.Description,
		ServiceIDs:  req.ServiceIDs,
		Enabled:     enabled,
	}
	if err := h.svc.Create(c.Request.Context(), p); err != nil {
		response.InternalError(c, "oluşturulamadı")
		return
	}
	response.Created(c, p)
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
	p, err := h.svc.Get(c.Request.Context(), uid, id)
	if err != nil {
		respondNotFoundOr(c, err, "status sayfası bulunamadı")
		return
	}
	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	if req.Title != nil {
		p.Title = *req.Title
	}
	if req.Description != nil {
		p.Description = req.Description
	}
	if req.ServiceIDs != nil {
		p.ServiceIDs = req.ServiceIDs
	}
	if req.Enabled != nil {
		p.Enabled = *req.Enabled
	}
	if err := h.svc.Update(c.Request.Context(), p); err != nil {
		response.InternalError(c, "güncellenemedi")
		return
	}
	response.Success(c, p)
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
		respondNotFoundOr(c, err, "status sayfası bulunamadı")
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

// ── Public read-only ───────────────────────────────────────────────

func (h *Handler) Public(c *gin.Context) {
	slug := strings.ToLower(strings.TrimSpace(c.Param("slug")))
	if slug == "" {
		response.BadRequest(c, "slug zorunlu")
		return
	}
	view, err := h.svc.BuildPublicView(c.Request.Context(), slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "status sayfası bulunamadı")
			return
		}
		response.InternalError(c, "status sayfası oluşturulamadı")
		return
	}
	c.Header("Cache-Control", "public, max-age=15")
	response.Success(c, view)
}

// helpers
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
