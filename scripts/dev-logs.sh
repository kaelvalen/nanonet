#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NanoNet Dev Log Viewer
# Kullanım: ./scripts/dev-logs.sh [GROUP] [--level LEVEL] [--since SINCE]
#
# GROUP (opsiyonel):
#   app    — backend + frontend (varsayılan)
#   all    — tüm container'lar
#   mock   — sadece mock servisler
#   infra  — db + redis
#
# --level   — min seviye: debug | info | warn | error  (varsayılan: debug)
# --since   — docker --since değeri: 5m | 1h | 2024-01-01  (varsayılan: 10m)
# --follow  — log'u takip et (varsayılan: açık)
# --no-follow — sadece snapshot al, çık
#
# Örnekler:
#   make logs                  → app logs (backend+frontend), follow
#   make logs-all              → tümü, follow
#   make logs-mock             → mock servisler, follow
#   make logs-err              → tüm error/warn, follow
#   make logs-since SINCE=1h   → son 1 saat
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Renkler ───────────────────────────────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

C_TIME='\033[38;5;240m'     # koyu gri — timestamp
C_DEBUG='\033[38;5;245m'    # gri      — debug
C_INFO='\033[38;5;39m'      # mavi     — info
C_WARN='\033[38;5;220m'     # sarı     — warn
C_ERROR='\033[38;5;196m'    # kırmızı  — error
C_PANIC='\033[38;5;201m'    # magenta  — fatal/panic

# Container grup renkleri
C_BACKEND='\033[38;5;82m'   # yeşil
C_FRONTEND='\033[38;5;33m'  # mavi
C_DB='\033[38;5;208m'       # turuncu
C_REDIS='\033[38;5;161m'    # pembe
C_MOCK='\033[38;5;249m'     # açık gri

# ── Argüman parse ──────────────────────────────────────────────────────────────
GROUP="${1:-app}"
LEVEL="debug"
SINCE="10m"
FOLLOW=true
NO_TIMESTAMP=false
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"

shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --level)    LEVEL="$2"; shift 2 ;;
    --since)    SINCE="$2"; shift 2 ;;
    --no-follow) FOLLOW=false; shift ;;
    --no-ts)    NO_TIMESTAMP=true; shift ;;
    *) shift ;;
  esac
done

# ── Container listesi ─────────────────────────────────────────────────────────
case "$GROUP" in
  app)
    CONTAINERS="backend frontend"
    ;;
  infra)
    CONTAINERS="db redis"
    ;;
  mock)
    CONTAINERS="mock-healthy mock-degraded mock-spike mock-memory-leak mock-flapping \
                mock-high-latency mock-down mock-connection-leak mock-slow-start \
                mock-database-issue mock-network-jitter mock-resource-starved \
                mock-circuit-breaker mock-random-crash mock-load-spike \
                mock-dependency-issue mock-error-burst"
    ;;
  all)
    CONTAINERS=""  # boş = tümü
    ;;
  *)
    # doğrudan container adı geçilmişse
    CONTAINERS="$GROUP"
    ;;
esac

# ── Severity level sayısal eşleme ─────────────────────────────────────────────
level_num() {
  case "${1,,}" in
    debug) echo 0 ;;
    info)  echo 1 ;;
    warn)  echo 2 ;;
    error) echo 3 ;;
    *)     echo 0 ;;
  esac
}
MIN_LEVEL=$(level_num "$LEVEL")

# ── Container adına göre renk ver ─────────────────────────────────────────────
container_color() {
  local name="$1"
  case "$name" in
    *backend*)  echo "$C_BACKEND"  ;;
    *frontend*) echo "$C_FRONTEND" ;;
    *db*)       echo "$C_DB"       ;;
    *redis*)    echo "$C_REDIS"    ;;
    *mock*)     echo "$C_MOCK"     ;;
    *)          echo "$C_INFO"     ;;
  esac
}

