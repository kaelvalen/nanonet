# NanoNet Siber Güvenlik Standartları

**Versiyon**: 1.0  
**Tarih**: 2026  
**Kapsam**: Geliştiriciler, Kullanıcılar, Sistem Yöneticileri  

---

## 1. Genel Güvenlik Politikası

### 1.1 Güvenlik İlkeleri
- **Güvenlik Öncelikli Tasarım**: Tüm bileşenler güvenlik odaklı tasarlanır
- **En Az Yetki Prensibi (PoLP)**: Her kullanıcı ve servis sadece ihtiyacı olan yetkilere sahip olur
- **Sıfır Güven (Zero Trust)**: Ağ içindeki hiçbir bağlantı varsayılan olarak güvenilir değildir
- **Şifreleme Varsayılan**: Tüm veri aktarımı ve depolama varsayılan olarak şifrelenir

### 1.2 Uyum Gereksinimleri
- ISO 27001 Bilgi Güvenliği Yönetimi
- OWASP Top 10 Web Uygulaması Güvenliği
- NIST Cybersecurity Framework
- GDPR Veri Koruma Regülasyonu (AB kullanıcıları için)
- KVKK (Kişisel Verileri Koruma Kanunu)

---

## 2. Geliştirici Güvenlik Standartları

### 2.1 Kod Güvenliği

#### Yasaklı Pratikler
```go
// ❌ YASAK - SQL Injection açığı
query := fmt.Sprintf("SELECT * FROM users WHERE id = %s", userID)

// ✅ DOĞRU - Parameterized query
query := "SELECT * FROM users WHERE id = ?"
db.QueryRow(query, userID)
```

#### Zorunlu Güvenlik Kontrolleri
- Tüm kullanıcı girdileri **validation** ve **sanitization**dan geçmeli
- API endpoint'leri **rate limiting** ile korunmalı
- Hata mesajlarında **sistem içi bilgi** paylaşılmamalı
- Loglarda **parola, token, API key** gibi hassas veriler kaydedilmemeli

### 2.2 Secret Yönetimi

#### Environment Değişkenleri
```bash
# .env.example - Her zaman versiyon kontrolüne dahil edilmeli
DATABASE_URL=postgres://user:CHANGE_ME@localhost:5432/nanonet
JWT_SECRET=CHANGE_ME_MIN_32_CHARS
CLAUDE_API_KEY=CHANGE_ME
```

#### Production Kuralları
- Hiçbir secret **kod içinde** hardcode edilemez
- Secret'lar **vault** veya **encrypted environment** dosyalarında saklanır
- API key'ler **rotation** periyoduna tabidir (90 gün)
- Development ortamı **farklı secret'lar** kullanır

### 2.3 Bağımlılık Güvenliği

#### Güvenlik Taramaları
```bash
# Go modül taraması
go list -json -m all | nancy sleuth

# Node.js taraması
npm audit
npm audit fix
```

#### Bağımlılık Kuralları
- Tüm bağımlılıklar **güvenlik taramasından** geçmeli
- Açığı olan paketler **24 saat içinde** güncellenmeli
- Sadece gerekli bağımlılıklar eklenir (minimal attack surface)

---

## 3. Altyapı Güvenliği

### 3.1 Ağ Güvenliği

#### TLS Konfigürasyonu
```nginx
# TLS 1.3 sadece
ssl_protocols TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
```

#### Firewall Kuralları
```yaml
# Sadece gerekli portlar açık
ports:
  - "80:80/tcp"   # HTTP redirect
  - "443:443/tcp" # HTTPS
  - "8080:8080/tcp" # Backend (internal only)
```

### 3.2 Container Güvenliği

#### Dockerfile Best Practices
```dockerfile
# Non-root kullanıcı
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Minimal image
FROM alpine:3.18

# Security scan
RUN apk add --no-cache curl && \
    curl -fsSL https://scan.docker.com/security | sh
```

#### Container Kuralları
- Container'lar **non-root** kullanıcı çalıştırır
- Sadece gerekli **capabilities** verilir
- Image'lar **vulnerability scan**'nden geçer
- Runtime **security policies** uygulanır

