#!/usr/bin/env bash
# NanoNet Agent Setup — Multiplatform Kurulum Sihirbazı v3
# Desteklenen: Ubuntu/Debian · Arch Linux · RHEL/Fedora/CentOS · openSUSE · macOS · WSL
#
# Kullanım: ./agent-setup.sh [KOMUT] [SEÇENEKLER]
#
# Komutlar (belirtilmezse interaktif kurulum):
#   status                   Çalışan tüm agent'ları listele
#   stop    [service_id|all] Agent'ı durdur
#   restart [service_id|all] Agent'ı yeniden başlat
#   logs    [service_id]     Agent log çıktısını takip et
#   add-service              Mevcut token ile yeni servis ekle
#   refresh-token            Sadece token'ı yenile
#   validate                 .env dosyasını doğrula
#   update                   Binary'yi güncelle
#   install-service          Systemd/launchd servis olarak kur
#
# Seçenekler:
#   --backend  <url>         Backend URL'i (varsayılan: http://localhost:8080)
#   --env      <dosya>       .env dosya yolu (varsayılan: script dizini/.env)
#   --install-deps           Eksik bağımlılıkları otomatik yükle (curl, jq)
#   --download-binary        GitHub Releases'tan binary indir
#   --version  <tag>         Binary sürümü (varsayılan: latest)
#   --yes / -y               Non-interactive mod (tüm onayları otomatik geç)
#   --dry-run                Hiçbir şey kaydetme/başlatma, sadece göster
#   --quiet / -q             Sadece hata ve sonuç çıktısı
#   --json                   Çıktıyı JSON formatında ver
#   --debug                  Tüm HTTP isteklerini verbose göster
#   --no-color               Renksiz çıktı
#   --autostart              Sistem başlangıcında agent'ları otomatik başlat

set -euo pipefail

# ── Sabitler ─────────────────────────────────────────────────────────────────
NANONET_DIR="$HOME/.nanonet"
AGENTS_DIR="$NANONET_DIR/agents"
LOGS_DIR="$NANONET_DIR/logs"
GITHUB_REPO="kaelvalen/nanonet"

# ── Global değişkenler ────────────────────────────────────────────────────────
BACKEND_URL="http://localhost:8080"
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
ENV_FILE="$SCRIPT_DIR/.env"
OPT_INSTALL_DEPS=false
OPT_DOWNLOAD_BINARY=false
OPT_VERSION="latest"
OPT_YES=false
OPT_DRY_RUN=false
OPT_QUIET=false
OPT_JSON=false
OPT_DEBUG=false
OPT_AUTOSTART=false
SUBCOMMAND=""
SUBCOMMAND_ARG=""

# ── Renk kontrolü ────────────────────────────────────────────────────────────
setup_colors() {
  if [[ "${NO_COLOR:-}" == "1" ]] || [[ "${OPT_NO_COLOR:-false}" == "true" ]] || [[ ! -t 1 ]]; then
    RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; DIM=''; MAGENTA=''; NC=''
  else
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
    CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'
    MAGENTA='\033[0;35m'; NC='\033[0m'
  fi
}
OPT_NO_COLOR=false
setup_colors

# ── Çıktı yardımcıları ────────────────────────────────────────────────────────
info()    { [[ "$OPT_QUIET" == true ]] && return; echo -e "${CYAN}▸ $*${NC}"; }
success() { [[ "$OPT_QUIET" == true ]] && return; echo -e "${GREEN}✔ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}" >&2; }
error()   { echo -e "${RED}✖ $*${NC}" >&2; exit 1; }
step()    { [[ "$OPT_QUIET" == true ]] && return; echo -e "\n${BOLD}$*${NC}"; }
dim()     { [[ "$OPT_QUIET" == true ]] && return; echo -e "${DIM}$*${NC}"; }
debug()   { [[ "$OPT_DEBUG" == true ]] || return 0; echo -e "${MAGENTA}[DEBUG] $*${NC}" >&2; }

# JSON çıktı modu
json_out() {
  local status="$1" msg="$2" data="${3:-{}}"
  if [[ "$OPT_JSON" == true ]]; then
    echo "{\"status\":\"$status\",\"message\":$(echo "$msg" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read().strip()))'),\"data\":$data}"
  fi
}

# ── Spinner ───────────────────────────────────────────────────────────────────
_SPINNER_PID=""
spinner_start() {
  [[ "$OPT_QUIET" == true ]] && return
  [[ ! -t 1 ]] && return
  local msg="${1:-İşleniyor...}"
  (
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local i=0
    while true; do
      printf "\r${CYAN}%s${NC} %s " "${frames[$((i % ${#frames[@]}))]}" "$msg"
      sleep 0.1
      ((i++))
    done
  ) &
  _SPINNER_PID=$!
  disown "$_SPINNER_PID" 2>/dev/null || true
}
spinner_stop() {
  [[ -z "$_SPINNER_PID" ]] && return
  kill "$_SPINNER_PID" 2>/dev/null || true
  _SPINNER_PID=""
  printf "\r\033[K"
}

# ── Token yardımcıları ────────────────────────────────────────────────────────
# Token'dan exp claim'i oku
token_exp() {
  local token="$1"
  echo "$token" | cut -d. -f2 | base64 -d 2>/dev/null \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("exp",0))' 2>/dev/null || echo "0"
}

# Token geçerli mi? (1=geçerli, 0=expired)
token_valid() {
  local token="$1"
  [[ -z "$token" ]] && echo "0" && return
  local exp now
  exp=$(token_exp "$token")
  now=$(date +%s)
  [[ "$exp" -gt "$now" ]] && echo "1" || echo "0"
}

# Token'ın kaç saniye sonra expiry olacağı
token_ttl() {
  local token="$1"
  local exp now
  exp=$(token_exp "$token")
  now=$(date +%s)
  echo $(( exp - now ))
}

# TTL'yi okunabilir formata çevir
ttl_human() {
  local ttl="$1"
  if   [[ "$ttl" -le 0 ]];        then echo "süresi dolmuş"
  elif [[ "$ttl" -lt 3600 ]];     then echo "$((ttl/60)) dakika"
  elif [[ "$ttl" -lt 86400 ]];    then echo "$((ttl/3600)) saat"
  elif [[ "$ttl" -lt 2592000 ]];  then echo "$((ttl/86400)) gün"
  elif [[ "$ttl" -lt 31536000 ]]; then echo "$((ttl/2592000)) ay"
  else                                  echo "$((ttl/31536000)) yıl"
  fi
}

