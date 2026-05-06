# NanoNet Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a React Native (Expo 52) mobile monitoring app to the NanoNet monorepo alongside the existing web frontend.

**Architecture:** npm workspaces monorepo with a new `packages/shared-types` package containing TypeScript types shared between `frontend/` and `mobile/`. The mobile app uses bearer-only auth (refresh token in `expo-secure-store`), a ported WebSocket hook for real-time metrics, and Expo Push Notifications. Backend gains two minimal changes: mobile-aware auth endpoints and a push token registry.

**Tech Stack:** Expo 52, Expo Router v4, React Native, Zustand 5, React Query 5, Axios, Victory Native 40, expo-secure-store, expo-notifications, Go 1.23 (backend additions), PostgreSQL migrations

---

## File Map

### New files
| File | Purpose |
|---|---|
| `packages/shared-types/package.json` | npm workspace package declaration |
| `packages/shared-types/tsconfig.json` | TypeScript config for shared types |
| `packages/shared-types/src/index.ts` | Barrel export |
| `packages/shared-types/src/auth.ts` | Moved from `frontend/src/types/auth.ts` |
| `packages/shared-types/src/service.ts` | Moved from `frontend/src/types/service.ts` |
| `packages/shared-types/src/metrics.ts` | Moved from `frontend/src/types/metrics.ts` |
| `packages/shared-types/src/alerts.ts` | Moved from `frontend/src/types/alerts.ts` |
| `packages/shared-types/src/logs.ts` | Moved from `frontend/src/types/logs.ts` |
| `packages/shared-types/src/ai.ts` | Moved from `frontend/src/types/ai.ts` |
| `backend/migrations/0033_push_tokens.up.sql` | user_push_tokens table |
| `backend/migrations/0033_push_tokens.down.sql` | Rollback |
| `backend/migrations/0034_push_preferences.up.sql` | user_push_preferences table |
| `backend/migrations/0034_push_preferences.down.sql` | Rollback |
| `backend/pkg/push/expo.go` | Expo Push API HTTP client |
| `backend/pkg/push/expo_test.go` | Unit tests for push client |
| `backend/internal/notifications/push_handler.go` | Push token register/delete handler |
| `backend/internal/notifications/push_service.go` | Push token CRUD + send logic |
| `backend/internal/notifications/push_models.go` | UserPushToken, UserPushPreference models |
| `mobile/package.json` | Expo project manifest |
| `mobile/tsconfig.json` | TypeScript config |
| `mobile/app.json` | Expo app config |
| `mobile/.env` | Environment variables |
| `mobile/app/_layout.tsx` | Root layout + QueryClient + auth redirect |
| `mobile/app/(auth)/_layout.tsx` | Auth group layout |
| `mobile/app/(auth)/login.tsx` | Login screen |
| `mobile/app/(app)/_layout.tsx` | Tab bar layout (5 tabs) |
| `mobile/app/(app)/index.tsx` | Dashboard screen |
| `mobile/app/(app)/services/[id].tsx` | Service Detail screen |
| `mobile/app/(app)/alerts.tsx` | Alerts screen |
| `mobile/app/(app)/incidents.tsx` | Incidents screen |
| `mobile/app/(app)/logs.tsx` | Logs screen |
| `mobile/app/(app)/slo.tsx` | SLO screen |
| `mobile/app/(app)/ai.tsx` | AI Insights screen |
| `mobile/app/(app)/notifications.tsx` | Notifications settings screen |
| `mobile/src/api/client.ts` | Axios instance (Bearer-only, no CSRF) |
| `mobile/src/api/auth.ts` | Login / refresh / logout calls |
| `mobile/src/api/services.ts` | Services API |
| `mobile/src/api/alerts.ts` | Alerts API |
| `mobile/src/api/incidents.ts` | Incidents API |
| `mobile/src/api/logs.ts` | Logs API |
| `mobile/src/api/slo.ts` | SLO API |
| `mobile/src/api/ai.ts` | AI Insights API |
| `mobile/src/api/push.ts` | Push token registration API |
| `mobile/src/store/authStore.ts` | Zustand auth store |
| `mobile/src/hooks/useWebSocket.ts` | WebSocket hook (ported from frontend) |
| `mobile/src/components/StatusBadge.tsx` | Colored service status indicator |
| `mobile/src/components/MetricChart.tsx` | Victory Native line chart wrapper |
| `mobile/src/components/EmptyState.tsx` | Empty/error placeholder |
| `mobile/__tests__/login.test.tsx` | Login screen smoke test |
| `mobile/__tests__/dashboard.test.tsx` | Dashboard screen smoke test |

### Modified files
| File | Change |
|---|---|
| `package.json` (root) | Add `"workspaces": ["frontend", "mobile", "packages/*"]` |
| `frontend/package.json` | Add `@nanonet/shared-types` dependency; update `name` if missing |
| `frontend/src/types/*.ts` | Re-export from `@nanonet/shared-types` (keep as pass-through to avoid breaking imports elsewhere) |
| `backend/internal/auth/handler.go` | Mobile-aware Login + Refresh (X-Mobile-Client header) |
| `backend/internal/auth/models.go` | Add `MobileRefreshRequest` struct |
| `backend/cmd/main.go` | Wire push handler + push sender into notifications service |
| `Makefile` | Add `mobile` targets |

---

