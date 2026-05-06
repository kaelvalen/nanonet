package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Auth cookie isimleri sabitlenir; route ve middleware tarafları aynı isimleri
// import ettiği için tek kaynak burada.
const (
	// CookieRefresh — uzun ömürlü refresh JWT.
	// HttpOnly + SameSite=Strict ⇒ JS erişimi yok, cross-site request yok.
	// Path /api/v1/auth ⇒ refresh dışı endpoint'lere bile gönderilmez.
	CookieRefresh = "nn_refresh"
	// CookieCSRF — JS-okunabilir random token. Frontend, mutating
	// isteklerde X-CSRF-Token header'ında geri sunar (double-submit pattern).
	CookieCSRF = "nn_csrf"

	cookiePathRefresh = "/api/v1/auth"
	cookiePathRoot    = "/"
)

// SetRefreshCookie — refresh JWT'yi HttpOnly cookie olarak yazar.
//
// `secure`: prod'da daima true; dev'de http üzerinden çalıştığımızda false
// (yoksa Chrome cookie'yi göndermez). Çağıran environment'a göre seçer.
// `maxAge`: saniye cinsinden ömür; 0 verilirse cookie session-only olur,
// negatif değer cookie'yi silmek için (Max-Age=0) kullanılır.
func SetRefreshCookie(c *gin.Context, secure bool, value string, maxAge int) {
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie(CookieRefresh, value, maxAge, cookiePathRefresh, "", secure, true)
}

// SetCSRFCookie — random CSRF token'ı JS-okunabilir cookie olarak yazar.
// HttpOnly **değil** (frontend okuyup header'a koyacak); SameSite=Strict
// + Secure XSS olmadığında klasik form-CSRF'i etkin biçimde engeller.
func SetCSRFCookie(c *gin.Context, secure bool, value string, maxAge int) {
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie(CookieCSRF, value, maxAge, cookiePathRoot, "", secure, false)
}

// ClearAuthCookies — logout sırasında her iki cookie'yi de geçersiz kılar.
// Max-Age=-1 + boş value: tarayıcı cookie'yi anında siler.
func ClearAuthCookies(c *gin.Context, secure bool) {
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie(CookieRefresh, "", -1, cookiePathRefresh, "", secure, true)
	c.SetCookie(CookieCSRF, "", -1, cookiePathRoot, "", secure, false)
}
