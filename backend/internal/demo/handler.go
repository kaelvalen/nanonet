package demo

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"nanonet-backend/pkg/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Seed populates the current user with demo services + 6h of metrics history.
// Returns 409 Conflict if the user already has services so the UI can offer
// guidance instead of silently no-op'ing.
func (h *Handler) Seed(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "kullanıcı doğrulanamadı")
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "geçersiz user_id")
		return
	}
	ids, err := h.svc.Seed(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrAlreadySeeded) {
			response.Error(c, http.StatusConflict, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, "demo verisi yüklenemedi: "+err.Error())
		return
	}
	response.Success(c, gin.H{
		"created_count":       len(ids),
		"created_service_ids": ids,
	})
}
