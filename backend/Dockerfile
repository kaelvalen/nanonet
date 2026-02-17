FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Migration dosyalarını container içindeki doğru konuma kopyala
RUN mkdir -p /migrations && cp -r migrations/* /migrations/

RUN CGO_ENABLED=0 GOOS=linux go build -o nanonet-backend cmd/main.go

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/nanonet-backend .
COPY --from=builder /migrations /migrations

EXPOSE 8080

CMD ["./nanonet-backend"]
