FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Migration dosyalarını container içindeki doğru konuma kopyala
RUN mkdir -p /migrations && cp -r migrations/* /migrations/

RUN CGO_ENABLED=0 GOOS=linux go build -o nanonet-backend cmd/main.go

FROM alpine:latest

RUN apk --no-cache add ca-certificates curl && \
    KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt) && \
    ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${ARCH}/kubectl" && \
    chmod +x kubectl && mv kubectl /usr/local/bin/kubectl

WORKDIR /root/

COPY --from=builder /app/nanonet-backend .
COPY --from=builder /migrations /migrations
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["./nanonet-backend"]
