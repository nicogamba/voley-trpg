#!/usr/bin/env python3
"""Recorta los 6 retratos por equipo de las sheets 3x2."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-source" / "principal"
OUT = ROOT / "app" / "src" / "assets" / "sprites" / "portraits" / "teams"

TEAMS = {
    "arg": "arg-portraits.jpeg",
    "bra": "bra-portraits.jpeg",
}

# Orden de la sheet: fila 0 libero, middle, opposite;
# fila 1 setter, outside 1, outside 2.
ROLES = ("libero", "middle", "opposite", "setter", "wing-1", "wing-2")
COLS = 3
ROWS = 2
CROP = 700
TOP_MARGIN = 20
OUT_SIZE = (128, 128)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for team, filename in TEAMS.items():
        source = Image.open(SRC / filename).convert("RGB")
        cell_w = source.width / COLS
        cell_h = source.height / ROWS
        for index, role in enumerate(ROLES):
            col = index % COLS
            row = index // COLS
            left = int(col * cell_w + (cell_w - CROP) / 2)
            top = int(row * cell_h + TOP_MARGIN)
            portrait = source.crop((left, top, left + CROP, top + CROP))
            portrait = portrait.resize(OUT_SIZE, Image.Resampling.NEAREST)
            path = OUT / f"{team}-{role}.png"
            portrait.save(path, optimize=True)
            print("  ", path.relative_to(ROOT), path.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