---

## 4. Veri Güvenliği

### 4.1 Veri Sınıflandırması

| Sınıf | Veri Türü | Koruma Seviyesi |
|-------|-----------|-----------------|
| Herkese Açık | Servis isimleri, durumları | Standart |
| Dahil | Kullanıcı email'leri | Şifreli |
| Hassas | Metrik verileri, loglar | Şifreli + Erişim kontrolü |
| Çok Hassas | API key'ler, parolalar | Şifreli + Audit + MFA |

### 4.2 Veri Şifrelemesi

#### Transit Şifreleme
- API通信: TLS 1.3
- WebSocket: WSS (WebSocket Secure)
- Database: SSL/TLS connection

#### At Rest Şifreleme
- Database: Transparent Data Encryption (TDE)
- Disk: Full disk encryption (LUKS)
- Backup: GPG encryption

### 4.3 Veri Saklama ve Temizleme

```sql
-- Otomatik veri temizleme
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- 90 günden eski metrikleri sil
  DELETE FROM metrics WHERE time < NOW() - INTERVAL '90 days';
  
  -- 1 yıldan eski logları arşivle
  DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Her gün çalıştır
SELECT cron.schedule('cleanup', '0 2 * * *', 'SELECT cleanup_old_data();');
```

---

## 5. Kimlik ve Erişim Yönetimi

### 5.1 Authentication

#### Parola Politikası
- Minimum 12 karakter
- Büyük/küçük harf, sayı, özel karakter içermeli
- 5 geçmiş parola kullanılamaz
- 90 günde bir değiştirilmeli

#### MFA (Multi-Factor Authentication)
```go
// TOTP implementation
type MFAConfig struct {
    Secret   string `json:"secret"`
    Enabled  bool   `json:"enabled"`
    BackupCodes []string `json:"backup_codes"`
}

// QR code generation
func GenerateMFAQR(userEmail string) ([]byte, error) {
    key, err := totp.Generate(totp.GenerateOpts{
        Issuer:      "NanoNet",
        AccountName: userEmail,
    })
    // QR code generation logic
}
```

### 5.2 Authorization

#### RBAC (Role-Based Access Control)
```yaml
roles:
  viewer:
    - services:read
    - metrics:read
  
  operator:
    - services:read
    - services:write
    - metrics:read
    - commands:execute
  
  admin:
    - "*"
```

#### JWT Token Yapısı
```json
{
  "sub": "user-uuid",
  "roles": ["operator"],
  "permissions": ["services:read", "services:write"],
  "iat": 1642694400,
  "exp": 1642780800,
  "jti": "token-uuid"
}
```

---

## 6. API Güvenliği

### 6.1 API Security Checklist

#### Authentication & Authorization
- [ ] API key rotation mekanizması
- [ ] JWT token blacklist
- [ ] Rate limiting per user/IP
- [ ] API versioning security

#### Input Validation
```go
type ServiceRequest struct {
    Name            string `json:"name" validate:"required,min=2,max=100"`
    Host            string `json:"host" validate:"required,ip|hostname"`
    Port            int    `json:"port" validate:"required,min=1,max=65535"`
    HealthEndpoint  string `json:"health_endpoint" validate:"required,uri"`
}

// Validation middleware
func ValidateRequest() gin.HandlerFunc {
    return func(c *gin.Context) {
        var req ServiceRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(400, gin.H{"error": err.Error()})
            c.Abort()
            return
        }
        
        if err := validator.New().Struct(&req); err != nil {
            c.JSON(400, gin.H{"error": err.Error()})
            c.Abort()
            return
        }
        
        c.Set("validated_request", &req)
        c.Next()
    }
}
```

### 6.2 API Security Headers
```go
func SecurityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-Frame-Options", "DENY")
        c.Header("X-XSS-Protection", "1; mode=block")
        c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        c.Header("Content-Security-Policy", "default-src 'self'")
        c.Next()
    }
}
```

---

## 7. AI/ML Güvenliği

### 7.1 AI Model Güvenliği

