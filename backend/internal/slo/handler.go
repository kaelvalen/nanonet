package slo

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"nanonet-backend/pkg/ownership"
	"nanonet-backend/pkg/response"
)

type Handler struct {
	service *Service
	db      *gorm.DB
}

func NewHandler(svc *Service, db *gorm.DB) *Handler {
	return &Handler{service: svc, db: db}
}

func (h *Handler) List(c *gin.Context) {
	userID, ok := mustUser(c)
	if !ok {
		return
	}
	if sid := c.Query("service_id"); sid != "" {
		serviceID, err := uuid.Parse(sid)
		if err != nil {
			response.BadRequest(c, "geçersiz service_id")
			return
		}
		out, err := h.service.ListByService(c.Request.Context(), userID, serviceID)
		if err != nil {
			response.InternalError(c, "SLO listesi alınamadı")
			return
		}
		response.Success(c, gin.H{"slos": coalesce(out)})
		return
	}
	out, err := h.service.ListByUser(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "SLO listesi alınamadı")
		return
	}
	response.Success(c, gin.H{"slos": coalesce(out)})
}

func (h *Handler) Create(c *gin.Context) {
	userID, ok := mustUser(c)
	if !ok {
		return
	}
	var req CreateSLORequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	if !ownership.IsServiceOwner(c.Request.Context(), h.db, req.ServiceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}
	sl := &SLO{
		UserID:     userID,
		ServiceID:  req.ServiceID,
		Name:       req.Name,
		SLIType:    req.SLIType,
		Threshold:  req.Threshold,
		Target:     req.Target,
		WindowDays: req.WindowDays,
		Enabled:    true,
	}
	if err := h.service.Create(c.Request.Context(), sl); err != nil {
		response.InternalError(c, "SLO oluşturulamadı")
		return
	}
	response.Created(c, sl)
}

func (h *Handler) Update(c *gin.Context) {
	userID, ok := mustUser(c)
	if !ok {
		return
	}
	id, ok := mustID(c)
	if !ok {
		return
	}
	sl, err := h.service.Get(c.Request.Context(), userID, id)
	if err != nil {
		respondNotFoundOr(c, err, "SLO bulunamadı")
		return
	}
	var req UpdateSLORequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	if req.Name != nil {
		sl.Name = *req.Name
	}
	if req.SLIType != nil {
		sl.SLIType = *req.SLIType
	}
	if req.Threshold != nil {
		sl.Threshold = req.Threshold
	}
	if req.Target != nil {
		sl.Target = *req.Target
	}
	if req.WindowDays != nil {
		sl.WindowDays = *req.WindowDays
	}
	if req.Enabled != nil {
		sl.Enabled = *req.Enabled
	}
	if err := h.service.Update(c.Request.Context(), sl); err != nil {
		response.InternalError(c, "SLO güncellenemedi")
		return
	}
	response.Success(c, sl)
}

func (h *Handler) Delete(c *gin.Context) {
	userID, ok := mustUser(c)
	if !ok {
		return
	}
	id, ok := mustID(c)
	if !ok {
		return
	}
	if err := h.service.Delete(c.Request.Context(), userID, id); err != nil {
		respondNotFoundOr(c, err, "SLO bulunamadı")
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

func (h *Handler) Compliance(c *gin.Context) {
	userID, ok := mustUser(c)
	if !ok {
		return
	}
	id, ok := mustID(c)
	if !ok {
		return
	}
	sl, err := h.service.Get(c.Request.Context(), userID, id)
	if err != nil {
		respondNotFoundOr(c, err, "SLO bulunamadı")
		return
	}
	out, err := h.service.ComputeCompliance(c.Request.Context(), sl)
	if err != nil {
		response.InternalError(c, "uyumluluk hesaplanamadı")
		return
	}
	response.Success(c, out)
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

func coalesce(s []SLO) []SLO {
	if s == nil {
		return []SLO{}
	}
	return s
}