# Token'ı maskele (ilk 10 + ... + son 6 karakter)
mask_token() {
  local t="$1"
  [[ ${#t} -lt 20 ]] && echo "$t" && return
  echo "${t:0:10}...${t: -6}"
}

# ── .env güncelle (python3 — uzun JWT token'larını bozmaz) ───────────────────
update_env() {
  local key="$1" val="$2"
  [[ "$OPT_DRY_RUN" == true ]] && { debug "[dry-run] .env güncellenmedi: $key"; return 0; }
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

# .env backup al
backup_env() {
  [[ -f "$ENV_FILE" ]] || return 0
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"
  debug ".env yedeklendi: ${ENV_FILE}.bak.*"
}

# .env rollback
rollback_env() {
  local latest_bak
  latest_bak=$(ls -t "${ENV_FILE}.bak."* 2>/dev/null | head -1)
  if [[ -n "$latest_bak" ]]; then
    cp "$latest_bak" "$ENV_FILE"
    warn ".env önceki haline döndürüldü: $latest_bak"
  fi
}

# ── HTTP isteği (retry destekli) ──────────────────────────────────────────────
http_get() {
  local url="$1" token="${2:-}" retries=3 delay=2
  local curl_opts=(-sf --max-time 10)
  [[ "$OPT_DEBUG" == true ]] && curl_opts+=(-v)
  [[ -n "$token" ]] && curl_opts+=(-H "Authorization: Bearer $token")
  local i=0
  while [[ $i -lt $retries ]]; do
    local resp
    if resp=$(curl "${curl_opts[@]}" "$url" 2>/dev/null); then
      echo "$resp"
      return 0
    fi
    i=$((i+1))
    [[ $i -lt $retries ]] && { debug "HTTP GET başarısız ($i/$retries), ${delay}s sonra tekrar..."; sleep "$delay"; }
  done
  return 1
}

http_post() {
  local url="$1" token="${2:-}" data="${3:-{}}" retries=3 delay=2
  local curl_opts=(-sf --max-time 10 -X POST -H "Content-Type: application/json" -d "$data")
  [[ "$OPT_DEBUG" == true ]] && curl_opts+=(-v)
  [[ -n "$token" ]] && curl_opts+=(-H "Authorization: Bearer $token")
  local i=0
  while [[ $i -lt $retries ]]; do
    local resp
    if resp=$(curl "${curl_opts[@]}" "$url" 2>/dev/null); then
      echo "$resp"
      return 0
    fi
    i=$((i+1))
    [[ $i -lt $retries ]] && { debug "HTTP POST başarısız ($i/$retries), ${delay}s sonra tekrar..."; sleep "$delay"; }
  done
  return 1
}

# ── PID dosyası yönetimi ──────────────────────────────────────────────────────
pid_file()  { echo "$AGENTS_DIR/${1}.pid"; }
log_file()  { echo "$LOGS_DIR/${1}.log"; }
env_file_for() { echo "$AGENTS_DIR/${1}.env"; }

agent_running() {
  local svc_id="$1"
  local pf; pf=$(pid_file "$svc_id")
  [[ -f "$pf" ]] || return 1
  local pid; pid=$(cat "$pf" 2>/dev/null)
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

agent_pid() {
  local svc_id="$1"
  local pf; pf=$(pid_file "$svc_id")
  [[ -f "$pf" ]] && cat "$pf" 2>/dev/null || echo ""
}

save_agent_pid() {
  local svc_id="$1" pid="$2"
  mkdir -p "$AGENTS_DIR"
  echo "$pid" > "$(pid_file "$svc_id")"
}

remove_agent_pid() {
  local svc_id="$1"
  rm -f "$(pid_file "$svc_id")"
}

save_agent_env() {
  local svc_id="$1"
  shift
  mkdir -p "$AGENTS_DIR"
  # "$@" key=value çiftleri olarak bekleniyor
  printf '%s\n' "$@" > "$(env_file_for "$svc_id")"
  chmod 600 "$(env_file_for "$svc_id")"
}

load_agent_env() {
  local svc_id="$1"
  local ef; ef=$(env_file_for "$svc_id")
  [[ -f "$ef" ]] && cat "$ef" || true
}

list_tracked_agents() {
  # ~/.nanonet/agents/ altındaki .pid dosyalarından servis ID'lerini döndür
  [[ -d "$AGENTS_DIR" ]] || return 0
  local f
  for f in "$AGENTS_DIR"/*.pid; do
    [[ -f "$f" ]] && basename "$f" .pid
  done
}

# ── Agent binary bul ──────────────────────────────────────────────────────────
find_agent_bin() {
  if command -v nanonet-agent >/dev/null 2>&1; then
    echo "nanonet-agent"
  elif [[ -f "$HOME/.local/bin/nanonet-agent" ]]; then
    echo "$HOME/.local/bin/nanonet-agent"
  elif [[ -f "$SCRIPT_DIR/agent/target/release/nanonet-agent" ]]; then
    echo "$SCRIPT_DIR/agent/target/release/nanonet-agent"
  else
    echo ""
  fi
}

# ── Platform tespiti ──────────────────────────────────────────────────────────
detect_platform() {
  OS=""; ARCH=""; DISTRO=""; PKG_MGR=""; IS_WSL=false; IS_MUSL=false
  case "$(uname -s)" in
    Linux*)
      OS="linux"
      grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=true
      grep -qi wsl /proc/version 2>/dev/null && IS_WSL=true
      if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        source /etc/os-release
        DISTRO="${ID:-unknown}"
        case "$ID" in
          ubuntu|debian|linuxmint|pop|elementary|zorin|kali) PKG_MGR="apt" ;;
          arch|manjaro|endeavouros|garuda|artix)             PKG_MGR="pacman" ;;
          fedora|rhel|centos|rocky|almalinux|ol)             PKG_MGR="dnf" ;;
          opensuse*|sles)                                    PKG_MGR="zypper" ;;
          alpine)  PKG_MGR="apk"; IS_MUSL=true ;;
          void)    PKG_MGR="xbps" ;;
          *)
            case "${ID_LIKE:-}" in
              *debian*|*ubuntu*) PKG_MGR="apt" ;;
              *arch*)            PKG_MGR="pacman" ;;
              *fedora*|*rhel*)   PKG_MGR="dnf" ;;
              *suse*)            PKG_MGR="zypper" ;;
            esac ;;
        esac
      fi ;;
    Darwin*)  OS="darwin"; DISTRO="macos"; PKG_MGR="brew" ;;
    MINGW*|MSYS*|CYGWIN*)
      error "Windows Git Bash/MSYS tespit edildi. Lütfen agent-setup.ps1 kullanın." ;;
    *) error "Desteklenmeyen işletim sistemi: $(uname -s)" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)  ARCH="x86_64" ;;
    aarch64|arm64) ARCH="aarch64" ;;
    armv7l|armhf)  ARCH="armv7" ;;
    i386|i686)     error "32-bit sistemler desteklenmiyor." ;;
    *)             error "Desteklenmeyen mimari: $(uname -m)" ;;
  esac
  if [[ "$OS" == "linux" && "$IS_MUSL" == true ]]; then
    BINARY_TARGET="${ARCH}-unknown-linux-musl"
  elif [[ "$OS" == "linux" ]]; then
    BINARY_TARGET="${ARCH}-unknown-linux-gnu"
  elif [[ "$OS" == "darwin" ]]; then
    BINARY_TARGET="${ARCH}-apple-darwin"
  fi
}

# ── Bağımlılık yönetimi ───────────────────────────────────────────────────────
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

install_package() {
  local pkg="$1"
  info "Kuruluyor: $pkg ($PKG_MGR)"
  case "$PKG_MGR" in
    apt)    sudo apt-get update -qq && sudo apt-get install -y -qq "$pkg" ;;
    pacman) sudo pacman -Sy --noconfirm "$pkg" ;;
    dnf)    sudo dnf install -y -q "$pkg" ;;
    zypper) sudo zypper install -y -q "$pkg" ;;
    apk)    sudo apk add --quiet "$pkg" ;;
    xbps)   sudo xbps-install -Sy "$pkg" ;;
    brew)   brew install "$pkg" ;;
    *)      warn "Paket yöneticisi bulunamadı. '$pkg' manuel kurun."; return 1 ;;
  esac
}

check_and_install() {
  local cmd="$1" pkg="${2:-$1}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    if [[ "$OPT_INSTALL_DEPS" == true ]]; then
      install_package "$pkg"
    else
      error "'$cmd' bulunamadı.\n  Otomatik kurmak için: $0 --install-deps\n  Manuel: $(install_hint "$cmd")"
    fi
  fi
}

# ── Rust kontrolü ────────────────────────────────────────────────────────────
check_rust() {
  if command -v cargo >/dev/null 2>&1; then
    local v; v=$(rustc --version 2>/dev/null | awk '{print $2}')
    success "Rust $v mevcut"
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
    warn "Rust kurmak için: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    return 1
  fi
}

# ── Binary indirme ────────────────────────────────────────────────────────────
download_binary() {
  local version="$1" install_dir="${2:-$HOME/.local/bin}"
  local binary_name="nanonet-agent"
  if [[ "$version" == "latest" ]]; then
    spinner_start "GitHub'dan son sürüm sorgulanıyor..."
    version=$(curl -sf "https://api.github.com/repos/$GITHUB_REPO/releases/latest" \
      | jq -r '.tag_name' 2>/dev/null) || true
    spinner_stop
    [[ -z "$version" || "$version" == "null" ]] && { warn "GitHub release bulunamadı."; return 1; }
  fi
  local base_url="https://github.com/$GITHUB_REPO/releases/download/$version"
  local archive="${binary_name}-${BINARY_TARGET}.tar.gz"
  local tmpdir; tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT
  spinner_start "İndiriliyor: $binary_name $version ($BINARY_TARGET)..."
  if ! curl -fsSL "$base_url/$archive" -o "$tmpdir/$archive" 2>/dev/null; then
    spinner_stop
    warn "Binary indirilemedi."
    rm -rf "$tmpdir"; return 1
  fi
  spinner_stop
  if curl -fsSL "$base_url/${archive}.sha256" -o "$tmpdir/${archive}.sha256" 2>/dev/null; then
    local expected actual
    expected=$(awk '{print $1}' "$tmpdir/${archive}.sha256")
    if command -v sha256sum >/dev/null 2>&1; then
      actual=$(sha256sum "$tmpdir/$archive" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
      actual=$(shasum -a 256 "$tmpdir/$archive" | awk '{print $1}')
    fi
    if [[ -n "${actual:-}" && "$expected" != "$actual" ]]; then
      rm -rf "$tmpdir"
      error "Checksum doğrulaması başarısız!\n  Beklenen: $expected\n  Gerçek:   $actual"
    fi
    success "Checksum doğrulandı"
  else
    warn "Checksum dosyası bulunamadı — doğrulama atlandı"
  fi
  mkdir -p "$install_dir"
  tar -xzf "$tmpdir/$archive" -C "$tmpdir"
  chmod +x "$tmpdir/$binary_name"
  mv "$tmpdir/$binary_name" "$install_dir/$binary_name"
  rm -rf "$tmpdir"; trap - EXIT
  if ! echo "$PATH" | grep -q "$install_dir"; then
    warn "$install_dir PATH'inizde değil."
    case "$SHELL" in
      */zsh)  echo "  echo 'export PATH=\"$install_dir:\$PATH\"' >> ~/.zshrc && source ~/.zshrc" ;;
      */fish) echo "  fish_add_path $install_dir" ;;
      *)      echo "  echo 'export PATH=\"$install_dir:\$PATH\"' >> ~/.bashrc && source ~/.bashrc" ;;
    esac
  fi
  success "Binary kuruldu: $install_dir/$binary_name"
}

# ── Agent başlatma ────────────────────────────────────────────────────────────
start_agent() {
  local svc_id="$1" svc_name="$2" agent_token="$3"
  local svc_host="$4" svc_port="$5" svc_endpoint="${6:-/health}"
  local svc_poll="${7:-10}" metrics_url="${8:-}"

  local agent_bin; agent_bin=$(find_agent_bin)
  if [[ -z "$agent_bin" ]]; then
    warn "Agent binary bulunamadı. Derleniyor..."
    if [[ -f "$SCRIPT_DIR/agent/Cargo.toml" ]]; then
      spinner_start "Derleniyor..."
      (cd "$SCRIPT_DIR" && cargo build --release --manifest-path agent/Cargo.toml -q) && spinner_stop \
        || { spinner_stop; error "Derleme başarısız."; }
      agent_bin="$SCRIPT_DIR/agent/target/release/nanonet-agent"
    else
      error "Agent binary veya kaynak kodu bulunamadı."
    fi
  fi

  if agent_running "$svc_id"; then
    local old_pid; old_pid=$(agent_pid "$svc_id")
    warn "Bu servis için agent zaten çalışıyor (PID: $old_pid). Önce durduruluyor..."
    stop_agent "$svc_id"
    sleep 1
  fi

  local ws_backend; ws_backend=$(echo "$BACKEND_URL" | sed 's|^http://|ws://|;s|^https://|wss://|')
  mkdir -p "$LOGS_DIR"
  local log_f; log_f=$(log_file "$svc_id")

  if [[ "$OPT_DRY_RUN" == true ]]; then
    info "[dry-run] Agent başlatılmayacak: $svc_id ($svc_name)"
    return 0
  fi

  local env_pairs=(
    "NANONET_BACKEND=$ws_backend"
    "NANONET_SERVICE_ID=$svc_id"
    "NANONET_TOKEN=$agent_token"
    "NANONET_AGENT_TOKEN=$agent_token"
    "NANONET_HOST=$svc_host"
    "NANONET_PORT=$svc_port"
    "NANONET_HEALTH_ENDPOINT=$svc_endpoint"
    "NANONET_POLL_INTERVAL=$svc_poll"
  )
  [[ -n "$metrics_url" ]] && env_pairs+=("NANONET_METRICS_ENDPOINT=$metrics_url")
  save_agent_env "$svc_id" "${env_pairs[@]}"

  env "${env_pairs[@]}" "$agent_bin" >> "$log_f" 2>&1 &
  local pid=$!
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    save_agent_pid "$svc_id" "$pid"
    success "Agent başlatıldı: ${BOLD}$svc_name${NC} (PID: $pid)"
    debug "Log: $log_f"
    return 0
  else
    warn "Agent başlatılamadı. Log: $log_f"
    tail -5 "$log_f" 2>/dev/null | while read -r l; do warn "  $l"; done
    return 1
  fi
}

# ── Agent durdurma ────────────────────────────────────────────────────────────
stop_agent() {
  local svc_id="$1"
  local pid; pid=$(agent_pid "$svc_id")
  if [[ -z "$pid" ]]; then
    warn "Agent PID bulunamadı: $svc_id"
    return 0
  fi
  if kill -0 "$pid" 2>/dev/null; then
    if [[ "$OPT_DRY_RUN" == true ]]; then
      info "[dry-run] Agent durdurulmayacak (PID: $pid)"
      return 0
    fi
    kill -TERM "$pid" 2>/dev/null || true
    local i=0
    while kill -0 "$pid" 2>/dev/null && [[ $i -lt 10 ]]; do
      sleep 0.5; i=$((i+1))
    done
    kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" 2>/dev/null || true
    success "Agent durduruldu (PID: $pid)"
  else
    warn "Agent zaten çalışmıyor (stale PID: $pid)"
  fi
  remove_agent_pid "$svc_id"
}

# ── Sürüm kontrolü ───────────────────────────────────────────────────────────
check_latest_version() {
  local current_ver latest_ver
  current_ver=$(nanonet-agent --version 2>/dev/null | awk '{print $2}' || echo "unknown")
  latest_ver=$(curl -sf --max-time 5 "https://api.github.com/repos/$GITHUB_REPO/releases/latest" \
    | jq -r '.tag_name' 2>/dev/null || echo "")
  if [[ -n "$latest_ver" && "$latest_ver" != "null" && "$latest_ver" != "v$current_ver" && "$latest_ver" != "$current_ver" ]]; then
    warn "Yeni sürüm mevcut: $latest_ver (mevcut: $current_ver)"
    warn "Güncellemek için: $0 update"
  fi
}

# ── Özet tablosu ─────────────────────────────────────────────────────────────
print_summary_table() {
  local -n rows_ref=$1
  local header="${2:-}"
  [[ "$OPT_QUIET" == true ]] && return
  [[ -n "$header" ]] && echo -e "\n${BOLD}$header${NC}"
  printf "${BOLD}%-38s %-20s %-8s %-12s %-10s${NC}\n" "Servis ID" "Ad" "PID" "Token Süresi" "Durum"
  printf '%s\n' "$(printf '─%.0s' {1..95})"
  for row in "${rows_ref[@]}"; do
    IFS='|' read -r sid sname spid sttl sstatus <<< "$row"
    local status_color="$NC"
    case "$sstatus" in
      çalışıyor) status_color="$GREEN" ;;
      durdu)     status_color="$RED" ;;
      *)         status_color="$YELLOW" ;;
    esac
    printf "%-38s %-20s %-8s %-12s ${status_color}%-10s${NC}\n" \
      "$sid" "${sname:0:18}" "$spid" "$sttl" "$sstatus"
  done
  echo ""
}

