package maintenance

import (
	"time"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

// List returns all maintenance windows for a service.
func (h *Handler) List(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if !h.repo.IsServiceOwner(c.Request.Context(), serviceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	windows, err := h.repo.List(c.Request.Context(), serviceID)
	if err != nil {
		response.InternalError(c, "bakım pencereleri alınamadı")
		return
	}

	response.Success(c, windows)
}

// Create adds a new maintenance window.
func (h *Handler) Create(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	if !h.repo.IsServiceOwner(c.Request.Context(), serviceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}

	startsAt, err := time.Parse(time.RFC3339, req.StartsAt)
	if err != nil {
		response.BadRequest(c, "geçersiz starts_at formatı (RFC3339 bekleniyor)")
		return
	}
	endsAt, err := time.Parse(time.RFC3339, req.EndsAt)
	if err != nil {
		response.BadRequest(c, "geçersiz ends_at formatı (RFC3339 bekleniyor)")
		return
	}
	if !endsAt.After(startsAt) {
		response.BadRequest(c, "ends_at starts_at'den sonra olmalı")
		return
	}

	w := &MaintenanceWindow{
		ServiceID: serviceID,
		StartsAt:  startsAt,
		EndsAt:    endsAt,
		Reason:    req.Reason,
		CreatedBy: &userID,
	}

	if err := h.repo.Create(c.Request.Context(), w); err != nil {
		response.InternalError(c, "bakım penceresi oluşturulamadı")
		return
	}

	response.Created(c, w)
}

// Delete removes a maintenance window.
func (h *Handler) Delete(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis ID")
		return
	}

	windowID, err := uuid.Parse(c.Param("windowId"))
	if err != nil {
		response.BadRequest(c, "geçersiz pencere ID")
		return
	}

	if !h.repo.IsServiceOwner(c.Request.Context(), serviceID, userID) {
		response.NotFound(c, "servis bulunamadı")
		return
	}

	if err := h.repo.Delete(c.Request.Context(), windowID, serviceID); err != nil {
		response.NotFound(c, "bakım penceresi bulunamadı")
		return
	}

	response.Success(c, gin.H{"message": "bakım penceresi silindi"})
}
