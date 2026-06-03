package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// apiCSP — backend doğrudan HTML servis etmediğinde uyguladığımız sıkı
// CSP. Tüm origin'ler 'none'; çıkıntı yapan tek şey base-uri/frame-ancestors
// önlemleri.
const apiCSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"

// swaggerCSP — yalnızca `/api/docs` Swagger UI sayfası için. Swagger UI
// varlıkları unpkg CDN'den yüklenir ve init/init-style inline olduğundan
// script/style için 'unsafe-inline' + unpkg.com origin'ine izin verilir.
// Bu yalnızca tek bir docs rotasıyla sınırlıdır; API/JSON rotaları hâlâ
// katı apiCSP kullanır.
const swaggerCSP = "default-src 'none'; " +
	"script-src 'self' 'unsafe-inline' https://unpkg.com; " +
	"style-src 'self' 'unsafe-inline' https://unpkg.com; " +
	"img-src 'self' data: https://unpkg.com; " +
	"font-src 'self' data: https://unpkg.com; " +
	"connect-src 'self'; " +
	"frame-ancestors 'none'; base-uri 'none'; object-src 'none'"

// SecurityHeadersMiddleware sets security-related HTTP response headers.
//
// CSP iki versiyonludur:
//   - API rotaları (`/api/...`, `/health`, `/ws/...`): JSON/WS dışı içerik
//     yok ⇒ apiCSP. Bu, API'nin HTML render etmesine kazara izin verecek
//     bir bug'a karşı sigorta görevi görür.
//   - Diğer rotalar (örn. backend tek başına SPA serve ediyorsa): SPA için
//     gerekli direktifler. NanoNet üretiminde frontend ayrı serve edilir;
//     yine de güvenli bir CSP varsayılanı koyuyoruz.
//
// Frontend'in kendi CSP'sini Nginx ya da CDN katmanında koyması beklenir
// (statik dosya origin'i farklı olabileceği için); orada da aşağıdaki
// `spaCSP` referans alınmalı.
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		path := c.Request.URL.Path
		if path == "/api/docs" {
			// Swagger UI HTML sayfası — CDN + inline gerektirir.
			c.Header("Content-Security-Policy", swaggerCSP)
		} else if strings.HasPrefix(path, "/api/") ||
			strings.HasPrefix(path, "/ws/") ||
			path == "/health" ||
			path == "/metrics" {
			c.Header("Content-Security-Policy", apiCSP)
		} else {
			// SPA için biraz daha esnek: stil için 'unsafe-inline' (Tailwind
			// runtime için), font/img veri URL'leri, WS bağlantısı.
			c.Header("Content-Security-Policy",
				"default-src 'self'; "+
					"script-src 'self'; "+
					"style-src 'self' 'unsafe-inline'; "+
					"img-src 'self' data: blob:; "+
					"font-src 'self' data:; "+
					"connect-src 'self' ws: wss:; "+
					"frame-ancestors 'none'; "+
					"base-uri 'self'; "+
					"object-src 'none'; "+
					"form-action 'self'")
		}

		// Only set HSTS when we are actually serving over HTTPS (or behind a TLS
		// terminating proxy that forwards the proto).
		if c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https") {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}
