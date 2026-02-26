# ── Builder stage ───────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 golang@sha256:383395b794dffa5b53012a212365d40c8e37109a626ca30d6151c8348d380b5f AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download && go mod verify

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -ldflags="-s -w" -o mock-service .

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12

COPY --from=builder /app/mock-service /mock-service

# Distroless images already run as nonroot user (nobody)
USER 65532:65532

ENV PORT=8001

EXPOSE 8001

ENTRYPOINT ["/mock-service"]
