#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# dev.sh — NanoNet geliştirme ortamı başlatıcı
# Desteklenen: Ubuntu/Debian · Arch Linux · RHEL/Fedora · openSUSE · macOS · WSL
#
# Kullanım:
#   ./dev.sh setup    — bağımlılıkları kontrol et / kur
#   ./dev.sh dev      — geliştirme ortamını başlat
#   ./dev.sh down     — servisleri durdur
#   ./dev.sh reset    — servisleri durdur + DB sıfırla (volume sil)
#   ./dev.sh logs     — logları takip et
#   ./dev.sh ps       — çalışan container'ları listele
#   ./dev.sh help     — bu yardım mesajı
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Renkli çıktı ─────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; RESET=''
fi

info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
err()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die()   { err "$*"; exit 1; }
step()  { echo -e "\n${BOLD}▶ $*${RESET}"; }

# ── Platform algılama ─────────────────────────────────────────────────────────
OS=""
DISTRO=""
PKG_MANAGER=""

detect_platform() {
  case "$(uname -s)" in
    Linux)
      OS="linux"
      # WSL tespiti
      if grep -qi microsoft /proc/version 2>/dev/null; then
        OS="wsl"
      fi
      if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        DISTRO="${ID:-unknown}"
      fi
      case "${DISTRO:-}" in
        ubuntu|debian|linuxmint|pop|elementary) PKG_MANAGER="apt"     ;;
        arch|manjaro|endeavouros|garuda)        PKG_MANAGER="pacman"  ;;
        fedora|rhel|centos|rocky|almalinux)     PKG_MANAGER="dnf"     ;;
        opensuse*|sles)                         PKG_MANAGER="zypper"  ;;
        *)                                      PKG_MANAGER="unknown" ;;
      esac
      ;;
    Darwin)
      OS="macos"
      PKG_MANAGER="brew"
      ;;
    *)
      die "Desteklenmeyen platform: $(uname -s). Windows için dev.bat kullanın."
      ;;
  esac
  info "Platform: ${OS}${DISTRO:+ (${DISTRO})} — paket yöneticisi: ${PKG_MANAGER}"
}

# ── Paket yükleme yardımcıları ────────────────────────────────────────────────
pkg_install() {
  case "$PKG_MANAGER" in
    apt)    sudo apt-get update -qq && sudo apt-get install -y "$@" ;;
    pacman) sudo pacman -Sy --noconfirm "$@" ;;
    dnf)    sudo dnf install -y "$@" ;;
    zypper) sudo zypper install -y "$@" ;;
    brew)   brew install "$@" ;;
    *)
      warn "Bilinmeyen paket yöneticisi. Lütfen şunları manuel kurun: $*"
      ;;
  esac
}

# ── Homebrew (macOS) ──────────────────────────────────────────────────────────
ensure_brew() {
  if [[ "$OS" == "macos" ]] && ! command -v brew &>/dev/null; then
    info "Homebrew bulunamadı, kuruluyor..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Apple Silicon için PATH
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
  fi
}

