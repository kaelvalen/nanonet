# NanoNet Mobile App — Design Spec

**Date:** 2026-05-06  
**Stack:** React Native + Expo 52, TypeScript  
**Scope:** Read-heavy monitoring dashboard (okuma ağırlıklı izleme paneli)

---

## 1. Repo Yapısı

npm workspaces ile monorepo genişletilir. `frontend/src/types/` içindeki tip dosyaları `packages/shared-types/` altına taşınır; her iki uygulama da bu paketten import eder.

```
nanonet/
├── packages/
│   └── shared-types/              # @nanonet/shared-types
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── auth.ts
│           ├── service.ts
│           ├── metrics.ts
│           ├── alerts.ts
│           └── logs.ts
├── mobile/                        # Expo 52 uygulaması
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login.tsx
│   │   ├── (app)/
│   │   │   ├── index.tsx          # Dashboard
│   │   │   ├── services/[id].tsx  # Service Detail
│   │   │   ├── alerts.tsx
│   │   │   ├── incidents.tsx
│   │   │   ├── logs.tsx
│   │   │   ├── slo.tsx
│   │   │   ├── ai.tsx
│   │   │   └── notifications.tsx
│   │   └── _layout.tsx
│   ├── src/
│   │   ├── api/
│   │   ├── store/
│   │   ├── hooks/
│   │   └── components/
│   └── package.json
├── frontend/                      # Mevcut — types/ shared-types'a taşındı
├── backend/
├── agent/
└── package.json                   # workspaces eklendi
```

Root `package.json`:
```json
{
  "workspaces": ["frontend", "mobile", "packages/*"]
}
```

`frontend/src/types/` içindeki dosyalar `packages/shared-types/src/` altına taşınır. `frontend` içindeki tüm `../types/` import'ları `@nanonet/shared-types` olarak güncellenir.

---

## 2. Kimlik Doğrulama

Web'in HTTP-only cookie + CSRF pattern'ı mobilde çalışmaz. Minimal backend değişikliyle çözülür:

### Login akışı
```
Mobile → POST /auth/login { email, password }
       ← { access_token, refresh_token, expires_in }
```
- `access_token` → Zustand store (memory)
- `refresh_token` → `expo-secure-store` (cihaz şifreli depolama)

### Token yenileme
```
Mobile → POST /auth/refresh
         Body: { refresh_token: "..." }
```
Backend hem cookie hem body'den refresh token kabul eder. Web akışı bozulmaz.

### API client
```typescript
// CSRF header yok; sadece Bearer
apiClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// 401 → SecureStore'dan refresh token → /auth/refresh body ile
```

### Backend değişiklikleri (auth)
| Değişiklik | Dosya |
|---|---|
| `/auth/login` response body'ye `refresh_token` ekle | `internal/auth/handler.go` |
| `/auth/refresh` body'den `refresh_token` kabul et | `internal/auth/handler.go` |
| `POST /notifications/push-token` endpoint ekle | `internal/notifications/` |

CSRF middleware zaten `Authorization: Bearer` olan istekleri bypass ediyor — ek değişiklik gerekmez.

---

## 3. Ekran Haritası & Navigasyon

### Tab Bar (5 sekme)
`Dashboard · Alerts · Incidents · Logs · Ayarlar`

### Ekranlar

| Ekran | Route | İçerik |
|---|---|---|
| Login | `(auth)/login` | Email + şifre formu |
| Dashboard | `(app)/index` | Servis kartları (status badge, CPU/mem özet), up/down/degraded sayacı, son 3 aktif alert |
| Service Detail | `(app)/services/[id]` | CPU, Memory, Latency, Error Rate grafikleri (WS canlı akış, 500 nokta); agent bağlantı durumu; son log satırları |
| Alerts | `(app)/alerts` | Aktif + geçmiş alert listesi; severity filtresi |
| Incidents | `(app)/incidents` | Incident listesi + detay modal |
| Logs | `(app)/logs` | Sayfalı log akışı; servis filtresi |
| SLO | `(app)/slo` | Hedef vs. gerçek değer; hata bütçesi göstergesi |
| AI Insights | `(app)/ai` | Anomali özeti kartları; servis bazlı tahminler |
| Bildirim Ayarları | `(app)/notifications` | Push aç/kapat; severity filtresi (critical/warning/info) |

