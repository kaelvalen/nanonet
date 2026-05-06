#!/usr/bin/env bash
# mobile-dev.sh — Metro başlat + ADB reverse tunnel kur
# Kullanım: ./scripts/mobile-dev.sh [--no-clear]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/mobile"
METRO_PORT=8081
CLEAR_FLAG="--clear"

for arg in "$@"; do
  [[ "$arg" == "--no-clear" ]] && CLEAR_FLAG=""
done

# ── Renk ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[mobile]${NC} $*"; }
ok()    { echo -e "${GREEN}[mobile]${NC} $*"; }
warn()  { echo -e "${YELLOW}[mobile]${NC} $*"; }
err()   { echo -e "${RED}[mobile]${NC} $*" >&2; }

# ── ADB kontrol ─────────────────────────────────────────────────────────────
check_adb() {
  if ! command -v adb &>/dev/null; then
    err "adb bulunamadı. Android SDK platform-tools kurulu olduğundan emin ol."
    exit 1
  fi

  local devices
  devices=$(adb devices 2>/dev/null | grep -v "List of" | grep "device$" | wc -l)
  if [[ "$devices" -eq 0 ]]; then
    warn "Bağlı ADB cihazı yok. USB bağlı ve hata ayıklama açık olduğundan emin ol."
    warn "Yine de Metro başlatılıyor — cihaz bağlandığında tunnel otomatik kurulacak."
    return 1
  fi
  return 0
}

setup_tunnel() {
  if check_adb; then
    adb reverse tcp:$METRO_PORT tcp:$METRO_PORT 2>/dev/null && \
      ok "ADB reverse tunnel kuruldu: telefon → localhost:$METRO_PORT"
  fi
}

cleanup() {
  warn "Metro durduruluyor..."
  # Metro child process'leri temizle
  pkill -P $$ 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Mevcut Metro'yu durdur ──────────────────────────────────────────────────
if lsof -i :$METRO_PORT -sTCP:LISTEN -t &>/dev/null; then
  warn "Port $METRO_PORT kullanımda, önceki Metro durduruluyor..."
  lsof -i :$METRO_PORT -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── ADB tunnel kur ──────────────────────────────────────────────────────────
setup_tunnel

# ── Metro başlat ─────────────────────────────────────────────────────────────
info "Metro başlatılıyor (port=$METRO_PORT, clear=$([[ -n $CLEAR_FLAG ]] && echo evet || echo hayır))..."
cd "$MOBILE_DIR"

# .env dosyasını kontrol et
if [[ ! -f .env ]]; then
  err ".env dosyası bulunamadı: $MOBILE_DIR/.env"
  err "Örnek: EXPO_PUBLIC_API_URL=http://192.168.x.x:8080/api/v1"
  exit 1
fi

info ".env yüklendi:"
grep "EXPO_PUBLIC_" .env | while read -r line; do
  info "  $line"
done

npx expo start --port $METRO_PORT $CLEAR_FLAG