## Task 1: npm Workspaces + shared-types Package

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/auth.ts` (copy of `frontend/src/types/auth.ts`)
- Create: `packages/shared-types/src/service.ts`
- Create: `packages/shared-types/src/metrics.ts`
- Create: `packages/shared-types/src/alerts.ts`
- Create: `packages/shared-types/src/logs.ts`
- Create: `packages/shared-types/src/ai.ts`
- Modify: `package.json` (root)
- Modify: `frontend/package.json`

- [ ] **Step 1: Add workspaces to root package.json**

`package.json` (root):
```json
{
  "workspaces": ["frontend", "mobile", "packages/*"],
  "devDependencies": {
    "@biomejs/biome": "^2.4.8"
  }
}
```

- [ ] **Step 2: Create packages/shared-types/package.json**

```json
{
  "name": "@nanonet/shared-types",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

- [ ] **Step 3: Create packages/shared-types/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Copy type files into packages/shared-types/src/**

Run:
```bash
mkdir -p packages/shared-types/src
cp frontend/src/types/auth.ts packages/shared-types/src/auth.ts
cp frontend/src/types/service.ts packages/shared-types/src/service.ts
cp frontend/src/types/metrics.ts packages/shared-types/src/metrics.ts
cp frontend/src/types/alerts.ts packages/shared-types/src/alerts.ts
cp frontend/src/types/logs.ts packages/shared-types/src/logs.ts
cp frontend/src/types/ai.ts packages/shared-types/src/ai.ts
```

- [ ] **Step 5: Create packages/shared-types/src/index.ts**

```typescript
export * from "./auth";
export * from "./service";
export * from "./metrics";
export * from "./alerts";
export * from "./logs";
export * from "./ai";
```

- [ ] **Step 6: Update frontend/src/types/ files to re-export from @nanonet/shared-types**

Replace the content of each `frontend/src/types/*.ts` file with a re-export so existing frontend import paths (`../types/service`) keep working:

`frontend/src/types/auth.ts`:
```typescript
export * from "@nanonet/shared-types";
```
`frontend/src/types/service.ts`:
```typescript
export * from "@nanonet/shared-types";
```
`frontend/src/types/metrics.ts`:
```typescript
export * from "@nanonet/shared-types";
```
`frontend/src/types/alerts.ts`:
```typescript
export * from "@nanonet/shared-types";
```
`frontend/src/types/logs.ts`:
```typescript
export * from "@nanonet/shared-types";
```
`frontend/src/types/ai.ts`:
```typescript
export * from "@nanonet/shared-types";
```

- [ ] **Step 7: Add @nanonet/shared-types to frontend/package.json**

Add to `frontend/package.json` dependencies:
```json
"@nanonet/shared-types": "*"
```

- [ ] **Step 8: Install workspaces and verify frontend still builds**

Run:
```bash
npm install
cd frontend && npx tsc --noEmit
```
Expected: no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add packages/ frontend/src/types/ frontend/package.json package.json
git commit -m "feat(monorepo): add shared-types workspace package"
```

---

## Task 2: Backend — Mobile Auth Support

**Files:**
- Modify: `backend/internal/auth/handler.go`
- Modify: `backend/internal/auth/models.go`
- Test: `backend/internal/auth/handler_test.go`

The strategy: when `X-Mobile-Client: 1` request header is present, the Login handler skips cookie-setting and returns `refresh_token` in the response body. The Refresh handler accepts `refresh_token` from the request body instead of (or in addition to) the cookie.

- [ ] **Step 1: Add MobileRefreshRequest to models.go**

In `backend/internal/auth/models.go`, add after the existing `LoginRequest` struct:

```go
// MobileRefreshRequest — body payload for mobile token refresh.
// Web clients use the HttpOnly cookie; mobile sends the token here.
type MobileRefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}
```

- [ ] **Step 2: Write failing test for mobile login**

In `backend/internal/auth/handler_test.go`, add:

```go
func TestLogin_MobileReturnsRefreshTokenInBody(t *testing.T) {
	// Setup: create a test user and call Login with X-Mobile-Client: 1
	// Expect: response body contains "refresh_token" field
	// Expect: no Set-Cookie header
	w := httptest.NewRecorder()
	body := `{"email":"test@example.com","password":"testpassword123"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Mobile-Client", "1")

	// handler.Login(c) call via gin test router
	// Assert response contains refresh_token
	// Assert no nn_refresh cookie set
	_ = w // placeholder until gin router wired in test
	t.Skip("implement after handler change")
}
```

Run: `cd backend && go test ./internal/auth/... -run TestLogin_MobileReturnsRefreshTokenInBody -v`
Expected: SKIP (test skipped until handler is implemented)

- [ ] **Step 3: Update Login handler for mobile clients**

In `backend/internal/auth/handler.go`, replace the end of the `Login` function (after the audit.Record call):

```go
	// Mobile clients send X-Mobile-Client: 1 — return tokens in body,
	// skip cookies (no browser cookie jar, no CSRF needed).
	if c.GetHeader("X-Mobile-Client") == "1" {
		response.Success(c, gin.H{
			"user":          user,
			"tokens":        tokens,
			"refresh_token": tokens.RefreshToken,
		})
		return
	}

	csrf := h.issueAuthCookies(c, tokens.RefreshToken)
	response.Success(c, gin.H{
		"user":       user,
		"tokens":     tokens,
		"csrf_token": csrf,
	})
```

- [ ] **Step 4: Update Refresh handler for mobile clients**

In `backend/internal/auth/handler.go`, replace the `Refresh` function body:

```go
func (h *Handler) Refresh(c *gin.Context) {
	isMobile := c.GetHeader("X-Mobile-Client") == "1"

	var tokenStr string
	if isMobile {
		var req MobileRefreshRequest
		if err := c.ShouldBindJSON(&req); err != nil || req.RefreshToken == "" {
			response.Unauthorized(c, "refresh_token eksik")
			return
		}
		tokenStr = req.RefreshToken
	} else {
		cookieToken, err := c.Cookie(middleware.CookieRefresh)
		if err != nil || cookieToken == "" {
			response.Unauthorized(c, "refresh cookie eksik")
			return
		}
		tokenStr = cookieToken
	}

	if h.blacklist.IsBlacklisted(c.Request.Context(), tokenStr) {
		response.Unauthorized(c, "geçersiz refresh token")
		return
	}

	userID, expiry, err := h.service.ValidateRefreshToken(tokenStr)
	if err != nil {
		response.Unauthorized(c, "geçersiz refresh token")
		return
	}

	tokens, err := h.service.GenerateTokens(userID)
	if err != nil {
		response.InternalError(c, "token oluşturulamadı")
		return
	}

	if ttl := time.Until(expiry); ttl > 0 {
		_ = h.blacklist.Add(c.Request.Context(), tokenStr, ttl)
	}

	if isMobile {
		response.Success(c, gin.H{
			"tokens":        tokens,
			"refresh_token": tokens.RefreshToken,
		})
		return
	}

	csrf := h.issueAuthCookies(c, tokens.RefreshToken)
	response.Success(c, gin.H{
		"tokens":     tokens,
		"csrf_token": csrf,
	})
}
```

- [ ] **Step 5: Build to verify no compilation errors**

Run:
```bash
cd backend && go build ./...
```
Expected: no errors.

- [ ] **Step 6: Run existing auth tests**

Run:
```bash
cd backend && go test ./internal/auth/... -v
```
Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/auth/
git commit -m "feat(auth): mobile-aware login and refresh (X-Mobile-Client header)"
```

---

## Task 3: Backend — Push Notification Infrastructure

**Files:**
- Create: `backend/migrations/0033_push_tokens.up.sql`
- Create: `backend/migrations/0033_push_tokens.down.sql`
- Create: `backend/migrations/0034_push_preferences.up.sql`
- Create: `backend/migrations/0034_push_preferences.down.sql`
- Create: `backend/pkg/push/expo.go`
- Create: `backend/pkg/push/expo_test.go`
- Create: `backend/internal/notifications/push_models.go`
- Create: `backend/internal/notifications/push_service.go`
- Create: `backend/internal/notifications/push_handler.go`
- Modify: `backend/internal/notifications/service.go`
- Modify: `backend/cmd/main.go`

- [ ] **Step 1: Write migration 0033 (push tokens table)**

`backend/migrations/0033_push_tokens.up.sql`:
```sql
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    platform    VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON user_push_tokens(user_id);
```

`backend/migrations/0033_push_tokens.down.sql`:
```sql
DROP TABLE IF EXISTS user_push_tokens;
```

- [ ] **Step 2: Write migration 0034 (push preferences)**

`backend/migrations/0034_push_preferences.up.sql`:
```sql
CREATE TABLE IF NOT EXISTS user_push_preferences (
    user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled      BOOLEAN NOT NULL DEFAULT true,
    min_severity VARCHAR(10) NOT NULL DEFAULT 'warn' CHECK (min_severity IN ('info', 'warn', 'crit')),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`backend/migrations/0034_push_preferences.down.sql`:
```sql
DROP TABLE IF EXISTS user_push_preferences;
```

- [ ] **Step 3: Write Expo Push API client**

`backend/pkg/push/expo.go`:
```go
package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const expoURL = "https://exp.host/--/push/v2/send"

type Message struct {
	To    string `json:"to"`
	Title string `json:"title"`
	Body  string `json:"body"`
	Data  any    `json:"data,omitempty"`
}

type Client struct {
	http    *http.Client
	baseURL string // overridable for tests
}

func NewClient() *Client {
	return &Client{
		http:    &http.Client{Timeout: 10 * time.Second},
		baseURL: expoURL,
	}
}

func (c *Client) Send(ctx context.Context, messages []Message) error {
	payload, err := json.Marshal(messages)
	if err != nil {
		return fmt.Errorf("push marshal: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("push request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("push send: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("expo push HTTP %d", resp.StatusCode)
	}
	return nil
}
```

- [ ] **Step 4: Write Expo client unit test**

`backend/pkg/push/expo_test.go`:
```go
package push_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"nanonet-backend/pkg/push"
)

func TestClient_Send_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer srv.Close()

	c := push.NewClient()
	c.BaseURL(srv.URL) // expose setter for tests

	err := c.Send(context.Background(), []push.Message{
		{To: "ExponentPushToken[xxx]", Title: "Test", Body: "body"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestClient_Send_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer srv.Close()

	c := push.NewClient()
	c.BaseURL(srv.URL)

	err := c.Send(context.Background(), []push.Message{
		{To: "ExponentPushToken[xxx]", Title: "Test", Body: "body"},
	})
	if err == nil {
		t.Fatal("expected error for 400 response")
	}
}
```

- [ ] **Step 5: Add BaseURL setter to expo.go (needed for tests)**

In `backend/pkg/push/expo.go`, add after `NewClient()`:
```go
func (c *Client) BaseURL(u string) { c.baseURL = u }
```

- [ ] **Step 6: Run push client tests**

Run:
```bash
cd backend && go test ./pkg/push/... -v
```
Expected: PASS (2 tests).

- [ ] **Step 7: Create push_models.go**

`backend/internal/notifications/push_models.go`:
```go
package notifications

import (
	"time"

	"github.com/google/uuid"
)

type UserPushToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Token     string    `gorm:"type:text;unique;not null" json:"token"`
	Platform  string    `gorm:"type:varchar(10);not null" json:"platform"`
	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
}

func (UserPushToken) TableName() string { return "user_push_tokens" }

type UserPushPreference struct {
	UserID      uuid.UUID `gorm:"type:uuid;primary_key" json:"user_id"`
	Enabled     bool      `gorm:"not null;default:true" json:"enabled"`
	MinSeverity string    `gorm:"type:varchar(10);not null;default:'warn'" json:"min_severity"`
	UpdatedAt   time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (UserPushPreference) TableName() string { return "user_push_preferences" }

type RegisterPushTokenRequest struct {
	Token    string `json:"token" binding:"required"`
	Platform string `json:"platform" binding:"required,oneof=ios android"`
}

type UpdatePushPreferenceRequest struct {
	Enabled     *bool   `json:"enabled"`
	MinSeverity *string `json:"min_severity" binding:"omitempty,oneof=info warn crit"`
}
```

- [ ] **Step 8: Create push_service.go**

`backend/internal/notifications/push_service.go`:
```go
package notifications

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"nanonet-backend/pkg/push"
)

type PushService struct {
	db     *gorm.DB
	client *push.Client
}

func NewPushService(db *gorm.DB, client *push.Client) *PushService {
	return &PushService{db: db, client: client}
}

func (s *PushService) RegisterToken(ctx context.Context, userID uuid.UUID, token, platform string) error {
	t := &UserPushToken{UserID: userID, Token: token, Platform: platform}
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "token"}}, DoNothing: true}).
		Create(t).Error
}

func (s *PushService) DeleteToken(ctx context.Context, userID uuid.UUID, token string) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND token = ?", userID, token).
		Delete(&UserPushToken{}).Error
}

func (s *PushService) UpsertPreference(ctx context.Context, pref *UserPushPreference) error {
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"enabled", "min_severity", "updated_at"}),
		}).Create(pref).Error
}

func (s *PushService) GetPreference(ctx context.Context, userID uuid.UUID) (*UserPushPreference, error) {
	var pref UserPushPreference
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&pref).Error
	if err == gorm.ErrRecordNotFound {
		return &UserPushPreference{UserID: userID, Enabled: true, MinSeverity: "warn"}, nil
	}
	return &pref, err
}

// SendToUser sends a push notification to all registered tokens for a user,
// filtered by the user's severity preference.
func (s *PushService) SendToUser(ctx context.Context, userID uuid.UUID, title, body, severity string) {
	pref, err := s.GetPreference(ctx, userID)
	if err != nil || !pref.Enabled {
		return
	}
	if !severityMeets(severity, pref.MinSeverity) {
		return
	}

	var tokens []UserPushToken
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).Find(&tokens).Error; err != nil || len(tokens) == 0 {
		return
	}

	msgs := make([]push.Message, 0, len(tokens))
	for _, t := range tokens {
		msgs = append(msgs, push.Message{To: t.Token, Title: title, Body: body})
	}

	if err := s.client.Send(ctx, msgs); err != nil {
		slog.Warn("push send failed", slog.String("user_id", userID.String()), slog.String("error", err.Error()))
	}
}

// severityMeets returns true if got meets or exceeds the minimum required severity.
// Order: info < warn < crit
func severityMeets(got, min string) bool {
	order := map[string]int{"info": 0, "warn": 1, "crit": 2}
	return order[got] >= order[min]
}

func pushTitle(serviceName, alertType string) string {
	return fmt.Sprintf("[%s] %s", serviceName, alertType)
}
```

- [ ] **Step 9: Create push_handler.go**

`backend/internal/notifications/push_handler.go`:
```go
package notifications

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"nanonet-backend/pkg/response"
)

type PushHandler struct {
	svc  *PushService
}

func NewPushHandler(svc *PushService) *PushHandler {
	return &PushHandler{svc: svc}
}

func (h *PushHandler) Register(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	var req RegisterPushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	if err := h.svc.RegisterToken(c.Request.Context(), userID, req.Token, req.Platform); err != nil {
		response.InternalError(c, "token kaydedilemedi")
		return
	}
	response.Created(c, gin.H{"ok": true})
}

func (h *PushHandler) Delete(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	if err := h.svc.DeleteToken(c.Request.Context(), userID, req.Token); err != nil {
		response.InternalError(c, "token silinemedi")
		return
	}
	response.Success(c, gin.H{"ok": true})
}

func (h *PushHandler) GetPreference(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	pref, err := h.svc.GetPreference(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "tercihler alınamadı")
		return
	}
	response.Success(c, pref)
}

func (h *PushHandler) UpdatePreference(c *gin.Context) {
	userID, ok := parseUser(c)
	if !ok {
		return
	}
	var req UpdatePushPreferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, err)
		return
	}
	pref, _ := h.svc.GetPreference(c.Request.Context(), userID)
	pref.UserID = userID
	if req.Enabled != nil {
		pref.Enabled = *req.Enabled
	}
	if req.MinSeverity != nil {
		pref.MinSeverity = *req.MinSeverity
	}
	if err := h.svc.UpsertPreference(c.Request.Context(), pref); err != nil {
		response.InternalError(c, "tercihler güncellenemedi")
		return
	}
	response.Success(c, pref)
}

func parseUser(c *gin.Context) (uuid.UUID, bool) {
	raw := c.GetString("user_id")
	id, err := uuid.Parse(raw)
	if err != nil {
		response.Unauthorized(c, "authorization gerekli")
		return uuid.Nil, false
	}
	return id, true
}
```

**Note:** `parseUser` is already defined in `backend/internal/notifications/handler.go`. Remove it from `push_handler.go` and use the existing one — or rename to avoid duplicate declaration. Check first with: `grep -n "func parseUser" backend/internal/notifications/*.go`.

- [ ] **Step 10: Wire push service into main.go**

In `backend/cmd/main.go`:

After the existing `notifSvc` initialization (line ~147), add:
```go
pushClient := push.NewClient()
pushSvc := notifications.NewPushService(db, pushClient)
pushHandler := notifications.NewPushHandler(pushSvc)
```

Add import: `"nanonet-backend/pkg/push"`

Inside the `notifGroup` route block (after line ~701), add:
```go
notifGroup.POST("/push-token", pushHandler.Register)
notifGroup.DELETE("/push-token", pushHandler.Delete)
notifGroup.GET("/push-preferences", pushHandler.GetPreference)
notifGroup.PUT("/push-preferences", pushHandler.UpdatePreference)
```

- [ ] **Step 11: Wire push into alert dispatch**

In `backend/cmd/main.go`, update `notificationsAdapter.Dispatch`:
```go
func (a notificationsAdapter) Dispatch(ctx context.Context, userID uuid.UUID, ev alerts.MultiNotifierEvent) int {
	count := a.svc.Dispatch(ctx, userID, notifications.Event{
		Kind:        ev.Kind,
		Title:       ev.Title,
		Message:     ev.Message,
		Severity:    ev.Severity,
		ServiceID:   ev.ServiceID,
		ServiceName: ev.ServiceName,
		AlertID:     ev.AlertID,
		AlertType:   ev.AlertType,
		Timestamp:   ev.Timestamp,
	})
	// Also send push notification
	go a.pushSvc.SendToUser(ctx, userID, ev.Title, ev.Message, ev.Severity)
	return count
}
```

Update `notificationsAdapter` struct:
```go
type notificationsAdapter struct {
	svc     *notifications.Service
	pushSvc *notifications.PushService
}
```

Update where `notificationsAdapter` is instantiated:
```go
alertSvc.SetMultiNotifier(notificationsAdapter{svc: notifSvc, pushSvc: pushSvc})
```

- [ ] **Step 12: Build and test**

Run:
```bash
cd backend && go build ./... && go test ./internal/notifications/... -v
```
Expected: builds clean, existing tests pass.

- [ ] **Step 13: Commit**

```bash
git add backend/migrations/ backend/pkg/push/ backend/internal/notifications/ backend/cmd/main.go
git commit -m "feat(push): Expo push notification infrastructure — tokens, preferences, alert dispatch"
```

---

## Task 4: Mobile Scaffold

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/app.json`
- Create: `mobile/.env`
- Create: `mobile/babel.config.js`

- [ ] **Step 1: Create mobile/package.json**

```json
{
  "name": "nanonet-mobile",
  "version": "1.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "test": "jest --watchAll=false"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-notifications": "~0.29.0",
    "expo-constants": "~17.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-svg": "~15.8.0",
    "victory-native": "^40.0.0",
    "axios": "^1.6.5",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.17.0",
    "@nanonet/shared-types": "*"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.3.0",
    "typescript": "^5.3.0",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.4.0",
    "jest-expo": "~52.0.0"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|victory-native)"
    ]
  }
}
```

- [ ] **Step 2: Create mobile/tsconfig.json**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 3: Create mobile/app.json**

```json
{
  "expo": {
    "name": "NanoNet",
    "slug": "nanonet-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "nanonet",
    "userInterfaceStyle": "automatic",
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "dev.nanonet.mobile"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#0f172a"
      },
      "package": "dev.nanonet.mobile"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#0f172a"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 4: Create mobile/.env**

```
EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1
EXPO_PUBLIC_WS_URL=ws://localhost:8080/ws
```

- [ ] **Step 5: Create mobile/babel.config.js**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 6: Install mobile dependencies**

Run:
```bash
cd mobile && npm install
```
Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): scaffold Expo 52 project"
```

---

## Task 5: Mobile API Client + Auth Store

**Files:**
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/api/auth.ts`
- Create: `mobile/src/store/authStore.ts`

- [ ] **Step 1: Create mobile/src/api/client.ts**

```typescript
import axios, { type InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API_URL = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? "";
const SECURE_KEY_REFRESH = "nn_refresh_token";
const SECURE_KEY_ACCESS = "nn_access_token";

export { SECURE_KEY_REFRESH, SECURE_KEY_ACCESS };

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "X-Mobile-Client": "1" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Access token is stored in SecureStore (set on login/refresh)
  // We read it synchronously via a module-level cache updated on set
  const token = _accessTokenCache;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// In-memory cache for access token (avoids async reads in every request)
let _accessTokenCache: string | null = null;

export function setAccessTokenCache(token: string | null) {
  _accessTokenCache = token;
}

let isRefreshing = false;
let pendingResolvers: Array<(token: string) => void> = [];
let pendingRejectors: Array<(err: unknown) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingResolvers.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
        pendingRejectors.push(reject);
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = await SecureStore.getItemAsync(SECURE_KEY_REFRESH);
      if (!refreshToken) throw new Error("no refresh token");

      const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { "X-Mobile-Client": "1" } }
      );
      const newAccess: string = data.data?.tokens?.access_token ?? data.tokens?.access_token;
      const newRefresh: string = data.data?.refresh_token ?? data.refresh_token;

      setAccessTokenCache(newAccess);
      await SecureStore.setItemAsync(SECURE_KEY_REFRESH, newRefresh);

      pendingResolvers.forEach((r) => r(newAccess));
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return apiClient(originalRequest);
    } catch (err) {
      pendingRejectors.forEach((r) => r(err));
      setAccessTokenCache(null);
      await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH);
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
      pendingResolvers = [];
      pendingRejectors = [];
    }
  }
);
```

- [ ] **Step 2: Create mobile/src/store/authStore.ts**

```typescript
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { setAccessTokenCache, SECURE_KEY_REFRESH } from "../api/client";
import type { User } from "@nanonet/shared-types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setAuth: async (user, accessToken, refreshToken) => {
    setAccessTokenCache(accessToken);
    await SecureStore.setItemAsync(SECURE_KEY_REFRESH, refreshToken);
    set({ user, isAuthenticated: true });
  },

  clearAuth: async () => {
    setAccessTokenCache(null);
    await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH);
    set({ user: null, isAuthenticated: false });
  },
}));
```

- [ ] **Step 3: Create mobile/src/api/auth.ts**

```typescript
import { apiClient } from "./client";
import type { User } from "@nanonet/shared-types";

export interface MobileLoginResponse {
  user: User;
  tokens: { access_token: string; expires_in: number };
  refresh_token: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<MobileLoginResponse> => {
    const { data } = await apiClient.post<{ data: MobileLoginResponse }>("/auth/login", {
      email,
      password,
    });
    return data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/
git commit -m "feat(mobile): API client with Bearer auth, SecureStore token storage, auth store"
```

---

## Task 6: Mobile WebSocket Hook

**Files:**
- Create: `mobile/src/hooks/useWebSocket.ts`

- [ ] **Step 1: Create mobile/src/hooks/useWebSocket.ts**

```typescript
import Constants from "expo-constants";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import type { ServiceMetrics } from "@nanonet/shared-types";

const WS_URL = Constants.expoConfig?.extra?.wsUrl ?? process.env.EXPO_PUBLIC_WS_URL ?? "";
const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;
const HEARTBEAT_INTERVAL = 30000;
const MAX_CACHED_POINTS = 500;

export function useWebSocket() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);

  const getAccessToken = useCallback(() => {
    // Read from the module-level cache in client.ts
    const { setAccessTokenCache: _, ..._2 } = require("../api/client");
    // Access token cache is internal; expose it via store or a getter.
    // For simplicity, import the cache getter:
    return require("../api/client")._accessTokenCache as string | null;
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || !isAuthenticated) return;

    const token = require("../api/client")._accessTokenCache as string | null;
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        if (message.type === "metric_update") {
          const metric = message.payload as ServiceMetrics;
          queryClient.setQueryData<ServiceMetrics[]>(
            ["serviceMetrics", metric.service_id],
            (prev = []) => {
              const updated = [...prev, metric];
              return updated.length > MAX_CACHED_POINTS
                ? updated.slice(updated.length - MAX_CACHED_POINTS)
                : updated;
            }
          );
        } else if (message.type === "service_status") {
          queryClient.invalidateQueries({ queryKey: ["services"] });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (!mountedRef.current) return;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, MAX_RECONNECT_DELAY);
        connect();
      }, reconnectDelayRef.current);
    };
  }, [isAuthenticated, queryClient]);

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  // Pause WS when app goes to background, resume on foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") connect();
      else disconnect();
    });
    return () => sub.remove();
  }, [connect, disconnect]);
}
```

**Note:** The `_accessTokenCache` is currently unexported from `client.ts`. Export it by adding to `client.ts`:
```typescript
export function getAccessToken(): string | null { return _accessTokenCache; }
```
Then update `useWebSocket.ts` to use `import { getAccessToken } from "../api/client"` instead of `require`.

- [ ] **Step 2: Commit**

```bash
git add mobile/src/hooks/
git commit -m "feat(mobile): WebSocket hook with AppState lifecycle and React Query integration"
```

---

## Task 7: Mobile Navigation Layout + Login Screen

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/(auth)/_layout.tsx`
- Create: `mobile/app/(auth)/login.tsx`
- Create: `mobile/app/(app)/_layout.tsx`
- Create: `mobile/__tests__/login.test.tsx`

- [ ] **Step 1: Write failing login screen test**

`mobile/__tests__/login.test.tsx`:
```typescript
import React from "react";
import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("expo-secure-store", () => ({ setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("expo-constants", () => ({ expoConfig: { extra: { apiUrl: "http://localhost" } } }));
jest.mock("../src/store/authStore", () => ({
  useAuthStore: () => ({ isAuthenticated: false, setAuth: jest.fn() }),
}));

import LoginScreen from "../app/(auth)/login";

test("renders email and password inputs", () => {
  render(<LoginScreen />);
  expect(screen.getByPlaceholderText("E-posta")).toBeTruthy();
  expect(screen.getByPlaceholderText("Şifre")).toBeTruthy();
  expect(screen.getByText("Giriş Yap")).toBeTruthy();
});
```

Run: `cd mobile && npm test -- --testPathPattern=login --passWithNoTests`
Expected: FAIL (module not found — login.tsx doesn't exist yet).

- [ ] **Step 2: Create mobile/app/_layout.tsx**

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Slot />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Create mobile/app/(auth)/_layout.tsx**

```typescript
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 4: Create mobile/app/(auth)/login.tsx**

```typescript
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthStore } from "../../src/store/authStore";
import { authApi } from "../../src/api/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      await setAuth(res.user, res.tokens.access_token, res.refresh_token);
    } catch {
      Alert.alert("Hata", "E-posta veya şifre hatalı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>NanoNet</Text>
        <Text style={styles.subtitle}>Servis İzleme</Text>
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Giriş Yap</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#1e293b", borderRadius: 16, padding: 28, gap: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#f1f5f9", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginTop: -8 },
  input: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f1f5f9",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
```

- [ ] **Step 5: Create mobile/app/(app)/_layout.tsx (tab bar)**

```typescript
import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";
import { Bell, Home, LayoutList, AlertCircle, ScrollText } from "lucide-react-native";

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#0f172a", borderTopColor: "#1e293b" },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#64748b",
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f1f5f9",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarIcon: ({ color }) => <Home size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: "Alerts", tabBarIcon: ({ color }) => <AlertCircle size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="incidents"
        options={{ title: "Incidents", tabBarIcon: ({ color }) => <LayoutList size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="logs"
        options={{ title: "Logs", tabBarIcon: ({ color }) => <ScrollText size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: "Ayarlar", tabBarIcon: ({ color }) => <Bell size={22} color={color} /> }}
      />
      {/* Hidden from tab bar — navigated via link */}
      <Tabs.Screen name="services/[id]" options={{ href: null }} />
      <Tabs.Screen name="slo" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
    </Tabs>
  );
}
```

**Note:** `lucide-react-native` must be added to `mobile/package.json` dependencies: `"lucide-react-native": "^0.400.0"`.

- [ ] **Step 6: Run login test**

Run: `cd mobile && npm test -- --testPathPattern=login`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/ mobile/__tests__/login.test.tsx
git commit -m "feat(mobile): navigation layout and login screen"
```

