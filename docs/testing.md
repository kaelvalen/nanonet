# Test

## Backend (Go)

```bash
cd backend && go test ./...
```

Kapsanan alanlar: `auth`, `alerts`, `commands`, `metrics/forecast`, `notifications`, `probes`, `runbooks`, `ws`, `pkg/*` (middleware, netguard, ratelimit, secrets, agentsign, push, tokenblacklist).

## Agent (Rust)

```bash
cd agent && cargo test
```

Integration testler: `agent/tests/command_flow.rs`, `ws_reconnect.rs`, `mock_backend_smoke.rs`.

## Mobile (Jest)

```bash
cd mobile && npm test
# veya: make mobile-test
```

Dosyalar: `mobile/__tests__/login.test.tsx`, `dashboard.test.tsx`.

## Frontend

Otomatik test yapılandırması yok (Vitest/Playwright planlanmış; README eski referansları kaldırıldı).  
Manuel QA: dashboard auth akışı, servis CRUD, WebSocket canlı metrik.

## Geliştirme mock'ları

`docker-compose.dev.yml` içinde 17 senaryo:

- healthy, degraded, spike, memory-leak, flapping, high-latency, down, vb.

Tek container senaryo değiştirme:

```bash
make mock-scenario SVC=http://localhost:8002 SCENARIO=down
```

## CI önerisi

```bash
go test ./... -count=1
cargo test --manifest-path agent/Cargo.toml
cd mobile && npm test -- --passWithNoTests
./lint.sh
```