# Container adını kısalt
short_name() {
  local name="$1"
  # "nanonet-mock-circuit-breaker" → "mock-cb"
  name="${name#nanonet-}"
  case "$name" in
    mock-circuit-breaker)  echo "mock-cb"     ;;
    mock-connection-leak)  echo "mock-connlk" ;;
    mock-memory-leak)      echo "mock-memlk"  ;;
    mock-high-latency)     echo "mock-hilat"  ;;
    mock-dependency-issue) echo "mock-dep"    ;;
    mock-database-issue)   echo "mock-db"     ;;
    mock-resource-starved) echo "mock-rsrc"   ;;
    mock-random-crash)     echo "mock-crash"  ;;
    mock-error-burst)      echo "mock-eburst" ;;
    mock-load-spike)       echo "mock-load"   ;;
    mock-network-jitter)   echo "mock-jitter" ;;
    mock-slow-start)       echo "mock-slow"   ;;
    *)                     echo "$name"       ;;
  esac
}

# ── Satır renklendirici ────────────────────────────────────────────────────────
colorize_line() {
  local container="$1"
  local line="$2"

  # Docker --timestamps formatı: "2026-03-30T19:57:49.344028316Z mesaj"
  # Sadece HH:MM:SS kısmını al, geri kalanını mesaj olarak tut
  local ts=""
  local msg="$line"
  if [[ "$line" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2}T([0-9]{2}:[0-9]{2}:[0-9]{2})\.[0-9]+Z)[[:space:]]+(.*) ]]; then
    ts="${BASH_REMATCH[2]}"
    msg="${BASH_REMATCH[3]}"
  fi

  # Boş satırları atla
  [[ -z "${msg// }" ]] && return

  # Go stdlib log formatı: "2026/03/30 19:57:53 mesaj" → "mesaj"
  if [[ "$msg" =~ ^[0-9]{4}/[0-9]{2}/[0-9]{2}\ [0-9]{2}:[0-9]{2}:[0-9]{2}\ (.*) ]]; then
    msg="${BASH_REMATCH[1]}"
  fi
  # Go log with brackets: "2026/03/30 19:57:53 [TAG] mesaj" — zaten yukarıda yakalanır
  # Gin log formatı zaten temiz bırakılır

  # Severity tespiti — JSON level field → keyword → HTTP status → default
  local sev_raw="     "
  local sev_color="$C_DEBUG"
  local sev_num=0

  case "$msg" in
    # JSON structured log
    *'"level":"error"'*|*'"level": "error"'*)
      sev_raw="ERROR"; sev_color="$C_ERROR"; sev_num=3 ;;
    *'"level":"fatal"'*|*'"level":"panic"'*)
      sev_raw="FATAL"; sev_color="$C_PANIC"; sev_num=3 ;;
    *'"level":"warn"'*|*'"level": "warn"'*)
      sev_raw="WARN "; sev_color="$C_WARN";  sev_num=2 ;;
    *'"level":"info"'*|*'"level": "info"'*)
      sev_raw="INFO "; sev_color="$C_INFO";  sev_num=1 ;;
    # Go stdlib log keywords
    *' FATAL '* | *'[FATAL]'* | *'panic:'*)
      sev_raw="FATAL"; sev_color="$C_PANIC"; sev_num=3 ;;
    *' ERROR '* | *'[ERROR]'* | *'Error:'*)
      sev_raw="ERROR"; sev_color="$C_ERROR"; sev_num=3 ;;
    *' WARN '* | *'[WARN]'* | *'Warning:'* | *'warning:'*)
      sev_raw="WARN "; sev_color="$C_WARN";  sev_num=2 ;;
    # Gin HTTP log: "|200|" / "|404|" / "|500|" — status'a göre severity
    *'| 5'[0-9][0-9]' |'* | *'|5'[0-9][0-9]'|'*)
      sev_raw="ERROR"; sev_color="$C_ERROR"; sev_num=3 ;;
    *'| 4'[0-9][0-9]' |'* | *'|4'[0-9][0-9]'|'*)
      sev_raw="WARN "; sev_color="$C_WARN";  sev_num=2 ;;
    *'| 2'[0-9][0-9]' |'* | *'|2'[0-9][0-9]'|'* | *'| 3'[0-9][0-9]' |'*)
      sev_raw="INFO "; sev_color="$C_INFO";  sev_num=1 ;;
    # mock servis log: "[svc-name] METHOD /path CODE duration"
    *'[GIN-debug]'* | *' 200 '* | *' 201 '*)
      sev_raw="INFO "; sev_color="$C_INFO";  sev_num=1 ;;
    # Başlangıç mesajları
    *'starting'* | *'başlatıldı'* | *'başarılı'* | *'bağlandı'* | *'Healthy'* | *'ready'*)
      sev_raw="INFO "; sev_color="$C_INFO";  sev_num=1 ;;
    *)
      sev_raw="     "; sev_color="$C_DEBUG"; sev_num=0 ;;
  esac

  # Min level filtresi
  [[ $sev_num -lt $MIN_LEVEL ]] && return

  local ccolor
  ccolor=$(container_color "$container")
  local cname
  cname=$(short_name "$container")

  # Zaman + container + severity + mesaj
  printf "${C_TIME}%s${RESET} ${ccolor}${BOLD}%-12s${RESET} ${sev_color}${BOLD}%s${RESET} %s\n" \
    "$ts" "$cname" "$sev_raw" "$msg"
}