---

## Task 8: Shared Components + Services API

**Files:**
- Create: `mobile/src/components/StatusBadge.tsx`
- Create: `mobile/src/components/MetricChart.tsx`
- Create: `mobile/src/components/EmptyState.tsx`
- Create: `mobile/src/api/services.ts`

- [ ] **Step 1: Create mobile/src/components/StatusBadge.tsx**

```typescript
import { StyleSheet, Text, View } from "react-native";

type Status = "up" | "down" | "degraded" | "unknown";

const COLORS: Record<Status, { bg: string; text: string }> = {
  up: { bg: "#14532d", text: "#86efac" },
  down: { bg: "#7f1d1d", text: "#fca5a5" },
  degraded: { bg: "#713f12", text: "#fcd34d" },
  unknown: { bg: "#1e293b", text: "#94a3b8" },
};

const LABELS: Record<Status, string> = {
  up: "UP", down: "DOWN", degraded: "DEGRADED", unknown: "UNKNOWN",
};

export function StatusBadge({ status }: { status: Status }) {
  const c = COLORS[status] ?? COLORS.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{LABELS[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});
```

- [ ] **Step 2: Create mobile/src/components/MetricChart.tsx**

```typescript
import { Dimensions, View } from "react-native";
import { VictoryChart, VictoryLine, VictoryTheme } from "victory-native";

interface DataPoint { x: number; y: number }

interface MetricChartProps {
  data: DataPoint[];
  color?: string;
}

const SCREEN_WIDTH = Dimensions.get("window").width;

export function MetricChart({ data, color = "#3b82f6" }: MetricChartProps) {
  if (data.length < 2) return null;
  return (
    <View style={{ backgroundColor: "#0f172a", borderRadius: 10, overflow: "hidden" }}>
      <VictoryChart
        width={SCREEN_WIDTH - 48}
        height={160}
        theme={VictoryTheme.material}
        padding={{ top: 10, bottom: 30, left: 40, right: 10 }}
      >
        <VictoryLine
          data={data}
          style={{ data: { stroke: color, strokeWidth: 2 } }}
          interpolation="monotoneX"
        />
      </VictoryChart>
    </View>
  );
}
```

