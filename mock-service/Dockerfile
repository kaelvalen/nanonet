FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o mock-service .

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/mock-service .

ENV PORT=3000

EXPOSE 3000

CMD ["./mock-service"]
