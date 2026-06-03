package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func newRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SecurityHeadersMiddleware())
	r.GET("/api/v1/ping", func(c *gin.Context) { c.String(200, "ok") })
	r.GET("/", func(c *gin.Context) { c.String(200, "ok") })
	return r
}

func get(r *gin.Engine, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, path, nil)
	r.ServeHTTP(w, req)
	return w
}

func TestSecurityHeaders_CommonHeadersAlwaysSet(t *testing.T) {
	r := newRouter()
	w := get(r, "/api/v1/ping")
	for _, h := range []string{
		"X-Content-Type-Options",
		"X-Frame-Options",
		"X-XSS-Protection",
		"Referrer-Policy",
		"Permissions-Policy",
		"Content-Security-Policy",
	} {
		if w.Header().Get(h) == "" {
			t.Errorf("expected %s header to be set", h)
		}
	}
}

func TestSecurityHeaders_APIRoutesGetStrictCSP(t *testing.T) {
	r := newRouter()
	w := get(r, "/api/v1/ping")
	csp := w.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "default-src 'none'") {
		t.Errorf("API route CSP should be strict default-src 'none', got %q", csp)
	}
	if !strings.Contains(csp, "frame-ancestors 'none'") {
		t.Errorf("API CSP should set frame-ancestors 'none', got %q", csp)
	}
}

func TestSecurityHeaders_SwaggerDocsGetsRelaxedCSP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SecurityHeadersMiddleware())
	r.GET("/api/docs", func(c *gin.Context) { c.String(200, "<html></html>") })
	w := get(r, "/api/docs")
	csp := w.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "https://unpkg.com") {
		t.Errorf("docs CSP should allow unpkg.com CDN, got %q", csp)
	}
	if !strings.Contains(csp, "script-src 'self' 'unsafe-inline' https://unpkg.com") {
		t.Errorf("docs CSP should allow inline+unpkg scripts for Swagger UI, got %q", csp)
	}
}

func TestSecurityHeaders_NonDocsAPIStaysStrict(t *testing.T) {
	r := newRouter()
	// /api/openapi.yaml is data, not the docs HTML — must remain strict.
	w := get(r, "/api/v1/ping")
	csp := w.Header().Get("Content-Security-Policy")
	if strings.Contains(csp, "unpkg.com") || strings.Contains(csp, "script-src 'self' 'unsafe-inline'") {
		t.Errorf("non-docs API route must keep strict CSP, got %q", csp)
	}
}

func TestSecurityHeaders_NonAPIRouteCSPAllowsSelf(t *testing.T) {
	r := newRouter()
	w := get(r, "/")
	csp := w.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "script-src 'self'") {
		t.Errorf("SPA CSP should allow script-src 'self', got %q", csp)
	}
	if strings.Contains(csp, "'unsafe-inline'") && !strings.Contains(csp, "style-src 'self' 'unsafe-inline'") {
		t.Errorf("only style-src may use 'unsafe-inline', got %q", csp)
	}
	if strings.Contains(csp, "script-src 'self' 'unsafe-inline'") {
		t.Errorf("script-src must not include 'unsafe-inline'; got %q", csp)
	}
}
