# NanoNet

Mikroservis izleme ve operasyon platformu: gerçek zamanlı metrikler, agent tabanlı komutlar, AI analizi, uyarılar, SLO, synthetic probe, Kubernetes konsol ve mobil uygulama.

## Hızlı başlangıç

Her platform için tek komut:

| Platform | Kurulum | Başlatma |
|----------|---------|----------|
| **Linux / macOS / WSL** | `./dev.sh setup` | `./dev.sh dev` |
| **Windows** (PowerShell) | `.\dev.ps1 setup` | `.\dev.ps1 dev` |
| **Windows** (Komut İstemi) | `dev.bat setup` | `dev.bat dev` |
| **Nix** | `nix develop` | `make dev` |

```bash
# Linux / macOS / WSL
git clone <repository-url> && cd nanonet
chmod +x dev.sh
./dev.sh setup   # Docker, Go, Node, Rust yoksa otomatik kurar
./dev.sh dev     # Docker dev stack'i başlatır
```

```powershell
# Windows (PowerShell)
git clone <repository-url>; cd nanonet
.\dev.ps1 setup   # Docker Desktop, Go, Node, Rust yoksa winget ile kurar
.\dev.ps1 dev     # Docker dev stack'i başlatır
```

> `.env.example` dosyası otomatik kopyalanır. **`JWT_SECRET`** ve **`CLAUDE_API_KEY`** alanlarını `.env` içinde doldurun.

### Komutlar

```
setup    Bağımlılıkları kontrol et / kur (ilk kurulum)
dev      Geliştirme ortamını başlat
down     Servisleri durdur
reset    Servisleri durdur + DB sıfırla (volume sil)
logs     Logları takip et (./dev.sh logs backend — belirli servis)
ps       Çalışan container'ları listele
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
