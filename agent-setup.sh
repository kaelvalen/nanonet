#!/bin/bash
# NanoNet Agent Setup — register/login + servis oluştur + .env güncelle
# Kullanım: ./agent-setup.sh [--backend http://localhost:8080]

set -e

# ── Renkler ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Yardımcılar ──────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}▸ $*${NC}"; }
success() { echo -e "${GREEN}✔ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
error()   { echo -e "${RED}✖ $*${NC}"; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || error "'$1' bulunamadı. Lütfen yükleyin: $2"
}

require curl  "apt install curl"
require jq    "apt install jq"

BACKEND_URL="http://localhost:8080"
ENV_FILE="$(dirname "$0")/.env"

while [[ $# -gt 0 ]]; do
  case $1 in
    --backend) BACKEND_URL="$2"; shift 2 ;;
    --env)     ENV_FILE="$2";    shift 2 ;;
    *) error "Bilinmeyen parametre: $1" ;;
  esac
done

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      NanoNet Agent Setup Sihirbazı    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""
info "Backend: $BACKEND_URL"
echo ""

# ── Backend erişilebilir mi? ──────────────────────────────────────────────────
info "Backend bağlantısı kontrol ediliyor..."
if ! curl -sf "$BACKEND_URL/health" >/dev/null 2>&1; then
  error "Backend'e ulaşılamıyor: $BACKEND_URL\nStack'i başlattığınızdan emin olun: docker compose up -d"
fi

# NanoNet backend mi yoksa başka bir servis mi?
HEALTH_BODY=$(curl -sf "$BACKEND_URL/health" 2>/dev/null || true)
if ! echo "$HEALTH_BODY" | jq -e '.status' >/dev/null 2>&1; then
  error "Bu bir NanoNet backend değil ($BACKEND_URL).\nMock servis veya yanlış port olabilir.\nVarsayılan backend portu: 8080\n  Örnek: ./agent-setup.sh --backend http://localhost:8080"
fi
success "Backend çalışıyor"
echo ""

