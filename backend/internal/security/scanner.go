package security

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// securityHeaders HTTP yanıtında bulunması beklenen güvenlik başlıkları.
var securityHeaders = []struct {
	name     string
	penalty  float64
	severity string
}{
	{"Strict-Transport-Security", 15, "high"},
	{"Content-Security-Policy", 10, "high"},
	{"X-Frame-Options", 8, "medium"},
	{"X-Content-Type-Options", 5, "medium"},
	{"X-XSS-Protection", 5, "low"},
	{"Referrer-Policy", 3, "low"},
}

type serviceRow struct {
	ID             uuid.UUID
	Host           string
	Port           int
	HealthEndpoint string
}

type tlsCheckResult struct {
	valid    bool
	expiry   *time.Time
	daysLeft *int
	issuer   string
	version  string
}

type headerCheckResult struct {
	missingHeaders   []string
	serverHeader     string
	redirectsToHTTPS bool
}

// scanService bir servis kaydını tarar ve Scan nesnesi döndürür.
// Ulaşılamayan servislerde hata döner; bu durumda skor 0 olarak kaydedilir.
func scanService(ctx context.Context, svc serviceRow) (*Scan, error) {
	scan := &Scan{
		ServiceID: svc.ID,
		ScannedAt: time.Now(),
	}

	host := cleanHost(svc.Host)
	isHTTPS := svc.Port == 443 || svc.Port == 8443 ||
		strings.HasPrefix(strings.ToLower(svc.Host), "https://")

	// ── TLS kontrolü ────────────────────────────────────────────────
	if isHTTPS {
		scan.TLSEnabled = true
		res := checkTLS(ctx, host, svc.Port)
		scan.TLSValid = res.valid
		scan.TLSExpiry = res.expiry
		scan.TLSDaysLeft = res.daysLeft
		scan.TLSIssuer = res.issuer
		scan.TLSVersion = res.version
	}

	// ── HTTP başlık ve redirect kontrolü ────────────────────────────
	scheme := "http"
	if isHTTPS {
		scheme = "https"
	}
	endpoint := svc.HealthEndpoint
	if endpoint == "" {
		endpoint = "/health"
	}
	targetURL := fmt.Sprintf("%s://%s:%d%s", scheme, host, svc.Port, endpoint)

	hRes, err := checkHeaders(ctx, targetURL, isHTTPS)
	if err != nil {
		log.Printf("[security] %s tarama hatası: %v", targetURL, err)
		// Ulaşılamayan servis — bulgusuz sıfır skor
		scan.MissingHeaders = json.RawMessage("[]")
		scan.Findings = json.RawMessage("[]")
		scan.RiskScore = 0
		return scan, nil
	}
	scan.MissingHeaders = mustMarshal(hRes.missingHeaders)
	scan.ServerHeader = hRes.serverHeader
	scan.RedirectToHTTPS = hRes.redirectsToHTTPS

	// ── Bulgular ────────────────────────────────────────────────────
	var findings []Finding

	if scan.TLSEnabled {
		if !scan.TLSValid {
			findings = append(findings, Finding{
				Type:        "tls_invalid",
				Severity:    "critical",
				Description: "TLS sertifikası geçersiz veya süresi dolmuş",
			})
		} else if scan.TLSDaysLeft != nil {
			switch {
			case *scan.TLSDaysLeft < 7:
				findings = append(findings, Finding{
					Type:        "tls_expiring_critical",
					Severity:    "critical",
					Description: fmt.Sprintf("TLS sertifikası %d gün içinde sona eriyor", *scan.TLSDaysLeft),
				})
			case *scan.TLSDaysLeft < 30:
				findings = append(findings, Finding{
					Type:        "tls_expiring_soon",
					Severity:    "high",
					Description: fmt.Sprintf("TLS sertifikası %d gün içinde sona eriyor", *scan.TLSDaysLeft),
				})
			}
		}
	}

	for _, h := range hRes.missingHeaders {
		sev := "medium"
		for _, def := range securityHeaders {
			if def.name == h {
				sev = def.severity
				break
			}
		}
		findings = append(findings, Finding{
			Type:        "missing_header",
			Severity:    sev,
			Description: fmt.Sprintf("Güvenlik başlığı eksik: %s", h),
		})
	}

	if hRes.serverHeader != "" && containsVersion(hRes.serverHeader) {
		findings = append(findings, Finding{
			Type:        "server_header_leak",
			Severity:    "medium",
			Description: fmt.Sprintf("Server başlığı sürüm bilgisi içeriyor: %s", hRes.serverHeader),
		})
	}

	if !isHTTPS && !hRes.redirectsToHTTPS {
		findings = append(findings, Finding{
			Type:        "no_https",
			Severity:    "high",
			Description: "HTTPS kullanılmıyor ve HTTP→HTTPS yönlendirmesi yok",
		})
	}

	if len(findings) == 0 {
		scan.Findings = json.RawMessage("[]")
	} else {
		scan.Findings = mustMarshal(findings)
	}

	scan.RiskScore = calculateScore(scan, findings, isHTTPS)
	return scan, nil
}

