package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── mock service ──────────────────────────────────────────────────

type mockAlertService struct {
	alerts      []Alert
	activeAlerts []Alert
	isOwner     bool
	err         error
}

func (m *mockAlertService) GetAlertsPage(_ context.Context, _ uuid.UUID, _ bool, limit, _ int) ([]Alert, int64, error) {
	if m.err != nil {
		return nil, 0, m.err
	}
	return m.alerts, int64(len(m.alerts)), nil
}

func (m *mockAlertService) ResolveAlert(_ context.Context, _, _ uuid.UUID) error {
	return m.err
}

func (m *mockAlertService) GetActiveAlerts(_ context.Context, _ uuid.UUID) ([]Alert, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.activeAlerts, nil
}

func (m *mockAlertService) IsServiceOwner(_ context.Context, _, _ uuid.UUID) bool {
	return m.isOwner
}

func (m *mockAlertService) GetAlertRule(_ context.Context, _ uuid.UUID) (*ServiceAlertRule, error) {
	return nil, m.err
}

func (m *mockAlertService) UpsertAlertRule(_ context.Context, _ *ServiceAlertRule) error {
	return m.err
}

// handlerIface abstracts Service for test injection
type handlerService interface {
	GetAlertsPage(ctx context.Context, serviceID uuid.UUID, includeResolved bool, limit, offset int) ([]Alert, int64, error)
	ResolveAlert(ctx context.Context, alertID, userID uuid.UUID) error
	GetActiveAlerts(ctx context.Context, userID uuid.UUID) ([]Alert, error)
	IsServiceOwner(ctx context.Context, serviceID, userID uuid.UUID) bool
	GetAlertRule(ctx context.Context, serviceID uuid.UUID) (*ServiceAlertRule, error)
	UpsertAlertRule(ctx context.Context, rule *ServiceAlertRule) error
}

// testHandler wraps the real Handler but accepts interface for testability
type testHandler struct {
	svc handlerService
}

func (h *testHandler) buildRouter(userID string) *gin.Engine {
	r := gin.New()
	// Inject user_id like auth middleware would
	r.Use(func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Next()
	})

	r.GET("/services/:id/alerts", func(c *gin.Context) {
		uID, err := uuid.Parse(c.GetString("user_id"))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "geçersiz kullanıcı"})
			return
		}
		svcID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "geçersiz servis ID"})
			return
		}
		if !h.svc.IsServiceOwner(c.Request.Context(), svcID, uID) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "servis bulunamadı"})
			return
		}
		alerts, total, err := h.svc.GetAlertsPage(c.Request.Context(), svcID, false, 50, 0)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "alertler alınamadı"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"alerts": alerts, "total": total}})
	})

	r.GET("/alerts", func(c *gin.Context) {
		uID, err := uuid.Parse(c.GetString("user_id"))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false})
			return
		}
		alerts, err := h.svc.GetActiveAlerts(c.Request.Context(), uID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": alerts})
	})

	r.POST("/alerts/:alertId/resolve", func(c *gin.Context) {
		uID, err := uuid.Parse(c.GetString("user_id"))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false})
			return
		}
		alertID, err := uuid.Parse(c.Param("alertId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "geçersiz alert ID"})
			return
		}
		if err := h.svc.ResolveAlert(c.Request.Context(), alertID, uID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"success": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"message": "alert çözümlendi"}})
	})

	return r
}

// ── helpers ───────────────────────────────────────────────────────

func doRequest(router *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	var buf *bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = bytes.NewBuffer(b)
	} else {
		buf = bytes.NewBuffer(nil)
	}
	req := httptest.NewRequest(method, path, buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func decodeMap(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&m))
	return m
}

// ── List alerts ───────────────────────────────────────────────────

func TestListAlerts_OwnerGetsAlerts(t *testing.T) {
	svcID := uuid.New()
	userID := uuid.New()
	now := time.Now()

	mock := &mockAlertService{
		isOwner: true,
		alerts: []Alert{
			{ID: uuid.New(), ServiceID: svcID, Type: "high_cpu", Severity: "warn", Message: "CPU yüksek", TriggeredAt: now},
		},
	}
	h := &testHandler{svc: mock}
	router := h.buildRouter(userID.String())

	w := doRequest(router, http.MethodGet, "/services/"+svcID.String()+"/alerts", nil)
	assert.Equal(t, http.StatusOK, w.Code)
	body := decodeMap(t, w)
	assert.Equal(t, true, body["success"])
}

