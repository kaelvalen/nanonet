# Deployment

## Production Compose

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Servisler: TimescaleDB, Redis, backend, frontend (Nginx statik), opsiyonel agent profile.

## Nginx

`nginx/nginx.prod.conf` — TLS termination, upstream backend/frontend, rate limit, güvenlik header'ları.

Sertifikalar: `nginx/certs/` (gitignore — asla commit etmeyin).  
Kurulum: [nginx/README](../nginx/README.md).

## Ortam (production)

| Değişken | Not |
|----------|-----|
| `ENVIRONMENT=production` | Güvenli cookie, kısıtlı CORS |
| `JWT_SECRET` | Güçlü rastgele değer |
| `METRICS_BASIC_AUTH` | Prometheus `/metrics` koruması |
| `REDIS_URL` | Çoklu backend instance için zorunlu |
| `ALLOWED_ORIGINS` | Frontend origin listesi |
| `SECURE_COOKIES=true` | HTTPS arkasında |

## Agent dağıtımı

1. `make agent-build-all`
2. Binary'leri `releases/` veya CDN'den sun
3. `GET /api/v1/agents/release` — sürüm metadata

Kurulum scriptleri: `agent-setup.sh`, `agent-setup.ps1`, `agent/install.sh`.

## Veritabanı

- Migrasyonlar container entrypoint'te (`backend/entrypoint.sh`)
- Retention: ayarlar + arka plan retention job
- Yedekleme: TimescaleDB/PostgreSQL standart `pg_dump` prosedürü

## Gözlemlenebilirlik

- Backend: `GET /metrics` (Prometheus)
- Health probe: `GET /health/ready` (orchestrator)
- Liveness: `GET /health/live`
