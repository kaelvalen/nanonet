package security

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	repo *Repository
	db   *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		repo: NewRepository(db),
		db:   db,
	}
}

// GetOverview GET /api/v1/security/overview
// Kullanıcıya ait tüm servislerin son tarama özetini ve agrega istatistikleri döndürür.
func (h *Handler) GetOverview(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "yetkisiz"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	type svcMeta struct {
		ID   uuid.UUID
		Name string
		Host string
		Port int
	}
	var svcs []svcMeta
	if err := h.db.WithContext(ctx).
		Table("services").
		Select("id, name, host, port").
		Where("user_id = ?", userID).
		Scan(&svcs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "servisler alınamadı"})
		return
	}

	latestScans, err := h.repo.GetLatestPerService(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "taramalar alınamadı"})
		return
	}

	scanByService := make(map[uuid.UUID]*Scan, len(latestScans))
	for i := range latestScans {
		scanByService[latestScans[i].ServiceID] = &latestScans[i]
	}

	var totalScore float64
	var scoredCount, tlsWarnings, headerIssues int

	summaries := make([]ServiceScanSummary, 0, len(svcs))
	for _, svc := range svcs {
		summary := ServiceScanSummary{
			ServiceID:   svc.ID,
			ServiceName: svc.Name,
			ServiceHost: svc.Host,
			ServicePort: svc.Port,
			LatestScan:  scanByService[svc.ID],
		}
		if sc := summary.LatestScan; sc != nil {
			totalScore += sc.RiskScore
			scoredCount++
			if sc.TLSEnabled && (!sc.TLSValid || (sc.TLSDaysLeft != nil && *sc.TLSDaysLeft < 30)) {
				tlsWarnings++
			}
			headerIssues += len(sc.MissingHeaders)
		}
		summaries = append(summaries, summary)
	}

	avg := 0.0
	if scoredCount > 0 {
		avg = totalScore / float64(scoredCount)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": OverviewResponse{
			SecurityScore: avg,
			TLSWarnings:   tlsWarnings,
			HeaderIssues:  headerIssues,
			Services:      summaries,
		},
	})
}

// GetServiceScans GET /api/v1/services/:id/security/scans
func (h *Handler) GetServiceScans(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "yetkisiz"})
		return
	}

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "geçersiz servis id"})
		return
	}

	var count int64
	h.db.Table("services").Where("id = ? AND user_id = ?", serviceID, userID).Count(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "erişim reddedildi"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	scans, err := h.repo.GetForService(ctx, serviceID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "taramalar alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"scans": scans}})
}

// TriggerScan POST /api/v1/services/:id/security/scan
func (h *Handler) TriggerScan(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "yetkisiz"})
		return
	}

	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "geçersiz servis id"})
		return
	}

	var svc struct {
		ID             uuid.UUID
		Host           string
		Port           int
		HealthEndpoint string
	}
	if err := h.db.Table("services").
		Select("id, host, port, health_endpoint").
		Where("id = ? AND user_id = ?", serviceID, userID).
		First(&svc).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "servis bulunamadı"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	scan, err := scanService(ctx, serviceRow{
		ID:             svc.ID,
		Host:           svc.Host,
		Port:           svc.Port,
		HealthEndpoint: svc.HealthEndpoint,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "tarama başarısız"})
		return
	}

	if err := h.repo.Save(ctx, scan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "tarama kaydedilemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"scan": scan}})
}
