# NanoNet Frontend

React + TypeScript + Vite dashboard. Ana proje dokümantasyonu: [../docs/frontend.md](../docs/frontend.md).

## Kurulum

```bash
cp .env.example .env
npm install
npm run dev
```

| Değişken | Varsayılan |
|----------|------------|
| `VITE_API_URL` | `http://localhost:8080` |
| `VITE_WS_URL` | `ws://localhost:8080` |

## Komutlar

```bash
npm run dev       # Geliştirme sunucusu (:5173 / proxy :3000 compose ile)
npm run build     # Production build
npm run preview   # Build önizleme
```

## Yapı

- `src/pages/` — route ekranları
- `src/api/` — backend REST client
- `src/components/` — UI ve domain bileşenleri
- `src/store/` — Zustand state
- `src/i18n/` — TR / EN

Route listesi: `src/routes.tsx`.
