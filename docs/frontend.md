# Frontend (React)

**Stack:** React 18, TypeScript, Vite 6, React Router 7, TanStack Query, Zustand, Tailwind 4, Radix UI

## Dizin yapısı

```
frontend/src/
├── api/           Backend REST client'ları (19 modül)
├── pages/         Route ekranları
├── components/    UI, service-detail, kubernetes, service-map
├── store/         Zustand (auth, theme, ws, services, AI)
├── hooks/         useAuth, useWebSocket, useDashboardLayout
├── i18n/          TR + EN
├── types/         Yerel TS tipleri
└── routes.tsx     Lazy-loaded router
```

## API client modülleri

| Dosya | Backend grubu |
|-------|-----------------|
| `auth.ts` | `/auth` |
| `services.ts` | `/services` |
| `metrics.ts` | metrik / özet |
| `dependencies.ts` | bağımlılıklar |
| `grants.ts` | paylaşım |
| `maintenance.ts` | bakım |
| `notifications.ts` | bildirim kanalları |
| `incidents.ts` | incidents |
| `statuspage.ts` | durum sayfaları |
| `slo.ts` | SLO |
| `probes.ts` | probeler |
| `runbooks.ts` | runbook |
| `apiTokens.ts` | API token |
| `security.ts` | güvenlik |
| `k8s.ts` | Kubernetes |
| `settings.ts` | ayarlar |
| `demo.ts` | demo seed |
| `aiUsage.ts` | AI kullanım |
| `client.ts` | Axios instance, interceptors |

Paylaşılan tipler: `@nanonet/shared-types` (`packages/shared-types`).

## Sayfalar (`/app/*`)

| Route | Sayfa |
|-------|-------|
| `/app` | Dashboard |
| `/app/services` | Servis listesi |
| `/app/services/:id` | Servis detay (metrik, log, uyarı, AI) |
| `/app/alerts` | Aktif uyarılar |
| `/app/ai-insights` | AI özet |
| `/app/service-map` | Bağımlılık haritası (xyflow) |
| `/app/kubernetes` | K8s konsol |
| `/app/logs` | Merkezi log arama |
| `/app/security` | Güvenlik özeti |
| `/app/notifications` | Kanal yönetimi |
| `/app/slo` | SLO |
| `/app/status-pages` | Durum sayfası admin |
| `/app/incidents` | Incident |
| `/app/probes` | Synthetic probe |
| `/app/runbooks` | Runbook |
| `/app/ai-usage` | AI maliyet |
| `/app/api-tokens` | API token |
| `/app/compare` | Servis karşılaştırma |
| `/app/settings` | Ayarlar |

Herkese açık: `/`, `/login`, `/register`, `/status/:slug`

## WebSocket

`hooks/useWebSocket.ts` — dashboard ve servis stream'leri.  
Env: `VITE_API_URL`, `VITE_WS_URL` (bkz. `frontend/.env.example`).

## Geliştirme

```bash
cd frontend
npm install
npm run dev      # :3000
npm run build
```

Kökten: `npm install` (workspace), `make dev-frontend`.

## Erişilebilirlik

Bkz. [accessibility.md](./accessibility.md).