#### Prompt Injection Koruması
```go
type SafePrompt struct {
    Template string
    Context  string
    UserInput string
}

func (p *SafePrompt) Sanitize() string {
    // Prompt injection patterns
    maliciousPatterns := []string{
        "ignore previous instructions",
        "system prompt",
        "act as",
        "pretend you are",
    }
    
    sanitized := p.UserInput
    for _, pattern := range maliciousPatterns {
        sanitized = strings.ReplaceAll(sanitized, pattern, "[REDACTED]")
    }
    
    return fmt.Sprintf(p.Template, p.Context, sanitized)
}
```

#### Model Output Filtering
```go
func FilterAIOutput(output string) (string, error) {
    // Sensitive information patterns
    sensitivePatterns := []string{
        `\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b`, // Credit card
        `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`, // Email
        `\b(?:\d{1,3}\.){3}\d{1,3}\b`, // IP address
    }
    
    filtered := output
    for _, pattern := range sensitivePatterns {
        re := regexp.MustCompile(pattern)
        filtered = re.ReplaceAllString(filtered, "[REDACTED]")
    }
    
    return filtered, nil
}
```

### 7.2 AI Usage Monitoring

#### Anomaly Detection
```go
type AIUsageMetrics struct {
    UserID        string    `json:"user_id"`
    RequestCount  int       `json:"request_count"`
    TokenUsage    int       `json:"token_usage"`
    LastRequest   time.Time `json:"last_request"`
    RiskScore     float64   `json:"risk_score"`
}

func DetectAnomalousUsage(metrics AIUsageMetrics) bool {
    // Anomaly detection logic
    if metrics.RequestCount > 100 { // Rate limit
        return true
    }
    
    if metrics.TokenUsage > 100000 { // Token abuse
        return true
    }
    
    if time.Since(metrics.LastRequest) < time.Second {
        return true // Rapid requests
    }
    
    return false
}
```

---

## 8. Monitoring ve Güvenlik Operasyonları

### 8.1 Security Monitoring

#### Log Formatı
```json
{
  "timestamp": "2026-02-26T19:59:00Z",
  "level": "SECURITY",
  "event": "AUTHENTICATION_FAILURE",
  "source_ip": "192.168.1.100",
  "user_id": "user-123",
  "user_agent": "Mozilla/5.0...",
  "details": {
    "reason": "invalid_password",
    "attempt_count": 3
  },
  "risk_score": 0.7
}
```

#### Alert Kuralları
```yaml
alerts:
  - name: "Brute Force Attack"
    condition: "auth_failure_count > 5 in 5m"
    severity: "high"
    action: "block_ip_1h"
    
  - name: "Unusual API Usage"
    condition: "api_requests > 1000 in 1m"
    severity: "medium"
    action: "notify_admin"
    
  - name: "AI Model Abuse"
    condition: "ai_requests > 100 in 1m"
    severity: "high"
    action: "suspend_user"
```

### 8.2 Incident Response

#### Incident Response Plan
1. **Detection** (0-5 dakika)
   - Otomatik alert
   - SIEM correlation
   - Risk skorlama

2. **Analysis** (5-30 dakika)
   - Log analizi
   - Impact assessment
   - Root cause identification

3. **Containment** (30-60 dakika)
   - Affected systems izolasyon
   - User accounts block
   - Network segmentation

4. **Recovery** (1-4 saat)
   - Systems restore
   - Security patches
   - Password reset

5. **Post-Incident** (1-7 gün)
   - Lessons learned
   - Process improvement
   - Security update

---

## 9. Kullanıcı Güvenliği

### 9.1 Kullanıcı Eğitimi

#### Security Awareness Program
- **Phishing Simülasyonları**: Aylık fake phishing e-postaları
- **Security Tips**: Dashboard'da güvenlik ipuçları
- **Tutorial Videos**: Hesap güvenliği ayarları

#### Kullanıcı Kontrol Listesi
- [ ] Güçlü parola kullanıyorum
- [ ] MFA etkinleştirdim
- [ ] API key'imi düzenli olarak güncelliyorum
- [ ] Şüpheli aktiviteyi rapor ediyorum
- [ ] Agent'ı güvenli ortamda çalıştırıyorum

