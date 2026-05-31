#!/usr/bin/env sh
# OpenAPI tek kaynak: backend/api/openapi.yaml
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$ROOT/scripts/merge-openapi.py" 2>/dev/null || true
cp "$ROOT/backend/api/openapi.yaml" "$ROOT/docs/api/openapi.yaml"
cp "$ROOT/backend/api/openapi.yaml" "$ROOT/backend/pkg/apidocs/openapi.yaml"
echo "OpenAPI senkron: backend/api → docs/api + pkg/apidocs"
