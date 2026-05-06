// Package secrets — log/observability için secret redaksiyon yardımcıları.
//
// URL'lerde userinfo (user:password) yer aldığında log akışına düşmemeli.
// Bu paket, parse hatası durumunda bile *asla* orijinal string'i geri
// döndürmez; en kötü ihtimalle düz "<redacted>" stringi döner.
package secrets

import (
	"net/url"
	"strings"
)

const passwordMask = "***"

// RedactURL — verilen URL'in userinfo bölümünü maskeler.
//
//	"redis://:supersecret@redis:6379/0"   ->  "redis://:***@redis:6379/0"
//	"redis://user:pass@redis:6379"        ->  "redis://user:***@redis:6379"
//	"postgres://u:p@db:5432/nn?sslmode=disable" ->
//	    "postgres://u:***@db:5432/nn?sslmode=disable"
//
// URL parse edilemezse veya şema yoksa "<redacted>" döner — input'u
// sızdırmaktansa anlamsız bir string yazmak güvenlidir.
//
// Userinfo yoksa string olduğu gibi kalır; bu sayede `redis://localhost:6379`
// gibi parolasız URL'lerde de bilgi kaybı yaşanmaz.
func RedactURL(raw string) string {
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		// Şema/host yoksa URL değildir; ama yine de parola içerebilir
		// (örn. "user:pass@host"). Güvenli taraf: maskele.
		return "<redacted>"
	}
	if u.User == nil {
		return raw
	}
	username := u.User.Username()
	pass, hasPass := u.User.Password()
	if !hasPass && username == "" {
		return raw
	}
	// `*` karakterini url.UserPassword ile yazınca encode oluyor (`%2A`).
	// Doğrudan string-replace ile orijinal "user:pass@" parçasını
	// "user:***@" şeklinde değiştiriyoruz. Yalnızca *ilk* eşleşmeyi
	// hedefliyoruz, böylece hostname içinde aynı dizi olsa bile yan etki
	// olmaz.
	_ = pass
	cleared := *u
	cleared.User = nil
	rest := cleared.String() // "scheme://host:port/path?query#frag"
	atSep := strings.Index(rest, "://")
	if atSep < 0 {
		return "<redacted>"
	}
	prefix := rest[:atSep+3] // scheme://
	tail := rest[atSep+3:]   // host[:port]/...
	var maskedUser string
	if username == "" {
		maskedUser = ":" + passwordMask + "@"
	} else {
		maskedUser = username + ":" + passwordMask + "@"
	}
	return prefix + maskedUser + tail
}
