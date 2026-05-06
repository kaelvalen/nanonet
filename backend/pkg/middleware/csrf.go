package middleware

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CSRFMiddleware — double-submit cookie pattern ile CSRF koruması.
//
//	1. Sunucu login/register/refresh sırasında nn_csrf çerezini set eder
//	   (random 32 byte; SameSite=Strict; Secure; HttpOnly **değil**).
//	2. Frontend cookie'yi okuyup mutating isteklerde X-CSRF-Token header'ı
//	   olarak geri yollar.
//	3. Bu middleware, mutating isteklerde header ile cookie'nin **birebir
//	   eşleştiğini** sabit zamanlı karşılaştırma ile doğrular.
//
// SameSite=Strict zaten browser tarafında çoğu CSRF vektörünü kapatır;
// double-submit ise eski tarayıcılarda ve "saf cookie taşıma" senaryosunda
// ek katmandır. JWT bearer ile erişen API client'ları header'a sahipse zaten
// kontrolü geçer; cookie yoksa (örn. agent'lar / first-party API token'lı
// CLI) bu middleware kapsam dışında olmalı (route grubu seçer).
//
// `skipPaths` set'i `c.FullPath()` ile karşılaştırılır; o yüzden gin-style
// param notation (örn. "/api/v1/auth/login") kullanılır. Bu liste
// genellikle: login, register, refresh, forgot-password, reset-password —
// yani kullanıcının henüz cookie'si olmadığı uçlar.
func CSRFMiddleware(skipPaths ...string) gin.HandlerFunc {
	skip := make(map[string]struct{}, len(skipPaths))
	for _, p := range skipPaths {
		skip[p] = struct{}{}
	}
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}

		if _, ok := skip[c.FullPath()]; ok {
			c.Next()
			return
		}

		// Bearer-only API client'lar (CLI, third-party automations) için
		// cookie hiç olmayabilir; bu durumda CSRF kontrolünü atla — saf
		// JWT auth zaten istemcinin sunucu tarafında saklanan secret'ı
		// göndermesini gerektirir, browser-csrf vektörü mevcut değildir.
		cookie, err := c.Cookie(CookieCSRF)
		if err != nil || cookie == "" {
			c.Next()
			return
		}

		header := c.GetHeader("X-CSRF-Token")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "CSRF token eksik",
			})
			return
		}
		if subtle.ConstantTimeCompare([]byte(cookie), []byte(header)) != 1 {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "CSRF doğrulaması başarısız",
			})
			return
		}

		c.Next()
	}
}

// GenerateCSRFToken — 32 byte random base64 token üretir.
// "url-safe-no-pad" tercih ediliyor: cookie/header taşınımı kolay,
// trim/encode/decode hatasına maruz kalmaz.
func GenerateCSRFToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
