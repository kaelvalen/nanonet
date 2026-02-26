d#!/usr/bin/env bash
# NanoNet Agent Setup — Multiplatform Kurulum Sihirbazı
# Desteklenen: Ubuntu/Debian · Arch Linux · RHEL/Fedora/CentOS · openSUSE · macOS · WSL
# Kullanım: ./agent-setup.sh [SEÇENEKLER]
#
# Seçenekler:
#   --backend  <url>     Backend URL'i (varsayılan: http://localhost:8080)
#   --env      <dosya>   .env dosya yolu (varsayılan: script dizini/.env)
#   --install-deps       Eksik bağımlılıkları otomatik yükle (curl, jq)
#   --download-binary    GitHub Releases'tan binary indir (derleme yerine)
#   --version  <tag>     Binary sürümü (varsayılan: latest)
#   --no-color           Renksiz çıktı

set -euo pipefail

# ── Renk kontrolü ────────────────────────────────────────────────────────────
if [[ "${NO_COLOR:-}" == "1" ]] || [[ ! -t 1 ]]; then
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; DIM=''; NC=''
else
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
fi

# ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────
info()    { echo -e "${CYAN}▸ $*${NC}"; }
success() { echo -e "${GREEN}✔ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
error()   { echo -e "${RED}✖ $*${NC}" >&2; exit 1; }
step()    { echo -e "\n${BOLD}$*${NC}"; }
dim()     { echo -e "${DIM}$*${NC}"; }

# ── Platform tespiti ─────────────────────────────────────────────────────────
detect_platform() {
  OS=""
  ARCH=""
  DISTRO=""
  PKG_MGR=""
  IS_WSL=false
  IS_MUSL=false

  # İşletim sistemi
  case "$(uname -s)" in
    Linux*)
      OS="linux"
      # WSL kontrolü
      if grep -qi microsoft /proc/version 2>/dev/null || \
         grep -qi wsl /proc/version 2>/dev/null; then
        IS_WSL=true
      fi
      # Dağıtım ve paket yöneticisi tespiti
      if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        source /etc/os-release
        DISTRO="${ID:-unknown}"
        case "$ID" in
          ubuntu|debian|linuxmint|pop|elementary|zorin|kali)
            PKG_MGR="apt" ;;
          arch|manjaro|endeavouros|garuda|artix)
            PKG_MGR="pacman" ;;
          fedora|rhel|centos|rocky|almalinux|ol)
            PKG_MGR="dnf" ;;
          opensuse*|sles)
            PKG_MGR="zypper" ;;
          alpine)
            PKG_MGR="apk"
            IS_MUSL=true ;;
          void)
            PKG_MGR="xbps" ;;
          *)
            # ID_LIKE fallback
            case "${ID_LIKE:-}" in
              *debian*|*ubuntu*) PKG_MGR="apt" ;;
              *arch*)            PKG_MGR="pacman" ;;
              *fedora*|*rhel*)   PKG_MGR="dnf" ;;
              *suse*)            PKG_MGR="zypper" ;;
            esac ;;
        esac
      fi
      ;;
    Darwin*)
      OS="darwin"
      DISTRO="macos"
      PKG_MGR="brew"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      error "Windows Git Bash/MSYS tespit edildi. Lütfen agent-setup.ps1 kullanın:\n  powershell -ExecutionPolicy Bypass -File agent-setup.ps1"
      ;;
    *)
      error "Desteklenmeyen işletim sistemi: $(uname -s)"
      ;;
  esac

  # CPU mimarisi
  case "$(uname -m)" in
    x86_64|amd64)   ARCH="x86_64" ;;
    aarch64|arm64)  ARCH="aarch64" ;;
    armv7l|armhf)   ARCH="armv7" ;;
    i386|i686)      error "32-bit sistemler desteklenmiyor." ;;
    *)              error "Desteklenmeyen mimari: $(uname -m)" ;;
  esac

  # Binary target triple (Rust/musl)
  if [[ "$OS" == "linux" ]] && [[ "$IS_MUSL" == true ]]; then
    BINARY_TARGET="${ARCH}-unknown-linux-musl"
  elif [[ "$OS" == "linux" ]]; then
    BINARY_TARGET="${ARCH}-unknown-linux-gnu"
  elif [[ "$OS" == "darwin" ]]; then
    BINARY_TARGET="${ARCH}-apple-darwin"
  fi
}

