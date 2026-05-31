.PHONY: setup dev dev-bg down ps dev-backend dev-frontend \
        openapi-sync api-docs \
        logs logs-all logs-app logs-mock logs-infra logs-err logs-warn logs-since \
        logs-backend logs-frontend \
        mock mock-all mock-stop mock-scenario \
        agent stop-agent \
        agent-build agent-build-all \
        agent-linux-amd64 agent-linux-arm64 \
        agent-darwin-amd64 agent-darwin-arm64 \
        agent-windows-amd64 \
        mobile-dev mobile-dev-nc mobile-install mobile-install-build \
        mobile-install-launch mobile-build mobile-build-release \
        mobile-build-clean mobile-test mobile-build-preview \
        build clean reset

# Bağımlılıkları kur (Linux/macOS/WSL)
setup:
	@bash dev.sh setup

# .env dosyasını yükle
ifneq (,$(wildcard .env))
  include .env
  export
endif

COMPOSE = docker compose -f docker-compose.dev.yml

# OpenAPI spec → docs + embed; Swagger UI: http://localhost:8080/api/docs
openapi-sync:
	@sh scripts/sync-openapi.sh

api-docs: openapi-sync
	@echo "Swagger UI: http://localhost:8080/api/docs"
	@echo "OpenAPI YAML: http://localhost:8080/api/openapi.yaml"

# Geliştirme ortamını başlat — build arka planda, loglar renkli viewer üzerinden
dev:
	@echo "Building and starting services..."
	@$(COMPOSE) up --build -d 2>&1 | grep -E "(Started|Error|failed)" || true
	@bash scripts/dev-logs.sh app --since 5s --level debug

# Arka planda başlat (log viewer olmadan)
dev-bg:
	$(COMPOSE) up --build -d

# Sadece servislerden birini yeniden başlat
dev-backend:
	$(COMPOSE) up --build backend

dev-frontend:
	$(COMPOSE) up --build frontend

# ── Log komutları ────────────────────────────────────────────────────────────
# Renkli + severity filtreli log viewer (scripts/dev-logs.sh)
SINCE  ?= 10m
LEVEL  ?= debug

# Backend + frontend, son 10 dakika, follow
logs:
	@bash scripts/dev-logs.sh app --since $(SINCE) --level $(LEVEL)

# Tüm container'lar
logs-all:
	@bash scripts/dev-logs.sh all --since $(SINCE) --level $(LEVEL)

# Sadece uygulama servisleri (backend + frontend)
logs-app:
	@bash scripts/dev-logs.sh app --since $(SINCE) --level $(LEVEL)

# Sadece mock servisler
logs-mock:
	@bash scripts/dev-logs.sh mock --since $(SINCE) --level $(LEVEL)

# Sadece altyapı (db + redis)
logs-infra:
	@bash scripts/dev-logs.sh infra --since $(SINCE) --level $(LEVEL)

# Sadece ERROR ve üzeri — tüm container'lar
logs-err:
	@bash scripts/dev-logs.sh all --since $(SINCE) --level error

# WARN ve üzeri — tüm container'lar
logs-warn:
	@bash scripts/dev-logs.sh all --since $(SINCE) --level warn

# Belirli bir süre aralığı: make logs-since SINCE=1h
logs-since:
	@bash scripts/dev-logs.sh all --since $(SINCE) --level $(LEVEL)

# Snapshot (follow yok): make logs-snap
logs-snap:
	@bash scripts/dev-logs.sh app --since $(SINCE) --level $(LEVEL) --no-follow

# Eski compat alias'ları
logs-backend:
	@bash scripts/dev-logs.sh backend --since $(SINCE) --level $(LEVEL)

logs-frontend:
	@bash scripts/dev-logs.sh frontend --since $(SINCE) --level $(LEVEL)

# Çalışan container'ları listele
ps:
	$(COMPOSE) ps

# Durdur
down:
	$(COMPOSE) down

# Durdur + volume'ları sil (DB sıfırla)
reset:
	$(COMPOSE) down -v

