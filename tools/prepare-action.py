#!/usr/bin/env python3
"""Prepara las imágenes de acción CT1 y las recolorea por equipo.

Entrada:
  art-source/actions/<clase>/<pose>.png
  o art-source/actions/<clase>-<pose>.png

Las imágenes se generan con el kit cromático que ya usa el resto del arte:
  camiseta magenta, short cian, vivos amarillos (el líbero los invierte).
El script cuantiza la imagen, reemplaza esos colores por los del equipo
conservando el sombreado y deja intactos piel, pelo, pelota y fondo.

Salida:
  app/src/assets/action/<equipo>/<clase>-<pose>.png  (720x640)

Uso:
  python3 tools/prepare-action.py
  python3 tools/prepare-action.py --team arg --team bra
  python3 tools/prepare-action.py --src /tmp/acciones --out /tmp/salida
"""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = ROOT / "art-source" / "actions"
DEFAULT_OUT = ROOT / "app" / "src" / "assets" / "action"

CLASSES = ("setter", "middle", "opposite", "libero")
POSES = (
    "serve-ready",
    "serve-contact",
    "receive",
    "set",
    "spike",
    "block",
    "dig",
    "celebrate",
    "error",
)

OUT_SIZE = (720, 640)
TARGET_RATIO = OUT_SIZE[0] / OUT_SIZE[1]
COLORS = 32


def load_prepare_sprites():
    """Reutiliza las funciones de color del pipeline de sprites."""
    path = Path(__file__).with_name("prepare-sprites.py")
    spec = importlib.util.spec_from_file_location("prepare_sprites", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("No se pudo cargar prepare-sprites.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def fit_action(image: Image.Image) -> Image.Image:
    """Recorte central a 1.125:1 y escala pixelada a 720x640."""
    width, height = image.size
    if width / height > TARGET_RATIO:
        new_width = int(height * TARGET_RATIO)
        left = (width - new_width) // 2
        image = image.crop((left, 0, left + new_width, height))
    else:
        new_height = int(width / TARGET_RATIO)
        top = (height - new_height) // 2
        image = image.crop((0, top, width, top + new_height))
    return image.resize(OUT_SIZE, Image.Resampling.NEAREST)


def recolor_palette(
    image: Image.Image,
    class_id: str,
    colors: dict[str, tuple[int, int, int]],
    pixel_art,
) -> Image.Image:
    """Cuantiza y reemplaza solo los colores cromáticos del kit."""
    quantized = image.convert("RGB").quantize(
        colors=COLORS,
        method=Image.Quantize.MEDIANCUT,
    )
    palette = quantized.getpalette() or []
    tinted = list(palette)
    mapping = pixel_art.CLASS_MAP[class_id]

    for index in range(COLORS):
        start = index * 3
        rgb = tuple(palette[start : start + 3])
        if len(rgb) != 3:
            continue
        bucket = pixel_art.classify(rgb)
        if bucket is None:
            continue
        region = mapping[bucket]
        factor = min(
            1.12,
            max(
                0.45,
                pixel_art.hsv(rgb)[2] / pixel_art.BASE_VALUE[bucket],
            ),
        )
        tinted[start : start + 3] = list(
            pixel_art.shade(colors[region], factor)
        )

    result = quantized.copy()
    result.putpalette(tinted)
    return result.convert("RGB")


def find_source(src: Path, class_id: str, pose: str) -> Path | None:
    nested = src / class_id / f"{pose}.png"
    if nested.exists():
        return nested
    flat = src / f"{class_id}-{pose}.png"
    if flat.exists():
        return flat
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument(
        "--team",
        action="append",
        choices=sorted(load_prepare_sprites().TEAMS),
        help="equipo a generar; repetible. Por defecto, todos.",
    )
    args = parser.parse_args()

    pixel_art = load_prepare_sprites()
    teams = args.team or list(pixel_art.TEAMS)
    generated = 0
    missing: list[str] = []

    for class_id in CLASSES:
        for pose in POSES:
            source = find_source(args.src, class_id, pose)
            if source is None:
                missing.append(f"{class_id}/{pose}")
                continue
            image = Image.open(source).convert("RGB")
            fitted = fit_action(image)
            for team in teams:
                shirt, shorts, trim = pixel_art.TEAMS[team]
                colors = {
                    "shirt": pixel_art.hex_rgb(shirt),
                    "shorts": pixel_art.hex_rgb(shorts),
                    "trim": pixel_art.hex_rgb(trim),
                }
                tinted = recolor_palette(
                    fitted,
                    class_id,
                    colors,
                    pixel_art,
                )
                path = args.out / team / f"{class_id}-{pose}.png"
                path.parent.mkdir(parents=True, exist_ok=True)
                tinted.save(path, optimize=True)
                generated += 1
                try:
                    label = path.relative_to(ROOT)
                except ValueError:
                    label = path
                print("  ", label, path.stat().st_size, "bytes")

    print(f"\n{generated} imágenes generadas")
    if missing:
        print(f"{len(missing)} poses faltantes:")
        for item in missing:
            print("  -", item)


if __name__ == "__main__":
    main()
