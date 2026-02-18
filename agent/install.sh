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
BINARY_NAME="nanonet-agent-$OS-$ARCH"
DOWNLOAD_URL="https://github.com/nanonet/agent/releases/latest/download/$BINARY_NAME"

echo -e "${YELLOW}⬇️  Agent indiriliyor...${NC}"

# Script'in bulunduğu dizine göre binary yolunu belirle
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_BINARY="$SCRIPT_DIR/target/release/nanonet-agent"

# For now, use local binary if available (production'da GitHub releases kullanılır)
if [ -f "$LOCAL_BINARY" ]; then
  echo -e "${GREEN}✅ Yerel binary bulundu${NC}"
  sudo cp "$LOCAL_BINARY" /usr/local/bin/nanonet-agent
else
  echo -e "${YELLOW}Binary GitHub'dan indirilecek (şu an mock)${NC}"
  # Production:
  # curl -sSL "$DOWNLOAD_URL" -o /tmp/nanonet-agent
  # sudo mv /tmp/nanonet-agent /usr/local/bin/nanonet-agent
  echo -e "${RED}❌ Binary bulunamadı: $LOCAL_BINARY${NC}"
  echo -e "${YELLOW}Önce derleyin: cd $SCRIPT_DIR && cargo build --release${NC}"
  exit 1
fi

sudo chmod +x /usr/local/bin/nanonet-agent

# Create systemd service
echo -e "${YELLOW}⚙️  Systemd servisi oluşturuluyor...${NC}"

sudo tee /etc/systemd/system/nanonet-agent.service > /dev/null <<EOF
[Unit]
Description=NanoNet Monitoring Agent
After=network.target

[Service]
Type=simple
User=$USER
Environment="NANONET_BACKEND=$BACKEND_URL"
Environment="NANONET_SERVICE_ID=$SERVICE_ID"
Environment="NANONET_TOKEN=$TOKEN"
ExecStart=/usr/local/bin/nanonet-agent \\
  --backend $BACKEND_URL \\
  --service-id $SERVICE_ID \\
  --token $TOKEN \\
  --host $HOST \\
  --port $PORT \\
  --health-endpoint $HEALTH_ENDPOINT \\
  --poll-interval $POLL_INTERVAL
Restart=always
RestartSec=10

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