# ── Bağımlılık kurulum fonksiyonları ─────────────────────────────────────────
install_package() {
  local pkg="$1"
  info "Kuruluyor: $pkg ($PKG_MGR)"
  case "$PKG_MGR" in
    apt)
      sudo apt-get update -qq && sudo apt-get install -y -qq "$pkg" ;;
    pacman)
      sudo pacman -Sy --noconfirm "$pkg" ;;
    dnf)
      sudo dnf install -y -q "$pkg" ;;
    zypper)
      sudo zypper install -y -q "$pkg" ;;
    apk)
      sudo apk add --quiet "$pkg" ;;
    xbps)
      sudo xbps-install -Sy "$pkg" ;;
    brew)
      brew install "$pkg" ;;
    *)
      warn "Paket yöneticisi bulunamadı. '$pkg' paketini manuel olarak kurun."
      return 1
      ;;
  esac
}

check_and_install() {
  local cmd="$1" pkg="${2:-$1}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    if [[ "$OPT_INSTALL_DEPS" == true ]]; then
      install_package "$pkg"
    else
      error "'$cmd' bulunamadı. Kurmak için:\n  ./agent-setup.sh --install-deps\nVeya elle kurun: $(install_hint "$cmd")"
    fi
  fi
}

install_hint() {
  case "$PKG_MGR" in
    apt)    echo "sudo apt install $1" ;;
    pacman) echo "sudo pacman -S $1" ;;
    dnf)    echo "sudo dnf install $1" ;;
    zypper) echo "sudo zypper install $1" ;;
    apk)    echo "sudo apk add $1" ;;
    brew)   echo "brew install $1" ;;
    *)      echo "paket yöneticiniz ile $1 kurun" ;;
  esac
}

# ── Binary indirme + checksum ─────────────────────────────────────────────────
download_binary() {
  local version="$1"
  local install_dir="${2:-$HOME/.local/bin}"
  local binary_name="nanonet-agent"
  local repo="kaelvalen/nanonet"  # GitHub repo

  info "Binary indiriliyor: $binary_name ($BINARY_TARGET, $version)..."

  # Latest release tag al
  if [[ "$version" == "latest" ]]; then
    version=$(curl -sf "https://api.github.com/repos/$repo/releases/latest" \
      | jq -r '.tag_name' 2>/dev/null) || true
    [[ -z "$version" || "$version" == "null" ]] && {
      warn "GitHub release bulunamadı. Kaynak koddan derleme kullanın: make agent-build"
      return 1
    }
  fi

  local base_url="https://github.com/$repo/releases/download/$version"
  local archive="${binary_name}-${BINARY_TARGET}.tar.gz"
  local checksum_url="${base_url}/${archive}.sha256"
  local tmpdir
  tmpdir=$(mktemp -d)

  trap 'rm -rf "$tmpdir"' EXIT

  # Binary indir
  if ! curl -fsSL "$base_url/$archive" -o "$tmpdir/$archive"; then
    warn "Binary indirilemedi ($base_url/$archive)"
    rm -rf "$tmpdir"
    return 1
  fi

  # Checksum doğrula (varsa)
  if curl -fsSL "$checksum_url" -o "$tmpdir/$archive.sha256" 2>/dev/null; then
    info "Checksum doğrulanıyor..."
    local expected actual
    expected=$(awk '{print $1}' "$tmpdir/$archive.sha256")
    if command -v sha256sum >/dev/null 2>&1; then
      actual=$(sha256sum "$tmpdir/$archive" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
      actual=$(shasum -a 256 "$tmpdir/$archive" | awk '{print $1}')
    fi
    if [[ -n "${actual:-}" ]] && [[ "$expected" != "$actual" ]]; then
      rm -rf "$tmpdir"
      error "Checksum doğrulaması başarısız!\n  Beklenen: $expected\n  Gerçek:   $actual"
    fi
    success "Checksum doğrulandı"
  else
    warn "Checksum dosyası bulunamadı — doğrulama atlandı"
  fi

  # Arşivi aç ve kur
  mkdir -p "$install_dir"
  tar -xzf "$tmpdir/$archive" -C "$tmpdir"
  chmod +x "$tmpdir/$binary_name"
  mv "$tmpdir/$binary_name" "$install_dir/$binary_name"

  rm -rf "$tmpdir"
  trap - EXIT

  # PATH kontrolü
  if ! echo "$PATH" | grep -q "$install_dir"; then
    warn "$install_dir PATH'inizde değil. Eklemek için:"
    echo ""
    case "$SHELL" in
      */zsh)  echo "  echo 'export PATH=\"$install_dir:\$PATH\"' >> ~/.zshrc && source ~/.zshrc" ;;
      */fish) echo "  fish_add_path $install_dir" ;;
      *)      echo "  echo 'export PATH=\"$install_dir:\$PATH\"' >> ~/.bashrc && source ~/.bashrc" ;;
    esac
    echo ""
  fi

  success "Binary kuruldu: $install_dir/$binary_name"
  return 0
}

