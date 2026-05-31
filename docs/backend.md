# Backend (Go)

**Modül:** `nanonet-backend`  
**Giriş:** `backend/cmd/main.go`  
**Framework:** Gin + GORM + golang-migrate

## Dizin yapısı

```
backend/
├── cmd/main.go          Route wiring, arka plan işleri
├── internal/            Domain modülleri (handler + service + repo)
├── pkg/                 Paylaşılan altyapı
└── migrations/          SQL migrasyonları (0001–0034)
```

## `internal/` modülleri

| Paket | Sorumluluk |
|-------|------------|
| `auth` | Kayıt, login, JWT, agent token, şifre sıfırlama, middleware |
| `services` | İzlenen servis CRUD, lifecycle komutları, servis haritası |
| `metrics` | Timescale ingest/sorgu, uptime, rollup, forecast, özet |
| `commands` | Komut kuyruğu ve geçmiş |
| `alerts` | Kurallar, aktif uyarılar, resolve/snooze, e-posta |
| `ai` | Claude chat, rapor, insight, maliyet koruması |
| `ws` | Hub, dashboard/agent stream, metrics broadcaster |
| `logs` | `service_logs` arama ve istatistik |
| `dependencies` | Agent raporlu outbound bağlantılar |
| `grants` | Servis bazlı RBAC (viewer/operator/admin) |
| `maintenance` | Bakım penceresi → uyarı bastırma |
| `notifications` | Slack, Discord, webhook, e-posta, PagerDuty, Expo push |
| `incidents` | Uyarılardan incident gruplama |
| `probes` | Synthetic HTTP probe runner |
| `runbooks` | Alert tetiklemeli otomasyon |
| `slo` | SLO tanımı ve compliance |
| `statuspage` | Herkese açık durum sayfası |
| `security` | Servis güvenlik taraması |
| `k8s` | `kubectl` sarmalayıcı REST API |
| `settings` | Kullanıcı ayarları |
| `apitokens` | Kişisel API token + scope |
| `agentmgmt` | Agent sürüm / heartbeat meta |
| `demo` | Demo seed endpoint |
| `observability` | Prometheus HTTP middleware |
| `health` | Detaylı sağlık, liveness, readiness |

## `pkg/` paketleri

| Paket | Açıklama |
|-------|----------|
| `config` | `.env` yükleme, güvenlik bayrakları |
| `database` | GORM, migrasyon çalıştırıcı |
| `middleware` | CORS, CSRF, güvenlik header, structured log |
| `ratelimit` | IP rate limit |
| `tokenblacklist` | Bellek veya Redis JWT blacklist |
| `redisstore` | Redis client |
| `mailer` | SMTP |
| `push` | Expo push API |
| `netguard` | SSRF koruması (webhook/probe) |
| `agentsign` | Agent HMAC imza |
| `audit` | Audit log HTTP |
| `ownership` | Kaynak sahipliği kontrolü |
| `response` | Standart JSON cevap |
| `secrets` | URL/token redaksiyon |
| `shutdown` | Graceful kapanış |

## Migrasyonlar

`backend/migrations/` — çift yönlü `.up.sql` / `.down.sql`.  
Başlıca tablolar: `users`, `services`, `metrics` (hypertable), `alerts`, `command_logs`, `service_logs`, `incidents`, `probes`, `runbooks`, `slos`, `api_tokens`, `push_preferences`.

## Ortam değişkenleri

Bkz. kök `.env.example`. Kritik alanlar:

- `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`
- `CLAUDE_API_KEY`, `FRONTEND_URL`, `ALLOWED_ORIGINS`
- `SMTP_*`, `METRICS_BASIC_AUTH`, `ENVIRONMENT`

## Geliştirme

```bash
cd backend
go mod tidy
go run cmd/main.go          # veya: air (hot reload)
go test ./...
```

Docker dev: `make dev-backend` veya tam stack `make dev`.