- [ ] **Step 3: Create mobile/src/components/EmptyState.tsx**

```typescript
import { StyleSheet, Text, View } from "react-native";

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  text: { color: "#64748b", fontSize: 15, textAlign: "center" },
});
```

- [ ] **Step 4: Create mobile/src/api/services.ts**

```typescript
import { apiClient } from "./client";
import type { Service, ServiceMetrics } from "@nanonet/shared-types";

export const servicesApi = {
  list: async (): Promise<Service[]> => {
    const { data } = await apiClient.get<{ data: { services: Service[] } }>("/services");
    return data.data.services ?? [];
  },

  get: async (id: string): Promise<Service> => {
    const { data } = await apiClient.get<{ data: Service }>(`/services/${id}`);
    return data.data;
  },

  metrics: async (id: string, range = "1h"): Promise<ServiceMetrics[]> => {
    const { data } = await apiClient.get<{ data: ServiceMetrics[] }>(
      `/metrics/${id}?range=${range}`
    );
    return data.data ?? [];
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ mobile/src/api/services.ts
git commit -m "feat(mobile): shared components (StatusBadge, MetricChart, EmptyState) and services API"
```

---

## Task 9: Dashboard + Service Detail Screens

**Files:**
- Create: `mobile/app/(app)/index.tsx`
- Create: `mobile/app/(app)/services/[id].tsx`
- Create: `mobile/__tests__/dashboard.test.tsx`