# ── Rust / Cargo kurulum kontrolü ────────────────────────────────────────────
check_rust() {
  if command -v cargo >/dev/null 2>&1; then
    local rust_ver
    rust_ver=$(rustc --version 2>/dev/null | awk '{print $2}')
    success "Rust $rust_ver mevcut"
    return 0
  fi

  warn "Rust/Cargo bulunamadı."
  if [[ "$OPT_INSTALL_DEPS" == true ]]; then
    info "rustup ile Rust kuruluyor..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
    # shellcheck source=/dev/null
    source "$HOME/.cargo/env" 2>/dev/null || export PATH="$HOME/.cargo/bin:$PATH"
    success "Rust kuruldu"
  else
    echo ""
    warn "Rust kurmak için:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "  source \"\$HOME/.cargo/env\""
    echo ""
    echo "  Veya binary indirmek için: ./agent-setup.sh --download-binary"
    return 1
  fi
}

# ── Argüman parse ─────────────────────────────────────────────────────────────
BACKEND_URL="http://localhost:8080"
ENV_FILE="$(dirname "$(realpath "$0")")/.env"
OPT_INSTALL_DEPS=false
OPT_DOWNLOAD_BINARY=false
OPT_VERSION="latest"

while [[ $# -gt 0 ]]; do
  case $1 in
    --backend)         BACKEND_URL="$2";   shift 2 ;;
    --env)             ENV_FILE="$2";      shift 2 ;;
    --install-deps)    OPT_INSTALL_DEPS=true;      shift ;;
    --download-binary) OPT_DOWNLOAD_BINARY=true;   shift ;;
    --version)         OPT_VERSION="$2";  shift 2 ;;
    --no-color)        RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; DIM=''; NC=''; shift ;;
    -h|--help)
      grep '^#' "$0" | grep -v '!/usr/bin' | sed 's/^# \?//'
      exit 0 ;;
    *) error "Bilinmeyen parametre: $1\nYardım için: $0 --help" ;;
  esac
done

# ── .env güncelle (python3 — uzun JWT token'larını bozmaz) ──────────────────
update_env() {
  local key="$1" val="$2"
  [[ -f "$ENV_FILE" ]] || return 0
  python3 - "$ENV_FILE" "$key" "$val" <<'PYEOF'
import sys, re
env_file, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
with open(env_file, 'r') as f:
    lines = f.readlines()
found = False
new_lines = []
for line in lines:
    if re.match(rf'^{re.escape(key)}=', line):
        new_lines.append(f'{key}={val}\n')
        found = True
    else:
        new_lines.append(line)
if not found:
    if new_lines and not new_lines[-1].endswith('\n'):
        new_lines.append('\n')
    new_lines.append(f'{key}={val}\n')
with open(env_file, 'w') as f:
    f.writelines(new_lines)
PYEOF
}

