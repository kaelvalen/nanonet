package logs

import (
	"net/http"
	"strconv"
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
	rows, total, err := h.repo.GetByService(c.Request.Context(), serviceID, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":   rows,
		"total":  total,
		"limit":  opts.limit(),
		"offset": opts.offset(),
	})
}

// SearchAll GET /logs
func (h *Handler) SearchAll(c *gin.Context) {
	opts := parseQueryOpts(c)
	rows, total, err := h.repo.SearchAll(c.Request.Context(), opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":   rows,
		"total":  total,
		"limit":  opts.limit(),
		"offset": opts.offset(),
	})
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

	var serviceID *uuid.UUID
	if raw := c.Query("service_id"); raw != "" {
		if id, err := uuid.Parse(raw); err == nil {
			serviceID = &id
		}
	}

	stats, err := h.repo.GetStats(c.Request.Context(), since, serviceID)
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

	if v, err := strconv.Atoi(c.Query("limit")); err == nil {
		opts.Limit = v
	}
	if v, err := strconv.Atoi(c.Query("offset")); err == nil {
		opts.Offset = v
	}
	if v, err := strconv.Atoi(c.Query("page")); err == nil {
		opts.Page = v
	}

	if s := firstNonEmpty(c.Query("since"), c.Query("from")); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			opts.Since = t
		}
	}
	if u := firstNonEmpty(c.Query("until"), c.Query("to")); u != "" {
		if t, err := time.Parse(time.RFC3339, u); err == nil {
			opts.Until = t
		}
	}

	return opts
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
