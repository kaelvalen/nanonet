package logs

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler — HTTP handler'ları
type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

// GetServiceLogs GET /services/:id/logs
func (h *Handler) GetServiceLogs(c *gin.Context) {
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "geçersiz service id"})
		return
	}

	opts := parseQueryOpts(c)
	rows, err := h.repo.GetByService(c.Request.Context(), serviceID, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logs": rows})
}

// SearchAll GET /logs
func (h *Handler) SearchAll(c *gin.Context) {
	opts := parseQueryOpts(c)
	rows, err := h.repo.SearchAll(c.Request.Context(), opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logs": rows})
}

// GetStats GET /logs/stats
func (h *Handler) GetStats(c *gin.Context) {
	sinceStr := c.Query("since")
	since := time.Now().Add(-24 * time.Hour) // default: son 24 saat
	if sinceStr != "" {
		if t, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			since = t
		}
	}

	stats, err := h.repo.GetStats(c.Request.Context(), since)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

func parseQueryOpts(c *gin.Context) QueryOpts {
	opts := QueryOpts{
		Level:  c.Query("level"),
		Source: c.Query("source"),
		Search: c.Query("search"),
	}

	if s := c.Query("since"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			opts.Since = t
		}
	}
	if u := c.Query("until"); u != "" {
		if t, err := time.Parse(time.RFC3339, u); err == nil {
			opts.Until = t
		}
	}

	return opts
}