# ── Platform tespit ve banner ─────────────────────────────────────────────────
detect_platform

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     NanoNet Agent Setup  —  v2             ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
echo ""
dim "  Platform : $OS/$ARCH  ($DISTRO)"
[[ "$IS_WSL" == true ]] && dim "  Ortam    : WSL (Windows Subsystem for Linux)"
dim "  Backend  : $BACKEND_URL"
dim "  .env     : $ENV_FILE"
echo ""

# ── Adım 1: Bağımlılıkları kontrol et ───────────────────────────────────────
step "1/5  Bağımlılıklar kontrol ediliyor..."
check_and_install curl curl
check_and_install jq   jq
success "Bağımlılıklar hazır"

# ── Adım 2: Backend bağlantısı ───────────────────────────────────────────────
step "2/5  Backend bağlantısı kontrol ediliyor..."
if ! curl -sf --max-time 5 "$BACKEND_URL/health" >/dev/null 2>&1; then
  error "Backend'e ulaşılamıyor: $BACKEND_URL\n  Stack'i başlattığınızdan emin olun: docker compose up -d"
fi
HEALTH_BODY=$(curl -sf --max-time 5 "$BACKEND_URL/health" 2>/dev/null || true)
if ! echo "$HEALTH_BODY" | jq -e '.status' >/dev/null 2>&1; then
  error "Bu bir NanoNet backend değil ($BACKEND_URL).\n  Yanlış port? Varsayılan: 8080\n  Örnek: ./agent-setup.sh --backend http://localhost:8080"
fi
success "Backend çalışıyor"

# ── Adım 3: Kimlik doğrulama ─────────────────────────────────────────────────
step "3/5  Kimlik doğrulama..."

