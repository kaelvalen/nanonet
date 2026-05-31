# API Referansı

**Base URL:** `http://localhost:8080` (geliştirme)  
**API prefix:** `/api/v1`  
**Kimlik doğrulama:** `Authorization: Bearer <access_token>` veya API token (scope gerekli)

**Canlı dokümantasyon (Swagger UI):** http://localhost:8080/api/docs  
**OpenAPI dosyası:** http://localhost:8080/api/openapi.yaml  

Kaynak spec (tek kaynak): [../backend/api/openapi.yaml](../backend/api/openapi.yaml)  
Kopya: [api/openapi.yaml](./api/openapi.yaml)

```bash
make openapi-sync          # spec senkron + embed
npm run openapi:lint       # Redocly doğrulama
cd frontend && npm run api:types   # TypeScript tipleri üret
```

## Sistem endpoint'leri

| Method | Path | Auth | Açıklama |
|--------|------|------|----------|
| GET | `/health` | Hayır | Basit durum + bağlı WS sayıları |
| GET | `/health/live` | Hayır | Liveness (Kubernetes) |
| GET | `/health/ready` | Hayır | Readiness (DB ping) |
| GET | `/health/details` | Hayır | DB/Redis/system detaylı sağlık |
| GET | `/metrics` | Basic auth (prod) / açık (dev) | Prometheus metrikleri |
| POST | `/api/v1/metrics` | JWT | Metrik ingest (agent/dashboard) |

## WebSocket

| Path | Rol |
|------|-----|
| `GET /ws/dashboard` | Tüm dashboard canlı metrik akışı |
| `GET /ws/services/:id` | Tek servis akışı |
| `GET /ws/agent` | Agent bağlantısı (token query/header) |

## `/api/v1/auth`

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/register` | Kayıt |
| POST | `/login` | Giriş |
| POST | `/refresh` | Access token yenile |
| POST | `/mobile/refresh` | Mobil refresh |
| POST | `/forgot-password` | Sıfırlama e-postası |
| POST | `/reset-password` | Şifre sıfırla |
| POST | `/logout` | Çıkış (blacklist) |
| POST | `/agent-token` | Agent token oluştur |
| GET | `/agent-tokens` | Token listesi |
| DELETE | `/agent-tokens/:token_id` | Token iptal |
| GET | `/me` | Oturum kullanıcısı |
| PUT | `/password` | Şifre değiştir |

## `/api/v1/services`

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `` | Liste |
| POST | `` | Oluştur |
| GET | `/:id` | Detay |
| PUT | `/:id` | Güncelle |
| DELETE | `/:id` | Sil |
| GET | `/:id/metrics` | Metrik geçmişi |
| GET | `/:id/metrics/aggregated` | Agregasyon |
| GET | `/:id/metrics/uptime` | Uptime |
| GET | `/:id/metrics/rollup` | Rollup |
| GET | `/:id/metrics/forecast` | Tahmin |
| GET | `/:id/dependencies` | Bağımlılıklar |
| PATCH | `/:id/dependencies/:dep_id` | Bağımlılık promote |
| DELETE | `/:id/dependencies/:dep_id` | Bağımlılık sil |
| GET/POST/PATCH/DELETE | `/:id/grants` | Paylaşım yetkileri |
| GET | `/:id/alerts` | Servis uyarıları |
| GET/PUT | `/:id/alert-rules` | Kural CRUD |
| GET/POST/DELETE | `/:id/maintenance` | Bakım pencereleri |
| GET | `/:id/insights` | AI insight |
| POST | `/:id/restart` | Restart komutu |
| POST | `/:id/stop` | Stop |
| POST | `/:id/start` | Start |
| POST | `/:id/exec` | Exec |
| POST | `/:id/scale` | Scale |
| POST | `/:id/ping` | Health ping |
| POST | `/:id/analyze` | AI analiz |
| GET | `/:id/commands` | Komut geçmişi |
| GET | `/:id/logs` | Servis logları |
| GET/POST | `/:id/security/scans` | Güvenlik taraması |

**Global servis:**

| Method | Path |
|--------|------|
| GET/PUT | `/services/map` |
| GET | `/services/uptime/summary` |
| GET | `/metrics/summary` |
| GET | `/insights` |

## `/api/v1/alerts`

| Method | Path |
|--------|------|
| GET | `` (aktif) |
| POST | `/:alertId/resolve` |
| POST | `/:alertId/snooze` |

## `/api/v1/ai`

| Method | Path |
|--------|------|
| POST | `/chat` |
| POST | `/report` |
| GET | `/usage` |
| GET | `/usage/recent` |

## Diğer gruplar

| Grup | Önemli endpoint'ler |
|------|---------------------|
| `/settings` | GET, PUT |
| `/demo/seed` | POST (demo veri) |
| `/agents/release` | GET (agent binary meta) |
| `/api-tokens` | GET, POST, DELETE `/:id` |
| `/public/status/:slug` | GET (auth yok) |
| `/incidents` | CRUD + resolve |
| `/status-pages` | CRUD |
| `/slos` | CRUD + `/:id/compliance` |
| `/probes` | CRUD + `/:id/runs` |
| `/runbooks` | CRUD + `/:id/fires` |
| `/notifications` | channels, push-token, push-preferences |
| `/audit` | GET |
| `/security/overview` | GET |
| `/logs` | GET, GET `/stats` |
| `/k8s/*` | namespaces, pods, deployments, HPA, events, deploy, scale, logs |

K8s tam listesi `backend/cmd/main.go` içinde `k8sGroup` altında tanımlıdır.

## Rate limiting

- Global: 100 istek/dakika (IP)
- Hassas işlemler (`strictLimiter`): 10/dakika (restart, AI, K8s mutasyonları)
- Auth brute-force: ayrı limiter

## Hata formatı

Standart JSON: `pkg/response` — `success`, `error`, `data` alanları.
