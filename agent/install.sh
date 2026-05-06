#!/bin/bash
# NanoNet Agent Quick Install Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 NanoNet Agent Kurulum${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Bu scripti root olarak çalıştırmayın${NC}"
   exit 1
fi

# Parse arguments
BACKEND_URL=""
SERVICE_ID=""
TOKEN=""
HOST="localhost"
PORT="8080"
HEALTH_ENDPOINT="/health"
POLL_INTERVAL="10"

while [[ $# -gt 0 ]]; do
  case $1 in
    --backend)
      BACKEND_URL="$2"
      shift 2
      ;;
    --service-id)
      SERVICE_ID="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --health-endpoint)
      HEALTH_ENDPOINT="$2"
      shift 2
      ;;
    --poll-interval)
      POLL_INTERVAL="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Bilinmeyen parametre: $1${NC}"
      exit 1
      ;;
  esac
done

# Validate required params
if [ -z "$BACKEND_URL" ] || [ -z "$SERVICE_ID" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Eksik parametreler!${NC}"
  echo ""
  echo "Kullanım:"
  echo "  curl -sSL https://nanonet.io/install.sh | bash -s -- \\"
  echo "    --backend ws://your-backend:8080 \\"
  echo "    --service-id YOUR_SERVICE_ID \\"
  echo "    --token YOUR_JWT_TOKEN \\"
  echo "    --host localhost \\"
  echo "    --port 8080"
  exit 1
fi

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case $ARCH in
  x86_64)
    ARCH="x86_64"
    ;;
  aarch64|arm64)
    ARCH="aarch64"
    ;;
  *)
    echo -e "${RED}❌ Desteklenmeyen mimari: $ARCH${NC}"
    exit 1
    ;;
esac

echo -e "${YELLOW}📦 Platform: $OS-$ARCH${NC}"

# Download binary
echo -e "${YELLOW}⬇️  Agent hazırlanıyor...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_BINARY="$SCRIPT_DIR/target/release/nanonet-agent"

if [ ! -f "$LOCAL_BINARY" ]; then
  echo -e "${YELLOW}Release binary bulunamadı, derleniyor...${NC}"
  (cd "$SCRIPT_DIR" && cargo build --release) || {
    echo -e "${RED}❌ Derleme başarısız${NC}"
    exit 1
  }
fi

echo -e "${GREEN}✅ Binary hazır${NC}"

# Önce çalışan agent'ı durdur (Text file busy hatasını önler)
if pgrep -x nanonet-agent >/dev/null 2>&1; then
  echo -e "${YELLOW}⚡ Çalışan agent durduruluyor...${NC}"
  sudo systemctl stop nanonet-agent 2>/dev/null || pkill -x nanonet-agent 2>/dev/null || true
  sleep 1
fi

sudo cp "$LOCAL_BINARY" /usr/local/bin/nanonet-agent
sudo chmod +x /usr/local/bin/nanonet-agent

# Create systemd service
echo -e "${YELLOW}⚙️  Systemd servisi oluşturuluyor...${NC}"

# Token'ı argv'de taşımıyoruz: `ps -ef` veya `/proc/<pid>/cmdline` ile
# yerel kullanıcılara sızar. Bunun yerine /etc/nanonet/agent.env (mode 0600,
# yalnızca servis kullanıcısı erişebilir) kullanıyoruz.
sudo install -d -m 0750 -o "$USER" -g "$USER" /etc/nanonet
ENV_FILE="/etc/nanonet/agent.env"
sudo install -m 0600 -o "$USER" -g "$USER" /dev/null "$ENV_FILE"
sudo tee "$ENV_FILE" > /dev/null <<EOF
NANONET_BACKEND=$BACKEND_URL
NANONET_SERVICE_ID=$SERVICE_ID
NANONET_AGENT_TOKEN=$TOKEN
NANONET_HOST=$HOST
NANONET_PORT=$PORT
NANONET_HEALTH_ENDPOINT=$HEALTH_ENDPOINT
NANONET_POLL_INTERVAL=$POLL_INTERVAL
EOF
sudo chmod 0600 "$ENV_FILE"

sudo tee /etc/systemd/system/nanonet-agent.service > /dev/null <<EOF
[Unit]
Description=NanoNet Monitoring Agent
After=network.target

[Service]
Type=simple
User=$USER
EnvironmentFile=$ENV_FILE
ExecStart=/usr/local/bin/nanonet-agent
Restart=always
RestartSec=10

# Hardening: token /etc/nanonet/agent.env içinde tutuluyor; ek dosya yazma
# yetkisi gerekmez. /var/lib/nanonet altında runtime state yazılır.
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
NoNewPrivileges=true
ReadWritePaths=/var/lib/nanonet /home/$USER/.nanonet

[Install]
WantedBy=multi-user.target
EOF

# Start service
echo -e "${YELLOW}🔄 Servis başlatılıyor...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable nanonet-agent
sudo systemctl start nanonet-agent

# Check status
sleep 2
if sudo systemctl is-active --quiet nanonet-agent; then
  echo ""
  echo -e "${GREEN}✅ Agent başarıyla kuruldu ve başlatıldı!${NC}"
  echo ""
  echo "Durum kontrolü:"
  echo "  sudo systemctl status nanonet-agent"
  echo ""
  echo "Logları görüntüle:"
  echo "  sudo journalctl -u nanonet-agent -f"
  echo ""
  echo "Durdur:"
  echo "  sudo systemctl stop nanonet-agent"
else
  echo -e "${RED}❌ Agent başlatılamadı${NC}"
  echo "Logları kontrol edin: sudo journalctl -u nanonet-agent -n 50"
  exit 1
fi
