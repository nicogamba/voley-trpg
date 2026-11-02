#!/usr/bin/env python3
"""Prepara los planos de impacto compartidos a PNG 720x640.

Los planos no muestran camiseta ni equipo: son close-ups de manos, pelota
y red. Se recortan a 1.125:1, se reducen a 720x640 y se cuantizan para que
pesen poco y mantengan el look pixel art.

Entrada:
  art-source/principal/game-serve.jpeg
  art-source/principal/duel-at-the-net.jpeg
  art-source/principal/block-hands.jpeg
  art-source/principal/ready-to-serve.png
  art-source/principal/tu-ataque-por2.png
  art-source/principal/tu-ataque-por4.png
  art-source/principal/just-in-attack.png
  art-source/principal/setter-miss.png
  art-source/principal/ball-in-air.png

Salida:
  app/src/assets/action/shared/serve.png
  app/src/assets/action/shared/duel.png
  app/src/assets/action/shared/block.png
  app/src/assets/action/shared/ready-to-serve.png
  app/src/assets/action/shared/attack-2.png
  app/src/assets/action/shared/attack-4.png
  app/src/assets/action/shared/just-in-attack.png
  app/src/assets/action/shared/setter-miss.png
  app/src/assets/action/shared/ball-in-air.png
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-source" / "principal"
OUT = ROOT / "app" / "src" / "assets" / "action" / "shared"

OUT_SIZE = (720, 640)
RATIO = OUT_SIZE[0] / OUT_SIZE[1]
COLORS = 48

# nombre final: (archivo fuente, posición del recorte vertical 0..1)
SHOTS = {
    "serve": ("game-serve.jpeg", 0.0),
    "duel": ("duel-at-the-net-2.jpeg", 0.5),
    "block": ("block-hands-2.jpeg", 0.5),
    "receive": ("receive.jpeg", 0.5),
    "receive-alt": ("receive2.jpeg", 0.5),
    "set": ("set.jpeg", 0.5),
    "dig": ("dig.jpeg", 0.5),
    "point": ("point.jpeg", 0.5),
    "error": ("error-out.png", 0.5),
    "error-net": ("error-net.png", 0.5),
    "free-ball": ("free-ball.png", 0.5),
    "celebrate": ("celebrate.png", 0.4),
    "defeat": ("defeat.png", 0.5),
    "ready-to-serve": ("ready-to-serve.png", 0.45),
    "attack-2": ("tu-ataque-por2.png", 0.95),
    "attack-4": ("tu-ataque-por4.png", 0.37),
    "just-in-attack": ("just-in-attack.png", 0.5),
    "setter-miss": ("setter-miss.png", 0.55),
    "ball-in-air": ("ball-in-air.png", 0.5),
}


def crop_to_ratio(
    image: Image.Image,
    ratio: float,
    offset: float,
) -> Image.Image:
    width, height = image.size
    if width / height > ratio:
        new_width = int(height * ratio)
        left = int((width - new_width) * offset)
        return image.crop((left, 0, left + new_width, height))
    new_height = int(width / ratio)
    top = int((height - new_height) * offset)
    return image.crop((0, top, width, top + new_height))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (filename, offset) in SHOTS.items():
        source = SRC / filename
        image = Image.open(source).convert("RGB")
        image = crop_to_ratio(image, RATIO, offset)
        image = image.resize(OUT_SIZE, Image.Resampling.NEAREST)
        image = image.quantize(colors=COLORS).convert("RGB")
        path = OUT / f"{name}.png"
        image.save(path, optimize=True)
        print(
            "  ",
            path.relative_to(ROOT),
            path.stat().st_size,
            "bytes",
        )


if __name__ == "__main__":
    main()