- [ ] **Step 1: Write failing dashboard test**

`mobile/__tests__/dashboard.test.tsx`:
```typescript
import React from "react";
import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false, isError: false }),
}));
jest.mock("../../src/hooks/useWebSocket", () => ({ useWebSocket: jest.fn() }));

import Dashboard from "../(app)/index";

test("renders dashboard heading", () => {
  render(<Dashboard />);
  expect(screen.getByText("Dashboard")).toBeTruthy();
});
```

Run: `cd mobile && npm test -- --testPathPattern=dashboard --passWithNoTests`
Expected: FAIL (module not found).

- [ ] **Step 2: Create mobile/app/(app)/index.tsx (Dashboard)**

```typescript
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { StatusBadge } from "../../src/components/StatusBadge";
import { servicesApi } from "../../src/api/services";
import { useWebSocket } from "../../src/hooks/useWebSocket";
import type { Service } from "@nanonet/shared-types";

export default function DashboardScreen() {
  useWebSocket();
  const router = useRouter();
  const { data: services = [], isLoading, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.list,
    refetchInterval: 30_000,
  });

  const up = services.filter((s) => s.status === "up").length;
  const down = services.filter((s) => s.status === "down").length;
  const degraded = services.filter((s) => s.status === "degraded").length;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Dashboard</Text>
      <View style={styles.counters}>
        <Counter label="UP" value={up} color="#86efac" />
        <Counter label="DOWN" value={down} color="#fca5a5" />
        <Counter label="DEGRADED" value={degraded} color="#fcd34d" />
      </View>
      {services.length === 0 && !isLoading ? (
        <EmptyState message="Henüz servis yok." />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(s) => s.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/(app)/services/${item.id}`)}>
              <View style={styles.cardRow}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.cardHost}>{item.host}:{item.port}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.counter}>
      <Text style={[styles.counterValue, { color }]}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  counters: { flexDirection: "row", justifyContent: "space-around", marginBottom: 16, paddingHorizontal: 16 },
  counter: { alignItems: "center" },
  counterValue: { fontSize: 28, fontWeight: "700" },
  counterLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: "600", color: "#f1f5f9", flex: 1, marginRight: 8 },
  cardHost: { fontSize: 13, color: "#64748b" },
});
```

- [ ] **Step 3: Create mobile/src/api/alerts.ts**

```typescript
import { apiClient } from "./client";
import type { Alert } from "@nanonet/shared-types";

