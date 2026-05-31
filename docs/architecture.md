# Mimari

## Genel bakış

NanoNet dört ana çalışma zamanı bileşeninden oluşur:

```
┌─────────────┐     HTTPS/WS      ┌──────────────┐     WS      ┌─────────────┐
│  Frontend   │ ◄──────────────► │   Backend    │ ◄─────────► │    Agent    │
│  (React)    │                   │  (Go/Gin)    │             │   (Rust)    │
└─────────────┘                   └──────┬───────┘             └──────┬──────┘
       │                                 │                            │
       │                                 ▼                            ▼
       │                          ┌──────────────┐            Hedef servis
       │                          │ TimescaleDB  │            (HTTP/metrics)
       │                          │    Redis     │
       └──────────────────────────┴──────────────┘
                    Mobile (Expo) — aynı REST API
```

## Sorumluluklar

| Bileşen | Görev |
|---------|--------|
| **Frontend** | Dashboard, servis haritası, K8s UI, AI asistan, ayarlar |
| **Backend** | Auth, metrik ingest, uyarılar, WebSocket hub, bildirimler, K8s proxy |
| **Agent** | Hedef hostta metrik toplama, health ping, komut yürütme (restart/stop/exec) |
| **Mobile** | Uyarılar, servis özeti, push bildirimleri (kısıtlı API yüzeyi) |

## Veri akışı

1. Kullanıcı servis kaydı oluşturur → backend `services` tablosuna yazar.
2. Agent token üretilir → agent `wss://backend/ws/agent` ile bağlanır.
3. Agent periyodik metrik gönderir → backend TimescaleDB'ye yazar.
4. `MetricsBroadcaster` DB'den okuyup dashboard WebSocket'lerine yayınlar.
5. Eşik aşılırsa `alerts` → e-posta / Slack / Discord / webhook / push.
6. Kullanıcı restart vb. isteği → backend komut kuyruğu → agent yürütür → sonuç WS ile döner.

## Altyapı

| Servis | Rol |
|--------|-----|
| **PostgreSQL + TimescaleDB** | İlişkisel veri + zaman serisi metrikler |
| **Redis** (opsiyonel) | JWT blacklist, çoklu instance WS hub |
| **Nginx** (prod) | TLS, rate limit, statik frontend |

## Kimlik doğrulama

- **Kullanıcı**: JWT access (kısa ömür) + refresh cookie; CSRF korumalı mutasyonlar.
- **Agent**: Opaque token, SHA-256 hash DB'de; HMAC imzalı WS mesajları.
- **API token**: Kişisel token, scope bazlı (`apitokens` modülü).

## Arka plan işleri

`backend/cmd/main.go` içinde başlatılır:

- WebSocket hub
- Metrik broadcaster (poll interval)
- Synthetic probe runner
- Runbook tetikleyici (alert → otomasyon)
- Metrik retention
- Agent staleness kontrolü

Detaylı modül listesi: [backend.md](./backend.md).  
Diyagramlar: [architecture-diagrams.md](./architecture-diagrams.md).
