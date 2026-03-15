package audit

import (
	"net/http"
	"strconv"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Handler — audit log HTTP handler'ı.
// main.go'daki standalone handleAuditLogs fonksiyonu buraya taşındı.
type Handler struct {
	db *gorm.DB
}

// NewHandler — yeni audit handler oluşturur.
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

// GetLogs — GET /api/v1/audit
// Kimliği doğrulanmış kullanıcının kendi audit loglarını döndürür.
// Admin rolü için tüm logları görmek üzere genişletilebilir.
func (h *Handler) GetLogs(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return
	}

	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	var logs []Log
	var total int64

	q := h.db.WithContext(c.Request.Context()).
		Where("user_id = ?", userID).
		Order("created_at DESC")

	q.Model(&Log{}).Count(&total)
	if err := q.Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		response.InternalError(c, "audit loglar alınamadı")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"logs":   logs,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}