export const alertsApi = {
  list: async (serviceId?: string): Promise<Alert[]> => {
    const params = serviceId ? `?service_id=${serviceId}` : "";
    const { data } = await apiClient.get<{ data: { alerts: Alert[] } }>(`/alerts${params}`);
    return data.data.alerts ?? [];
  },
};
```

- [ ] **Step 4: Create mobile/app/(app)/services/[id].tsx (Service Detail)**

```typescript
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { MetricChart } from "../../../src/components/MetricChart";
import { servicesApi } from "../../../src/api/services";
import type { ServiceMetrics } from "@nanonet/shared-types";

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: service } = useQuery({
    queryKey: ["service", id],
    queryFn: () => servicesApi.get(id),
    enabled: !!id,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["serviceMetrics", id],
    queryFn: () => servicesApi.metrics(id),
    enabled: !!id,
    refetchInterval: 60_000,
  });

  const toChartData = (key: keyof ServiceMetrics) =>
    metrics.map((m, i) => ({ x: i, y: Number(m[key] ?? 0) }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.header}>
        <Text style={styles.name}>{service?.name ?? "…"}</Text>
        {service && <StatusBadge status={service.status} />}
      </View>
      <Text style={styles.host}>{service?.host}:{service?.port}</Text>

      <ChartSection label="CPU %" data={toChartData("cpu_percent")} color="#3b82f6" />
      <ChartSection label="Memory (MB)" data={toChartData("memory_used_mb")} color="#8b5cf6" />
      <ChartSection label="Latency (ms)" data={toChartData("latency_ms")} color="#10b981" />
      <ChartSection label="Error Rate" data={toChartData("error_rate")} color="#ef4444" />

      {service?.agent_connected && (
        <View style={styles.agentRow}>
          <Text style={styles.agentLabel}>Agent</Text>
          <Text style={styles.agentValue}>{service.agent_status ?? "unknown"} · v{service.agent_version}</Text>
        </View>
      )}

      <Pressable style={styles.logLink} onPress={() => router.push({ pathname: "/(app)/logs", params: { serviceId: id } })}>
        <Text style={styles.logLinkText}>Loglara git →</Text>
      </Pressable>

      <Pressable style={styles.logLink} onPress={() => router.push({ pathname: "/(app)/slo", params: { serviceId: id } })}>
        <Text style={styles.logLinkText}>SLO →</Text>
      </Pressable>
    </ScrollView>
  );
}

function ChartSection({ label, data, color }: { label: string; data: { x: number; y: number }[]; color: string }) {
  return (
    <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
      <Text style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>{label}</Text>
      <MetricChart data={data} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 4 },
  name: { fontSize: 20, fontWeight: "700", color: "#f1f5f9", flex: 1 },
  host: { color: "#64748b", fontSize: 13, paddingHorizontal: 16, marginBottom: 20 },
  agentRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#1e293b", marginHorizontal: 16, borderRadius: 10, marginBottom: 12 },
  agentLabel: { color: "#94a3b8", fontSize: 14 },
  agentValue: { color: "#f1f5f9", fontSize: 14 },
  logLink: { marginHorizontal: 16, marginTop: 8 },
  logLinkText: { color: "#3b82f6", fontSize: 15 },
});
```

- [ ] **Step 5: Run dashboard test**

Run: `cd mobile && npm test -- --testPathPattern=dashboard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/ mobile/__tests__/ mobile/src/api/alerts.ts
git commit -m "feat(mobile): Dashboard and Service Detail screens"
```

---

## Task 10: Alerts + Incidents Screens

**Files:**
- Create: `mobile/src/api/incidents.ts`
- Create: `mobile/app/(app)/alerts.tsx`
- Create: `mobile/app/(app)/incidents.tsx`

- [ ] **Step 1: Create mobile/src/api/incidents.ts**

```typescript
import { apiClient } from "./client";

export interface IncidentListItem {
  id: string;
  title: string;
  severity: "info" | "warn" | "crit";
  service_name: string;
  started_at: string;
  resolved_at: string | null;
  alert_count: number;
}

export const incidentsApi = {
  list: async (): Promise<IncidentListItem[]> => {
    const { data } = await apiClient.get<{ data: { incidents: IncidentListItem[] } }>("/incidents");
    return data.data.incidents ?? [];
  },
};
```

- [ ] **Step 2: Create mobile/app/(app)/alerts.tsx**

```typescript
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { alertsApi } from "../../src/api/alerts";
import { EmptyState } from "../../src/components/EmptyState";
import type { Alert } from "@nanonet/shared-types";

const SEVERITIES = ["all", "crit", "warn", "info"] as const;
type Filter = (typeof SEVERITIES)[number];

const SEV_COLOR: Record<string, string> = { crit: "#ef4444", warn: "#f59e0b", info: "#3b82f6" };