# Cached token'ları oku
CACHED_ACCESS_TOKEN=""
CACHED_AGENT_TOKEN=""
CACHED_EMAIL=""
if [[ -f "$ENV_FILE" ]]; then
  CACHED_ACCESS_TOKEN=$(grep "^ACCESS_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  CACHED_AGENT_TOKEN=$(grep  "^AGENT_TOKEN="  "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  CACHED_EMAIL=$(grep         "^AGENT_EMAIL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
fi

ACCESS_TOKEN=""

if [[ -n "$CACHED_ACCESS_TOKEN" ]]; then
  info "Kayıtlı token test ediliyor${CACHED_EMAIL:+ ($CACHED_EMAIL)}..."
  TEST_RESP=$(curl -sf --max-time 5 "$BACKEND_URL/api/v1/services" \
    -H "Authorization: Bearer $CACHED_ACCESS_TOKEN" 2>/dev/null || true)
  if echo "$TEST_RESP" | jq -e '.success == true' >/dev/null 2>&1; then
    success "Token geçerli — giriş atlanıyor"
    ACCESS_TOKEN="$CACHED_ACCESS_TOKEN"
  else
    warn "Token geçersiz veya süresi dolmuş, yeniden giriş gerekiyor"
  fi
fi

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo ""
  echo -e "${BOLD}Hesap seçin:${NC}"
  echo "  1) Yeni hesap oluştur (register)"
  echo "  2) Mevcut hesaba giriş yap (login)"
  read -rp "Seçim [1/2]: " AUTH_MODE
  echo ""

  if [[ -n "$CACHED_EMAIL" ]]; then
    read -rp "E-posta [$CACHED_EMAIL]: " INPUT_EMAIL
    EMAIL="${INPUT_EMAIL:-$CACHED_EMAIL}"
  else
    read -rp "E-posta: " EMAIL
  fi

  # Parola: güvenli okuma (echo'suz)
  read -rsp "Şifre (min 12 karakter): " PASSWORD
  echo ""
  echo ""

  # Minimum uzunluk kontrolü (backend'e gönderilmeden önce)
  if [[ ${#PASSWORD} -lt 12 ]]; then
    error "Şifre en az 12 karakter olmalıdır (güvenlik standardı)"
  fi

  if [[ "$AUTH_MODE" == "1" ]]; then
    info "Kayıt yapılıyor..."
    AUTH_RESP=$(curl -sf --max-time 10 -X POST "$BACKEND_URL/api/v1/auth/register" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>&1) || {
      warn "Bu e-posta zaten kayıtlı olabilir, giriş deneniyor..."
      AUTH_MODE="2"
    }
  fi

  if [[ "$AUTH_MODE" == "2" ]]; then
    info "Giriş yapılıyor..."
    HTTP_CODE=$(curl -s -o /tmp/_nanonet_auth.json -w "%{http_code}" --max-time 10 \
      -X POST "$BACKEND_URL/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || echo "000")
    AUTH_RESP=$(cat /tmp/_nanonet_auth.json 2>/dev/null || true)
    rm -f /tmp/_nanonet_auth.json
    if [[ "$HTTP_CODE" != "200" ]]; then
      ERR_MSG=$(echo "$AUTH_RESP" | jq -r '.error // .message // "E-posta veya şifre yanlış"' 2>/dev/null || true)
      error "Giriş başarısız ($HTTP_CODE): $ERR_MSG"
    fi
  fi

  ACCESS_TOKEN=$(echo "$AUTH_RESP" | jq -r '.data.tokens.access_token // .data.tokens.AccessToken // empty')
  [[ -z "$ACCESS_TOKEN" ]] && error "Token alınamadı.\nYanıt: $AUTH_RESP"
  success "Kimlik doğrulama başarılı"

  # E-postayı cache'le
  update_env "AGENT_EMAIL" "$EMAIL"
fi
echo ""

# ── Adım 4: Agent token ──────────────────────────────────────────────────────
step "4/5  Agent token..."
if [[ -n "$CACHED_ACCESS_TOKEN" ]] && \
   [[ "$ACCESS_TOKEN" == "$CACHED_ACCESS_TOKEN" ]] && \
   [[ -n "$CACHED_AGENT_TOKEN" ]]; then
  AGENT_TOKEN="$CACHED_AGENT_TOKEN"
  success "Mevcut agent token kullanılıyor"
else
  info "Agent token alınıyor (uzun ömürlü)..."
  AGENT_TOKEN_RESP=$(curl -sf --max-time 10 -X POST \
    "$BACKEND_URL/api/v1/auth/agent-token" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" 2>/dev/null || true)
  AGENT_TOKEN=$(echo "$AGENT_TOKEN_RESP" | jq -r '.data.agent_token // empty' 2>/dev/null || true)
  if [[ -z "$AGENT_TOKEN" ]]; then
    warn "Agent token alınamadı, access token kullanılıyor (24 saat geçerli)"
    AGENT_TOKEN="$ACCESS_TOKEN"
  fi
  success "Agent token alındı"
fi
echo ""

# ── Adım 5: Servis seç / oluştur ─────────────────────────────────────────────
step "5/5  Servis yapılandırması..."
SVC_RESP=$(curl -sf --max-time 10 "$BACKEND_URL/api/v1/services" \
  -H "Authorization: Bearer $ACCESS_TOKEN") || error "Servis listesi alınamadı"
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

SERVICE_METRICS_URL=""
if [[ "$SVC_CHOICE" -le "$SVC_COUNT" && "$SVC_COUNT" -gt 0 ]]; then
  IDX=$((SVC_CHOICE - 1))
  SERVICE_ID=$(echo "$SVC_RESP"       | jq -r --argjson i $IDX '.data[$i].id')
  SERVICE_NAME=$(echo "$SVC_RESP"     | jq -r --argjson i $IDX '.data[$i].name')
  SERVICE_HOST=$(echo "$SVC_RESP"     | jq -r --argjson i $IDX '.data[$i].host')
  SERVICE_PORT=$(echo "$SVC_RESP"     | jq -r --argjson i $IDX '.data[$i].port')
  SERVICE_ENDPOINT=$(echo "$SVC_RESP" | jq -r --argjson i $IDX '.data[$i].health_endpoint')
  SERVICE_POLL=$(echo "$SVC_RESP"     | jq -r --argjson i $IDX '.data[$i].poll_interval_sec')
  success "Seçilen servis: $SERVICE_NAME"
  # Servisin /metrics endpoint'i varsa uygulama metrikleri için kullan
  SERVICE_METRICS_URL="http://${SERVICE_HOST}:${SERVICE_PORT}/metrics"
  if curl -sf --max-time 2 "$SERVICE_METRICS_URL" >/dev/null 2>&1; then
    info "Uygulama metrikleri endpoint'i bulundu: $SERVICE_METRICS_URL"
  else
    SERVICE_METRICS_URL=""
  fi
else
  echo -e "${BOLD}Yeni servis bilgileri:${NC}"
  read -rp "  Servis adı           : " SERVICE_NAME
  read -rp "  İzlenecek host       : " SERVICE_HOST
  read -rp "  İzlenecek port       : " SERVICE_PORT
  read -rp "  Health endpoint [/health]: " SERVICE_ENDPOINT
  SERVICE_ENDPOINT="${SERVICE_ENDPOINT:-/health}"
  read -rp "  Metrik aralığı (s)  [10]: " SERVICE_POLL
  SERVICE_POLL="${SERVICE_POLL:-10}"
  echo ""

  info "Servis oluşturuluyor..."
  CREATE_RESP=$(curl -sf --max-time 10 -X POST "$BACKEND_URL/api/v1/services" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$SERVICE_NAME\",\"host\":\"$SERVICE_HOST\",\"port\":$SERVICE_PORT,\"health_endpoint\":\"$SERVICE_ENDPOINT\",\"poll_interval_sec\":$SERVICE_POLL}") \
    || error "Servis oluşturulamadı"

  SERVICE_ID=$(echo "$CREATE_RESP" | jq -r '.data.id // empty')
  [[ -z "$SERVICE_ID" ]] && error "Servis ID alınamadı.\nYanıt: $CREATE_RESP"
  success "Servis oluşturuldu: $SERVICE_ID"
fi
echo ""

if [[ -f "$ENV_FILE" ]]; then
  info ".env güncelleniyor: $ENV_FILE"
  update_env "ACCESS_TOKEN"             "$ACCESS_TOKEN"
  update_env "AGENT_SERVICE_ID"         "$SERVICE_ID"
  update_env "AGENT_TOKEN"              "$AGENT_TOKEN"
  update_env "AGENT_TARGET_HOST"        "${SERVICE_HOST:-localhost}"
  update_env "AGENT_TARGET_PORT"        "${SERVICE_PORT:-8080}"
  update_env "AGENT_HEALTH_ENDPOINT"    "${SERVICE_ENDPOINT:-/health}"
  update_env "AGENT_POLL_INTERVAL"      "${SERVICE_POLL:-10}"
  update_env "AGENT_METRICS_ENDPOINT"   "${SERVICE_METRICS_URL:-}"
  success ".env güncellendi"
else
  warn ".env dosyası bulunamadı ($ENV_FILE) — değerleri manuel ekleyin:"
  echo ""
  echo "  AGENT_SERVICE_ID=$SERVICE_ID"
  echo "  AGENT_TOKEN=$AGENT_TOKEN"
  echo "  AGENT_TARGET_HOST=${SERVICE_HOST:-localhost}"
  echo "  AGENT_TARGET_PORT=${SERVICE_PORT:-8080}"
  echo "  AGENT_HEALTH_ENDPOINT=${SERVICE_ENDPOINT:-/health}"
  echo "  AGENT_POLL_INTERVAL=${SERVICE_POLL:-10}"
fi
echo ""

# ── Agent kurulum seçeneği ────────────────────────────────────────────────────
if [[ "$OPT_DOWNLOAD_BINARY" == true ]]; then
  step "Agent binary indiriliyor..."
  download_binary "$OPT_VERSION" "$HOME/.local/bin" || {
    warn "Binary indirme başarısız. Kaynak koddan derlemeye geçiliyor..."
    OPT_DOWNLOAD_BINARY=false
  }
fi

if [[ "$OPT_DOWNLOAD_BINARY" == false ]]; then
  SCRIPT_DIR="$(dirname "$(realpath "$0")")"
  if [[ -f "$SCRIPT_DIR/agent/Cargo.toml" ]]; then
    check_rust || true
  fi
fi

# ── Özet ─────────────────────────────────────────────────────────────────────
echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║              Kurulum Tamamlandı            ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Platform  : ${CYAN}$OS/$ARCH${NC}$([[ "$IS_WSL" == true ]] && echo ' (WSL)')"
echo -e "  Servis ID : ${CYAN}$SERVICE_ID${NC}"
echo -e "  Servis    : ${CYAN}${SERVICE_NAME:-?}${NC}"
echo ""
echo -e "${BOLD}Agent'ı başlatmak için:${NC}"
echo ""

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
if command -v nanonet-agent >/dev/null 2>&1; then
  # Kurulu binary
  echo -e "  ${GREEN}nanonet-agent${NC}  (PATH'de kurulu binary)"
elif [[ -f "$HOME/.local/bin/nanonet-agent" ]]; then
  echo -e "  ${GREEN}$HOME/.local/bin/nanonet-agent${NC}"
elif [[ -f "$SCRIPT_DIR/agent/Cargo.toml" ]]; then
  echo -e "  ${GREEN}make agent${NC}  (kaynak kod derle)"
fi
echo ""

# ── Direkt başlatma seçeneği ──────────────────────────────────────────────────
read -rp "Agent'ı şimdi başlatayım mı? [e/H]: " RUN_NOW
if [[ "$RUN_NOW" =~ ^[Ee]$ ]]; then
  echo ""
  pkill -f 'nanonet-agent' 2>/dev/null || true
  sleep 0.5

  AGENT_BIN=""
  if command -v nanonet-agent >/dev/null 2>&1; then
    AGENT_BIN="nanonet-agent"
  elif [[ -f "$HOME/.local/bin/nanonet-agent" ]]; then
    AGENT_BIN="$HOME/.local/bin/nanonet-agent"
  fi

  if [[ -n "$AGENT_BIN" ]]; then
    # Binary kurulu — env değişkenlerini ayarla ve çalıştır
    export NANONET_BACKEND="$(echo "$BACKEND_URL" | sed 's|^http://|ws://|;s|^https://|wss://|')"
    export NANONET_SERVICE_ID="$SERVICE_ID"
    export NANONET_AGENT_TOKEN="$AGENT_TOKEN"
    export NANONET_TOKEN="$AGENT_TOKEN"
    export NANONET_HOST="${SERVICE_HOST:-localhost}"
    export NANONET_PORT="${SERVICE_PORT:-8080}"
    export NANONET_HEALTH_ENDPOINT="${SERVICE_ENDPOINT:-/health}"
    export NANONET_POLL_INTERVAL="${SERVICE_POLL:-10}"
    [[ -n "$SERVICE_METRICS_URL" ]] && export NANONET_METRICS_ENDPOINT="$SERVICE_METRICS_URL" || unset NANONET_METRICS_ENDPOINT
    "$AGENT_BIN" &
    AGENT_PID=$!
  elif [[ -f "$SCRIPT_DIR/agent/Cargo.toml" ]]; then
    # Kaynak kod — make agent
    (cd "$SCRIPT_DIR" && make agent) &
    AGENT_PID=$!
  else
    warn "Agent binary veya kaynak kodu bulunamadı."
    AGENT_PID=""
  fi

  if [[ -n "$AGENT_PID" ]]; then
    sleep 3
    if kill -0 "$AGENT_PID" 2>/dev/null; then
      success "Agent başlatıldı (PID: $AGENT_PID)"
      echo ""
      echo -e "  Durdurmak için : ${CYAN}pkill -f nanonet-agent${NC}"
      echo -e "  Loglar için    : ${CYAN}make logs-agent${NC}  (Docker kullanıyorsanız)"
    else
      warn "Agent erken kapandı. Manuel deneyin: make agent"
    fi
  fi
fi
echo ""
