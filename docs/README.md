# NanoNet Dokümantasyonu

NanoNet, mikroservis izleme ve operasyon platformudur. Bu dizin tüm bileşenlerin teknik referansını içerir.

## İçindekiler

| Doküman | Açıklama |
|---------|----------|
| [architecture.md](./architecture.md) | Sistem mimarisi, veri akışı, bileşenler |
| [architecture-diagrams.md](./architecture-diagrams.md) | Mermaid diyagramları |
| [api.md](./api.md) | REST ve WebSocket endpoint referansı |
| [api/openapi.yaml](./api/openapi.yaml) | OpenAPI 3.1 (senkron kopya) |
| Swagger UI | http://localhost:8080/api/docs |
| [backend.md](./backend.md) | Go API: modüller, `pkg/`, migrasyonlar |
| [frontend.md](./frontend.md) | React dashboard: sayfalar, API client, state |
| [agent.md](./agent.md) | Rust agent: protokol, komutlar, kurulum |
| [mobile.md](./mobile.md) | Expo mobil uygulama |
| [development.md](./development.md) | Geliştirme ortamı, Makefile, Nix, Docker |
| [deployment.md](./deployment.md) | Production compose ve Nginx |
| [testing.md](./testing.md) | Test komutları ve mock servisler |
| [security.md](./security.md) | Güvenlik standartları |
| [accessibility.md](./accessibility.md) | WCAG / i18n / a11y rehberi |
| [project-reference.md](./project-reference.md) | Proje kararları, sprint planı, ders referansı |

## Hızlı başlangıç

```bash
cp .env.example .env   # JWT_SECRET, CLAUDE_API_KEY doldur
make dev             # docker-compose.dev.yml + log viewer
```

- Dashboard: http://localhost:3000
- API: http://localhost:8080
- Health: http://localhost:8080/health

## Monorepo yapısı

```
nanonet/
├── backend/     Go + Gin API
├── frontend/    React + Vite dashboard
├── agent/       Rust monitoring agent
├── mobile/      Expo React Native
├── packages/    @nanonet/shared-types
├── mock-service/  Geliştirme mock hedefleri
├── nginx/       Production reverse proxy
├── docs/        Bu dokümantasyon
└── scripts/     dev-logs, mobile build
```

## Dış kaynaklar

- [Ana README](../README.md) — özet ve kurulum
- [mock-service/README](../mock-service/README.md) — senaryo mock'ları
- [nginx/README](../nginx/README.md) — TLS ve proxy