# ── Docker compose logs pipeline ──────────────────────────────────────────────
FOLLOW_FLAG=""
if $FOLLOW; then FOLLOW_FLAG="--follow"; fi

DC="docker compose -f $COMPOSE_FILE"

# Header
echo -e "${BOLD}${C_INFO}━━━ NanoNet Dev Logs ━━━${RESET}"
echo -e "${DIM}Group: ${GROUP}  |  Level: ≥${LEVEL}  |  Since: ${SINCE}  |  Follow: ${FOLLOW}${RESET}"
echo -e "${DIM}Ctrl+C to stop${RESET}"
echo ""

# Renk kılavuzu
echo -e "  ${C_BACKEND}■${RESET} backend   ${C_FRONTEND}■${RESET} frontend   ${C_DB}■${RESET} db   ${C_REDIS}■${RESET} redis   ${C_MOCK}■${RESET} mock"
echo -e "  ${C_ERROR}${BOLD}ERROR${RESET}  ${C_WARN}${BOLD}WARN${RESET}  ${C_INFO}INFO${RESET}  ${C_DEBUG}DEBUG${RESET}"
echo ""

# ── Stream ────────────────────────────────────────────────────────────────────
{
  if [[ -z "$CONTAINERS" ]]; then
    $DC logs $FOLLOW_FLAG --since "$SINCE" --timestamps 2>&1
  else
    $DC logs $FOLLOW_FLAG --since "$SINCE" --timestamps $CONTAINERS 2>&1
  fi
} | while IFS= read -r raw_line; do
  # docker compose logs formatı: "nanonet-backend-1  | 2024-01-01T... mesaj"
  if [[ "$raw_line" =~ ^([a-zA-Z0-9_-]+)[[:space:]]*\|[[:space:]]*(.*) ]]; then
    container="${BASH_REMATCH[1]}"
    content="${BASH_REMATCH[2]}"

    # GORM/SQL çok satırlı fragment'larını gizle (SELECT, FROM, WHERE, ORDER, GROUP, JOIN, [N.NNms])
    case "$content" in
      *"SELECT "*|*"FROM "*|*"WHERE "*|*"ORDER BY"*|*"GROUP BY"*|\
      *"JOIN "*|*"[rows:"*|*"] ["*ms"]"*|"      "*)
        [[ $MIN_LEVEL -le 0 ]] || continue ;;  # sadece debug modda göster
    esac

    # repository.go:NN satır referanslarını gizle (debug gürültüsü)
    case "$content" in
      *".go:"[0-9]*)
        [[ $MIN_LEVEL -le 0 ]] || continue ;;
    esac

    colorize_line "$container" "$content"
  fi
  # Prefix yoksa (build output vb.) gizle — gürültüyü azalt
done
