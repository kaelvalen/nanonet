# Mobile (Expo)

**Framework:** Expo ~52, expo-router, React Native  
**Giriş:** `mobile/app/_layout.tsx`

## Yapı

```
mobile/
├── app/
│   ├── (auth)/login.tsx
│   └── (app)/          # Oturum gerekli ekranlar
├── src/
│   ├── api/            # auth, services (kısıtlı yüzey)
│   ├── components/
│   ├── store/
│   └── theme/
└── android/            # Native build
```

## Özellikler

- Dashboard özeti, servis detay, uyarılar
- Incident ve log görüntüleme (kısıtlı)
- SLO ve AI insight
- Expo push token kaydı (`/notifications/push-token`)

## Geliştirme

```bash
make mobile-dev              # Metro + ADB tunnel
make mobile-install-build    # APK derle + yükle
make mobile-test             # Jest
```

Env: backend URL mobil cihazdan erişilebilir olmalı (genelde LAN IP).

Plan ve tasarım: `docs/superpowers/plans/`, `docs/superpowers/specs/`.
