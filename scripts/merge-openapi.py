#!/usr/bin/env python3
"""Birleştir: openapi.yaml + paths-extra.yaml → openapi.yaml (tek kaynak)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "backend/api/openapi.yaml"
EXTRA = ROOT / "backend/api/paths-extra.yaml"
MARKER = "  /health:\n"

def main() -> None:
    base = SPEC.read_text(encoding="utf-8")
    if MARKER in base:
        print("paths-extra zaten birleşik, atlanıyor")
        return
    extra_lines = [
        ln
        for ln in EXTRA.read_text(encoding="utf-8").splitlines()
        if not ln.strip().startswith("#")
    ]
    extra = "\n".join(extra_lines).rstrip() + "\n"
    merged = base.rstrip() + "\n" + extra
    SPEC.write_text(merged, encoding="utf-8")
    print(f"Birleştirildi: {len(extra_lines)} satır paths-extra eklendi")

if __name__ == "__main__":
    main()
