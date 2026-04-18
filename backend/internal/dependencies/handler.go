package dependencies

import (
	"context"
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"nanonet-backend/pkg/ownership"
	"nanonet-backend/pkg/response"
)

type Handler struct {
	repo *Repository
	db   *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{repo: NewRepository(db), db: db}
}

// Repo exposes the repository so the WS hub can ingest agent observations
// without going through HTTP. Keeps the dependency graph explicit.
func (h *Handler) Repo() *Repository { return h.repo }

func (h *Handler) List(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	sid, ok := mustServiceID(c)
	if !ok {
		return
	}
	if !ownership.IsServiceOwner(c.Request.Context(), h.db, sid, uid) {
		response.NotFound(c, "servis bulunamadı")
		return
	}
	out, err := h.repo.ListByService(c.Request.Context(), sid)
	if err != nil {
		response.InternalError(c, "bağımlılıklar alınamadı")
		return
	}
	if out == nil {
		out = []Dependency{}
	}
	response.Success(c, gin.H{"dependencies": out})
}

func (h *Handler) Promote(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	sid, ok := mustServiceID(c)
	if !ok {
		return
	}
	if !ownership.IsServiceOwner(c.Request.Context(), h.db, sid, uid) {
		response.NotFound(c, "servis bulunamadı")
		return
	}
	depID, err := uuid.Parse(c.Param("dep_id"))
	if err != nil {
		response.BadRequest(c, "geçersiz dep_id")
		return
	}
	var body struct {
		Promoted bool `json:"promoted"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.ValidationError(c, err)
		return
	}
	if err := h.repo.Promote(c.Request.Context(), sid, depID, body.Promoted); err != nil {
		respondNotFoundOr(c, err, "bağımlılık bulunamadı")
		return
	}
	response.Success(c, gin.H{"promoted": body.Promoted})
}

func (h *Handler) Delete(c *gin.Context) {
	uid, ok := mustUser(c)
	if !ok {
		return
	}
	sid, ok := mustServiceID(c)
	if !ok {
		return
	}
	if !ownership.IsServiceOwner(c.Request.Context(), h.db, sid, uid) {
		response.NotFound(c, "servis bulunamadı")
		return
	}
	depID, err := uuid.Parse(c.Param("dep_id"))
	if err != nil {
		response.BadRequest(c, "geçersiz dep_id")
		return
	}
	if err := h.repo.Delete(c.Request.Context(), sid, depID); err != nil {
		respondNotFoundOr(c, err, "bağımlılık bulunamadı")
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

// IngestFromAgent is the bridge called by the WS hub when an agent reports
// dependency observations. Not exposed via HTTP.
func (h *Handler) IngestFromAgent(ctx context.Context, serviceID uuid.UUID, obs []Observation) error {
	return h.repo.UpsertBatch(ctx, serviceID, obs)
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

func mustServiceID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz service ID")
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
