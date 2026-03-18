#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Frontend (Biome)"
cd "$ROOT/frontend"
npx @biomejs/biome check --write --unsafe . || true

echo ""
echo "==> Backend (Go)"
cd "$ROOT/backend"
gofmt -w .
golangci-lint run --fix ./... || true

echo ""
echo "==> Agent (Rust)"
cd "$ROOT/agent"
cargo fmt
cargo clippy --fix --allow-dirty || true

echo ""
echo "Done."