# ── Cached token kontrolü ─────────────────────────────────────────────────────
CACHED_ACCESS_TOKEN=""
CACHED_AGENT_TOKEN=""
CACHED_EMAIL=""
if [[ -f "$ENV_FILE" ]]; then
  CACHED_ACCESS_TOKEN=$(grep "^ACCESS_TOKEN=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  CACHED_AGENT_TOKEN=$(grep "^AGENT_TOKEN=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  CACHED_EMAIL=$(grep "^AGENT_EMAIL=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
fi

ACCESS_TOKEN=""

if [[ -n "$CACHED_ACCESS_TOKEN" ]]; then
  info "Kayıtlı token test ediliyor${CACHED_EMAIL:+ ($CACHED_EMAIL)}..."
  TEST_RESP=$(curl -sf "$BACKEND_URL/api/v1/services" \
    -H "Authorization: Bearer $CACHED_ACCESS_TOKEN" 2>/dev/null || true)
  if echo "$TEST_RESP" | jq -e '.success == true' >/dev/null 2>&1; then
    success "Token geçerli — giriş atlanıyor"
    ACCESS_TOKEN="$CACHED_ACCESS_TOKEN"
    echo ""
  else
    warn "Token geçersiz veya süresi dolmuş, yeniden giriş gerekiyor"
    echo ""
  fi
fi

# ── Giriş (token yoksa veya geçersizse) ──────────────────────────────────────
if [[ -z "$ACCESS_TOKEN" ]]; then
  echo -e "${BOLD}Hesap seçin:${NC}"
  echo "  1) Yeni hesap oluştur (register)"
  echo "  2) Mevcut hesaba giriş yap (login)"
  read -rp "Seçim [1/2]: " AUTH_MODE
  echo ""

  # E-posta: cached varsa göster, değiştirme imkanı ver
  if [[ -n "$CACHED_EMAIL" ]]; then
    read -rp "E-posta [$CACHED_EMAIL]: " INPUT_EMAIL
    EMAIL="${INPUT_EMAIL:-$CACHED_EMAIL}"
  else
    read -rp "E-posta: " EMAIL
  fi
  read -rsp "Şifre:   " PASSWORD
  echo ""
  echo ""

  if [[ "$AUTH_MODE" == "1" ]]; then
    info "Kayıt yapılıyor..."
    AUTH_RESP=$(curl -sf -X POST "$BACKEND_URL/api/v1/auth/register" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>&1) || {
      warn "Bu e-posta zaten kayıtlı, giriş deneniyor..."
      AUTH_MODE="2"
    }
  fi

  if [[ "$AUTH_MODE" == "2" ]]; then
    info "Giriş yapılıyor..."
    AUTH_RESP=$(curl -sf -X POST "$BACKEND_URL/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}") || \
      error "Giriş başarısız. E-posta veya şifre yanlış."
  fi

  ACCESS_TOKEN=$(echo "$AUTH_RESP" | jq -r '.data.tokens.access_token // .data.tokens.AccessToken // empty')
  [[ -z "$ACCESS_TOKEN" ]] && error "Token alınamadı. Yanıt:\n$AUTH_RESP"
  success "Kimlik doğrulama başarılı"

  # E-postayı .env'e kaydet (bir daha sormamak için)
  if [[ -f "$ENV_FILE" ]] && [[ -n "$EMAIL" ]]; then
    if grep -q "^AGENT_EMAIL=" "$ENV_FILE"; then
      sed -i "s|^AGENT_EMAIL=.*|AGENT_EMAIL=$EMAIL|" "$ENV_FILE"
    else
      echo "AGENT_EMAIL=$EMAIL" >> "$ENV_FILE"
    fi
  fi
fi
echo ""

# ── Uzun ömürlü agent token al (sadece yeni girişte) ─────────────────────────
if [[ -n "$CACHED_ACCESS_TOKEN" ]] && [[ "$ACCESS_TOKEN" == "$CACHED_ACCESS_TOKEN" ]] && [[ -n "$CACHED_AGENT_TOKEN" ]]; then
  AGENT_TOKEN="$CACHED_AGENT_TOKEN"
  success "Mevcut agent token kullanılıyor"
  echo ""
else
  info "Agent token alınıyor (10 yıl geçerli)..."
  AGENT_TOKEN_RESP=$(curl -sf -X POST "$BACKEND_URL/api/v1/auth/agent-token" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json") || true

  AGENT_TOKEN=$(echo "$AGENT_TOKEN_RESP" | jq -r '.data.agent_token // empty' 2>/dev/null || true)
  [[ -z "$AGENT_TOKEN" ]] && {
    warn "Agent token alınamadı, access token kullanılıyor (24 saat geçerli)"
    AGENT_TOKEN="$ACCESS_TOKEN"
  }
  success "Agent token alındı"
  echo ""
fi

# ── Servis listesi ────────────────────────────────────────────────────────────
info "Mevcut servisler alınıyor..."
SVC_RESP=$(curl -sf "$BACKEND_URL/api/v1/services" \
  -H "Authorization: Bearer $ACCESS_TOKEN") || error "Servisler alınamadı"

SVC_COUNT=$(echo "$SVC_RESP" | jq '.data | length')

echo ""
echo -e "${BOLD}Servis seçin:${NC}"
if [[ "$SVC_COUNT" -gt 0 ]]; then
  echo "$SVC_RESP" | jq -r '.data[] | "  \(.id | .[0:8])…  \(.name)  [\(.status)]"' | nl -w2 -s') '
  echo "  $((SVC_COUNT + 1))) Yeni servis oluştur"
else
  echo "  (Henüz servis yok)"
  SVC_CHOICE=$((SVC_COUNT + 1))
fi

if [[ "$SVC_COUNT" -gt 0 ]]; then
  read -rp "Seçim [1-$((SVC_COUNT + 1))]: " SVC_CHOICE
  echo ""
fi

# ── Servis oluştur ya da mevcut seç ──────────────────────────────────────────
if [[ "$SVC_CHOICE" -le "$SVC_COUNT" && "$SVC_COUNT" -gt 0 ]]; then
  # Mevcut servisi seç (1-indexed)
  SERVICE_ID=$(echo "$SVC_RESP" | jq -r --argjson idx "$((SVC_CHOICE - 1))" '.data[$idx].id')
  SERVICE_NAME=$(echo "$SVC_RESP" | jq -r --argjson idx "$((SVC_CHOICE - 1))" '.data[$idx].name')
  SERVICE_HOST=$(echo "$SVC_RESP" | jq -r --argjson idx "$((SVC_CHOICE - 1))" '.data[$idx].host')
  SERVICE_PORT=$(echo "$SVC_RESP" | jq -r --argjson idx "$((SVC_CHOICE - 1))" '.data[$idx].port')
  SERVICE_ENDPOINT=$(echo "$SVC_RESP" | jq -r --argjson idx "$((SVC_CHOICE - 1))" '.data[$idx].health_endpoint')
  SERVICE_POLL=$(echo "$SVC_RESP" | jq -r --argjson idx "$((SVC_CHOICE - 1))" '.data[$idx].poll_interval_sec')
  success "Seçilen servis: $SERVICE_NAME ($SERVICE_ID)"
else
  # Yeni servis oluştur
  echo -e "${BOLD}Yeni servis bilgileri:${NC}"
  read -rp "  Servis adı         : " SERVICE_NAME
  read -rp "  İzlenecek host     : " SERVICE_HOST
  read -rp "  İzlenecek port     : " SERVICE_PORT
  read -rp "  Health endpoint    [/health]: " SERVICE_ENDPOINT
  SERVICE_ENDPOINT="${SERVICE_ENDPOINT:-/health}"
  read -rp "  Metrik aralığı (s) [10]: " SERVICE_POLL
  SERVICE_POLL="${SERVICE_POLL:-10}"
  echo ""

  info "Servis oluşturuluyor..."
  CREATE_RESP=$(curl -sf -X POST "$BACKEND_URL/api/v1/services" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\":\"$SERVICE_NAME\",
      \"host\":\"$SERVICE_HOST\",
      \"port\":$SERVICE_PORT,
      \"health_endpoint\":\"$SERVICE_ENDPOINT\",
      \"poll_interval_sec\":$SERVICE_POLL
    }") || error "Servis oluşturulamadı"

  SERVICE_ID=$(echo "$CREATE_RESP" | jq -r '.data.id // empty')
  [[ -z "$SERVICE_ID" ]] && error "Servis ID alınamadı. Yanıt:\n$CREATE_RESP"
  success "Servis oluşturuldu: $SERVICE_ID"
fi
echo ""

# ── .env güncelle ─────────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  info ".env güncelleniyor: $ENV_FILE"

  # Mevcut satırları güncelle, yoksa ekle
  update_env() {
    local key="$1" val="$2"
    if grep -q "^${key}=" "$ENV_FILE"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    else
      echo "${key}=${val}" >> "$ENV_FILE"
    fi
  }

  update_env "ACCESS_TOKEN"        "$ACCESS_TOKEN"
  update_env "AGENT_SERVICE_ID"     "$SERVICE_ID"
  update_env "AGENT_TOKEN"          "$AGENT_TOKEN"
  update_env "AGENT_TARGET_HOST"    "${SERVICE_HOST:-backend}"
  update_env "AGENT_TARGET_PORT"    "${SERVICE_PORT:-8080}"
  update_env "AGENT_HEALTH_ENDPOINT" "${SERVICE_ENDPOINT:-/health}"
  update_env "AGENT_POLL_INTERVAL"  "${SERVICE_POLL:-10}"

  success ".env güncellendi"
else
  warn ".env dosyası bulunamadı ($ENV_FILE)"
  warn "Aşağıdaki değerleri manuel olarak .env'e ekleyin:"
  echo ""
  echo "  AGENT_SERVICE_ID=$SERVICE_ID"
  echo "  AGENT_TOKEN=$ACCESS_TOKEN"
  echo "  AGENT_TARGET_HOST=${SERVICE_HOST:-backend}"
  echo "  AGENT_TARGET_PORT=${SERVICE_PORT:-8080}"
  echo "  AGENT_HEALTH_ENDPOINT=${SERVICE_ENDPOINT:-/health}"
  echo "  AGENT_POLL_INTERVAL=${SERVICE_POLL:-10}"
fi

echo ""

# ── Özet & sonraki adım ───────────────────────────────────────────────────────
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║              Hazır! 🎉               ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  Servis ID : ${CYAN}$SERVICE_ID${NC}"
echo -e "  Servis    : ${CYAN}${SERVICE_NAME:-?}${NC}"
echo ""
echo -e "${BOLD}Agent'ı başlatmak için:${NC}"
echo ""
echo -e "  ${GREEN}make agent${NC}"
echo ""

# ── Direkt başlatma seçeneği ─────────────────────────────────────────────────
read -rp "Agent'ı şimdi başlatayım mı? [e/H]: " RUN_NOW
if [[ "$RUN_NOW" =~ ^[Ee]$ ]]; then
  echo ""
  # Önce varsa çalışan agent'ı durdur
  pkill -f 'nanonet-agent' 2>/dev/null || true
  sleep 1
  # make agent çalıştır (yeni terminal açar, arka planda)
  SCRIPT_DIR="$(dirname "$(realpath "$0")")"
  cd "$SCRIPT_DIR"
  make agent &
  AGENT_PID=$!
  sleep 3
  if kill -0 "$AGENT_PID" 2>/dev/null; then
    success "Agent başlatıldı (PID: $AGENT_PID)"
    echo ""
    echo -e "  Loglar için: ${CYAN}make logs-agent${NC}"
    echo -e "  Durdurmak için: ${CYAN}pkill -f nanonet-agent${NC}"
  else
    warn "Agent başlatılamadı. Manuel çalıştırın: make agent"
  fi
fi
