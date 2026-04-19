# syntax=docker/dockerfile:1.7
#
# Multi-stage build → distroless runtime.
#
# - cargo-chef ile bağımlılık layer'ı önceden cache'lenir.
# - Final imaj: `gcr.io/distroless/cc-debian12` — sadece glibc + ca-certs;
#   shell yok, paket yöneticisi yok, attack surface minimum.
#
# Build:
#   docker build -t nanonet-agent:dev agent/
#
# Run (örnek):
#   docker run --rm \
#     -e NANONET_BACKEND=wss://backend.example.com \
#     -e NANONET_SERVICE_ID=... \
#     -e NANONET_AGENT_TOKEN=... \
#     nanonet-agent:dev

ARG RUST_VERSION=1.82
ARG DEBIAN_VERSION=bookworm

# ---------- chef stage ---------------------------------------------------
FROM rust:${RUST_VERSION}-slim-${DEBIAN_VERSION} AS chef
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && cargo install cargo-chef --locked --version ^0.1
WORKDIR /app

# ---------- planner: ihtiyaç duyulan crate'leri çıkar -------------------
FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY tests ./tests
RUN cargo chef prepare --recipe-path recipe.json

# ---------- builder: önce deps, sonra app --------------------------------
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY tests ./tests
RUN cargo build --release --bin nanonet-agent \
    && strip target/release/nanonet-agent

# ---------- runtime ------------------------------------------------------
FROM gcr.io/distroless/cc-debian12:nonroot AS runtime

LABEL org.opencontainers.image.title="nanonet-agent" \
      org.opencontainers.image.source="https://github.com/nanonet/agent" \
      org.opencontainers.image.licenses="MIT"

USER nonroot:nonroot
WORKDIR /home/nonroot

COPY --from=builder /app/target/release/nanonet-agent /usr/local/bin/nanonet-agent

# Agent kendi /health endpoint'ini sunabilir (NANONET_AGENT_PORT).
EXPOSE 9100
ENTRYPOINT ["/usr/local/bin/nanonet-agent"]
