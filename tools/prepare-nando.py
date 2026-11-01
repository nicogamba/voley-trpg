#!/usr/bin/env python3
"""Recorta las 5 expresiones de Nando a retratos cuadrados."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-source" / "principal" / "nando.png"
OUT = ROOT / "app" / "src" / "assets" / "sprites" / "commentator"

EXPRESSIONS = (
    "neutral",
    "excited",
    "shocked",
    "worried",
    "triumphant",
)

PANELS = 5
CROP_SIZE = 200
CROP_TOP = 120
OUT_SIZE = (128, 128)


def main() -> None:
    source = Image.open(SRC).convert("RGB")
    panel_w = source.width / PANELS
    OUT.mkdir(parents=True, exist_ok=True)

    for index, expression in enumerate(EXPRESSIONS):
        center_x = int((index + 0.5) * panel_w)
        left = center_x - CROP_SIZE // 2
        right = left + CROP_SIZE
        top = CROP_TOP
        bottom = top + CROP_SIZE
        portrait = source.crop((left, top, right, bottom))
        portrait = portrait.resize(OUT_SIZE, Image.Resampling.NEAREST)
        path = OUT / f"nando-{expression}.png"
        portrait.save(path, optimize=True)
        print("  ", path.relative_to(ROOT), path.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