### 9.2 Kullanıcı İzinleri

#### Default Permissions
```yaml
new_user:
  can_view_own_services: true
  can_create_services: true
  can_delete_services: true
  can_manage_agents: true
  can_access_ai: true
  can_view_logs: false
  can_manage_users: false
```

#### Permission Escalation
- Admin onayı gerektiren işlemler
- Justification formu
- Temporal elevation (zaman sınırlı)

---

## 10. Test ve Denetim

### 10.1 Security Testing

#### Otomatik Testler
```bash
# OWASP ZAP Baseline Scan
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://target

# Nessus Vulnerability Scan
nessuscli scan new <scan_name> <target>

# Bandit SAST for Python
bandit -r ./

# Gosec for Go
gosec ./...
```

#### Pentest Checklist
- [ ] SQL Injection testleri
- [ ] XSS vulnerability testleri
- [ ] Authentication bypass
- [ ] Authorization flaws
- [ ] Business logic flaws
- [ ] API security testleri

### 10.2 Compliance Denetimi

 quarterly Security Review
- Access control review
- Data classification audit
- Incident response test
- Third-party risk assessment
- Compliance gap analysis

---

## 11. Güvenlik Araçları

### 11.1 Open Source Araçlar
- **SAST**: SonarQube, CodeQL, Bandit
- **DAST**: OWASP ZAP, Burp Suite
- **Container**: Trivy, Clair, Docker Bench
- **Infrastructure**: Terraform Security Scanner
- **Monitoring**: ELK Stack, Prometheus + Grafana

### 11.2 Commercial Araçlar
- **SIEM**: Splunk, QRadar
- **WAF**: Cloudflare, Akamai
- **EDR**: CrowdStrike, SentinelOne
- **Vulnerability Management**: Tenable, Qualys

---

## 12. Acil Durum Prosedürleri

### 12.1 Data Breach Response
```yaml
steps:
  1. Immediately isolate affected systems
  2. Notify security team and management
  3. Preserve evidence (don't reboot)
  4. Assess data exposure scope
  5. Notify affected users within 72 hours
  6. Report to authorities (if required)
  7. Implement remediation measures
  8. Conduct post-incident review
```

### 12.2 Service Outage Security
- Failover mekanizmaları test edilmeli
- Backup systems güvenli tutulmalı
- Communication plan hazır olmalı

---

## 13. Güvenlik Metrics

### 13.1 KPI'lar
- **Mean Time to Detect (MTTD)**: < 5 dakika
- **Mean Time to Respond (MTTR)**: < 1 saat
- **Vulnerability Remediation Time**: < 30 gün
- **Security Training Completion**: %100
- **Failed Authentication Rate**: < %0.1

### 13.2 Dashboard Metrics
```json
{
  "security_score": 92,
  "active_threats": 2,
  "blocked_attempts": 1547,
  "vulnerabilities": {
    "critical": 0,
    "high": 2,
    "medium": 5,
    "low": 12
  },
  "compliance_status": "compliant"
}
```

---

## 14. Dokümantasyon ve Eğitim

### 14.1 Zorunlu Dokümanlar
- Security Policy (bu doküman)
- Incident Response Plan
- Data Classification Guide
- Acceptable Use Policy
- Security Architecture Diagrams

### 14.2 Eğitim Programı
- **Yeni Geliştiriciler**: 1 haftalık security onboarding
- **Mevcut Ekip**: Çeyreklik security workshops
- **Yönetim**: Yıllık security briefing

---

## 15. İmza ve Onay

Bu güvenlik standartları aşağıdaki tarafından onaylanmıştır:

- **CTO**: _________________________ Tarih: _________
- **Security Lead**: ________________ Tarih: _________
- **Development Lead**: _____________ Tarih: _________

---

**Not**: Bu doküman 6 ayda bir gözden geçirilir ve güncellenir. Değişiklik önerileri için security@nanonet.dev adresine e-posta gönderiniz.