SLO ve AI Insights tab bar'da değil; Dashboard veya Service Detail'den link ile ulaşılır.

---

## 4. Gerçek Zamanlı: WebSocket & Push Notifications

### WebSocket
React Native'in global `WebSocket` implementasyonu standarttır; `useWebSocket.ts` hook'u minimal değişiklikle port edilir (`import.meta.env` → `expo-constants`).

```
Mobile WS → wss://<api>/ws?token=<access_token>
Backend   → auth_ok | metric_update | alert_triggered | service_status
Mobile    → ping (30s heartbeat)
```

- Service Detail açıkken `metric_update` → React Query cache (500 nokta sınırı)
- Uygulama arka plana geçince WS kapatılır; ön plana dönünce yeniden bağlanır

### Push Notifications
```
1. Login sonrası: Expo.getExpoPushTokenAsync()
2. Token → POST /notifications/push-token
3. Alert tetiklendiğinde: backend → Expo Push API
4. APNs / FCM → kullanıcı telefonuna bildirim
```

**Bildirim formatı:**
```
🔴 [ServiceName] DOWN
CPU %94 · Latency 2300ms
```

**Backend değişiklikleri (push):**
- `user_push_tokens` tablosu: `(id, user_id, token, platform, created_at)`
- `user_push_preferences` tablosu: `(user_id, min_severity)` — hangi severity'lerde bildirim gönderileceği
- Alert dispatch akışına Expo Push HTTP call eklenir (~30 satır Go)

---

## 5. Tech Stack

### Mobile bağımlılıkları
```json
{
  "expo": "~52",
  "expo-router": "^4",
  "expo-secure-store": "^14",
  "expo-notifications": "^0.29",
  "expo-constants": "^17",
  "@tanstack/react-query": "^5",
  "zustand": "^5",
  "axios": "^1",
  "victory-native": "^40",
  "@nanonet/shared-types": "*"
}
```

**Victory Native:** `react-native-svg` üzerine kurulu, TypeScript-first grafik kütüphanesi. Web'deki Recharts/Chart.js RN'de çalışmaz; Victory Native onun yerine geçer.

### Ortam değişkenleri
`mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://api.nanonet.dev
EXPO_PUBLIC_WS_URL=wss://api.nanonet.dev
```
`expo-constants` ile okunur (Vite `import.meta.env` yerine).

### CI/CD
`Makefile`'a `mobile:` hedefleri eklenir. EAS Build ile iOS `.ipa` + Android `.apk` üretimi.

---

## 6. Kapsam Dışı (Bilinçli Kararlar)

| Kapsam Dışı | Neden |
|---|---|
| Servis ekleme/silme/düzenleme | Read-only tasarım kararı |
| Kubernetes sayfası | Çok teknik; mobil UX'e uymuyor |
| Runbooks, Status Pages Admin | Okuma ağırlıklı scope dışında |
| Offline mod | Bağlantı yoksa boş state yeterli |
| Çoklu hesap desteği | YAGNI |

Tema: sistem temasına göre otomatik dark/light (`useColorScheme`).

---

## 7. Uygulama Sırası (Özet)

1. `packages/shared-types` paketi oluştur; `frontend/src/types/` taşı
2. Root `package.json` workspaces kur
3. `mobile/` Expo projesi scaffold et
4. Backend: auth değişiklikleri (refresh token body, push token endpoint)
5. Backend: push notification altyapısı (DB tabloları + Expo HTTP client)
6. Mobile: auth akışı (login, token yenileme, SecureStore)
7. Mobile: API client + WebSocket hook
8. Mobile: Dashboard + Service Detail ekranları
9. Mobile: Alerts + Incidents + Logs ekranları
10. Mobile: SLO + AI Insights + Notifications Settings ekranları
11. EAS Build konfigürasyonu
