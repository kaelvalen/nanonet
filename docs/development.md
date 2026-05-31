# Geliştirme Ortamı

## Gereksinimler

- Docker & Docker Compose
- Go 1.23+
- Node.js 20+
- Rust 1.70+ (agent için)
- Opsiyonel: Nix (`flake.nix` dev shell)

## İlk kurulum

```bash
git clone <repo-url> nanonet && cd nanonet
cp .env.example .env
# JWT_SECRET, CLAUDE_API_KEY, isteğe bağlı AGENT_* doldur
npm install                  # workspace: frontend, mobile, packages
```

## Docker (önerilen)

```bash
make dev        # Build + arka plan + renkli log viewer
make dev-bg     # Sadece arka planda başlat
make down       # Durdur
make reset      # Volume sil (DB sıfırla)
make ps         # Container listesi
```

`docker-compose.dev.yml`: backend, frontend, TimescaleDB, Redis, 17 mock servis.

## Nix dev shell

```bash
nix develop
# go, rust (musl), node 20, docker, air, make hazır
# .env yoksa otomatik .env.example kopyalanır
```

## Bileşen bazlı

| Bileşen | Komut |
|---------|--------|
| Backend | `cd backend && air` veya `go run cmd/main.go` |
| Frontend | `cd frontend && npm run dev` |
| Agent | `make agent` |
| Mobile | `make mobile-dev` |

## Loglar

```bash
make logs              # backend + frontend
make logs-mock         # mock servisler
make logs-err LEVEL=error
make logs-since SINCE=1h
```

Script: `scripts/dev-logs.sh`

## OpenAPI

| Komut | Açıklama |
|-------|----------|
| `make openapi-sync` | Spec → `docs/api` + `pkg/apidocs` embed |
| `make api-docs` | Swagger UI URL'lerini yazdır |
| `npm run openapi:lint` | Redocly ile spec doğrula |
| `cd frontend && npm run api:types` | `src/api/generated/schema.ts` üret |

Backend çalışırken: http://localhost:8080/api/docs

Spec düzenleme: `backend/api/openapi.yaml` (+ isteğe bağlı `paths-extra.yaml` birleştirme).

## Lint

```bash
./lint.sh              # Biome (kök biome.json)
```

## Mock servisler

```bash
make mock-all          # 17 senaryo container
make mock-scenario SVC=http://localhost:8002 SCENARIO=down
```

Bkz. [mock-service/README](../mock-service/README.md).

## Agent derleme

```bash
make agent-build
make agent-linux-amd64
make agent-build-all   # tüm platformlar + sha256
```

## Ortam değişkenleri

Kök `.env.example` — tüm servisler için.  
Frontend: `frontend/.env.example` (`VITE_API_URL`, `VITE_WS_URL`).
