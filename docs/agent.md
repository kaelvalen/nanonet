# Agent (Rust)

**Crate:** `nanonet-agent`  
**Giriş:** `agent/src/main.rs` → `lib.rs`  
**Runtime:** Tokio

## Görev

Hedef sunucuda çalışır; backend ile WebSocket üzerinden:

- CPU, bellek, disk, latency, error rate metrikleri toplar
- Yapılandırılmış health endpoint'i ping'ler
- `restart`, `stop`, `start`, `exec`, `scale` komutlarını yürütür
- Outbound TCP bağlantılarını bağımlılık olarak raporlar

## Modüller

| Modül | Açıklama |
|-------|----------|
| `ws` | Backend WS istemcisi, yeniden bağlanma |
| `tasks/` | Metrik poll, heartbeat, signal, deps |
| `commands/` | Komut doğrulama ve çalıştırma |
| `metrics`, `buffer` | Toplama ve batch gönderim |
| `sign`, `audit`, `redact` | HMAC imza ve güvenli log |
| `health`, `agent_health` | Yerel HTTP sağlık endpoint |

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `NANONET_BACKEND` | `ws://host:8080` veya `wss://...` |
| `NANONET_SERVICE_ID` | UUID |
| `NANONET_AGENT_TOKEN` | Opaque token |
| `NANONET_HOST` / `NANONET_PORT` | Hedef servis |
| `NANONET_HEALTH_ENDPOINT` | Health path |
| `NANONET_POLL_INTERVAL` | Saniye |
| `NANONET_RESTART_CMD` / `NANONET_STOP_CMD` | Shell komutları |

## Kurulum

```bash
# Dashboard'dan agent token + servis ID alın
./agent-setup.sh   # veya agent/install.sh
make agent         # yerel cargo run
```

Cross-compile: `make agent-build-all` → `releases/`

## Test

```bash
cd agent
cargo test
```

Integration: `agent/tests/` (mock backend, command flow, reconnect).

## Protokol

Agent → backend mesaj tipleri: metrik batch, heartbeat, dependency snapshot, komut sonucu.  
İmza: `pkg/agentsign` ile uyumlu HMAC (backend doğrular).

Detay: [project-reference.md](./project-reference.md) § Agent protokolü.
