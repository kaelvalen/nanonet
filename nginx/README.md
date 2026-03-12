# Nginx TLS Sertifika Kurulumu

Production deployment için `nginx/certs/` dizinine TLS sertifikalarını koyun.

## Let's Encrypt (Certbot) ile Ücretsiz Sertifika

```bash
# Certbot kur
sudo apt install certbot

# Sertifika al (domain DNS'i sunucuya yönlendirilmiş olmalı)
sudo certbot certonly --standalone -d your-domain.com

# Sertifikaları kopyala
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem  nginx/certs/privkey.pem
sudo chmod 644 nginx/certs/fullchain.pem
sudo chmod 600 nginx/certs/privkey.pem
```

## Self-Signed (Geliştirme/Test)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

## Production Deployment

```bash
# 1. .env dosyasını hazırla
cp .env.example .env
# Tüm CHANGE_ME değerlerini doldurun

# 2. Sertifikaları nginx/certs/ dizinine koyun (yukarıya bakın)

# 3. Production'ı başlat
docker compose -f docker-compose.prod.yml up -d

# 4. Logları izle
docker compose -f docker-compose.prod.yml logs -f
```

## Otomatik Yenileme (Cron)

```bash
# /etc/cron.d/certbot-nanonet
0 3 * * * root certbot renew --quiet && \
  cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/nanonet/nginx/certs/fullchain.pem && \
  cp /etc/letsencrypt/live/your-domain.com/privkey.pem  /path/to/nanonet/nginx/certs/privkey.pem && \
  docker exec nanonet-nginx nginx -s reload
```

## Beklenen Dizin Yapısı

```
nginx/
├── nginx.prod.conf   ← Nginx production konfigürasyonu
├── certs/
│   ├── fullchain.pem ← TLS sertifikası zinciri (git'te yok)
│   └── privkey.pem   ← Özel anahtar (git'te yok — asla commit etme)
└── README.md
```
