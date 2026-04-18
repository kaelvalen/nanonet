// Package grants implements per-service role-based sharing on top of the
// owner-only model encoded in services.user_id. The owner of a service is
// implicit (not stored here); rows in this table grant additional users a
// scoped role: viewer | operator | admin.
package grants

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"nanonet-backend/pkg/ownership"
	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Grant struct {
	ID            uuid.UUID  `gorm:"column:id;primaryKey" json:"id"`
	ServiceID     uuid.UUID  `gorm:"column:service_id"    json:"service_id"`
	GranteeUserID uuid.UUID  `gorm:"column:grantee_user_id" json:"grantee_user_id"`
	Role          string     `gorm:"column:role"          json:"role"`
	CreatedAt     time.Time  `gorm:"column:created_at"    json:"created_at"`
	CreatedBy     *uuid.UUID `gorm:"column:created_by"    json:"created_by,omitempty"`
}

func (Grant) TableName() string { return "service_grants" }

// GrantWithUser is what the UI consumes — joins the user table to render
// emails / display names without a separate fetch.
type GrantWithUser struct {
	ID            uuid.UUID `gorm:"column:id"            json:"id"`
	ServiceID     uuid.UUID `gorm:"column:service_id"    json:"service_id"`
	GranteeUserID uuid.UUID `gorm:"column:grantee_user_id" json:"grantee_user_id"`
	Role          string    `gorm:"column:role"          json:"role"`
	CreatedAt     time.Time `gorm:"column:created_at"    json:"created_at"`
	GranteeEmail  string    `gorm:"column:email"         json:"grantee_email"`
}

type CreateRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role"  binding:"required,oneof=viewer operator admin"`
}

type UpdateRequest struct {
	Role string `json:"role" binding:"required,oneof=viewer operator admin"`
}

type Repository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// ListByService returns every grant on a service (owner-only operation).
func (r *Repository) ListByService(ctx context.Context, serviceID uuid.UUID) ([]GrantWithUser, error) {
	var out []GrantWithUser
	err := r.db.WithContext(ctx).Raw(`
		SELECT g.id, g.service_id, g.grantee_user_id, g.role, g.created_at, u.email
		FROM service_grants g
		JOIN users u ON u.id = g.grantee_user_id
		WHERE g.service_id = ?
		ORDER BY g.created_at DESC
	`, serviceID).Scan(&out).Error
	return out, err
}

// Upsert grants role to userID on serviceID; updates role if it already exists.
func (r *Repository) Upsert(ctx context.Context, g *Grant) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	if g.CreatedAt.IsZero() {
		g.CreatedAt = time.Now()
	}
	return r.db.WithContext(ctx).Exec(`
		INSERT INTO service_grants (id, service_id, grantee_user_id, role, created_at, created_by)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (service_id, grantee_user_id)
		DO UPDATE SET role = EXCLUDED.role
	`, g.ID, g.ServiceID, g.GranteeUserID, g.Role, g.CreatedAt, g.CreatedBy).Error
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Grant{}).Error
}

// findUserByEmail resolves an email to a user id. Returns gorm.ErrRecordNotFound
// when there is no matching user.
func (r *Repository) findUserByEmail(ctx context.Context, email string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.WithContext(ctx).Raw(
		`SELECT id FROM users WHERE lower(email) = lower(?)`, strings.TrimSpace(email),
	).Scan(&id).Error
	if err != nil {
		return uuid.Nil, err
	}
	if id == uuid.Nil {
		return uuid.Nil, gorm.ErrRecordNotFound
	}
	return id, nil
}

type Handler struct {
	db   *gorm.DB
	repo *Repository
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db, repo: NewRepository(db)}
}

// requireServiceOwner enforces that the caller owns the service. Sharing
// management is reserved to owners — operators/admins can use the service but
// not redistribute it.
func (h *Handler) requireServiceOwner(c *gin.Context) (serviceID, userID uuid.UUID, ok bool) {
	uid, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		response.Unauthorized(c, "geçersiz kullanıcı")
		return uuid.Nil, uuid.Nil, false
	}
	sid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "geçersiz servis id")
		return uuid.Nil, uuid.Nil, false
	}
	if !ownership.IsServiceOwner(c.Request.Context(), h.db, sid, uid) {
		response.NotFound(c, "servis bulunamadı")
		return uuid.Nil, uuid.Nil, false
	}
	return sid, uid, true
}

// List — GET /api/v1/services/:id/grants
func (h *Handler) List(c *gin.Context) {
	sid, _, ok := h.requireServiceOwner(c)
	if !ok {
		return
	}
	rows, err := h.repo.ListByService(c.Request.Context(), sid)
	if err != nil {
		response.InternalError(c, "grant listesi alınamadı")
		return
	}
	response.Success(c, gin.H{"grants": rows})
}

// Create — POST /api/v1/services/:id/grants
func (h *Handler) Create(c *gin.Context) {
	sid, ownerID, ok := h.requireServiceOwner(c)
	if !ok {
		return
	}
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	granteeID, err := h.repo.findUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.BadRequest(c, "bu e-posta ile kayıtlı kullanıcı yok")
			return
		}
		response.InternalError(c, "kullanıcı aranamadı")
		return
	}
	if granteeID == ownerID {
		response.BadRequest(c, "kendinize grant veremezsiniz — zaten owner'sınız")
		return
	}
	g := &Grant{
		ServiceID:     sid,
		GranteeUserID: granteeID,
		Role:          req.Role,
		CreatedBy:     &ownerID,
	}
	if err := h.repo.Upsert(c.Request.Context(), g); err != nil {
		response.InternalError(c, "grant kaydedilemedi")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": g})
}

// Update — PATCH /api/v1/services/:id/grants/:grant_id
func (h *Handler) Update(c *gin.Context) {
	sid, _, ok := h.requireServiceOwner(c)
	if !ok {
		return
	}
	gid, err := uuid.Parse(c.Param("grant_id"))
	if err != nil {
		response.BadRequest(c, "geçersiz grant id")
		return
	}
	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.db.WithContext(c.Request.Context()).
		Model(&Grant{}).
		Where("id = ? AND service_id = ?", gid, sid).
		Update("role", req.Role).Error; err != nil {
		response.InternalError(c, "grant güncellenemedi")
		return
	}
	response.Success(c, gin.H{"updated": true})
}

// Delete — DELETE /api/v1/services/:id/grants/:grant_id
func (h *Handler) Delete(c *gin.Context) {
	sid, _, ok := h.requireServiceOwner(c)
	if !ok {
		return
	}
	gid, err := uuid.Parse(c.Param("grant_id"))
	if err != nil {
		response.BadRequest(c, "geçersiz grant id")
		return
	}
	if err := h.db.WithContext(c.Request.Context()).
		Where("id = ? AND service_id = ?", gid, sid).
		Delete(&Grant{}).Error; err != nil {
		response.InternalError(c, "grant silinemedi")
		return
	}
	response.Success(c, gin.H{"deleted": true})
}