export default function AlertsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.list(),
    refetchInterval: 30_000,
  });

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Alerts</Text>
      <View style={styles.filters}>
        {SEVERITIES.map((s) => (
          <Pressable key={s} style={[styles.chip, filter === s && styles.chipActive]} onPress={() => setFilter(s)}>
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>{s.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState message="Alert bulunamadı." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }) => <AlertCard alert={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const color = SEV_COLOR[alert.severity] ?? "#94a3b8";
  const resolved = !!alert.resolved_at;
  return (
    <View style={[styles.card, { borderLeftColor: color, opacity: resolved ? 0.6 : 1 }]}>
      <View style={styles.cardRow}>
        <Text style={[styles.severity, { color }]}>{alert.severity.toUpperCase()}</Text>
        {resolved && <Text style={styles.resolved}>Çözüldü</Text>}
      </View>
      <Text style={styles.message}>{alert.message}</Text>
      <Text style={styles.time}>{new Date(alert.triggered_at).toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1e293b" },
  chipActive: { backgroundColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16, borderLeftWidth: 3 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  severity: { fontSize: 12, fontWeight: "700" },
  resolved: { fontSize: 12, color: "#64748b" },
  message: { color: "#e2e8f0", fontSize: 14, marginBottom: 6 },
  time: { color: "#64748b", fontSize: 12 },
});
```

- [ ] **Step 3: Create mobile/app/(app)/incidents.tsx**

```typescript
import { useQuery } from "@tanstack/react-query";
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { incidentsApi, type IncidentListItem } from "../../src/api/incidents";
import { EmptyState } from "../../src/components/EmptyState";

const SEV_COLOR: Record<string, string> = { crit: "#ef4444", warn: "#f59e0b", info: "#3b82f6" };

export default function IncidentsScreen() {
  const [selected, setSelected] = useState<IncidentListItem | null>(null);
  const { data: incidents = [], isLoading, refetch } = useQuery({
    queryKey: ["incidents"],
    queryFn: incidentsApi.list,
    refetchInterval: 60_000,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Incidents</Text>
      {incidents.length === 0 && !isLoading ? (
        <EmptyState message="Aktif incident yok." />
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, { borderLeftColor: SEV_COLOR[item.severity] ?? "#94a3b8" }]} onPress={() => setSelected(item)}>
              <Text style={[styles.sev, { color: SEV_COLOR[item.severity] }]}>{item.severity.toUpperCase()}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.sub}>{item.service_name} · {item.alert_count} alert</Text>
              <Text style={styles.time}>{new Date(item.started_at).toLocaleString()}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <ScrollView style={styles.modal}>
          <Pressable onPress={() => setSelected(null)}><Text style={styles.close}>✕ Kapat</Text></Pressable>
          {selected && (
            <>
              <Text style={styles.modalTitle}>{selected.title}</Text>
              <Text style={styles.modalSub}>{selected.service_name}</Text>
              <Text style={styles.modalMeta}>Başladı: {new Date(selected.started_at).toLocaleString()}</Text>
              {selected.resolved_at && (
                <Text style={styles.modalMeta}>Çözüldü: {new Date(selected.resolved_at).toLocaleString()}</Text>
              )}
              <Text style={styles.modalMeta}>{selected.alert_count} ilişkili alert</Text>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16, borderLeftWidth: 3 },
  sev: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  title: { color: "#f1f5f9", fontSize: 15, fontWeight: "600", marginBottom: 2 },
  sub: { color: "#94a3b8", fontSize: 13, marginBottom: 4 },
  time: { color: "#64748b", fontSize: 12 },
  modal: { flex: 1, backgroundColor: "#0f172a", padding: 24 },
  close: { color: "#64748b", fontSize: 15, marginBottom: 20 },
  modalTitle: { color: "#f1f5f9", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  modalSub: { color: "#94a3b8", fontSize: 14, marginBottom: 16 },
  modalMeta: { color: "#64748b", fontSize: 14, marginBottom: 8 },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/(app)/alerts.tsx mobile/app/(app)/incidents.tsx mobile/src/api/incidents.ts
git commit -m "feat(mobile): Alerts and Incidents screens"
```

---

## Task 11: Logs + SLO + AI Insights Screens

**Files:**
- Create: `mobile/src/api/logs.ts`
- Create: `mobile/src/api/slo.ts`
- Create: `mobile/src/api/ai.ts`
- Create: `mobile/app/(app)/logs.tsx`
- Create: `mobile/app/(app)/slo.tsx`
- Create: `mobile/app/(app)/ai.tsx`

- [ ] **Step 1: Create mobile/src/api/logs.ts**

```typescript
import { apiClient } from "./client";
import type { ServiceLog, LogsResponse } from "@nanonet/shared-types";

export const logsApi = {
  list: async (params: { serviceId?: string; limit?: number; offset?: number } = {}): Promise<LogsResponse> => {
    const q = new URLSearchParams();
    if (params.serviceId) q.set("service_id", params.serviceId);
    q.set("limit", String(params.limit ?? 50));
    q.set("offset", String(params.offset ?? 0));
    const { data } = await apiClient.get<{ data: LogsResponse }>(`/logs?${q}`);
    return data.data;
  },
};
```

- [ ] **Step 2: Create mobile/src/api/slo.ts**

```typescript
import { apiClient } from "./client";

export interface SLO {
  id: string;
  name: string;
  sli_type: string;
  target: number;
  window_days: number;
}

export interface SLOCompliance {
  slo: SLO;
  good_samples: number;
  total_samples: number;
  compliance_pct: number;
  budget_remaining_pct: number;
}

export const sloApi = {
  list: async (): Promise<SLOCompliance[]> => {
    const { data } = await apiClient.get<{ data: { slos: SLOCompliance[] } }>("/slo/compliance");
    return data.data.slos ?? [];
  },
};
```

- [ ] **Step 3: Create mobile/src/api/ai.ts**

```typescript
import { apiClient } from "./client";
import type { AIInsight } from "@nanonet/shared-types";

export const aiApi = {
  insights: async (): Promise<AIInsight[]> => {
    const { data } = await apiClient.get<{ data: { insights: AIInsight[] } }>("/ai/insights");
    return data.data.insights ?? [];
  },
};
```

- [ ] **Step 4: Create mobile/app/(app)/logs.tsx**

```typescript
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { logsApi } from "../../src/api/logs";
import { EmptyState } from "../../src/components/EmptyState";
import type { ServiceLog } from "@nanonet/shared-types";

const LEVEL_COLOR: Record<string, string> = {
  error: "#ef4444", warn: "#f59e0b", info: "#3b82f6", debug: "#64748b",
};

export default function LogsScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs", serviceId],
    queryFn: () => logsApi.list({ serviceId }),
    refetchInterval: 30_000,
  });

  const logs = data?.logs ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Logs</Text>
      {logs.length === 0 && !isLoading ? (
        <EmptyState message="Log bulunamadı." />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }) => <LogRow log={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function LogRow({ log }: { log: ServiceLog }) {
  const color = LEVEL_COLOR[log.level] ?? "#94a3b8";
  return (
    <View style={styles.row}>
      <Text style={[styles.level, { color }]}>{log.level.toUpperCase()}</Text>
      <Text style={styles.message} numberOfLines={3}>{log.message}</Text>
      <Text style={styles.time}>{new Date(log.time).toLocaleTimeString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  row: { borderBottomWidth: 1, borderBottomColor: "#1e293b", paddingHorizontal: 16, paddingVertical: 10 },
  level: { fontSize: 10, fontWeight: "700", marginBottom: 2 },
  message: { color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", marginBottom: 4 },
  time: { color: "#64748b", fontSize: 11 },
});
```

- [ ] **Step 5: Create mobile/app/(app)/slo.tsx**

```typescript
import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { sloApi, type SLOCompliance } from "../../src/api/slo";
import { EmptyState } from "../../src/components/EmptyState";

export default function SLOScreen() {
  const { data: slos = [], isLoading, refetch } = useQuery({
    queryKey: ["slo"],
    queryFn: sloApi.list,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>SLO</Text>
      {slos.length === 0 && !isLoading ? (
        <EmptyState message="SLO tanımlanmamış." />
      ) : (
        <FlatList
          data={slos}
          keyExtractor={(s) => s.slo.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }) => <SLOCard item={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function SLOCard({ item }: { item: SLOCompliance }) {
  const ok = item.compliance_pct >= item.slo.target;
  const budgetColor = item.budget_remaining_pct > 20 ? "#86efac" : item.budget_remaining_pct > 5 ? "#fcd34d" : "#fca5a5";
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.slo.name}</Text>
      <Text style={styles.type}>{item.slo.sli_type} · {item.slo.window_days}d window</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Uyum</Text>
        <Text style={[styles.value, { color: ok ? "#86efac" : "#fca5a5" }]}>
          {item.compliance_pct.toFixed(2)}% / {item.slo.target}%
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Hata Bütçesi</Text>
        <Text style={[styles.value, { color: budgetColor }]}>{item.budget_remaining_pct.toFixed(1)}% kaldı</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16 },
  name: { color: "#f1f5f9", fontSize: 15, fontWeight: "600", marginBottom: 2 },
  type: { color: "#64748b", fontSize: 12, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { color: "#94a3b8", fontSize: 13 },
  value: { fontSize: 13, fontWeight: "600" },
});
```

- [ ] **Step 6: Create mobile/app/(app)/ai.tsx**

```typescript
import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { aiApi } from "../../src/api/ai";
import { EmptyState } from "../../src/components/EmptyState";
import type { AIInsight } from "@nanonet/shared-types";

export default function AIInsightsScreen() {
  const { data: insights = [], isLoading, refetch } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: aiApi.insights,
    refetchInterval: 120_000,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>AI Insights</Text>
      {insights.length === 0 && !isLoading ? (
        <EmptyState message="Henüz AI analizi yok." />
      ) : (
        <FlatList
          data={insights}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }) => <InsightCard item={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function InsightCard({ item }: { item: AIInsight }) {
  return (
    <View style={styles.card}>
      <Text style={styles.summary}>{item.summary}</Text>
      {item.root_cause && <Text style={styles.cause}>Kök neden: {item.root_cause}</Text>}
      {item.recommendations?.slice(0, 2).map((r, i) => (
        <Text key={i} style={styles.rec}>• {r.action}</Text>
      ))}
      <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16 },
  summary: { color: "#e2e8f0", fontSize: 14, marginBottom: 8 },
  cause: { color: "#f59e0b", fontSize: 13, marginBottom: 6 },
  rec: { color: "#94a3b8", fontSize: 13, marginBottom: 3 },
  time: { color: "#64748b", fontSize: 11, marginTop: 8 },
});
```

- [ ] **Step 7: Commit**

```bash
git add mobile/app/(app)/logs.tsx mobile/app/(app)/slo.tsx mobile/app/(app)/ai.tsx mobile/src/api/
git commit -m "feat(mobile): Logs, SLO, and AI Insights screens"
```

---

## Task 12: Notifications Settings Screen + Push Token Registration

**Files:**
- Create: `mobile/src/api/push.ts`
- Create: `mobile/app/(app)/notifications.tsx`

- [ ] **Step 1: Create mobile/src/api/push.ts**

```typescript
import { apiClient } from "./client";

export interface PushPreference {
  user_id: string;
  enabled: boolean;
  min_severity: "info" | "warn" | "crit";
}

export const pushApi = {
  registerToken: async (token: string, platform: "ios" | "android"): Promise<void> => {
    await apiClient.post("/notifications/push-token", { token, platform });
  },

  deleteToken: async (token: string): Promise<void> => {
    await apiClient.delete("/notifications/push-token", { data: { token } });
  },

  getPreference: async (): Promise<PushPreference> => {
    const { data } = await apiClient.get<{ data: PushPreference }>("/notifications/push-preferences");
    return data.data;
  },

  updatePreference: async (pref: Partial<PushPreference>): Promise<PushPreference> => {
    const { data } = await apiClient.put<{ data: PushPreference }>("/notifications/push-preferences", pref);
    return data.data;
  },
};
```

- [ ] **Step 2: Create mobile/app/(app)/notifications.tsx**

```typescript
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform, ScrollView, StyleSheet, Switch, Text, View, Pressable, Alert } from "react-native";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pushApi } from "../../src/api/push";
import { useAuthStore } from "../../src/store/authStore";
import { authApi } from "../../src/api/auth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const [pushToken, setPushToken] = useState<string | null>(null);

  const { data: pref } = useQuery({
    queryKey: ["push-pref"],
    queryFn: pushApi.getPreference,
  });

  const updateMutation = useMutation({
    mutationFn: pushApi.updatePreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["push-pref"] }),
  });

  useEffect(() => {
    registerForPushNotifications().then(async (token) => {
      if (!token) return;
      setPushToken(token);
      const platform = Platform.OS === "ios" ? "ios" : "android";
      await pushApi.registerToken(token, platform).catch(() => null);
    });
  }, []);

  const handleLogout = async () => {
    try {
      if (pushToken) await pushApi.deleteToken(pushToken).catch(() => null);
      await authApi.logout();
    } finally {
      await clearAuth();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, gap: 20 }}>
      <Text style={styles.heading}>Ayarlar</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Bildirimler</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Bildirimler</Text>
          <Switch
            value={pref?.enabled ?? true}
            onValueChange={(v) => updateMutation.mutate({ enabled: v })}
            trackColor={{ true: "#3b82f6" }}
          />
        </View>

        <Text style={[styles.label, { marginTop: 16, marginBottom: 8 }]}>Minimum Seviye</Text>
        {(["info", "warn", "crit"] as const).map((sev) => (
          <Pressable
            key={sev}
            style={[styles.sevOption, pref?.min_severity === sev && styles.sevActive]}
            onPress={() => updateMutation.mutate({ min_severity: sev })}
          >
            <Text style={[styles.sevText, pref?.min_severity === sev && styles.sevTextActive]}>
              {sev.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", marginBottom: 8 },
  section: { backgroundColor: "#1e293b", borderRadius: 12, padding: 16 },
  sectionTitle: { color: "#94a3b8", fontSize: 13, fontWeight: "600", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "#e2e8f0", fontSize: 15 },
  sevOption: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginBottom: 6, backgroundColor: "#0f172a" },
  sevActive: { backgroundColor: "#1d4ed8" },
  sevText: { color: "#94a3b8", fontSize: 14 },
  sevTextActive: { color: "#fff", fontWeight: "600" },
  logoutBtn: { backgroundColor: "#7f1d1d", borderRadius: 12, padding: 16, alignItems: "center" },
  logoutText: { color: "#fca5a5", fontWeight: "700", fontSize: 15 },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(app)/notifications.tsx mobile/src/api/push.ts
git commit -m "feat(mobile): Notifications settings screen with push token registration and logout"
```

---

## Task 13: EAS Build + Makefile Targets

**Files:**
- Modify: `Makefile`
- Create: `mobile/eas.json`

- [ ] **Step 1: Create mobile/eas.json**

```json
{
  "cli": {
    "version": ">= 8.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 2: Add mobile targets to Makefile**

Add to the end of the existing `Makefile`:

```makefile
# ── Mobile ────────────────────────────────────────────────────────────────────
.PHONY: mobile-start mobile-test mobile-build-preview

mobile-start:
	cd mobile && npx expo start

mobile-test:
	cd mobile && npm test -- --passWithNoTests

mobile-build-preview:
	cd mobile && npx eas build --profile preview --platform all --non-interactive
```

- [ ] **Step 3: Run mobile tests one final time**

Run:
```bash
make mobile-test
```
Expected: all tests pass.

- [ ] **Step 4: Final build check (backend)**

Run:
```bash
cd backend && go build ./...
```
Expected: no errors.

- [ ] **Step 5: Final type check (frontend — verify shared-types didn't break anything)**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/eas.json Makefile
git commit -m "feat(mobile): EAS Build config and Makefile targets"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Monorepo workspaces + shared-types (Task 1)
- ✅ Mobile auth — X-Mobile-Client header, body refresh token (Task 2)
- ✅ Push notification DB tables + Expo HTTP client + handler (Task 3)
- ✅ Mobile scaffold — package.json, tsconfig, app.json (Task 4)
- ✅ API client with Bearer-only, SecureStore, token refresh (Task 5)
- ✅ WebSocket hook with AppState lifecycle (Task 6)
- ✅ Navigation + Login screen (Task 7)
- ✅ Dashboard + Service Detail (Task 9)
- ✅ Alerts + Incidents (Task 10)
- ✅ Logs + SLO + AI Insights (Task 11)
- ✅ Notifications Settings + push token registration (Task 12)
- ✅ EAS Build + Makefile (Task 13)

**Watch-outs:**
- `parseUser` is already defined in `backend/internal/notifications/handler.go` — do NOT redeclare it in `push_handler.go`. Use the existing function.
- `_accessTokenCache` in `client.ts` is a module-level `let`; export `getAccessToken()` and use it in `useWebSocket.ts` instead of `require()` hacks.
- `lucide-react-native` must be added to `mobile/package.json` before running the tab layout.
- EAS Build requires `eas-cli` installed globally (`npm install -g eas-cli`) and an Expo account — this is a deploy-time step, not build-time.
