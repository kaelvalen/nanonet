# NanoNet - Mikroservis İzleme ve Yönetim Platformu

Real-time mikroservis izleme · Agent tabanlı komut yürütme · AI destekli anomali analizi

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Docker & Docker Compose
- Node.js 18+ (geliştirme için)
- Go 1.21+ (geliştirme için)
- Rust 1.70+ (geliştirme için)

### Kurulum

1. **Projeyi klonla**
```bash
git clone <repository-url>
cd nanonet
```

2. **Ortam değişkenlerini ayarla**
```bash
cp .env.example .env
# .env dosyasını düzenle (JWT_SECRET, CLAUDE_API_KEY vb.)
```

3. **Servisleri başlat**
```bash
docker-compose up --build
```

4. **Uygulamaya eriş**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Health check: http://localhost:8080/health

## 🏗️ Proje Yapısı

```
nanonet/
├── backend/           # Go + Gin API servisi
│   ├── cmd/          # Uygulama giriş noktası
│   ├── internal/     # İş mantığı katmanları
│   ├── pkg/          # Paylaşılan paketler
│   └── migrations/   # Veritabanı migrasyonları
├── frontend/         # React + TypeScript arayüz
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── store/
├── agent/            # Rust + Tokio monitoring agent
│   └── src/
├── docker-compose.yml
└── README.md
```

## 📋 Özellikler

### ✅ MVP (Faz 1-4)
- **Kullanıcı Yönetimi**: JWT tabanlı auth, register/login
- **Servis Yönetimi**: IP, port, health endpoint konfigürasyonu
- **Real-time İzleme**: CPU, bellek, disk, latency metrikleri
- **Grafikler**: Recharts ile zaman serisi görselleştirme
- **Kontrol Paneli**: Restart, stop komutları
- **AI Analizi**: Claude API ile anomali tespiti
- **Responsive**: Mobile-first tasarım

### 🚀 V2 (Gelecek)
- Cross-servis korelasyon analizi
- Öngörüsel uyarılar
- Log streaming
- Webhook entegrasyonları
- Servis bağımlılık haritası

## 🔧 Geliştirme

### Backend (Go)
```bash
cd backend
go mod tidy
go run cmd/main.go
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

### Agent (Rust)
```bash
cd agent
cargo build --release
./target/release/nanonet-agent --help
```

## 📚 API Dokümantasyonu

### Auth
- `POST /api/v1/auth/register` - Kullanıcı kaydı
- `POST /api/v1/auth/login` - Giriş
- `POST /api/v1/auth/logout` - Çıkış

### Servisler
- `GET /api/v1/services` - Servis listesi
- `POST /api/v1/services` - Yeni servis
- `GET /api/v1/services/{id}` - Servis detayı
- `PUT /api/v1/services/{id}` - Servis güncelleme
- `DELETE /api/v1/services/{id}` - Servis silme

### Metrikler
- `GET /api/v1/services/{id}/metrics` - Metrik geçmişi
- `POST /api/v1/services/{id}/analyze` - AI analizi

### Kontrol
- `POST /api/v1/services/{id}/restart` - Servis restart
- `POST /api/v1/services/{id}/stop` - Servis durdurma

## 🤖 Agent Kurulumu

1. Dashboard'dan servis ekle
2. Oluşturulan kurulum komutunu kopyala
3. Hedef sunucuda çalıştır:
```bash
curl -sSL https://nanonet.dev/install.sh | sh -s -- \
  --token <TOKEN> \
  --backend wss://nanonet.dev \
  --service-id <SERVICE_ID>
```

## 🛡️ Güvenlik

- JWT token'lar (24h access, 30d refresh)
- bcrypt password hashing (cost 12)
- Rate limiting (IP bazlı)
- CORS konfigürasyonu
- SQL injection koruması (parameterized queries)
- Opaque agent token'lar (SHA-256 hash'li, DB'de revocable)

### ⚠️ Bilinen Sınırlamalar

**Token Blacklist — Multi-Instance:**
Token blacklist şu an in-memory (`sync.Map`) olarak çalışmaktadır.
Birden fazla backend instance'ı çalıştırıldığında (horizontal scaling / load balancer),
bir instance'daki logout/refresh token invalidation diğer instance'lara yansımaz.
Bu durum kısa süreli (token TTL'e kadar) token reuse'a yol açabilir.

Çözüm: Production'da Redis blacklist kullanın (`pkg/tokenblacklist` Redis adapter'ı V2'de eklenecek).

## 📊 Veritabanı

- **PostgreSQL** + **TimescaleDB**
- Zaman serisi metrikler için optimize edilmiş
- 90 günlük retention policy
- Otomatik partitioning

## 🧪 Test

```bash
# Backend testleri
cd backend && go test ./...

# Frontend testleri
cd frontend && npm test

# E2E testleri
cd frontend && npx playwright test
```

## 📄 Lisans

MIT License

---

**NanoNet** - Mikroservis yönetimini basitleştir.