# ── Docker ────────────────────────────────────────────────────────────────────
check_docker() {
  if ! command -v docker &>/dev/null; then
    warn "Docker bulunamadı, kurulumu deneniyor..."
    case "$PKG_MANAGER" in
      apt)
        curl -fsSL https://get.docker.com | sudo sh
        sudo usermod -aG docker "$USER"
        warn "Docker kuruldu. 'newgrp docker' veya oturum açıp kapatın, ardından tekrar çalıştırın."
        exit 0
        ;;
      pacman) pkg_install docker docker-compose ;;
      dnf)    pkg_install docker docker-compose ;;
      zypper) pkg_install docker docker-compose ;;
      brew)
        warn "macOS için Docker Desktop gerekli: https://www.docker.com/products/docker-desktop"
        die "Docker Desktop kurulduktan sonra tekrar çalıştırın."
        ;;
      *) die "Docker kurulu değil. https://docs.docker.com/get-docker/ adresinden kurun." ;;
    esac
  fi

  if ! docker info &>/dev/null 2>&1; then
    warn "Docker daemon çalışmıyor, başlatılıyor..."
    if [[ "$OS" == "wsl" ]]; then
      die "WSL2: Docker Desktop'ın Windows tarafında çalıştığından emin olun ve tekrar deneyin."
    elif [[ "$OS" == "macos" ]]; then
      open -a Docker 2>/dev/null || true
      info "Docker Desktop başlatılıyor, 15 saniye bekleniyor..."
      sleep 15
      docker info &>/dev/null || die "Docker daemon hâlâ çalışmıyor. Docker Desktop'ı manuel başlatın."
    else
      sudo systemctl start docker 2>/dev/null \
        || sudo service docker start 2>/dev/null \
        || die "Docker daemon başlatılamadı. 'sudo systemctl start docker' deneyin."
      sleep 2
    fi
  fi

  # Docker Compose v2 plugin kontrolü
  if ! docker compose version &>/dev/null 2>&1; then
    warn "Docker Compose plugin bulunamadı, eski 'docker-compose' deneniyor..."
    if ! command -v docker-compose &>/dev/null; then
      case "$PKG_MANAGER" in
        apt)    sudo apt-get install -y docker-compose-plugin 2>/dev/null \
                  || sudo apt-get install -y docker-compose ;;
        *)      pkg_install docker-compose ;;
      esac
    fi
    COMPOSE_CMD="docker-compose"
  fi

  ok "Docker: $(docker --version | awk '{print $3}' | tr -d ',')"
}

# ── Go ────────────────────────────────────────────────────────────────────────
check_go() {
  if command -v go &>/dev/null; then
    ok "Go: $(go version | awk '{print $3}')"; return
  fi
  warn "Go bulunamadı, kuruluyor..."
  case "$PKG_MANAGER" in
    apt)    pkg_install golang-go ;;
    pacman) pkg_install go ;;
    dnf)    pkg_install golang ;;
    zypper) pkg_install go ;;
    brew)   pkg_install go ;;
    *)      warn "Go kurulu değil. https://go.dev/dl/ adresinden indirin." ;;
  esac
  command -v go &>/dev/null && ok "Go: $(go version | awk '{print $3}')"
}

# ── Node.js ───────────────────────────────────────────────────────────────────
check_node() {
  if command -v node &>/dev/null; then
    ok "Node.js: $(node --version)"; return
  fi
  warn "Node.js bulunamadı, kuruluyor..."
  case "$PKG_MANAGER" in
    apt)
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      pkg_install nodejs
      ;;
    pacman) pkg_install nodejs npm ;;
    dnf)
      sudo dnf module enable nodejs:20 -y 2>/dev/null || true
      pkg_install nodejs npm
      ;;
    zypper) pkg_install nodejs20 npm20 ;;
    brew)   pkg_install node@20 && brew link node@20 2>/dev/null || true ;;
    *)      warn "Node.js kurulu değil. https://nodejs.org adresinden indirin." ;;
  esac
  command -v node &>/dev/null && ok "Node.js: $(node --version)"
}

