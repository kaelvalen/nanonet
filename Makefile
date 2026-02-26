.PHONY: dev dev-bg down logs logs-backend logs-frontend ps dev-backend dev-frontend \
        mock mock-all mock-stop \
        agent stop-agent \
        agent-build agent-build-all \
        agent-linux-amd64 agent-linux-arm64 \
        agent-darwin-amd64 agent-darwin-arm64 \
        agent-windows-amd64 \
        build clean reset

# .env dosyasını yükle
ifneq (,$(wildcard .env))
  include .env
  export
endif

COMPOSE = DOCKER_BUILDKIT=1 docker compose -f docker-compose.dev.yml

# Geliştirme ortamını başlat (hot reload)
dev:
	$(COMPOSE) up --build

# Arka planda başlat
dev-bg:
	$(COMPOSE) up --build -d

# Sadece servislerden birini yeniden başlat
dev-backend:
	$(COMPOSE) up --build backend

dev-frontend:
	$(COMPOSE) up --build frontend

# Logları takip et
logs:
	$(COMPOSE) logs -f

logs-backend:
	$(COMPOSE) logs -f backend

logs-frontend:
	$(COMPOSE) logs -f frontend

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

# Tüm 5 mock servisi Docker ile başlat
mock-all:
	$(COMPOSE) up --build mock-healthy mock-degraded mock-spike mock-memory-leak mock-flapping

# Mock servislerini durdur
mock-stop:
	$(COMPOSE) stop mock-healthy mock-degraded mock-spike mock-memory-leak mock-flapping

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
