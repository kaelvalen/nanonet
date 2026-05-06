#!/usr/bin/env bash
# mobile-install.sh — APK derle (opsiyonel) ve ADB ile yükle
# Kullanım:
#   ./scripts/mobile-install.sh           # Mevcut APK'yı yükle
#   ./scripts/mobile-install.sh --build   # Önce derle, sonra yükle
#   ./scripts/mobile-install.sh --launch  # Yükledikten sonra uygulamayı aç
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
METRO_PORT=8081
BUILD=false
LAUNCH=false
APP_PACKAGE="com.nanonet.mobile"   # app/build.gradle'daki applicationId ile eşleş

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[install]${NC} $*"; }
ok()    { echo -e "${GREEN}[install]${NC} $*"; }
warn()  { echo -e "${YELLOW}[install]${NC} $*"; }
err()   { echo -e "${RED}[install]${NC} $*" >&2; }

for arg in "$@"; do
  [[ "$arg" == "--build"  ]] && BUILD=true
  [[ "$arg" == "--launch" ]] && LAUNCH=true
done

# ── ADB cihaz kontrolü ──────────────────────────────────────────────────────
require_device() {
  if ! command -v adb &>/dev/null; then
    err "adb bulunamadı."
    exit 1
  fi
  local devices
  devices=$(adb devices 2>/dev/null | grep -v "List of" | grep "device$" | wc -l)
  if [[ "$devices" -eq 0 ]]; then
    err "Bağlı ADB cihazı yok."
    err "Telefonu USB ile bağla ve USB hata ayıklamayı etkinleştir."
    exit 1
  fi
  ok "$(adb devices | grep 'device$' | awk '{print $1}') bağlı"
}

# ── Derleme ─────────────────────────────────────────────────────────────────
build_apk() {
  info "Debug APK derleniyor (Gradle)..."
  cd "$ANDROID_DIR"

  if [[ ! -f gradlew ]]; then
    err "gradlew bulunamadı: $ANDROID_DIR/gradlew"
    exit 1
  fi

  chmod +x gradlew
  ./gradlew assembleDebug --no-daemon 2>&1 | grep -E "BUILD|error:|warning:|> Task" || true

  if [[ ! -f "$APK_PATH" ]]; then
    err "APK oluşturulamadı: $APK_PATH"
    exit 1
  fi
  ok "APK derlendi: $APK_PATH"
}

# ── Kurulum ─────────────────────────────────────────────────────────────────
install_apk() {
  if [[ ! -f "$APK_PATH" ]]; then
    err "APK bulunamadı: $APK_PATH"
    err "--build bayrağını kullanarak önce derle: ./scripts/mobile-install.sh --build"
    exit 1
  fi

  local size
  size=$(du -sh "$APK_PATH" | cut -f1)
  info "APK yükleniyor ($size)..."

  adb install -r "$APK_PATH" 2>&1 | tee /tmp/adb-install.log
  if grep -q "Success" /tmp/adb-install.log; then
    ok "Kurulum başarılı!"
  else
    err "Kurulum başarısız:"
    cat /tmp/adb-install.log
    exit 1
  fi
}

# ── ADB Reverse Tunnel ───────────────────────────────────────────────────────
setup_tunnel() {
  adb reverse tcp:$METRO_PORT tcp:$METRO_PORT 2>/dev/null && \
    ok "ADB tunnel kuruldu → localhost:$METRO_PORT"
}

# ── Uygulamayı aç ───────────────────────────────────────────────────────────
launch_app() {
  # applicationId'yi build.gradle'dan oku
  local pkg
  pkg=$(grep -m1 "applicationId" "$ANDROID_DIR/app/build.gradle" 2>/dev/null | \
        grep -oP '"[^"]+"' | tr -d '"' || echo "$APP_PACKAGE")
  info "Uygulama açılıyor: $pkg"
  adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 &>/dev/null || true
}

# ── Ana akış ────────────────────────────────────────────────────────────────
require_device

if $BUILD; then
  build_apk
fi

install_apk
setup_tunnel

if $LAUNCH; then
  launch_app
fi

echo ""
ok "Bitti! Şimdi Metro'yu başlat:"
ok "  make mobile-dev"
ok "  veya: ./scripts/mobile-dev.sh"
