#!/usr/bin/env bash
# mobile-build.sh — Android APK derle
# Kullanım:
#   ./scripts/mobile-build.sh           # Debug APK
#   ./scripts/mobile-build.sh --release # Release APK (imzasız)
#   ./scripts/mobile-build.sh --clean   # Temiz derleme
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$REPO_ROOT/mobile/android"
VARIANT="Debug"
CLEAN=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[build]${NC} $*"; }
ok()    { echo -e "${GREEN}[build]${NC} $*"; }
warn()  { echo -e "${YELLOW}[build]${NC} $*"; }
err()   { echo -e "${RED}[build]${NC} $*" >&2; }

for arg in "$@"; do
  [[ "$arg" == "--release" ]] && VARIANT="Release"
  [[ "$arg" == "--clean"   ]] && CLEAN=true
done

cd "$ANDROID_DIR"
chmod +x gradlew

if $CLEAN; then
  warn "Temiz derleme yapılıyor (./gradlew clean)..."
  ./gradlew clean --no-daemon
fi

info "APK derleniyor: $VARIANT..."
START=$(date +%s)

./gradlew "assemble${VARIANT}" --no-daemon \
  2>&1 | grep -E "^(BUILD|> Task|FAILURE|error:|ERROR)" || true

END=$(date +%s)
ELAPSED=$((END - START))

VARIANT_LOWER=$(echo "$VARIANT" | tr '[:upper:]' '[:lower:]')
APK="$ANDROID_DIR/app/build/outputs/apk/$VARIANT_LOWER/app-${VARIANT_LOWER}.apk"

if [[ -f "$APK" ]]; then
  SIZE=$(du -sh "$APK" | cut -f1)
  ok "Derleme tamamlandı (${ELAPSED}s)"
  ok "APK: $APK ($SIZE)"
  echo ""
  info "Yüklemek için:"
  info "  ./scripts/mobile-install.sh"
  info "  veya: make mobile-install"
else
  err "APK oluşturulamadı. Tam çıktı için --no-daemon olmadan çalıştır:"
  err "  cd mobile/android && ./gradlew assemble${VARIANT}"
  exit 1
fi