# ── Rust ──────────────────────────────────────────────────────────────────────
check_rust() {
  if command -v cargo &>/dev/null; then
    ok "Rust: $(rustc --version | awk '{print $2}')"; return
  fi
  warn "Rust/Cargo bulunamadı, rustup ile kuruluyor..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path
  export PATH="$HOME/.cargo/bin:$PATH"
  # shellcheck disable=SC1091
  [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
  command -v cargo &>/dev/null && ok "Rust: $(rustc --version | awk '{print $2}')"
}

# ── Temel araçlar ─────────────────────────────────────────────────────────────
check_tools() {
  for tool in git curl jq make; do
    if ! command -v "$tool" &>/dev/null; then
      warn "$tool bulunamadı, kuruluyor..."
      pkg_install "$tool"
    fi
  done
  ok "Temel araçlar hazır (git, curl, jq, make)"
}

# ── .env kurulumu ─────────────────────────────────────────────────────────────
setup_env() {
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      cp .env.example .env
      ok ".env oluşturuldu (.env.example'dan)"
      warn "Önemli: .env içindeki JWT_SECRET ve CLAUDE_API_KEY alanlarını doldurun!"
    else
      warn ".env.example bulunamadı. .env dosyasını manuel oluşturun."
    fi
  else
    ok ".env mevcut"
  fi
}

# ── Docker ağ kurulumu ────────────────────────────────────────────────────────
# docker-compose.dev.yml 'kind' ağını external olarak bekler.
# kind kurulu değilse bu ağı oluşturalım ki compose hata vermesin.
setup_networks() {
  if ! docker network inspect kind &>/dev/null 2>&1; then
    info "'kind' Docker ağı oluşturuluyor (Kubernetes geliştirme için)..."
    docker network create kind &>/dev/null || true
    ok "'kind' ağı oluşturuldu"
  fi
}

# ── Compose komutu ────────────────────────────────────────────────────────────
COMPOSE_CMD="docker compose"
_compose() {
  $COMPOSE_CMD -f docker-compose.dev.yml "$@"
}

# ── Komutlar ──────────────────────────────────────────────────────────────────
cmd_setup() {
  step "Bağımlılıklar kontrol ediliyor / kuruluyor..."
  [[ "$OS" == "macos" ]] && ensure_brew
  check_docker
  check_go
  check_node
  check_rust
  check_tools
  setup_env
  setup_networks
  echo ""
  ok "Kurulum tamamlandı!"
  info "Geliştirme ortamını başlatmak için: ./dev.sh dev"
}

cmd_dev() {
  step "Geliştirme ortamı başlatılıyor..."
  setup_env
  setup_networks

  if ! docker info &>/dev/null 2>&1; then
    die "Docker çalışmıyor. 'sudo systemctl start docker' veya Docker Desktop'ı başlatın."
  fi

  _compose up --build -d

  echo ""
  ok "Servisler çalışıyor!"
  echo -e "  ${CYAN}Frontend:${RESET}  http://localhost:3000"
  echo -e "  ${CYAN}Backend:${RESET}   http://localhost:8080"
  echo -e "  ${CYAN}API Docs:${RESET}  http://localhost:8080/api/docs"
  echo ""
  info "Loglar için:     ./dev.sh logs"
  info "Durdurmak için:  ./dev.sh down"
}

cmd_down() {
  step "Servisler durduruluyor..."
  _compose down
  ok "Tüm servisler durduruldu."
}

cmd_reset() {
  step "Ortam sıfırlanıyor (volume'lar da siliniyor)..."
  _compose down -v
  ok "Sıfırlama tamamlandı — veritabanı temizlendi."
}

cmd_logs() {
  _compose logs -f --tail=100 "$@"
}

cmd_ps() {
  _compose ps
}

cmd_help() {
  echo -e ""
  echo -e "${BOLD}NanoNet Dev Script${RESET} — Linux · macOS · WSL"
  echo -e ""
  echo -e "  ${CYAN}./dev.sh setup${RESET}      Bağımlılıkları kontrol et / kur (ilk kurulum)"
  echo -e "  ${CYAN}./dev.sh dev${RESET}        Geliştirme ortamını başlat"
  echo -e "  ${CYAN}./dev.sh down${RESET}       Servisleri durdur"
  echo -e "  ${CYAN}./dev.sh reset${RESET}      Servisleri durdur + volume sil (DB sıfırla)"
  echo -e "  ${CYAN}./dev.sh logs${RESET}       Tüm logları takip et"
  echo -e "  ${CYAN}./dev.sh logs backend${RESET}  Belirli servis logları"
  echo -e "  ${CYAN}./dev.sh ps${RESET}         Çalışan container'ları listele"
  echo -e "  ${CYAN}./dev.sh help${RESET}       Bu yardım mesajı"
  echo -e ""
  echo -e "  ${YELLOW}Nix kullanıcıları:${RESET} nix develop"
  echo -e "  ${YELLOW}Windows:${RESET}           dev.bat veya .\\dev.ps1"
}

# ── Giriş noktası ─────────────────────────────────────────────────────────────
detect_platform

COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  setup)          cmd_setup          ;;
  dev)            cmd_dev            ;;
  down)           cmd_down           ;;
  reset)          cmd_reset          ;;
  logs)           cmd_logs "$@"      ;;
  ps)             cmd_ps             ;;
  help|--help|-h) cmd_help           ;;
  *)
    err "Bilinmeyen komut: $COMMAND"
    cmd_help
    exit 1
    ;;
esac
