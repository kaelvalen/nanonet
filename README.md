# NanoNet

Mikroservis izleme ve operasyon platformu: gerçek zamanlı metrikler, agent tabanlı komutlar, AI analizi, uyarılar, SLO, synthetic probe, Kubernetes konsol ve mobil uygulama.

## Hızlı başlangıç

```bash
git clone <repository-url> && cd nanonet
cp .env.example .env          # JWT_SECRET, CLAUDE_API_KEY
npm install
make dev                      # Docker dev stack + log viewer
```

| Servis | URL |
|--------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:8080 |
| Health | http://localhost:8080/health |

## Monorepo

| Dizin | Teknoloji | Rol |
|-------|-----------|-----|
| [backend/](backend/) | Go, Gin | REST API, WebSocket hub, TimescaleDB |
| [frontend/](frontend/) | React, Vite | Web dashboard |
| [agent/](agent/) | Rust, Tokio | Hedef sunucu agent |
| [mobile/](mobile/) | Expo | Mobil companion |
| [packages/shared-types/](packages/shared-types/) | TypeScript | Paylaşılan tipler |
| [docs/](docs/) | — | **Tüm teknik dokümantasyon** |

## Dokümantasyon

Tüm modül, API ve geliştirme rehberleri: **[docs/README.md](docs/README.md)**

- [Mimari](docs/architecture.md)
- [API referansı](docs/api.md) · **Swagger UI:** http://localhost:8080/api/docs
- [Backend modülleri](docs/backend.md)
- [Frontend](docs/frontend.md)
- [Agent](docs/agent.md)
- [Geliştirme](docs/development.md)

## Test

```bash
cd backend && go test ./...
cd agent && cargo test
make mobile-test
```

Ayrıntı: [docs/testing.md](docs/testing.md).

## Agent kurulumu

Dashboard → servis ekle → kurulum komutunu kopyala, veya:

```bash
./agent-setup.sh
# make agent  — yerel geliştirme
```

## Nix (opsiyonel)

```bash
nix develop    # flake.nix dev shell
```

## Lisans

MIT