// checkTLS TLS bağlantısı açarak sertifika bilgisini toplar.
func checkTLS(ctx context.Context, host string, port int) tlsCheckResult {
	addr := fmt.Sprintf("%s:%d", host, port)
	dialer := &tls.Dialer{
		NetDialer: &net.Dialer{Timeout: 5 * time.Second},
		Config:    &tls.Config{InsecureSkipVerify: true}, //nolint:gosec // Sertifika bilgisi için bilinçli olarak atlanıyor
	}

	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return tlsCheckResult{}
	}
	defer conn.Close()

	tlsConn, ok := conn.(*tls.Conn)
	if !ok {
		return tlsCheckResult{}
	}

	certs := tlsConn.ConnectionState().PeerCertificates
	if len(certs) == 0 {
		return tlsCheckResult{}
	}

	leaf := certs[0]
	now := time.Now()
	valid := now.Before(leaf.NotAfter) && now.After(leaf.NotBefore)
	expiry := leaf.NotAfter
	daysLeft := int(time.Until(leaf.NotAfter).Hours() / 24)

	version := tlsVersionName(tlsConn.ConnectionState().Version)

	return tlsCheckResult{
		valid:    valid,
		expiry:   &expiry,
		daysLeft: &daysLeft,
		issuer:   leaf.Issuer.CommonName,
		version:  version,
	}
}

// checkHeaders HTTP isteği atarak yanıt başlıklarını denetler.
func checkHeaders(ctx context.Context, targetURL string, isHTTPS bool) (headerCheckResult, error) {
	transport := &http.Transport{
		TLSClientConfig:   &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
		DisableKeepAlives: true,
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   8 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // redirect'leri elle incele
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return headerCheckResult{}, err
	}
	req.Header.Set("User-Agent", "NanoNet-SecurityScanner/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return headerCheckResult{}, err
	}
	defer resp.Body.Close()

	var res headerCheckResult

	// Redirect kontrolü
	if loc := resp.Header.Get("Location"); loc != "" &&
		(resp.StatusCode == 301 || resp.StatusCode == 302 || resp.StatusCode == 307 || resp.StatusCode == 308) {
		res.redirectsToHTTPS = strings.HasPrefix(strings.ToLower(loc), "https://")
	}

	// Eksik güvenlik başlıkları
	for _, h := range securityHeaders {
		if resp.Header.Get(h.name) == "" {
			res.missingHeaders = append(res.missingHeaders, h.name)
		}
	}
	if res.missingHeaders == nil {
		res.missingHeaders = []string{}
	}

	// Server başlığı sızıntısı
	res.serverHeader = resp.Header.Get("Server")

	return res, nil
}

// calculateScore 0-100 arası güvenlik skoru hesaplar (100 = mükemmel).
func calculateScore(scan *Scan, findings []Finding, isHTTPS bool) float64 {
	score := 100.0

	if scan.TLSEnabled && !scan.TLSValid {
		score -= 40
	} else if scan.TLSDaysLeft != nil {
		switch {
		case *scan.TLSDaysLeft < 7:
			score -= 30
		case *scan.TLSDaysLeft < 30:
			score -= 15
		}
	}

	// Eksik başlık cezaları
	var missing []string
	if len(scan.MissingHeaders) > 2 {
		_ = json.Unmarshal(scan.MissingHeaders, &missing)
	}
	for _, h := range securityHeaders {
		for _, m := range missing {
			if m == h.name {
				score -= h.penalty
				break
			}
		}
	}

	if scan.ServerHeader != "" && containsVersion(scan.ServerHeader) {
		score -= 10
	}

	if !isHTTPS && !scan.RedirectToHTTPS {
		score -= 10
	}

	if score < 0 {
		score = 0
	}
	return score
}

// containsVersion server başlığının sürüm bilgisi içerip içermediğini kontrol eder.
func containsVersion(header string) bool {
	// "nginx/1.18.0", "Apache/2.4.51", "Microsoft-IIS/10.0" vb.
	return strings.Contains(header, "/") || strings.ContainsAny(header, "0123456789")
}

func cleanHost(host string) string {
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimPrefix(host, "http://")
	return strings.TrimRight(host, "/")
}

func tlsVersionName(v uint16) string {
	switch v {
	case tls.VersionTLS10:
		return "TLS 1.0"
	case tls.VersionTLS11:
		return "TLS 1.1"
	case tls.VersionTLS12:
		return "TLS 1.2"
	case tls.VersionTLS13:
		return "TLS 1.3"
	default:
		return "unknown"
	}
}

func mustMarshal(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage("[]")
	}
	return b
}

// ScanAllServices DB'deki tüm servisleri tarar ve sonuçları kaydeder.
// Broadcaster tarafından periyodik çağrılır.
func ScanAllServices(ctx context.Context, db *gorm.DB) {
	var rows []serviceRow
	if err := db.WithContext(ctx).
		Table("services").
		Select("id, host, port, health_endpoint").
		Scan(&rows).Error; err != nil {
		log.Printf("[security] Servis listesi alınamadı: %v", err)
		return
	}

	for _, svc := range rows {
		svc := svc
		go func() {
			scanCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()

			scan, err := scanService(scanCtx, svc)
			if err != nil {
				log.Printf("[security] Tarama hatası [service=%s]: %v", svc.ID, err)
				return
			}

			if err := db.WithContext(ctx).Create(scan).Error; err != nil {
				log.Printf("[security] Tarama kaydedilemedi [service=%s]: %v", svc.ID, err)
			}
		}()
	}
}
