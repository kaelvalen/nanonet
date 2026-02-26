# NANONET — PROJE REFERANS DOSYASI
Mikroservis İzleme ve Yönetim Platformu

**Hazırlayan** : Kael Valen  
**Ders** : YMH354 Web Tasarım ve Programlama  
**Tarih** : 2026  
**Versiyon** : 1.0 — Kapsamlı Referans  

---

Bu dosya NanoNet projesine dair şu ana kadar alınmış tüm kararları,
belirlenen teknik detayları, mimariyi, özellik listesini, geliştirme
planını ve risk analizini tek bir yerde toplamaktadır. Geliştirme
süresince birincil referans kaynağı olarak kullanılacaktır.

---

## İÇİNDEKİLER

1.  [Proje Vizyonu ve Özeti](#1-proje-vizyonu-ve-özeti)
2.  [Problem Tanımı](#2-problem-tanımı)
3.  [Rekabet Analizi](#3-rekabet-analizi)
4.  [Sistem Mimarisi](#4-sistem-mimarisi)
5.  [Teknoloji Kararları ve Gerekçeler](#5-teknoloji-kararları-ve-gerekçeler)
6.  [Veri Modeli / DB Şeması](#6-veri-modeli--db-şeması)
7.  [API Endpoint Dokümantasyonu](#7-api-endpoint-dokümantasyonu)
8.  [Agent Kommunikasyon Protokolü](#8-agent-komünikasyon-protokolü)
9.  [AI Entegrasyonu](#9-ai-entegrasyonu)
10. [Özellik Listesi (MVP + V2)](#10-özellik-listesi-mvp--v2)
11. [Güvenlik Mimarisi](#11-güvenlik-mimarisi)
12. [Performans Hedefleri](#12-performans-hedefleri)
13. [10 Haftalık Geliştirme Planı (Sprint Detaylı)](#13-10-haftalık-geliştirme-planı-sprint-detaylı)
14. [Teknoloji Öğrenme Takvimi](#14-teknoloji-öğrenme-takvimi)
15. [Risk Analizi](#15-risk-analizi)
16. [Deployment Mimarisi](#16-deployment-mimarisi)
17. [YMH354 Ders Gereksinimi Uyum Tablosu](#17-ymh354-ders-gereksinimi-uyum-tablosu)
18. [Teslim Öncesi Kontrol Listesi](#18-teslim-öncesi-kontrol-listesi)

---

## 1. PROJE VİZYONU VE ÖZETİ

**PROJE ADI** : NanoNet  
**SLOGAN** : "Real-time mikroservis izleme · Agent tabanlı komut yürütme · AI destekli anomali analizi"

### VİZYON:
Kullanıcıların kendi mikroservislerini platforma ekleyebildiği,
gerçek zamanlı metriklerini izleyebildiği, AI destekli anomali
analizinden yararlanabildiği ve restart/stop gibi yönetim komutlarını
dashboard üzerinden çalıştırabildiği bir web platformu.

### TEMEL DEĞER:
NanoNet, izlemeyi pasif bir aktiviteden aktif bir operasyon aracına
dönüştürür. Kullanıcı yalnızca metrikleri görmekle kalmaz; AI destekli
analizle sorunları önceden tespit eder ve tek tıklamayla müdahale
edebilir.

### BİLEŞENLER:
- **Frontend** : React dashboard (kullanıcının tarayıcısında)
- **Backend** : Go servis (servis kayıt, polling, WebSocket, AI proxy)
- **Agent** : Rust binary (kullanıcının kendi servisine deploy ettiği)

### HEDEF KİTLE:
- Mikroservis mimarisi kullanan bireysel geliştiriciler ve küçük ekipler
- Birden fazla servisi tek noktadan yönetmek isteyen DevOps pratisyenleri
- Üretim ortamında servis sağlığını anlık takip etmesi gereken backend mühendisleri

---

## 2. PROBLEM TANIMI

### MEVCUT DURUM:
Mikroservis mimarisinin yaygınlaşmasıyla geliştiriciler onlarca, hatta
yüzlerce bağımsız servisi yönetmek zorunda kalmaktadır. Mevcut
araçların temel sorunları:

- **Grafana + Prometheus**: Kurulum ve konfigürasyon ağır, yönetim yok
- **Datadog / New Relic**: Kurumsal, pahalı, vendor lock-in
- **Portainer**: Container yönetimi var ama izleme zayıf
- **Çoğu araç**: Yalnızca izleme; servis yönetimi ayrı araç gerektirir
- **AI destekli anomali tespiti ve cross-servis korelasyon**: nadiren entegre sunulur

### NANONET'İN ÇÖZÜMÜ:
Kurulumu basit (tek binary agent), monitoring ve management'ı tek
arayüzde birleştiren, AI ile anomali tespiti yapan, küçük-orta
ölçekli ekipler için uygun bir platform.

---

## 3. REKABET ANALİZİ

| Araç | Kurulum | Real-time | Servis Yönetimi | AI Analizi | Maliyet |
|------|---------|-----------|-----------------|------------|---------|
| Grafana+Prom | Karmaşık | Evet | Hayır | Eklenti | Ücretsiz |
| Datadog | Orta | Evet | Sınırlı | Evet | Ödeli |
| Portainer | Basit | Kısmen | Container | Hayır | Ücretsiz/Ödeli |
| New Relic | Orta | Evet | Hayır | Evet | Ödeli |
| **NanoNet [BİZ]** | **Tek binary** | **Evet** | **TAM** | **Entegre** | **Açık Kaynak** |

---

## 4. SİSTEM MİMARİSİ

### GENEL YAPI — 3 KATMAN:

```
┌─────────────────────────────────────────────────────────────────────┐
│  KULLANICI SERVİSLERİ          BACKEND (Go)       FRONTEND (React)  │
│                                                                     │
│  ┌────────────────┐   WS/gRPC  ┌─────────────┐   WebSocket          │
│  │ auth-service   │ ─────────► │ API Gateway │ ◄──────────────────  │
│  │ :8001 /health  │            │ (Gin)       │                      │
│  └────────────────┘            ├─────────────┤   REST API           │
│  ┌────────────────┐            │ Polling     │ ◄──────────────────  │
│  │ payment-service│ ─────────► │ Engine      │                      │
│  │ :8002 /metrics │            ├─────────────┤                      │
│  └────────────────┘            │ Agent       │                      │
│  ┌────────────────┐            │ Handler     │                      │
│  │ notification   │ ─────────► ├─────────────┤                      │
│  │ :8003 /health  │            │ WebSocket   │                      │
│  └────────────────┘            │ Hub         │                      │
│         │                      ├─────────────┤                      │
│  ┌──────┴──────┐               │ AI Servisi  │ ─► Claude/OpenAI API │
│  │NanoNet Agent│               ├─────────────┤                      │
│  │(Rust binary)│               │ TimescaleDB │                      │
│  └─────────────┘               └─────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
```

### VERİ AKIŞI (sıralı):
1. Agent sistem metriklerini toplar (CPU, mem, disk) — her 10 saniye
2. Agent health endpoint'i poll eder, latency ölçer
3. Metrik paketi JSON olarak WebSocket üzerinden Backend'e gönderilir
4. Backend TimescaleDB'ye yazar (async, non-blocking)
5. Backend eşik kontrolü yapar; aşım varsa AI analizi tetikler
6. Metrik + AI insight WebSocket Hub üzerinden tüm Frontend bağlantılarına push edilir
7. React state güncellenir, UI render tetiklenir

### KATMAN 1 — NanoNet Agent (Rust):
- Host sistemin CPU, bellek ve disk metriklerini periyodik toplar
- Servisin özelleştirilmiş health endpoint'ini poll eder
- Backend'den gelen komutları (restart, stop, graceful shutdown) yorumlar ve uygular
- WebSocket üzerinden backend ile kalıcı bağlantı sürdürür
- Bağlantı kesilmesi durumunda exponential backoff ile yeniden bağlanır (1s → 2s → 4s → ... → 32s max)

### KATMAN 2 — Backend (Go):
- **REST API Katmanı** : Servis kayıt, güncelleme, silme
- **Polling Engine** : Kayıtlı servisleri configurable interval'larla health check yapar
- **Agent Handler** : Frontend'den gelen yönetim komutlarını ilgili agent'a iletir
- **WebSocket Hub** : Tüm metrik güncellemelerini frontend'e push eder
- **AI Servisi** : Metrikleri analiz ederek anomali tespiti ve öneriler üretir (backend proxy)
- **Veri Katmanı** : TimescaleDB — zaman serisi metrikler için optimize edilmiş PostgreSQL uzantısı

### KATMAN 3 — Frontend (React):
- **Ana Dashboard** : Tüm servislerin genel sağlık durumu, kart bazlı
- **Servis Detay** : Zaman serisi grafikleri (Recharts) ve log akışı
- **Servis Yönetimi** : Yeni servis ekleme formu; IP, port, endpoint, polling interval konfigürasyonu
- **Kontrol Paneli** : Restart, stop, graceful shutdown, scale komutları
- **AI Insight Panel** : Anomali uyarıları, cross-servis korelasyon

---

## 5. TEKNOLOJİ KARARLARI VE GEREKÇELERİ

| Bileşen | Teknoloji | Gerekçe |
|---------|-----------|---------|
| Frontend | React 18 + TypeScript | Component tabanlı; strict typing; büyük projede sürdürülebilirlik |
| State Yönetimi | Zustand + React Query | Zustand minimal boilerplate; React Query sunucu state caching ve invalidation |
| Grafik | Recharts | React-native API; SVG tabanlı; declarative; zaman serisi için yeterli performans |
| UI Bileşenleri | Shadcn/ui + Tailwind CSS | Headless component'lar ile tam kontrol; utility-first CSS; ARIA dahili |
| Form Yönetimi | React Hook Form + Zod | Tip-güvenli validasyon; minimal re-render |
| Backend | Go + Gin Framework | Native goroutine concurrency; I/O-heavy polling ve WebSocket yönetimi için optimal; tek binary deployment |
| Agent | Rust + Tokio async | Memory safety; cross-compile; düşük kaynak tüketimi; sıfır runtime bağımlılığı |
| Veritabanı | PostgreSQL + TimescaleDB | Zaman serisi sorgularında 10-100x performans; standart SQL uyumu; otomatik partitioning |
| Gerçek Zamanlı | WebSocket (gorilla/websocket) | Düşük gecikme; çift yönlü iletişim; polling yerine push |
| AI Entegrasyonu | Claude API / OpenAI API | Metrik analizi; structured output ile güvenilir JSON |
| Auth | JWT + bcrypt | Stateless token doğrulama; bcrypt (cost:12) ile güvenli parola hashleme |
| Container | Docker + Compose | Tekrarlanabilir deployment; tek komutla ortam kaldırma |
| CI/CD | GitHub Actions | Otomatik test, build, release |
| ORM | GORM veya sqlx | Go DB erişim katmanı |
| Migration | golang-migrate | Versiyonlu DB şema yönetimi |

### NOT — TimescaleDB vs MongoDB:
Ders MongoDB kullanımını önermektedir. NanoNet teknik gerekçeyle
TimescaleDB'yi tercih eder: uygulamanın çekirdek verisi zaman serisidir
(10 saniyede bir metrik yazımı). MongoDB bu iş yükü için tasarlanmamış;
zaman aralıklı toplu sorgularda ciddi performans düşüşü yaşanır.
TimescaleDB ise standart SQL arayüzü ile PostgreSQL üzerine kurulu,
otomatik zaman bazlı partitioning ve sıkıştırma yapan bir uzantıdır.

**Hibrit alternatif**: Kullanıcı/servis metadata → MongoDB,
zaman serisi metrikler → TimescaleDB.

---

## 6. VERİ MODELİ / DB ŞEMASI

### TABLE: users
| Kolon | Tip | Kısıt |
|-------|-----|--------|
| id | UUID | PRIMARY KEY |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| password_hash | VARCHAR(60) | NOT NULL -- bcrypt hash (cost: 12) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| api_key_hash | VARCHAR(60) | NULL -- agent bağlantı API anahtarı hash |

### TABLE: services
| Kolon | Tip | Kısıt |
|-------|-----|--------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | REFERENCES users(id) ON DELETE CASCADE |
| name | VARCHAR(100) | NOT NULL |
| host | VARCHAR(255) | NOT NULL -- IP adresi veya hostname |
| port | INTEGER | NOT NULL |
| health_endpoint | VARCHAR(255) | NOT NULL -- health check endpoint path |
| poll_interval_sec | INTEGER | DEFAULT 10 |
| status | TEXT | CHECK(status IN ('up','down','degraded')) |
| agent_id | UUID | NULL -- bağlı agent ID (opsiyonel) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### TABLE: metrics [TimescaleDB HYPERTABLE — partition key: time]
| Kolon | Tip | Kısıt |
|-------|-----|--------|
| time | TIMESTAMPTZ | NOT NULL -- partition key |
| service_id | UUID | REFERENCES services(id) ON DELETE CASCADE |
| cpu_percent | FLOAT4 | NULL |
| memory_used_mb | FLOAT4 | NULL |
| latency_ms | FLOAT4 | NULL |
| error_rate | FLOAT4 | NULL -- 0.0 - 1.0 |
| status | TEXT | CHECK(status IN ('up','down','degraded')) |
| disk_used_gb | FLOAT4 | NULL |

**PRIMARY KEY (time, service_id)**

```sql
-- TimescaleDB komutları:
SELECT create_hypertable('metrics', 'time');
SELECT add_retention_policy('metrics', INTERVAL '90 days');
```

### TABLE: alerts
| Kolon | Tip | Kısıt |
|-------|-----|--------|
| id | UUID | PRIMARY KEY |
| service_id | UUID | REFERENCES services(id) ON DELETE CASCADE |
| type | VARCHAR(50) | NOT NULL -- 'cpu_spike','latency_high','error_surge' |
| severity | TEXT | CHECK(severity IN ('info','warn','crit')) |
| message | TEXT | NOT NULL |
| triggered_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| resolved_at | TIMESTAMPTZ | NULL -- NULL = hâlâ aktif |

### TABLE: ai_insights
| Kolon | Tip | Kısıt |
|-------|-----|--------|
| id | UUID | PRIMARY KEY |
| alert_id | UUID | REFERENCES alerts(id) ON DELETE CASCADE |
| model | VARCHAR(50) | NOT NULL -- 'claude-sonnet-4' vb. |
| summary | TEXT | NOT NULL |
| root_cause | TEXT | NULL |
| recommendations | JSONB | NULL -- [{action: "...", priority: "high"}, ...] |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### ÖRNEK SORGULAR:
```sql
-- Son 1 saatin metriklerini 1 dakikalık bucket'larla getir
SELECT
  time_bucket('1 minute', time) AS bucket,
  AVG(cpu_percent)    AS avg_cpu,
  AVG(latency_ms)     AS avg_latency,
  MAX(latency_ms)     AS max_latency
FROM metrics
WHERE service_id = $1
  AND time > NOW() - INTERVAL '1 hour'
GROUP BY bucket
ORDER BY bucket;
```

---

## 7. API ENDPOINT DOKÜMANTASYONU

**BASE URL** : /api/v1  
**AUTH HEADER** : Authorization: Bearer {access_token}

### AUTH
```http
POST /auth/register
  Body    : { email, password, name }
  Response: { id, email, name, created_at }
  Auth    : Hayır

POST /auth/login
  Body    : { email, password }
  Response: { access_token, refresh_token, expires_in }
  Auth    : Hayır

POST /auth/refresh
  Body    : { refresh_token }
  Response: { access_token, expires_in }
  Auth    : Refresh token (header)

POST /auth/logout
  Body    : {}
  Response: { message: "ok" }
  Auth    : Evet
```

### SERVİS YÖNETİMİ
```http
GET /services
  Query   : page, limit, status
  Response: { services: [...], total, page }
  Auth    : Evet

POST /services
  Body    : { name, host, port, health_endpoint, poll_interval_sec }
  Response: { id, name, host, port, status, agent_install_cmd }
  Auth    : Evet

GET /services/{id}
  Response: { id, name, host, port, status, uptime_pct, agent_connected, ... }
  Auth    : Evet

PUT /services/{id}
  Body    : { name?, host?, port?, health_endpoint?, poll_interval_sec? }
  Response: { ...updated service }
  Auth    : Evet

DELETE /services/{id}
  Response: { message: "deleted" }
  Auth    : Evet
```

### METRİK
```http
GET /services/{id}/metrics
  Query   : from (ISO), to (ISO), interval (1m|5m|1h|1d)
  Response: { service_id, range, data: [{ time, cpu, memory_mb, latency_ms, error_rate, status }] }
  Auth    : Evet

GET /services/{id}/alerts
  Query   : severity, resolved, page, limit
  Response: { alerts: [...], total }
  Auth    : Evet

GET /services/{id}/insights
  Query   : page, limit
  Response: { insights: [{ id, summary, root_cause, recommendations, created_at }] }
  Auth    : Evet
```

### KONTROL
```http
POST /services/{id}/restart
  Body    : { timeout_sec?: 30 }
  Response: { command_id, status: "queued", queued_at }
  Auth    : Evet

POST /services/{id}/stop
  Body    : { graceful?: true }
  Response: { command_id, status: "queued", queued_at }
  Auth    : Evet

POST /services/{id}/ping
  Response: { agent_reachable, service_reachable, latency_ms }
  Auth    : Evet

POST /services/{id}/analyze
  Body    : { window_minutes?: 30 }
  Response: { insight: { summary, root_cause, recommendations } }
  Auth    : Evet
```

### WEBSOCKET
```http
ws://host/ws/dashboard
  → Tüm kullanıcı servislerinin canlı metrik akışı
  Auth: ?token={access_token} query param

ws://host/ws/services/{id}
  → Tek servis metrik + event (alert, komut sonucu) akışı

ws://host/ws/agent
  → Agent bağlantı ve komut kanalı (agent tarafından kullanılır)
  Auth: ?token={api_key} query param
```

### ÖRNEK REQUEST/RESPONSE:
```json
POST /services  (request body):
{
  "name": "payment-service",
  "host": "192.168.1.42",
  "port": 8080,
  "health_endpoint": "/health",
  "poll_interval_sec": 10
}

GET /services/{id}/metrics  (response):
{
  "service_id": "svc_a3f8b2",
  "range": { "from": "2026-02-17T10:00:00Z", "to": "2026-02-17T11:00:Z" },
  "data": [
    { "time": "2026-02-17T10:00:10Z", "cpu": 23.4, "memory_mb": 412,
      "latency_ms": 42, "status": "up" },
    { "time": "2026-02-17T10:00:20Z", "cpu": 67.1, "memory_mb": 418,
      "latency_ms": 89, "status": "up" }
  ]
}
```

---

## 8. AGENT KOMÜNİKASYON PROTOKOLÜ

### BAĞLANTI KURULUMU:
1. Kullanıcı dashboard'dan "Servis Ekle" formunu doldurun
2. Platform benzersiz bir API token + servis ID üretir
3. Otomatik oluşturulan kurulum komutu kullanıcıya gösterilir
4. Kullanıcı komutu hedef sunucuda çalıştırır
5. Agent backend WebSocket endpoint'ine bağlanır
6. Kimlik doğrulama: API token header olarak iletilir
7. Her agent benzersiz UUID ile tanımlanır
8. Bağlantı kesilirse: exponential backoff (1s → 2s → 4s → 32s max)

### KURULUM KOMUTU (platform tarafından otomatik üretilir):
```bash
# Linux / macOS
curl -sSL https://nanonet.dev/install.sh | sh -s -- \
  --token eyJhbGciOiJIUzI1NiJ9... \
  --backend wss://nanonet.dev \
  --service-id svc_a3f8b2

# systemd servisi olarak çalıştırma
[Unit]
Description=NanoNet Agent
After=network.target
[Service]
ExecStart=/usr/local/bin/nanonet-agent --token <TOKEN> \
          --backend wss://nanonet.dev --service-id <ID>
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
```

### METRİK GÖNDERİMİ (her poll_interval_sec saniyede bir push):
```json
{
  "type": "metrics",
  "agent_id": "agt_xyz123",
  "service_id": "svc_a3f8b2",
  "timestamp": "2026-02-17T10:00:10Z",
  "system": {
    "cpu_percent": 23.4,
    "memory_used_mb": 412.0,
    "disk_used_gb": 18.2
  },
  "service": {
    "status": "up",
    "latency_ms": 42.0,
    "error_rate": 0.0
  },
  "process": {
    "pid": 12345,
    "uptime_seconds": 86400,
    "restart_count": 0
  }
}
```

### KOMUT ALIMI (backend → agent WebSocket):
**Desteklenen komutlar:**
- **restart** : Servisi graceful shutdown + yeniden başlatma
- **stop** : Servisi durdurma (SIGTERM → SIGKILL fallback, 30s timeout)
- **ping** : Agent ve servis sağlık doğrulaması

**Komut formatı:**
```json
{ "type": "command", "command_id": "cmd_abc", "action": "restart", "timeout_sec": 30 }
```

**Agent yanıtı (ACK):**
```json
{ "type": "ack", "command_id": "cmd_abc", "status": "received" }
```

**Agent yanıtı (sonuç):**
```json
{ "type": "result", "command_id": "cmd_abc", "status": "success", "duration_ms": 1240 }
```

### PLATFORM DESTEĞİ:
- **Linux** x86_64, aarch64 → Tam destek
- **macOS** x86_64, Apple Silicon → Tam destek
- **Windows** x86_64 → Beta
- **Docker** linux/amd64, arm64 → Tam destek

### GÜVENLİK:
- Agent yalnızca allowlist'e alınmış komutları çalıştırır
- Komutlar imzalı JWT ile taşınır; agent imzayı doğrular
- Arbitrary shell execution YOK
- Agent kurulumunda backend'in public key'i konfigürasyona eklenir

---

## 9. AI ENTEGRASYONU

### GENEL YAPI:
- LLM çağrıları YALNIZCA backend üzerinden yapılır
- API anahtarı hiçbir zaman frontend'e expose edilmez
- CLAUDE_API_KEY yalnızca sunucu ortam değişkeninde saklanır
- Varsayılan model: Claude Sonnet 4 (konfigüre edilebilir)
- Rate limiting: kullanıcı başına dakikada maks 10 AI çağrısı

### ANOMALİ TETİKLEME EŞİKLERİ:
- **CPU ani artış** : Normalin 2 standart sapma üzerindeki spike'lar
- **Latency artışı** : Ortalama latency'nin 1.5x eşiği aşması
- **Error rate** : 5 dakika içinde hata oranının %5'i geçmesi

### AI ANALİZ GİRDİSİ:
Backend AI'ya şunları bağlam olarak iletir:
- Son N dakikanın metrik geçmişi
- Servis metadata'sı
- Diğer servislerin eş zamanlı durumu (cross-servis korelasyon için)

### AI ÇIKTI FORMATI (structured JSON):
```json
{
  "summary": "payment-service'de latency artışı tespit edildi",
  "root_cause": "auth-service timeout'larıyla korelasyon var",
  "recommendations": [
    { "action": "auth-service loglarını 14:30-14:35 aralığında incele",
      "priority": "high" },
    { "action": "payment-service'i restart etmeyi değerlendir",
      "priority": "medium" }
  ],
  "confidence": 0.82
}
```

### ÖRNEK AI ÇIKTISI:
"payment-service'deki latency artışı (14:32'den itibaren +340ms) ile
 auth-service'deki timeout oranı artışı (%0.2'den %3.8'e) eş zamanlı
 gerçekleşti. payment-service'in auth-service'e olan bağımlılığı göz
 önüne alındığında, kök nedenin auth-service kaynaklı olduğu tahmin
 edilmektedir. Önerilen aksiyon: auth-service servis loglarını
 14:30-14:35 aralığında inceleyin."

### V2 PLANLANAN:
- Cross-servis korelasyon analizi
- Öngörüsel uyarı (predictive alert)

---

## 10. ÖZELLİK LİSTESİ

### MVP (Faz 1-4, 10 hafta):
#### [AUTH]
- Kullanıcı kaydı (register) — email + parola, form validasyonlu
- Giriş (login) ve çıkış (logout) — JWT tabanlı
- Her kullanıcı yalnızca kendi servislerini görür (izolasyon)

#### [SERVİS YÖNETİMİ]
- Yeni servis ekleme: IP, port, health endpoint, polling interval
- Servis düzenleme ve silme
- Otomatik agent kurulum komutu üretimi

#### [İZLEME]
- Gerçek zamanlı metrik izleme: CPU, bellek, disk, latency
- Servis sağlık durumu kartları: UP / DOWN / DEGRADED
- Uptime yüzdesi ve son kontrol zamanı
- Alert mekanizması: eşik aşımında görsel uyarı + toast bildirimi

#### [GÖRSELLEŞTİRME]
- Latency zaman serisi grafikleri (Recharts)
- Zaman aralığı seçici: 1h, 6h, 24h, 7g
- Servis durum kartları

#### [YÖNETİM]
- Restart komutu (agent üzerinden)
- Stop komutu (agent üzerinden)
- Komut geçmişi logu

#### [AI]
- Anomali tespitinde AI analizi tetikleme
- AI insight kartı: özet, olası nedenler, önerilen aksiyonlar
- Manuel "Analiz Et" butonu

#### [DEPLOYMENT]
- Docker Compose ile tek komut kurulum
- Responsive tasarım (mobil + tablet + desktop)

### V2 (MVP sonrası):
- Cross-servis korelasyon analizi
- Öngörüsel uyarı (predictive alert)
- Log streaming: gerçek zamanlı, keyword filtreleme
- Webhook entegrasyonu: Slack, Discord, özel endpoint
- Custom metrik tanımı: kullanıcı tanımlı endpoint'ler
- Servis bağımlılık haritası (interaktif graph)
- Scale komutu (container ortamında replica sayısı)

---

## 11. GÜVENLİK MİMARİSİ

### KİMLİK DOĞRULAMA:
- JWT access token : 24 saat ömürlü
- JWT refresh token : 30 gün ömürlü
- Parola hashleme : bcrypt, cost factor 12
- API key'ler : bcrypt hashlenmiş, plaintext hiç saklanmaz
- Kullanıcı izolasyonu: her kullanıcı yalnızca kendi kaynaklarına erişir

### AGENT GÜVENLİĞİ:
- Komutlar imzalı JWT ile taşınır
- Agent yalnızca allowlist komutları çalıştırır (restart, stop, ping)
- Arbitrary shell execution yok
- Agent kurulumda backend public key'ini alır, imza doğrular

### AĞ GÜVENLİĞİ:
- TLS zorunlu; HTTP fallback üretimde devre dışı
- Rate limiting: IP başına dk'da 100 istek; AI endpoint dk'da 10
- CORS: yalnızca kayıtlı origin'lere izin
- SQL injection: ORM parameterized queries; ham string interpolasyon yok

### VERİ GÜVENLİĞİ:
- Hassas env değişkenler yalnızca sunucu tarafında
- Frontend hiçbir API key görmez

---

## 12. PERFORMANS HEDEFLERİ

| Metrik | Hedef Değer |
|--------|-------------|
| Maksimum izlenebilir servis | 500 / kullanıcı (tek backend instance) |
| Metrik güncelleme gecikmesi | < 200ms (agent → frontend görünümüne kadar) |
| WebSocket eşzamanlı bağlantı | 1.000+ (goroutine başına düşük memory) |
| API yanıt süresi (p95) | < 50ms |
| Metrik sorgu süresi (1 saat) | < 100ms (TimescaleDB compressed query) |
| Agent bellek kullanımı | < 20MB RSS |
| AI analiz gecikme süresi | < 3 saniye (LLM API süresine bağlı) |
| Backend uptime hedefi | %99.5 (aylık planlı bakım dahil) |

### V2 SKALABILITE PLANI:
- Horizontal scaling: backend çoklu instance
- WebSocket Hub: Redis Pub/Sub ile instance'lar arası mesaj
- Metrik write path: NATS veya Kafka ile asenkron

---

## 13. 10 HAFTALIK GELİŞTİRME PLANI

### GENEL TABLO:
| Faz | Hafta | Odak | Milestone |
|-----|-------|------|-----------|
| Faz 1 | H1-H2 | Temel Kurulum | M1: Temel Çalışan Sistem |
| Faz 2 | H3-H5 | Core Özellikler | M2: Canlı Veri Akışı |
| Faz 3 | H6-H8 | AI + Gelişmiş | M3: Tam Özellik Seti |
| Faz 4 | H9-H10 | Polish + Test + Teslim | TESLİM |

**GÜNLÜK ÇALIŞMA**: Yarı zamanlı, günde 2-4 saat

### FAZ 1 — TEMEL KURULUM (H1-H2)

#### HAFTA 1 — Proje İskeleti (toplam ~18 saat)
✦ Go mod init + Gin kurulumu (4 saat)  
github.com/gin-gonic/gin; main.go; temel router

✦ TimescaleDB Docker Compose (3 saat)  
docker-compose.yml; postgres+timescaledb; migration yapısı

✦ Vite + React + TypeScript kurulumu (4 saat)  
npm create vite; tsconfig; eslint; prettier

✦ React Router DOM kurulumu (2 saat)  
BrowserRouter; /login /register /dashboard route'ları

✦ Layout bileşenleri (Sidebar, Navbar) (4 saat)  
Shadcn/ui kurulumu; temel sayfa çerçevesi

✦ GitHub repo + branch stratejisi (1 saat)  
main/develop/feature/* yapısı

**ÖĞRENİLECEK**: Gin framework route yapısı, Vite+React TypeScript konfigürasyonu, Shadcn/ui kurulumu

**KONTROL KRİTERİ**:
- curl http://localhost:8080/health → 200 OK
- React sayfası tarayıcıda açılıyor
- Docker Compose ile DB ayaklanıyor

#### HAFTA 2 — DB Migrasyonları + Temel API (toplam ~18 saat)
✦ DB şeması migrasyonları (4 saat)  
users, services, metrics tabloları; golang-migrate

✦ GORM/sqlx entegrasyonu (3 saat)  
ORM konfigürasyonu; model struct'ları

✦ Temel CRUD endpoint testi (3 saat)  
Postman/HTTPie ile manuel test

✦ React axios/fetch katmanı (3 saat)  
api/ klasörü; base URL; interceptor

✦ Login/Register sayfası UI (4 saat)  
React Hook Form; Zod validasyon şeması

✦ M1 kontrol ve düzeltme (1 saat)

**ÖĞRENİLECEK**: Go GORM ORM, golang-migrate, React Hook Form + Zod

**KONTROL KRİTERİ (M1)**:
- DB şeması migrate edilmiş
- /api/v1/health ve GET /api/v1/services yanıt veriyor
- Login formu render oluyor, validasyon çalışıyor

### FAZ 2 — CORE ÖZELLİKLER (H3-H5)

#### HAFTA 3 — Auth Sistemi + Servis CRUD (toplam ~20 saat)
✦ POST /auth/register — backend (4 saat)  
bcrypt hash; email unique kontrol; JWT üretme

✦ POST /auth/login — backend (3 saat)  
Kimlik doğrulama; access + refresh token

✦ Auth middleware (3 saat)  
Authorization header parse; token doğrulama; context inject

✦ POST/GET/PUT/DELETE /services (4 saat)  
Tam CRUD; user_id izolasyonu; validasyon

✦ React auth context + protected route (3 saat)  
AuthProvider; useAuth hook; PrivateRoute wrapper

✦ Servis ekleme formu (frontend) (3 saat)  
Ad, host, port, endpoint, interval; form validasyon

**ÖĞRENİLECEK**: golang-jwt, Go middleware zinciri, React Context API

**KONTROL KRİTERİ**:
- Register → Login → Token al → Korumalı endpoint'e istek → 200
- Yetkisiz istek → 401
- Servis ekleme formu çalışıyor

#### HAFTA 4 — Rust Agent Bölüm 1 (toplam ~16 saat)
✦ Rust projesi init (cargo new) (2 saat)  
Tokio async runtime; serde_json; reqwest bağımlılıkları

✦ Sistem metrik toplama (5 saat)  
sysinfo crate ile CPU, bellek, disk okuma

✦ Health endpoint polling (4 saat)  
reqwest ile HTTP GET; latency ölçümü; status parse

✦ CLI arg parse (3 saat)  
clap crate; --token, --backend, --service-id parametreleri

✦ Cross-compile yapılandırması (2 saat)  
.cargo/config.toml; linux-musl target

**ÖĞRENİLECEK**: Rust Tokio async modeli, sysinfo crate, clap, cross-compile

**KONTROL KRİTERİ**:
```
./nanonet-agent --token x --backend ws://localhost:8080 --service-id test
```
Terminalde metrik çıktısı görünüyor

#### HAFTA 5 — WebSocket Entegrasyonu (M2) (toplam ~18 saat)
✦ Go WebSocket Hub (5 saat)  
gorilla/websocket; register/unregister; broadcast channel

✦ Agent WebSocket bağlantısı (Rust) (4 saat)  
tokio-tungstenite; token authenticate; reconnect logic

✦ React useWebSocket hook (4 saat)  
WebSocket bağlantısı; JSON parse; state güncelleme

✦ Servis kartları canlı güncelleme (3 saat)  
Zustand store; kart bileşeni metrik state'i

✦ M2 kontrol ve düzeltme (2 saat)

**ÖĞRENİLECEK**: gorilla/websocket sunucu mimarisi, tokio-tungstenite, Zustand reactive state

**KONTROL KRİTERİ (M2)**:
- Agent bağlandığında React dashboard kartı 10 saniyede bir güncelleniyor
- Kullanıcı giriş yapıyor, kendi servislerini görüyor

### FAZ 3 — AI + GELİŞMİŞ ÖZELLİKLER (H6-H8)

#### HAFTA 6 — Dashboard UI + Grafikler (toplam ~18 saat)
✦ Recharts entegrasyonu (3 saat)  
LineChart; AreaChart; zaman serisi veri formatı

✦ Latency/CPU grafik bileşeni (5 saat)  
Time range selector (1h/6h/24h); API'den geçmiş çekme

✦ Servis detay sayfası (4 saat)  
Metrik grafikleri + özet istatistikler + servis bilgisi

✦ GET /services/{id}/metrics endpoint (3 saat)  
from/to/interval query params; TimescaleDB time_bucket sorgusu

✦ Responsive grid layout (3 saat)  
Tailwind grid; mobil breakpoint'lar

**ÖĞRENİLECEK**: Recharts LineChart/AreaChart, TimescaleDB time_bucket(), Tailwind responsive grid

**KONTROL KRİTERİ**:
- Servis detay sayfasında CPU ve latency grafikleri görülüyor
- Zaman aralığı değişince grafik güncelleniyor
- Mobil görünüm bozulmuyor

#### HAFTA 7 — Kontrol Paneli (Restart/Stop) (toplam ~17 saat)
✦ POST /services/{id}/restart endpoint (3 saat)  
Agent'a komut gönderme; async; komut ID ile takip

✦ Agent komut alıcı (Rust) (5 saat)  
WS'ten komut dinleme; ACK gönderme; process restart logic

✦ Kontrol buton bileşeni (UI) (3 saat)  
Konfirmasyon modal; disabled state; loading indicator

✦ Komut geçmişi logu (3 saat)  
Son 10 komut; zaman, sonuç, kullanıcı

✦ Komut durumu WebSocket push (3 saat)  
Backend komut sonucunu frontend'e WS ile iletir

**ÖĞRENİLECEK**: Rust'ta SIGTERM/SIGKILL process yönetimi, Go async komut gönderme pattern'ı, React optimistic UI

**KONTROL KRİTERİ**:
- Dashboard'tan restart'a basılıyor → modal onaylanıyor → 5 saniye içinde kartda "Restarting..." → "UP" görülüyor

#### HAFTA 8 — AI + Alert (M3) (toplam ~17 saat)
✦ Claude API Go entegrasyonu (4 saat)  
HTTP client; prompt şablonu; structured JSON çıktısı

✦ Anomali tetikleme mantığı (3 saat)  
Eşik kontrolü (CPU>80, latency>500ms); debounce

✦ AI insight kart bileşeni (4 saat)  
Analiz özeti; olası nedenler; önerilen aksiyonlar

✦ Alert modeli + DB tablosu (2 saat)  
alerts tablosu; severity enum; resolved_at

✦ Toast bildirim sistemi (2 saat)  
react-hot-toast; önem seviyesine göre renk

✦ M3 kontrol ve düzeltme (2 saat)

**ÖĞRENİLECEK**: Claude API sistem promptu ve structured output, Go debounce pattern'ı, react-hot-toast

**KONTROL KRİTERİ (M3)**:
- CPU > %80 geçince 30 saniye içinde AI insight kartı açılıyor
- Toast bildirimi çıkıyor
- Restart komutu çalışıyor

### FAZ 4 — POLISH + TEST + TESLİM (H9-H10)

#### HAFTA 9 — Test + Responsive Polish (toplam ~17 saat)
✦ Go backend unit testleri (4 saat)  
testing paketi; auth, servis CRUD, alert endpoint'leri

✦ React component testleri (3 saat)  
Jest + React Testing Library; servis kartı, form

✦ Playwright E2E testi (4 saat)  
Register → login → servis ekle → dashboard gör → logout

✦ Mobil responsive düzeltmeler (3 saat)  
Dashboard, servis detay, kontrol sayfaları mobil görünüm

✦ Hata yönetimi ve boş durum UI'ları (3 saat)  
Servis yok, API hatası, bağlantı koptu ekranları

**ÖĞRENİLECEK**: Go table-driven test yazımı, Playwright otomasyon, Chrome DevTools device mode

**KONTROL KRİTERİ**:
- Backend testleri geçiyor (%80+ coverage)
- E2E happy path testi geçiyor
- Mobil (375px) ve tablet (768px) görünüm düzgün

#### HAFTA 10 — Docker Deploy + Teslim (toplam ~15 saat)
✦ Dockerfile'lar (backend + frontend) (3 saat)  
Multi-stage build; minimal image boyutu; alpine base

✦ Docker Compose tam yapılandırması (3 saat)  
db + backend + frontend servisleri; .env dosyası

✦ README + kurulum dokümantasyonu (3 saat)  
Kurulum adımları; ortam değişkenleri; agent kurulumu

✦ Son bug'lar ve edge case'ler (3 saat)  
Test sırasında bulunan sorunların çözümü

✦ Proje sunumu hazırlığı (3 saat)  
Demo script; öne çıkarılacak özellikler; soru-cevap hazırlığı

**ÖĞRENİLECEK**: Docker multi-stage build, Docker Compose orkestrasyon

**KONTROL KRİTERİ (TESLİM)**:
- docker-compose up --build → her şey ayaklanıyor
- Demo hesabıyla giriş, servis ekleme, dashboard görüntüsü, AI analizi tetiklenebiliyor

### MİLESTONE ÖZETİ:
- **M1 (H2 sonu)**: Go backend ayakta, DB bağlı, React açılıyor, endpoint testi geçiyor
- **M2 (H5 sonu)**: Rust agent metrik gönderiyor, WebSocket üzerinden dashboard'a ulaşıyor, kullanıcı giriş yapabiliyor
- **M3 (H8 sonu)**: AI analizi çalışıyor, restart/stop komutu agent'a ulaşıyor, alert tetikleniyor
- **TESLİM (H10)**: Tüm E2E testler geçiyor, Docker Compose ile tek komutta ayaklanıyor, responsive tasarım tamam

---

## 14. TEKNOLOJİ ÖĞRENME TAKVİMİ

| Teknoloji | Hafta | Kaynak | Süre |
|-----------|-------|--------|------|
| Go + Gin Framework | H1-H2 | go.dev/tour + gin-gonic.com | 6-8 saat |
| GORM / golang-migrate | H2 | gorm.io/docs | 3-4 saat |
| React Hook Form + Zod | H2-H3 | react-hook-form.com + zod.dev | 4-5 saat |
| golang-jwt (JWT) | H3 | github.com/golang-jwt/jwt | 2-3 saat |
| Rust + Tokio async | H4 | tokio.rs/tokio/tutorial | 8-10 saat |
| sysinfo + reqwest (Rust) | H4 | docs.rs/sysinfo + reqwest | 3-4 saat |
| clap (CLI Rust) | H4 | docs.rs/clap | 2 saat |
| gorilla/websocket (Go) | H5 | pkg.go.dev/gorilla/websocket | 4-5 saat |
| tokio-tungstenite (Rust) | H5 | docs.rs/tokio-tungstenite | 3-4 saat |
| Zustand | H5 | docs.pmnd.rs/zustand | 2-3 saat |
| Recharts | H6 | recharts.org/guide | 3-4 saat |
| TimescaleDB time_bucket() | H6 | docs.timescale.com/api | 2-3 saat |
| Claude API (Go) | H8 | docs.anthropic.com | 3-4 saat |
| Playwright | H9 | playwright.dev/docs | 4-5 saat |
| Docker multi-stage build | H10 | docs.docker.com/build/guide | 3-4 saat |

**TOPLAM TAHMİNİ ÖĞRENME SÜRESİ**: ~55-70 saat (10 hafta boyunca dağılmış)

---

## 15. RİSK ANALİZİ

| Risk | Etki | Olasılık | Hafifletme |
|------|------|----------|------------|
| Rust async öğrenmesi beklenenden uzun sürer | Yüksek | Yüksek | H4'te sadece agent core'una odaklan; WS H5'e taşı |
| gorilla/ws + tokio-tungstenite uyumsuzluğu | Yüksek | Orta | H5'te 1 gün WS prototipe ayır; REST polling fallback |
| TimescaleDB migrasyon sorunları | Orta | Orta | Docker volume temizle; migration rollback |
| Claude API rate limit aşımı | Orta | Orta | Debounce + rate limiter; mock response |
| Docker build süresi ve boyut | Orta | Orta | Multi-stage build; alpine base; H10'da erkenden başla |
| E2E testlerin geliştirme zamanı çalması | Orta | Yüksek | Yalnızca happy path; unit test kapsamını düşür |
| Rust cross-compile başarısızlığı | Orta | Orta | GitHub Actions matrix build; linux-amd64 minimum zorunlu |
| Haftalık süre yetersizliği (diğer dersler) | Yüksek | Yüksek | Her haftanın başında sprint gözden geçir; düşük öncelikli görevleri sona ertele |
| Yanlış restart komutu (insan hatası) | Yüksek | Orta | Konfirmasyon modal; komut geçmişi; 10 saniyelik geri alma penceresi |
| Agent binary güvenlik açığı | Kritik | Düşük | Release imzalama; checksum doğrulama; minimal permission |

### GENEL RİSK KURALI:
Bir görev beklenen sürenin 1.5 katını aşarsa dur ve çözümü
basitleştir. MVP çalışıyorsa teslim edilebilir. Süslemeyi sona bırak.

---

## 16. DEPLOYMENT MİMARİSİ

### ORTAM DEĞİŞKENLERİ:
**Backend:**
```
DATABASE_URL        = postgres://user:pass@db:5432/nanonet
JWT_SECRET          = <min. 256-bit random string>
CLAUDE_API_KEY      = <Anthropic API key>
POLL_DEFAULT_SEC    = 10
WS_MAX_CONNECTIONS  = 1000
```

**Agent:**
```
NANONET_TOKEN       = <backend API token>
NANONET_BACKEND     = wss://nanonet.dev
NANONET_SERVICE_ID  = <servis UUID>
```

**Frontend:**
```
REACT_APP_API_URL   = http://localhost:8080/api/v1
REACT_APP_WS_URL    = ws://localhost:8080
```

### DOCKER COMPOSE YAPISI:
```yaml
services:
  db:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_DB: nanonet
      POSTGRES_PASSWORD: ${DB_PASS}

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASS}@db:5432/nanonet
      JWT_SECRET: ${JWT_SECRET}
      CLAUDE_API_KEY: ${CLAUDE_API_KEY}
    depends_on: [db]
    ports: ["8080:8080"]

  frontend:
    build: ./frontend
    environment:
      REACT_APP_API_URL: http://localhost:8080/api/v1
    ports: ["3000:3000"]
```

### KLASÖR YAPISI (önerilen):
```
nanonet/
├── backend/           Go kaynak kodu
│   ├── cmd/
│   ├── internal/
│   │   ├── auth/
│   │   ├── services/
│   │   ├── metrics/
│   │   ├── ws/
│   │   └── ai/
│   ├── migrations/
│   └── Dockerfile
├── frontend/          React kaynak kodu
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/     (Zustand)
│   │   └── api/
│   └── Dockerfile
├── agent/             Rust kaynak kodu
│   ├── src/
│   │   ├── main.rs
│   │   ├── metrics.rs
│   │   ├── ws.rs
│   │   └── commands.rs
│   └── Cargo.toml
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 17. YMH354 DERS GEREKSİNİMİ UYUM TABLOSU

| Gereksinim | Durum | NanoNet'teki Karşılığı |
|------------|-------|------------------------|
| React kullanımı | ✓ TAMAM | Tüm frontend React 18 + TypeScript |
| Üyelik (register) sistemi | ✓ TAMAM | JWT + bcrypt; email unique; form validasyon |
| Giriş / çıkış (login/logout) | ✓ TAMAM | JWT access+refresh token; logout'ta invalidasyon |
| Form validasyonu (en az 1) | ✓ TAMAM | React Hook Form + Zod; client + server side |
| AI araç entegrasyonu | ✓ TAMAM | Claude API; anomali tespiti; backend üzerinden |
| AI servis back-end'den çağrılır | ✓ TAMAM | CLAUDE_API_KEY yalnızca sunucu env'de; frontend hiç görmez |
| Dinamik dashboard | ✓ TAMAM | WebSocket canlı akış; hardcoded veri yok |
| Grafik veya tablo içeren dashboard | ✓ TAMAM | Recharts zaman serisi grafikleri |
| REST API yapısı | ✓ TAMAM | Go Gin; /api/v1 prefix; RESTful endpoints |
| Veritabanı kullanımı | ✓ TAMAM | PostgreSQL + TimescaleDB (MongoDB gerekçesi: aşağıda) |
| En az 3 farklı endpoint | ✓ TAMAM | 20+ endpoint mevcut |
| AI çağrıları server-side | ✓ TAMAM | Yalnızca backend AI API'sine çağrı yapıyor |
| Responsive tasarım | ✓ TAMAM | Tailwind + Shadcn/ui; mobile-first; sm/md/lg/xl |
| Erişilebilirlik | ✓ TAMAM | Shadcn/ui ARIA etiketleri; klavye navigasyonu |
| Belirli bir probleme çözüm | ✓ TAMAM | Dağıtık mikroservis yönetimi sorunu |
| Kullanıcı odaklı tasarım | ✓ TAMAM | Tek tıkla servis ekleme; otomatik agent kurulum komutu |
| Geliştirme yaşam döngüsü | ✓ TAMAM | Gereksinim → tasarım → geliştirme → test → deploy |

### TimescaleDB vs MongoDB gerekçesi:
Uygulamanın çekirdek verisi zaman serisidir (10 saniyede bir metrik).
MongoDB zaman aralıklı toplu sorgularda yetersiz kalır. TimescaleDB
standart SQL + otomatik partitioning + sıkıştırma ile bu iş yükü
için doğru araçtır. Datadog, InfluxDB ve TimescaleDB gerçek üretim
projelerinde aynı gerekçeyle tercih edilir.

**Hibrit seçenek**: kullanıcı/servis metadata → MongoDB,
                zaman serisi metrikler → TimescaleDB

---

## 18. TESLİM ÖNCESİ KONTROL LİSTESİ

### TEKNİK:
- [ ] npm run build hatasız tamamlanıyor
- [ ] Register → Login → Korumalı sayfa → Logout akışı çalışıyor
- [ ] En az 1 form validasyonu çalışıyor (hata mesajı görünüyor)
- [ ] Network sekmesinde AI çağrısı frontend'den gitmiyor; backend'den
- [ ] Dashboard'ta hardcoded veri yok; her şey API/WS'ten geliyor
- [ ] En az 1 Recharts grafiği canlı veriyle dolduruluyor
- [ ] En az 3 REST endpoint çalışıyor
- [ ] Servisler ve kullanıcılar DB'ye yazılıp okunuyor

### UX:
- [ ] 375px (mobile), 768px (tablet), 1280px (desktop) görünüm düzgün
- [ ] API hatası durumunda kullanıcıya mesaj gösteriliyor
- [ ] Boş liste durumu (servis yok) ekranı var
- [ ] Bağlantı koptu durumu için UI var

### DEPLOY:
- [ ] docker-compose up --build → her şey ayaklanıyor
- [ ] README'de kurulum adımları var; başka biri kurabilmeli
- [ ] .env.example dosyası mevcut

### SUNUM:
- [ ] Canlı demo script'i hazır
- [ ] Demo için sahte veri yüklenmiş
- [ ] "Neden bu teknoloji?" sorularına hazır cevaplar var
- [ ] "AI nasıl çalışıyor?" sorusuna hazır cevap var

---

## NOTLAR VE KARARLAR (geliştirilirken güncellenir)

**2026 — İlk karar:**
- Proje adı NanoNet olarak belirlendi
- Stack kararları finalize edildi (Go backend, Rust agent, React frontend)
- TimescaleDB seçildi; gerekçe yukarıda belgelendi
- 10 haftalık sprint planı hazırlandı

### TODO (henüz karar verilmemiş):
- Go ORM: GORM mi sqlx mi? (GORM daha hızlı; sqlx daha kontrollü)
- Frontend build tool: Vite (önerilen, Create React App deprecated)
- AI model varsayılanı: Claude haiku 3.5 (değiştirilebilir)
- Agent config: env mi YAML mi? (env daha basit, H4'te karar)

---

## SON

**Dosya boyutu** : ~12 KB  
**Toplam madde** : 100+  
**Son güncelleme** : 2026