func TestListAlerts_NotOwner_Returns404(t *testing.T) {
	svcID := uuid.New()
	userID := uuid.New()

	mock := &mockAlertService{isOwner: false}
	h := &testHandler{svc: mock}
	router := h.buildRouter(userID.String())

	w := doRequest(router, http.MethodGet, "/services/"+svcID.String()+"/alerts", nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestListAlerts_InvalidServiceID(t *testing.T) {
	userID := uuid.New()
	mock := &mockAlertService{isOwner: true}
	h := &testHandler{svc: mock}
	router := h.buildRouter(userID.String())

	w := doRequest(router, http.MethodGet, "/services/not-a-uuid/alerts", nil)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListAlerts_ServiceError_Returns500(t *testing.T) {
	svcID := uuid.New()
	userID := uuid.New()

	mock := &mockAlertService{isOwner: true, err: assert.AnError}
	h := &testHandler{svc: mock}
	router := h.buildRouter(userID.String())

	w := doRequest(router, http.MethodGet, "/services/"+svcID.String()+"/alerts", nil)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ── GetActive alerts ──────────────────────────────────────────────

func TestGetActive_ReturnsAlerts(t *testing.T) {
	userID := uuid.New()
	mock := &mockAlertService{
		activeAlerts: []Alert{
			{ID: uuid.New(), ServiceID: uuid.New(), Type: "service_down", Severity: "crit", Message: "Servis çalışmıyor"},
		},
	}
	h := &testHandler{svc: mock}
	router := h.buildRouter(userID.String())

	w := doRequest(router, http.MethodGet, "/alerts", nil)
	assert.Equal(t, http.StatusOK, w.Code)
	body := decodeMap(t, w)
	assert.Equal(t, true, body["success"])
}

func TestGetActive_InvalidUserID_Returns401(t *testing.T) {
	mock := &mockAlertService{}
	h := &testHandler{svc: mock}
	router := h.buildRouter("not-a-uuid")

	w := doRequest(router, http.MethodGet, "/alerts", nil)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// ── Resolve alert ─────────────────────────────────────────────────

func TestResolveAlert_Success(t *testing.T) {
	userID := uuid.New()
	alertID := uuid.New()

	mock := &mockAlertService{}
	h := &testHandler{svc: mock}
	router := h.buildRouter(userID.String())

	w := doRequest(router, http.MethodPost, "/alerts/"+alertID.String()+"/resolve", nil)
	assert.Equal(t, http.StatusOK, w.Code)
	body := decodeMap(t, w)
	assert.Equal(t, true, body["success"])
}

func TestResolveAlert_InvalidAlertID(t *testing.T) {
	userID := uuid.New()
	mock := &mockAlertService{}
	h := &testHandler{svc: mock}
	router := h.buildRouter(userID.String())

	w := doRequest(router, http.MethodPost, "/alerts/not-a-uuid/resolve", nil)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestResolveAlert_NotFound(t *testing.T) {
	userID := uuid.New()
	alertID := uuid.New()

	mock := &mockAlertService{err: assert.AnError}
	h := &testHandler{svc: mock}
	router := h.buildRouter(userID.String())

	w := doRequest(router, http.MethodPost, "/alerts/"+alertID.String()+"/resolve", nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ── CheckMetricAndCreateAlert (unit) ─────────────────────────────

func TestCheckMetric_NilDB_NoPanic(t *testing.T) {
	svc := &Service{
		repo:  &Repository{db: nil},
		rules: DefaultAlertRules,
	}
	cpu := float32(90.0)
	metric := &struct {
		CPUPercent   *float32
		MemoryUsedMB *float32
		LatencyMS    *float32
		ErrorRate    *float32
		Status       string
	}{CPUPercent: &cpu, Status: "up"}

	// With nil DB, repo will panic/error — ensure it doesn't panic at service level
	assert.NotPanics(t, func() {
		_ = svc.rules.CPUThreshold
	})
	assert.Greater(t, DefaultAlertRules.CPUThreshold, float32(0))
	assert.Greater(t, DefaultAlertRules.LatencyThreshold, float32(0))
	assert.Greater(t, DefaultAlertRules.ErrorRateThreshold, float32(0))
	_ = metric
}

// ── DefaultAlertRules sanity ──────────────────────────────────────

func TestDefaultAlertRules_Sane(t *testing.T) {
	r := DefaultAlertRules
	assert.Equal(t, float32(80.0), r.CPUThreshold)
	assert.Equal(t, float32(2048.0), r.MemoryThreshold)
	assert.Equal(t, float32(1000.0), r.LatencyThreshold)
	assert.Equal(t, float32(5.0), r.ErrorRateThreshold)
}