# Mock servis başlat — tek (legacy)
mock:
	cd mock-service && PORT=4000 SERVICE_NAME=mock SERVICE_SCENARIO=healthy go run main.go

# Tüm mock servisleri Docker ile başlat (17 senaryo)
MOCK_SERVICES = mock-healthy mock-degraded mock-spike mock-memory-leak mock-flapping \
                mock-high-latency mock-down mock-connection-leak mock-slow-start \
                mock-database-issue mock-network-jitter mock-resource-starved \
                mock-circuit-breaker mock-random-crash mock-load-spike \
                mock-dependency-issue mock-error-burst

mock-all:
	$(COMPOSE) up --build -d $(MOCK_SERVICES)

# Mock servislerini durdur
mock-stop:
	$(COMPOSE) stop $(MOCK_SERVICES)

# Belirli bir serviste senaryo değiştir
# Kullanım: make mock-scenario SVC=http://localhost:8002 SCENARIO=down
mock-scenario:
	curl -sf -X POST $(SVC)/scenario \
	  -H "Content-Type: application/json" \
	  -d '{"scenario":"$(SCENARIO)"}' | jq .

# Agent'ı native çalıştır (Docker'a gerek yok)
agent:
	@set -a; . ./.env; set +a; \
	NANONET_BACKEND=ws://localhost:8080 \
	NANONET_SERVICE_ID=$$AGENT_SERVICE_ID \
	NANONET_AGENT_TOKEN=$$AGENT_TOKEN \
	NANONET_TOKEN=$$AGENT_TOKEN \
	NANONET_HOST=$$AGENT_TARGET_HOST \
	NANONET_PORT=$$AGENT_TARGET_PORT \
	NANONET_HEALTH_ENDPOINT=$$AGENT_HEALTH_ENDPOINT \
	NANONET_POLL_INTERVAL=$$AGENT_POLL_INTERVAL \
	NANONET_METRICS_ENDPOINT=$$AGENT_METRICS_ENDPOINT \
	NANONET_ERROR_RATE_WINDOW=$$AGENT_ERROR_RATE_WINDOW \
	NANONET_RESTART_CMD="$$AGENT_RESTART_CMD" \
	NANONET_STOP_CMD="$$AGENT_STOP_CMD" \
	cargo run --release --manifest-path agent/Cargo.toml

# Çalışan agent'ı durdur
stop-agent:
	pkill -x nanonet-agent 2>/dev/null || echo "Agent zaten durmuş"

# ── Agent Cross-Compile ───────────────────────────────────────────────────────
AGENT_DIR    = agent
RELEASE_DIR  = releases
AGENT_BIN    = nanonet-agent

# Yerel platforma göre release build
agent-build:
	cargo build --release --manifest-path $(AGENT_DIR)/Cargo.toml
	@echo "Binary: $(AGENT_DIR)/target/release/$(AGENT_BIN)"

# Linux x86_64 (musl — statik binary, Docker/CI uyumlu)
agent-linux-amd64:
	cargo build --release \
	  --manifest-path $(AGENT_DIR)/Cargo.toml \
	  --target x86_64-unknown-linux-musl
	@mkdir -p $(RELEASE_DIR)
	@cp $(AGENT_DIR)/target/x86_64-unknown-linux-musl/release/$(AGENT_BIN) \
	    $(RELEASE_DIR)/$(AGENT_BIN)-x86_64-unknown-linux-musl
	@echo "Hazır: $(RELEASE_DIR)/$(AGENT_BIN)-x86_64-unknown-linux-musl"

# Linux ARM64 (musl — Raspberry Pi 4/5, Apple M serisi sunucu, AWS Graviton)
agent-linux-arm64:
	cargo build --release \
	  --manifest-path $(AGENT_DIR)/Cargo.toml \
	  --target aarch64-unknown-linux-musl
	@mkdir -p $(RELEASE_DIR)
	@cp $(AGENT_DIR)/target/aarch64-unknown-linux-musl/release/$(AGENT_BIN) \
	    $(RELEASE_DIR)/$(AGENT_BIN)-aarch64-unknown-linux-musl
	@echo "Hazır: $(RELEASE_DIR)/$(AGENT_BIN)-aarch64-unknown-linux-musl"

