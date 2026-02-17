package services

import (
	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service *ServiceLayer
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		service: NewServiceLayer(db),
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

	response.Success(c, service)
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

	response.Success(c, services)
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
	response.Success(c, gin.H{"message": "restart komutu gönderildi"})
}

func (h *Handler) Stop(c *gin.Context) {
	response.Success(c, gin.H{"message": "stop komutu gönderildi"})
}
