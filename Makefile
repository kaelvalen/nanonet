.PHONY: dev dev-bg down logs logs-backend logs-frontend ps dev-backend dev-frontend mock agent stop-agent build clean reset

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

# Mock servis başlat (agent test için)
mock:
	cd mock-service && PORT=4000 go run main.go

# Agent'ı native çalıştır (Docker'a gerek yok)
agent:
	@set -a; . ./.env; set +a; \
	NANONET_BACKEND=ws://localhost:8080 \
	NANONET_SERVICE_ID=$$AGENT_SERVICE_ID \
	NANONET_TOKEN=$$AGENT_TOKEN \
	NANONET_HOST=$$AGENT_TARGET_HOST \
	NANONET_PORT=$$AGENT_TARGET_PORT \
	NANONET_HEALTH_ENDPOINT=$$AGENT_HEALTH_ENDPOINT \
	NANONET_POLL_INTERVAL=$$AGENT_POLL_INTERVAL \
	NANONET_ERROR_RATE_WINDOW=$$AGENT_ERROR_RATE_WINDOW \
	NANONET_RESTART_CMD="$$AGENT_RESTART_CMD" \
	NANONET_STOP_CMD="$$AGENT_STOP_CMD" \
	cargo run --release --manifest-path agent/Cargo.toml

# Çalışan agent'ı durdur
stop-agent:
	pkill -x nanonet-agent 2>/dev/null || echo "Agent zaten durmuş"

# Production build
build:
	docker compose build

# Dangling image'ları temizle
clean:
	docker image prune -f