# ── Kimlik doğrulama ─────────────────────────────────────────────────────────
do_auth() {
  local cached_access="" cached_agent="" cached_email=""
  if [[ -f "$ENV_FILE" ]]; then
    cached_access=$(grep "^ACCESS_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
    cached_agent=$(grep  "^AGENT_TOKEN="  "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
    cached_email=$(grep  "^AGENT_EMAIL="  "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
  fi

  # Token expiry uyarısı
  if [[ -n "$cached_access" ]]; then
    local ttl; ttl=$(token_ttl "$cached_access")
    if [[ "$ttl" -gt 0 && "$ttl" -lt 3600 ]]; then
      warn "Access token $(ttl_human "$ttl") içinde sona erecek!"
    elif [[ "$ttl" -le 0 ]]; then
      warn "Access token süresi dolmuş. Yeniden giriş gerekiyor."
      cached_access=""
    fi
  fi

  ACCESS_TOKEN=""
  if [[ -n "$cached_access" && "$(token_valid "$cached_access")" == "1" ]]; then
    info "Kayıtlı token test ediliyor${cached_email:+ (${cached_email})}..."
    spinner_start "Doğrulanıyor..."
    local test_resp
    test_resp=$(http_get "$BACKEND_URL/api/v1/services" "$cached_access" 2>/dev/null || true)
    spinner_stop
    if echo "$test_resp" | jq -e '.success == true' >/dev/null 2>&1; then
      success "Token geçerli — giriş atlanıyor ($(ttl_human "$(token_ttl "$cached_access")") kaldı)"
      ACCESS_TOKEN="$cached_access"
      AGENT_TOKEN="${cached_agent:-}"
      return 0
    else
      warn "Token reddedildi, yeniden giriş gerekiyor"
    fi
  fi

  # Giriş / kayıt
  if [[ "$OPT_YES" == true ]]; then
    error "Non-interactive modda geçerli token bulunamadı. Önce interaktif modda çalıştırın."
  fi

  echo ""
  echo -e "${BOLD}Hesap seçin:${NC}"
  echo "  1) Yeni hesap oluştur"
  echo "  2) Mevcut hesaba giriş yap"
  local auth_mode
  read -rp "Seçim [1/2]: " auth_mode
  echo ""

  local email password
  if [[ -n "$cached_email" ]]; then
    read -rp "E-posta [$cached_email]: " email
    email="${email:-$cached_email}"
  else
    read -rp "E-posta: " email
  fi
  read -rsp "Şifre (min 12 karakter): " password; echo ""

  # Şifre strength kontrolü
  if [[ ${#password} -lt 12 ]]; then
    error "Şifre en az 12 karakter olmalıdır."
  fi
  local has_upper has_lower has_digit
  has_upper=$(echo "$password" | grep -c '[A-Z]' || true)
  has_lower=$(echo "$password" | grep -c '[a-z]' || true)
  has_digit=$(echo "$password" | grep -c '[0-9]' || true)
  [[ "$has_upper" -eq 0 || "$has_lower" -eq 0 || "$has_digit" -eq 0 ]] && \
    warn "Şifre büyük harf, küçük harf ve rakam içerirse daha güvenli olur."

  local auth_resp http_code
  if [[ "$auth_mode" == "1" ]]; then
    spinner_start "Kayıt yapılıyor..."
    auth_resp=$(http_post "$BACKEND_URL/api/v1/auth/register" "" \
      "{\"email\":\"$email\",\"password\":\"$password\"}" 2>/dev/null) || true
    spinner_stop
    if ! echo "$auth_resp" | jq -e '.success' >/dev/null 2>&1; then
      warn "Kayıt başarısız, giriş deneniyor..."
      auth_mode="2"
    fi
  fi

  if [[ "$auth_mode" == "2" ]]; then
    spinner_start "Giriş yapılıyor..."
    local tmp_file; tmp_file=$(mktemp)
    http_code=$(curl -s -o "$tmp_file" -w "%{http_code}" --max-time 10 \
      -X POST "$BACKEND_URL/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"$password\"}" 2>/dev/null || echo "000")
    auth_resp=$(cat "$tmp_file" 2>/dev/null || true)
    rm -f "$tmp_file"
    spinner_stop
    if [[ "$http_code" != "200" ]]; then
      local err_msg; err_msg=$(echo "$auth_resp" | jq -r '.error // .message // "E-posta veya şifre yanlış"' 2>/dev/null || true)
      error "Giriş başarısız ($http_code): $err_msg"
    fi
  fi

  ACCESS_TOKEN=$(echo "$auth_resp" | jq -r '.data.tokens.access_token // .data.tokens.AccessToken // empty')
  local refresh_token; refresh_token=$(echo "$auth_resp" | jq -r '.data.tokens.refresh_token // empty')
  [[ -z "$ACCESS_TOKEN" ]] && error "Token alınamadı. Yanıt: $auth_resp"
  success "Kimlik doğrulama başarılı"

  update_env "AGENT_EMAIL"    "$email"
  update_env "ACCESS_TOKEN"   "$ACCESS_TOKEN"
  [[ -n "$refresh_token" ]] && update_env "REFRESH_TOKEN" "$refresh_token"

  # Agent token al
  spinner_start "Agent token alınıyor (uzun ömürlü)..."
  local agent_token_resp
  agent_token_resp=$(http_post "$BACKEND_URL/api/v1/auth/agent-token" "$ACCESS_TOKEN" "{}" 2>/dev/null || true)
  spinner_stop
  AGENT_TOKEN=$(echo "$agent_token_resp" | jq -r '.data.agent_token // empty' 2>/dev/null || true)
  if [[ -z "$AGENT_TOKEN" ]]; then
    warn "Agent token alınamadı, access token kullanılacak (24 saat geçerli)"
    AGENT_TOKEN="$ACCESS_TOKEN"
  else
    success "Agent token alındı ($(ttl_human "$(token_ttl "$AGENT_TOKEN")") geçerli)"
  fi
  update_env "AGENT_TOKEN" "$AGENT_TOKEN"
}

# ── Servis listesi al ─────────────────────────────────────────────────────────
fetch_services() {
  local token="$1"
  local resp; resp=$(http_get "$BACKEND_URL/api/v1/services" "$token" 2>/dev/null) || \
    error "Servis listesi alınamadı."
  echo "$resp"
}

# ── Servis seçimi (tekli veya çoklu) ─────────────────────────────────────────
select_services() {
  local svc_resp="$1"
  local svc_count; svc_count=$(echo "$svc_resp" | jq '.data | length')

  if [[ "$OPT_JSON" == true ]]; then
    echo "$svc_resp" | jq '.data[]'
    return
  fi

  echo ""
  echo -e "${BOLD}Servis seçin${NC} ${DIM}(birden fazla için: 1,3,5 veya 'a' tümü)${NC}"
  echo ""

  if [[ "$svc_count" -gt 0 ]]; then
    local i=0
    while IFS= read -r svc; do
      i=$((i+1))
      local sid sname sstatus shost sport
      sid=$(echo "$svc" | jq -r '.id')
      sname=$(echo "$svc" | jq -r '.name')
      sstatus=$(echo "$svc" | jq -r '.status')
      shost=$(echo "$svc" | jq -r '.host')
      sport=$(echo "$svc" | jq -r '.port')

      # Latency önizlemesi
      local latency_str=""
      local lat_resp
      lat_resp=$(curl -sf --max-time 1 "http://$shost:$sport/health" 2>/dev/null | jq -r '.latency_ms // empty' 2>/dev/null || true)
      [[ -n "$lat_resp" ]] && latency_str=" | ${lat_resp}ms"

      local status_icon
      case "$sstatus" in
        up)       status_icon="${GREEN}●${NC}" ;;
        down)     status_icon="${RED}●${NC}" ;;
        degraded) status_icon="${YELLOW}●${NC}" ;;
        *)        status_icon="${DIM}●${NC}" ;;
      esac

      printf "  %s %2d) %-30s ${DIM}%s${NC}%s\n" \
        "$(echo -e "$status_icon")" "$i" "$sname" "${sid:0:8}…" "$latency_str"
    done < <(echo "$svc_resp" | jq -c '.data[]')
    echo ""
    printf "  %3d) ${CYAN}+ Yeni servis oluştur${NC}\n" "$((svc_count + 1))"
  else
    echo -e "  ${DIM}(Henüz servis yok)${NC}"
  fi

  echo ""

  # Servis arama
  local search_term=""
  if [[ "$svc_count" -gt 5 && "$OPT_YES" == false ]]; then
    read -rp "  Filtrele (boş=tümü): " search_term
  fi

  local choice
  if [[ "$OPT_YES" == true ]]; then
    choice="1"
    info "Non-interactive mod: ilk servis seçildi"
  else
    read -rp "  Seçim [1-$((svc_count + 1))]: " choice
  fi
  echo ""

  SELECTED_SERVICE_IDS=()
  SELECTED_SERVICE_NAMES=()
  SELECTED_SERVICE_HOSTS=()
  SELECTED_SERVICE_PORTS=()
  SELECTED_SERVICE_ENDPOINTS=()
  SELECTED_SERVICE_POLLS=()
  SELECTED_METRICS_URLS=()

  if [[ "$choice" == "a" || "$choice" == "A" ]]; then
    # Tümünü seç
    local j=0
    while IFS= read -r svc; do
      _add_service_from_json "$svc"
      j=$((j+1))
    done < <(echo "$svc_resp" | jq -c '.data[]')
    info "$j servis seçildi"
  else
    # Virgülle ayrılmış seçimler
    IFS=',' read -ra choices <<< "$choice"
    for c in "${choices[@]}"; do
      c="${c// /}"
      if [[ "$c" -le "$svc_count" && "$svc_count" -gt 0 ]]; then
        local idx=$(( c - 1 ))
        local svc; svc=$(echo "$svc_resp" | jq -c --argjson i "$idx" '.data[$i]')
        _add_service_from_json "$svc"
      elif [[ "$c" -eq "$((svc_count + 1))" ]]; then
        _create_new_service
      fi
    done
  fi
}

_add_service_from_json() {
  local svc="$1"
  local sid sname shost sport sendpoint spoll
  sid=$(echo "$svc" | jq -r '.id')
  sname=$(echo "$svc" | jq -r '.name')
  shost=$(echo "$svc" | jq -r '.host')
  sport=$(echo "$svc" | jq -r '.port')
  sendpoint=$(echo "$svc" | jq -r '.health_endpoint')
  spoll=$(echo "$svc" | jq -r '.poll_interval_sec')

  # /metrics endpoint kontrol
  local metrics_url="http://${shost}:${sport}/metrics"
  curl -sf --max-time 2 "$metrics_url" >/dev/null 2>&1 || metrics_url=""

  SELECTED_SERVICE_IDS+=("$sid")
  SELECTED_SERVICE_NAMES+=("$sname")
  SELECTED_SERVICE_HOSTS+=("$shost")
  SELECTED_SERVICE_PORTS+=("$sport")
  SELECTED_SERVICE_ENDPOINTS+=("$sendpoint")
  SELECTED_SERVICE_POLLS+=("$spoll")
  SELECTED_METRICS_URLS+=("$metrics_url")
  success "Seçildi: $sname ${DIM}(${sid:0:8}…)${NC}"
}

_create_new_service() {
  echo -e "${BOLD}Yeni servis bilgileri:${NC}"
  local sname shost sport sendpoint spoll
  read -rp "  Servis adı           : " sname
  read -rp "  İzlenecek host       : " shost
  read -rp "  İzlenecek port       : " sport
  read -rp "  Health endpoint [/health]: " sendpoint
  sendpoint="${sendpoint:-/health}"
  read -rp "  Metrik aralığı (s) [10]: " spoll
  spoll="${spoll:-10}"

  spinner_start "Servis oluşturuluyor..."
  local create_resp
  create_resp=$(http_post "$BACKEND_URL/api/v1/services" "$ACCESS_TOKEN" \
    "{\"name\":\"$sname\",\"host\":\"$shost\",\"port\":$sport,\"health_endpoint\":\"$sendpoint\",\"poll_interval_sec\":$spoll}") \
    || { spinner_stop; error "Servis oluşturulamadı."; }
  spinner_stop
  local sid; sid=$(echo "$create_resp" | jq -r '.data.id // empty')
  [[ -z "$sid" ]] && error "Servis ID alınamadı."
  success "Servis oluşturuldu: $sid"

  local metrics_url="http://${shost}:${sport}/metrics"
  curl -sf --max-time 2 "$metrics_url" >/dev/null 2>&1 || metrics_url=""

  SELECTED_SERVICE_IDS+=("$sid")
  SELECTED_SERVICE_NAMES+=("$sname")
  SELECTED_SERVICE_HOSTS+=("$shost")
  SELECTED_SERVICE_PORTS+=("$sport")
  SELECTED_SERVICE_ENDPOINTS+=("$sendpoint")
  SELECTED_SERVICE_POLLS+=("$spoll")
  SELECTED_METRICS_URLS+=("$metrics_url")
}

# ── Systemd / launchd kurulumu ────────────────────────────────────────────────
install_systemd_service() {
  local svc_id="$1" svc_name="$2" agent_token="$3"
  local svc_host="$4" svc_port="$5" svc_endpoint="${6:-/health}" svc_poll="${7:-10}"
  local agent_bin; agent_bin=$(find_agent_bin)
  [[ -z "$agent_bin" ]] && error "Agent binary bulunamadı."
  local ws_backend; ws_backend=$(echo "$BACKEND_URL" | sed 's|^http://|ws://|;s|^https://|wss://|')
  local unit_name="nanonet-agent-${svc_id:0:8}"
  local unit_file="/etc/systemd/system/${unit_name}.service"

  if [[ "$OPT_DRY_RUN" == true ]]; then
    info "[dry-run] Systemd unit oluşturulmayacak: $unit_file"
    return 0
  fi

  sudo tee "$unit_file" > /dev/null <<EOF
[Unit]
Description=NanoNet Agent - $svc_name
After=network.target

[Service]
Type=simple
Restart=always
RestartSec=10
Environment=NANONET_BACKEND=$ws_backend
Environment=NANONET_SERVICE_ID=$svc_id
Environment=NANONET_TOKEN=$agent_token
Environment=NANONET_AGENT_TOKEN=$agent_token
Environment=NANONET_HOST=$svc_host
Environment=NANONET_PORT=$svc_port
Environment=NANONET_HEALTH_ENDPOINT=$svc_endpoint
Environment=NANONET_POLL_INTERVAL=$svc_poll
ExecStart=$agent_bin
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$unit_name

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable "$unit_name"
  if [[ "$OPT_AUTOSTART" == true ]]; then
    sudo systemctl start "$unit_name"
    success "Systemd servisi başlatıldı: $unit_name"
  else
    success "Systemd servisi kuruldu: $unit_name"
    info "Başlatmak için: sudo systemctl start $unit_name"
  fi
}

install_launchd_service() {
  local svc_id="$1" svc_name="$2" agent_token="$3"
  local svc_host="$4" svc_port="$5" svc_endpoint="${6:-/health}" svc_poll="${7:-10}"
  local agent_bin; agent_bin=$(find_agent_bin)
  [[ -z "$agent_bin" ]] && error "Agent binary bulunamadı."
  local ws_backend; ws_backend=$(echo "$BACKEND_URL" | sed 's|^http://|ws://|;s|^https://|wss://|')
  local label="com.nanonet.agent.${svc_id:0:8}"
  local plist="$HOME/Library/LaunchAgents/${label}.plist"

  if [[ "$OPT_DRY_RUN" == true ]]; then
    info "[dry-run] launchd plist oluşturulmayacak: $plist"
    return 0
  fi

  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array><string>$agent_bin</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NANONET_BACKEND</key><string>$ws_backend</string>
    <key>NANONET_SERVICE_ID</key><string>$svc_id</string>
    <key>NANONET_TOKEN</key><string>$agent_token</string>
    <key>NANONET_HOST</key><string>$svc_host</string>
    <key>NANONET_PORT</key><string>$svc_port</string>
    <key>NANONET_HEALTH_ENDPOINT</key><string>$svc_endpoint</string>
    <key>NANONET_POLL_INTERVAL</key><string>$svc_poll</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$(log_file "$svc_id")</string>
  <key>StandardErrorPath</key><string>$(log_file "$svc_id")</string>
</dict>
</plist>
EOF
  launchctl load "$plist"
  success "launchd servisi kuruldu: $label"
}

# ════════════════════════════════════════════════════════════════════════════
# ── SUBKOMUTLAR ──────────────────────────────────────────────────────────────
# ════════════════════════════════════════════════════════════════════════════

cmd_status() {
  local tracked=()
  while IFS= read -r sid; do
    [[ -n "$sid" ]] && tracked+=("$sid")
  done < <(list_tracked_agents)

  if [[ "$OPT_JSON" == true ]]; then
    local json_arr="["
    local first=true
    for sid in "${tracked[@]}"; do
      local pid; pid=$(agent_pid "$sid")
      local running="false"
      kill -0 "$pid" 2>/dev/null && running="true"
      local ttl_str="?"
      local env_data; env_data=$(load_agent_env "$sid")
      local agent_tok; agent_tok=$(echo "$env_data" | grep "^NANONET_TOKEN=" | cut -d= -f2- || true)
      [[ -n "$agent_tok" ]] && ttl_str=$(ttl_human "$(token_ttl "$agent_tok")")
      [[ "$first" == true ]] && first=false || json_arr+=","
      json_arr+="{\"service_id\":\"$sid\",\"pid\":\"$pid\",\"running\":$running,\"token_ttl\":\"$ttl_str\"}"
    done
    json_arr+="]"
    echo "$json_arr"
    return
  fi

  if [[ ${#tracked[@]} -eq 0 ]]; then
    info "Takip edilen agent bulunamadı."
    info "Agent başlatmak için: $0"
    return
  fi

  local table_rows=()
  for sid in "${tracked[@]}"; do
    local pid; pid=$(agent_pid "$sid")
    local status="durdu"
    kill -0 "$pid" 2>/dev/null && status="çalışıyor"
    local ttl_str="?"
    local env_data; env_data=$(load_agent_env "$sid")
    local agent_tok; agent_tok=$(echo "$env_data" | grep "^NANONET_TOKEN=" | cut -d= -f2- || true)
    [[ -n "$agent_tok" ]] && ttl_str=$(ttl_human "$(token_ttl "$agent_tok")")
    table_rows+=("${sid}|${sid:0:12}…|${pid:-—}|${ttl_str}|${status}")
  done
  print_summary_table table_rows "Çalışan Agent'lar"
  echo -e "  Loglar: ${DIM}$LOGS_DIR/<service_id>.log${NC}"
}

cmd_stop() {
  local target="${SUBCOMMAND_ARG:-all}"
  if [[ "$target" == "all" ]]; then
    local stopped=0
    while IFS= read -r sid; do
      [[ -n "$sid" ]] || continue
      stop_agent "$sid"
      stopped=$((stopped+1))
    done < <(list_tracked_agents)
    [[ "$stopped" -eq 0 ]] && info "Durdurulacak agent bulunamadı."
  else
    if agent_running "$target"; then
      stop_agent "$target"
    else
      warn "Agent çalışmıyor: $target"
      remove_agent_pid "$target"
    fi
  fi
}

cmd_restart() {
  local target="${SUBCOMMAND_ARG:-all}"
  local sids=()
  if [[ "$target" == "all" ]]; then
    while IFS= read -r sid; do [[ -n "$sid" ]] && sids+=("$sid"); done < <(list_tracked_agents)
  else
    sids=("$target")
  fi

  for sid in "${sids[@]}"; do
    local env_data; env_data=$(load_agent_env "$sid")
    if [[ -z "$env_data" ]]; then
      warn "Agent env verisi bulunamadı: $sid — yeniden kurulum gerekebilir."
      continue
    fi
    stop_agent "$sid"
    sleep 1
    # Env'den değerleri oku
    local tok host port endpoint poll metrics_url
    tok=$(echo "$env_data"         | grep "^NANONET_TOKEN="              | cut -d= -f2- || true)
    host=$(echo "$env_data"        | grep "^NANONET_HOST="               | cut -d= -f2- || true)
    port=$(echo "$env_data"        | grep "^NANONET_PORT="               | cut -d= -f2- || true)
    endpoint=$(echo "$env_data"    | grep "^NANONET_HEALTH_ENDPOINT="    | cut -d= -f2- || true)
    poll=$(echo "$env_data"        | grep "^NANONET_POLL_INTERVAL="      | cut -d= -f2- || true)
    metrics_url=$(echo "$env_data" | grep "^NANONET_METRICS_ENDPOINT="   | cut -d= -f2- || true)
    start_agent "$sid" "$sid" "$tok" "$host" "$port" "${endpoint:-/health}" "${poll:-10}" "${metrics_url:-}"
  done
}

cmd_logs() {
  local target="${SUBCOMMAND_ARG:-}"
  if [[ -z "$target" ]]; then
    # İlk çalışan agent'ı bul
    while IFS= read -r sid; do
      [[ -n "$sid" ]] && { target="$sid"; break; }
    done < <(list_tracked_agents)
  fi
  [[ -z "$target" ]] && error "Log görüntülenecek agent bulunamadı."
  local log_f; log_f=$(log_file "$target")
  [[ ! -f "$log_f" ]] && error "Log dosyası bulunamadı: $log_f"
  info "Log: $log_f  (Ctrl+C ile çık)"
  tail -f "$log_f"
}

cmd_add_service() {
  step "Servis ekleniyor..."
  check_and_install curl curl
  check_and_install jq jq

  # Mevcut token'ı yükle
  local access_tok agent_tok
  access_tok=$(grep "^ACCESS_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
  agent_tok=$(grep  "^AGENT_TOKEN="  "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)

  if [[ -z "$access_tok" || "$(token_valid "$access_tok")" != "1" ]]; then
    warn "Geçerli token bulunamadı. Yeniden giriş gerekiyor."
    ACCESS_TOKEN=""; AGENT_TOKEN=""
    do_auth
    access_tok="$ACCESS_TOKEN"
    agent_tok="${AGENT_TOKEN:-$ACCESS_TOKEN}"
  fi

  local svc_resp; svc_resp=$(fetch_services "$access_tok")
  SELECTED_SERVICE_IDS=(); SELECTED_SERVICE_NAMES=(); SELECTED_SERVICE_HOSTS=()
  SELECTED_SERVICE_PORTS=(); SELECTED_SERVICE_ENDPOINTS=(); SELECTED_SERVICE_POLLS=()
  SELECTED_METRICS_URLS=()
  select_services "$svc_resp"

  local i
  for i in "${!SELECTED_SERVICE_IDS[@]}"; do
    local sid="${SELECTED_SERVICE_IDS[$i]}"
    start_agent "$sid" "${SELECTED_SERVICE_NAMES[$i]}" "$agent_tok" \
      "${SELECTED_SERVICE_HOSTS[$i]}" "${SELECTED_SERVICE_PORTS[$i]}" \
      "${SELECTED_SERVICE_ENDPOINTS[$i]}" "${SELECTED_SERVICE_POLLS[$i]}" \
      "${SELECTED_METRICS_URLS[$i]}"
    update_env "AGENT_SERVICE_ID" "$sid"
    update_env "AGENT_TOKEN"      "$agent_tok"
    update_env "AGENT_TARGET_HOST"     "${SELECTED_SERVICE_HOSTS[$i]}"
    update_env "AGENT_TARGET_PORT"     "${SELECTED_SERVICE_PORTS[$i]}"
    update_env "AGENT_HEALTH_ENDPOINT" "${SELECTED_SERVICE_ENDPOINTS[$i]}"
    update_env "AGENT_POLL_INTERVAL"   "${SELECTED_SERVICE_POLLS[$i]}"
  done
}

cmd_refresh_token() {
  step "Token yenileniyor..."
  local refresh_tok
  refresh_tok=$(grep "^REFRESH_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)

  if [[ -n "$refresh_tok" && "$(token_valid "$refresh_tok")" == "1" ]]; then
    spinner_start "Refresh token ile yenileniyor..."
    local resp
    resp=$(http_post "$BACKEND_URL/api/v1/auth/refresh" "" \
      "{\"refresh_token\":\"$refresh_tok\"}" 2>/dev/null) || true
    spinner_stop
    local new_access; new_access=$(echo "$resp" | jq -r '.data.access_token // .data.tokens.access_token // empty' 2>/dev/null || true)
    if [[ -n "$new_access" ]]; then
      update_env "ACCESS_TOKEN" "$new_access"
      success "Access token yenilendi ($(ttl_human "$(token_ttl "$new_access")") geçerli)"
      local new_agent
      new_agent=$(http_post "$BACKEND_URL/api/v1/auth/agent-token" "$new_access" "{}" 2>/dev/null \
        | jq -r '.data.agent_token // empty' || true)
      if [[ -n "$new_agent" ]]; then
        update_env "AGENT_TOKEN" "$new_agent"
        success "Agent token yenilendi ($(ttl_human "$(token_ttl "$new_agent")") geçerli)"
      fi
      return 0
    fi
  fi

  warn "Refresh token kullanılamadı. Yeniden giriş gerekiyor."
  ACCESS_TOKEN=""; AGENT_TOKEN=""
  do_auth
  success "Token başarıyla yenilendi"
}

cmd_validate() {
  step ".env doğrulanıyor: $ENV_FILE"
  local errors=0 warnings=0

  [[ ! -f "$ENV_FILE" ]] && error ".env dosyası bulunamadı: $ENV_FILE"

  check_field() {
    local key="$1" label="$2" required="${3:-false}"
    local val; val=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
    if [[ -z "$val" ]]; then
      if [[ "$required" == true ]]; then
        echo -e "  ${RED}✖${NC} $label ($key): eksik (zorunlu)"
        errors=$((errors+1))
      else
        echo -e "  ${YELLOW}⚠${NC} $label ($key): tanımlanmamış"
        warnings=$((warnings+1))
      fi
    else
      echo -e "  ${GREEN}✔${NC} $label ($key): tanımlı"
    fi
  }

  check_field "DATABASE_URL"   "Veritabanı URL"     true
  check_field "JWT_SECRET"     "JWT Secret"         true
  check_field "AGENT_SERVICE_ID" "Agent Servis ID"  false
  check_field "AGENT_TOKEN"    "Agent Token"        false
  check_field "AGENT_TARGET_HOST" "Hedef Host"      false
  check_field "AGENT_TARGET_PORT" "Hedef Port"      false

  # Token geçerlilik kontrolü
  local access_tok; access_tok=$(grep "^ACCESS_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
  if [[ -n "$access_tok" ]]; then
    local ttl; ttl=$(token_ttl "$access_tok")
    if [[ "$ttl" -le 0 ]]; then
      echo -e "  ${RED}✖${NC} ACCESS_TOKEN: süresi dolmuş — yenile: $0 refresh-token"
      errors=$((errors+1))
    elif [[ "$ttl" -lt 3600 ]]; then
      echo -e "  ${YELLOW}⚠${NC} ACCESS_TOKEN: $(ttl_human "$ttl") içinde sona erecek"
      warnings=$((warnings+1))
    else
      echo -e "  ${GREEN}✔${NC} ACCESS_TOKEN: geçerli ($(ttl_human "$ttl") kaldı)"
    fi
  fi

  local agent_tok; agent_tok=$(grep "^AGENT_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
  if [[ -n "$agent_tok" ]]; then
    local ttl; ttl=$(token_ttl "$agent_tok")
    if [[ "$ttl" -le 0 ]]; then
      echo -e "  ${RED}✖${NC} AGENT_TOKEN: süresi dolmuş — yenile: $0 refresh-token"
      errors=$((errors+1))
    else
      echo -e "  ${GREEN}✔${NC} AGENT_TOKEN: geçerli ($(ttl_human "$ttl") kaldı)"
    fi
  fi

  # JWT secret uzunluk kontrolü
  local jwt; jwt=$(grep "^JWT_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
  if [[ -n "$jwt" && ${#jwt} -lt 32 ]]; then
    echo -e "  ${RED}✖${NC} JWT_SECRET: 32 karakterden kısa (güvenlik riski)"
    errors=$((errors+1))
  fi

  echo ""
  if [[ "$errors" -gt 0 ]]; then
    echo -e "  ${RED}$errors hata, $warnings uyarı bulundu.${NC}"
    [[ "$OPT_JSON" == true ]] && json_out "error" "$errors hata bulundu" "{\"errors\":$errors,\"warnings\":$warnings}"
    return 1
  elif [[ "$warnings" -gt 0 ]]; then
    echo -e "  ${YELLOW}$warnings uyarı bulundu, hata yok.${NC}"
  else
    success "Tüm kontroller geçti."
  fi
  [[ "$OPT_JSON" == true ]] && json_out "ok" "doğrulama başarılı" "{\"errors\":$errors,\"warnings\":$warnings}"
}

cmd_update() {
  step "Binary güncelleniyor..."
  detect_platform
  download_binary "$OPT_VERSION" "$HOME/.local/bin"
  # Çalışan agent'ları yeniden başlat
  local any=false
  while IFS= read -r sid; do
    [[ -n "$sid" ]] || continue
    any=true
    info "Agent yeniden başlatılıyor: $sid"
    cmd_restart_single "$sid"
  done < <(list_tracked_agents)
  [[ "$any" == true ]] && success "Tüm agent'lar güncellendi ve yeniden başlatıldı."
}

cmd_restart_single() {
  local sid="$1"
  local old_subarg="$SUBCOMMAND_ARG"
  SUBCOMMAND_ARG="$sid"
  cmd_restart
  SUBCOMMAND_ARG="$old_subarg"
}

cmd_install_service() {
  step "Sistem servisi olarak kuruluyor..."
  local access_tok; access_tok=$(grep "^ACCESS_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
  local agent_tok; agent_tok=$(grep "^AGENT_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)

  [[ -z "$agent_tok" ]] && error "AGENT_TOKEN .env'de bulunamadı. Önce kurulum yapın."

  local svc_id; svc_id=$(grep "^AGENT_SERVICE_ID=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
  local svc_host; svc_host=$(grep "^AGENT_TARGET_HOST=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
  local svc_port; svc_port=$(grep "^AGENT_TARGET_PORT=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
  local svc_endpoint; svc_endpoint=$(grep "^AGENT_HEALTH_ENDPOINT=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || echo "/health")
  local svc_poll; svc_poll=$(grep "^AGENT_POLL_INTERVAL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || echo "10")

  [[ -z "$svc_id" ]] && error "AGENT_SERVICE_ID .env'de bulunamadı."

  if [[ "$OS" == "linux" ]]; then
    if command -v systemctl >/dev/null 2>&1; then
      install_systemd_service "$svc_id" "nanonet-agent" "$agent_tok" "$svc_host" "$svc_port" "$svc_endpoint" "$svc_poll"
    else
      error "systemctl bulunamadı. Manuel kurulum gerekiyor."
    fi
  elif [[ "$OS" == "darwin" ]]; then
    install_launchd_service "$svc_id" "nanonet-agent" "$agent_tok" "$svc_host" "$svc_port" "$svc_endpoint" "$svc_poll"
  else
    error "Bu platform için otomatik servis kurulumu desteklenmiyor."
  fi
}

# ════════════════════════════════════════════════════════════════════════════
# ── ARGÜMAN PARSE ─────────────────────────────────────────────────────────
# ════════════════════════════════════════════════════════════════════════════

# İlk pozisyonel argüman subcommand olabilir
if [[ $# -gt 0 ]]; then
  case "$1" in
    status|stop|restart|logs|add-service|refresh-token|validate|update|install-service)
      SUBCOMMAND="$1"
      shift
      # subcommand'in opsiyonel argümanı
      if [[ $# -gt 0 && "${1:0:2}" != "--" && "${1:0:1}" != "-" ]]; then
        SUBCOMMAND_ARG="$1"
        shift
      fi
      ;;
  esac
fi

while [[ $# -gt 0 ]]; do
  case $1 in
    --backend)         BACKEND_URL="$2";              shift 2 ;;
    --env)             ENV_FILE="$2";                 shift 2 ;;
    --install-deps)    OPT_INSTALL_DEPS=true;         shift ;;
    --download-binary) OPT_DOWNLOAD_BINARY=true;      shift ;;
    --version)         OPT_VERSION="$2";              shift 2 ;;
    --yes|-y)          OPT_YES=true;                  shift ;;
    --dry-run)         OPT_DRY_RUN=true;              shift ;;
    --quiet|-q)        OPT_QUIET=true;                shift ;;
    --json)            OPT_JSON=true; OPT_QUIET=true; shift ;;
    --debug)           OPT_DEBUG=true;                shift ;;
    --autostart)       OPT_AUTOSTART=true;            shift ;;
    --no-color)        OPT_NO_COLOR=true; setup_colors; shift ;;
    -h|--help)
      awk 'NR==1{next} /^$/{exit} /^#/{sub(/^# ?/,""); print}' "$0"
      exit 0 ;;
    *) error "Bilinmeyen parametre: $1\n  Yardım için: $0 --help" ;;
  esac
done

# ── Yönetim dizinleri oluştur ─────────────────────────────────────────────────
mkdir -p "$AGENTS_DIR" "$LOGS_DIR"

# ════════════════════════════════════════════════════════════════════════════
# ── SUBCOMMAND YÖNLENDİRME ───────────────────────────────────────────────────
# ════════════════════════════════════════════════════════════════════════════

if [[ -n "$SUBCOMMAND" ]]; then
  detect_platform
  case "$SUBCOMMAND" in
    status)          cmd_status ;;
    stop)            cmd_stop ;;
    restart)         cmd_restart ;;
    logs)            cmd_logs ;;
    add-service)     cmd_add_service ;;
    refresh-token)   cmd_refresh_token ;;
    validate)        cmd_validate ;;
    update)          cmd_update ;;
    install-service) detect_platform; cmd_install_service ;;
  esac
  exit 0
fi

# ════════════════════════════════════════════════════════════════════════════
# ── İNTERAKTİF KURULUM ───────────────────────────────────────────────────────
# ════════════════════════════════════════════════════════════════════════════

detect_platform

[[ "$OPT_QUIET" == false ]] && {
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     NanoNet Agent Setup  —  v3             ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
echo ""
dim "  Platform : $OS/$ARCH  ($DISTRO)"
[[ "$IS_WSL" == true ]] && dim "  Ortam    : WSL (Windows Subsystem for Linux)"
dim "  Backend  : $BACKEND_URL"
dim "  .env     : $ENV_FILE"
[[ "$OPT_DRY_RUN" == true ]]  && echo -e "  ${YELLOW}[DRY-RUN modu aktif — hiçbir şey kaydedilmeyecek]${NC}"
[[ "$OPT_YES" == true ]]      && echo -e "  ${CYAN}[Non-interactive mod]${NC}"
echo ""
}

# ── 1. Bağımlılıklar ──────────────────────────────────────────────────────────
step "1/5  Bağımlılıklar kontrol ediliyor..."
check_and_install curl curl
check_and_install jq   jq
success "Bağımlılıklar hazır"

# ── 2. Backend bağlantısı ────────────────────────────────────────────────────
step "2/5  Backend bağlantısı kontrol ediliyor..."
spinner_start "Bağlanılıyor: $BACKEND_URL"
local_health=$(http_get "$BACKEND_URL/health" 2>/dev/null || true)
spinner_stop
if [[ -z "$local_health" ]]; then
  error "Backend'e ulaşılamıyor: $BACKEND_URL\n  Stack'i başlattığınızdan emin olun: docker compose up -d"
fi
if ! echo "$local_health" | jq -e '.status' >/dev/null 2>&1; then
  error "Bu bir NanoNet backend değil: $BACKEND_URL"
fi

# Sürüm kontrolü (arka planda)
{ check_latest_version; } &>/dev/null &

success "Backend çalışıyor"

# ── 3. Kimlik doğrulama ──────────────────────────────────────────────────────
step "3/5  Kimlik doğrulama..."
backup_env
do_auth

# ── 4. Servis seçimi ─────────────────────────────────────────────────────────
step "4/5  Servis yapılandırması..."
SVC_RESP=$(fetch_services "$ACCESS_TOKEN")

SELECTED_SERVICE_IDS=()
SELECTED_SERVICE_NAMES=()
SELECTED_SERVICE_HOSTS=()
SELECTED_SERVICE_PORTS=()
SELECTED_SERVICE_ENDPOINTS=()
SELECTED_SERVICE_POLLS=()
SELECTED_METRICS_URLS=()

select_services "$SVC_RESP"

if [[ ${#SELECTED_SERVICE_IDS[@]} -eq 0 ]]; then
  warn "Hiç servis seçilmedi."
  exit 0
fi

# .env güncelle (ilk seçilen için)
if [[ -f "$ENV_FILE" ]]; then
  update_env "ACCESS_TOKEN"          "$ACCESS_TOKEN"
  update_env "AGENT_TOKEN"           "${AGENT_TOKEN:-$ACCESS_TOKEN}"
  update_env "AGENT_SERVICE_ID"      "${SELECTED_SERVICE_IDS[0]}"
  update_env "AGENT_TARGET_HOST"     "${SELECTED_SERVICE_HOSTS[0]}"
  update_env "AGENT_TARGET_PORT"     "${SELECTED_SERVICE_PORTS[0]}"
  update_env "AGENT_HEALTH_ENDPOINT" "${SELECTED_SERVICE_ENDPOINTS[0]}"
  update_env "AGENT_POLL_INTERVAL"   "${SELECTED_SERVICE_POLLS[0]}"
  [[ -n "${SELECTED_METRICS_URLS[0]}" ]] && update_env "AGENT_METRICS_ENDPOINT" "${SELECTED_METRICS_URLS[0]}"
  success ".env güncellendi"
fi

# ── 5. Agent binary ───────────────────────────────────────────────────────────
step "5/5  Agent binary..."

if [[ "$OPT_DOWNLOAD_BINARY" == true ]]; then
  download_binary "$OPT_VERSION" "$HOME/.local/bin" || OPT_DOWNLOAD_BINARY=false
fi

if [[ "$(find_agent_bin)" == "" ]]; then
  if [[ -f "$SCRIPT_DIR/agent/Cargo.toml" ]]; then
    check_rust || true
    if command -v cargo >/dev/null 2>&1; then
      spinner_start "Agent derleniyor (bu birkaç dakika sürebilir)..."
      cargo build --release --manifest-path "$SCRIPT_DIR/agent/Cargo.toml" -q 2>/dev/null && spinner_stop \
        || { spinner_stop; warn "Derleme başarısız. Binary'yi manuel indirin."; }
    fi
  fi
fi

agent_bin=$(find_agent_bin)

# ── Özet + Başlatma ───────────────────────────────────────────────────────────
[[ "$OPT_QUIET" == false ]] && {
  echo ""
  echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║              Kurulum Tamamlandı            ║${NC}"
  echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Platform      : ${CYAN}$OS/$ARCH${NC}$( [[ "$IS_WSL" == true ]] && echo ' (WSL)')"
  echo -e "  Seçilen servis: ${CYAN}${#SELECTED_SERVICE_IDS[@]}${NC} adet"
  for i in "${!SELECTED_SERVICE_IDS[@]}"; do
    echo -e "    ${DIM}${SELECTED_SERVICE_IDS[$i]:0:8}…${NC}  ${SELECTED_SERVICE_NAMES[$i]}"
  done
  echo -e "  Agent token   : ${DIM}$(mask_token "${AGENT_TOKEN:-?}")${NC} — $(ttl_human "$(token_ttl "${AGENT_TOKEN:-}")")"
  echo ""
}

# install-service modu
if [[ "$OPT_AUTOSTART" == true ]] && command -v systemctl >/dev/null 2>&1; then
  for i in "${!SELECTED_SERVICE_IDS[@]}"; do
    install_systemd_service "${SELECTED_SERVICE_IDS[$i]}" "${SELECTED_SERVICE_NAMES[$i]}" \
      "${AGENT_TOKEN:-$ACCESS_TOKEN}" "${SELECTED_SERVICE_HOSTS[$i]}" \
      "${SELECTED_SERVICE_PORTS[$i]}" "${SELECTED_SERVICE_ENDPOINTS[$i]}" \
      "${SELECTED_SERVICE_POLLS[$i]}"
  done
  exit 0
fi

if [[ -z "$agent_bin" ]]; then
  warn "Agent binary bulunamadı."
  echo -e "  ${BOLD}Manuel başlatmak için:${NC}"
  echo -e "  ${CYAN}make agent${NC}  (kaynak kod derleme)"
  echo -e "  ${CYAN}$0 --download-binary${NC}  (binary indir)"
  exit 0
fi

echo -e "  ${BOLD}Agent başlatılsın mı?${NC} ${DIM}[$agent_bin]${NC}"

RUN_NOW="e"
if [[ "$OPT_YES" == false ]]; then
  read -rp "  [E/h]: " RUN_NOW
fi

if [[ ! "$RUN_NOW" =~ ^[Hh]$ ]]; then
  echo ""
  for i in "${!SELECTED_SERVICE_IDS[@]}"; do
    start_agent \
      "${SELECTED_SERVICE_IDS[$i]}" \
      "${SELECTED_SERVICE_NAMES[$i]}" \
      "${AGENT_TOKEN:-$ACCESS_TOKEN}" \
      "${SELECTED_SERVICE_HOSTS[$i]}" \
      "${SELECTED_SERVICE_PORTS[$i]}" \
      "${SELECTED_SERVICE_ENDPOINTS[$i]}" \
      "${SELECTED_SERVICE_POLLS[$i]}" \
      "${SELECTED_METRICS_URLS[$i]}"
  done
  echo ""

  # Özet tablosu
  if [[ "$OPT_QUIET" == false ]]; then
    _summary_rows=()
    for i in "${!SELECTED_SERVICE_IDS[@]}"; do
      _sum_sid="${SELECTED_SERVICE_IDS[$i]}"
      _sum_pid=$(agent_pid "$_sum_sid")
      _sum_status="durdu"
      kill -0 "$_sum_pid" 2>/dev/null && _sum_status="çalışıyor"
      _summary_rows+=("${_sum_sid}|${SELECTED_SERVICE_NAMES[$i]}|${_sum_pid:-—}|$(ttl_human "$(token_ttl "${AGENT_TOKEN:-}")")|${_sum_status}")
    done
    print_summary_table _summary_rows "Agent Durumu"

    echo -e "  Durdurmak için   : ${CYAN}$0 stop${NC}"
    echo -e "  Durumu görmek    : ${CYAN}$0 status${NC}"
    echo -e "  Log takibi       : ${CYAN}$0 logs${NC}"
    echo -e "  Token yenile     : ${CYAN}$0 refresh-token${NC}"
    echo -e "  Servis ekle      : ${CYAN}$0 add-service${NC}"
    echo -e "  Sistem servisi   : ${CYAN}$0 install-service${NC}"
    echo ""
  fi

  [[ "$OPT_JSON" == true ]] && {
    _ids_json=$(printf '"%s",' "${SELECTED_SERVICE_IDS[@]}" | sed 's/,$//')
    json_out "ok" "agent başlatıldı" "{\"service_ids\":[$_ids_json]}"
  }
fi
echo ""