# macOS x86_64 (Intel Mac)
agent-darwin-amd64:
	cargo build --release \
	  --manifest-path $(AGENT_DIR)/Cargo.toml \
	  --target x86_64-apple-darwin
	@mkdir -p $(RELEASE_DIR)
	@cp $(AGENT_DIR)/target/x86_64-apple-darwin/release/$(AGENT_BIN) \
	    $(RELEASE_DIR)/$(AGENT_BIN)-x86_64-apple-darwin
	@echo "Hazır: $(RELEASE_DIR)/$(AGENT_BIN)-x86_64-apple-darwin"

# macOS ARM64 (Apple Silicon — M1/M2/M3/M4)
agent-darwin-arm64:
	cargo build --release \
	  --manifest-path $(AGENT_DIR)/Cargo.toml \
	  --target aarch64-apple-darwin
	@mkdir -p $(RELEASE_DIR)
	@cp $(AGENT_DIR)/target/aarch64-apple-darwin/release/$(AGENT_BIN) \
	    $(RELEASE_DIR)/$(AGENT_BIN)-aarch64-apple-darwin
	@echo "Hazır: $(RELEASE_DIR)/$(AGENT_BIN)-aarch64-apple-darwin"

# Windows x86_64
agent-windows-amd64:
	cargo build --release \
	  --manifest-path $(AGENT_DIR)/Cargo.toml \
	  --target x86_64-pc-windows-gnu
	@mkdir -p $(RELEASE_DIR)
	@cp $(AGENT_DIR)/target/x86_64-pc-windows-gnu/release/$(AGENT_BIN).exe \
	    $(RELEASE_DIR)/$(AGENT_BIN)-x86_64-pc-windows-msvc.exe
	@echo "Hazır: $(RELEASE_DIR)/$(AGENT_BIN)-x86_64-pc-windows-msvc.exe"

# Tüm platformlar için build + checksum
agent-build-all: agent-linux-amd64 agent-linux-arm64 agent-darwin-amd64 agent-darwin-arm64 agent-windows-amd64
	@echo ""
	@echo "Tüm binary'ler hazır:"
	@ls -lh $(RELEASE_DIR)/$(AGENT_BIN)-*
	@echo ""
	@echo "SHA256 checksumlar oluşturuluyor..."
	@cd $(RELEASE_DIR) && for f in $(AGENT_BIN)-*; do \
	  sha256sum "$$f" > "$$f.sha256"; \
	  echo "  $$f.sha256"; \
	done

# Production build
build:
	docker compose build

# Dangling image'ları temizle
clean:
	docker image prune -f

# ── Mobile ────────────────────────────────────────────────────────────────────
.PHONY: mobile-dev mobile-install mobile-build mobile-build-release \
        mobile-build-clean mobile-start mobile-test mobile-build-preview

## Metro'yu başlat + ADB tunnel kur (geliştirme modu)
mobile-dev:
	@bash scripts/mobile-dev.sh

## Metro'yu cache temizlemeden başlat
mobile-dev-nc:
	@bash scripts/mobile-dev.sh --no-clear

## Mevcut APK'yı ADB ile yükle + Metro tunnel kur
mobile-install:
	@bash scripts/mobile-install.sh

## APK derle ve yükle (tek komut)
mobile-install-build:
	@bash scripts/mobile-install.sh --build

## APK derle ve yükleyip uygulamayı aç
mobile-install-launch:
	@bash scripts/mobile-install.sh --launch

## Sadece debug APK derle
mobile-build:
	@bash scripts/mobile-build.sh

## Release APK derle
mobile-build-release:
	@bash scripts/mobile-build.sh --release

## Temiz debug APK derle
mobile-build-clean:
	@bash scripts/mobile-build.sh --clean

mobile-test:
	cd mobile && npm test -- --passWithNoTests

mobile-build-preview:
	cd mobile && npx eas build --profile preview --platform all --non-interactive
