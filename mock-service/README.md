# NanoNet Mock Service

Bağımsız, hafif bir mock HTTP servisi. Agent'ı test etmek veya demo yapmak için kullanılabilir.

## Özellikler

- ✅ `/health` endpoint — Health check (bazen degraded döner)
- 📊 `/metrics` endpoint — Simüle edilmiş metrikler
- 👥 `/api/users` endpoint — Mock kullanıcı verisi
- 📦 `/api/products` endpoint — Mock ürün verisi
- 🔄 Request logging
- 🌐 CORS desteği
- 📈 Request counter + uptime tracking

## Çalıştırma

### Doğrudan Go ile

```bash
cd mock-service
go run main.go
```

Varsayılan port: `3000`

Özel port:
```bash
PORT=8080 go run main.go
```

### Docker ile

```bash
cd mock-service
docker build -t mock-service .
docker run -p 3000:3000 mock-service
```

### Binary olarak

```bash
go build -o mock-service
./mock-service
```

## Endpoints

| Method | Path             | Açıklama                          |
|--------|------------------|-----------------------------------|
| GET    | `/`              | Servis bilgisi                    |
| GET    | `/health`        | Health check (200 veya 503)       |
| GET    | `/metrics`       | CPU, memory, uptime metrikleri    |
| GET    | `/api/users`     | Mock kullanıcı listesi            |
| GET    | `/api/products`  | Mock ürün listesi                 |

## Agent ile Test

NanoNet agent'ı bu servisi izlemek için kullanabilirsiniz:

```bash
./nanonet-agent \
  --backend ws://localhost:8080 \
  --service-id <SERVICE_UUID> \
  --token <JWT_TOKEN> \
  --host localhost \
  --port 3000 \
  --health-endpoint /health \
  --poll-interval 5
```

## Örnek Yanıtlar

### GET /health

```json
{
  "status": "healthy",
  "timestamp": "2026-02-17T17:30:00Z",
  "uptime": "1h23m45s",
  "requests": 142,
  "version": "1.0.0"
}
```

### GET /metrics

```json
{
  "requests": 142,
  "uptime_seconds": 5025,
  "memory_usage_mb": 67.3,
  "cpu_percent": 23.5
}
```

### GET /api/users

```json
{
  "success": true,
  "data": [
    {"id": 1, "name": "Alice Johnson", "email": "alice@example.com", "role": "admin"},
    {"id": 2, "name": "Bob Smith", "email": "bob@example.com", "role": "user"}
  ],
  "count": 4
}
```

## Özellikler

- **Rastgele degraded state**: %5 ihtimalle `/health` endpoint'i 503 döner (agent'ın down detection'ını test etmek için)
- **Simüle edilmiş metrikler**: Her `/metrics` çağrısında gerçekçi CPU ve memory değerleri
- **Request tracking**: Her istek loglanır ve sayılır
- **CORS**: Tüm origin'lere izin verir (development için)

## Environment Variables

| Variable | Default | Açıklama          |
|----------|---------|-------------------|
| `PORT`   | `3000`  | HTTP server portu |
