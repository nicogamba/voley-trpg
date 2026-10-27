#!/usr/bin/env python3
"""Recorta y recolorea el arte de ZONA 3 para la cancha v2.

Las hojas vienen en JPEG 2048x2048 con fondo verde y una grilla de 5x4
(19 frames). Este script:
  1. separa cada celda y quita el verde,
  2. escala cada frame a un lienzo fijo de 48x58 con los pies al piso,
  3. recolorea camiseta, short y detalles por equipo conservando luces
     y sombras,
  4. arma una hoja 5x4 por clase y equipo.
"""

from __future__ import annotations

import colorsys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-source" / "principal"
OUT = ROOT / "app" / "src" / "assets" / "sprites"

CELLS = 5
ROWS = 4
FRAME_W = 48
FRAME_H = 58
FEET_Y = FRAME_H - 2
TARGET_HEIGHT = 44

# Kits por equipo: camiseta, short, detalle.
TEAMS = {
    "arg": ("#4f7fd4", "#223a7a", "#e8eefc"),
    "chi": ("#c8352f", "#1b2a5e", "#ffffff"),
    "ita": ("#2f6fd0", "#f0f4ff", "#ffffff"),
    "jpn": ("#e8eefc", "#b8242f", "#b8242f"),
    "usa": ("#23335e", "#c8352f", "#e8eefc"),
    "bra": ("#ffd166", "#1f9d55", "#1f9d55"),
}

# En las hojas de jugadores de campo la camiseta es magenta y el detalle
# amarillo; el líbero los invierte (camiseta amarilla, detalle magenta).
CLASS_MAP = {
    "setter": {"magenta": "shirt", "cyan": "shorts", "yellow": "trim"},
    "middle": {"magenta": "shirt", "cyan": "shorts", "yellow": "trim"},
    "opposite": {"magenta": "shirt", "cyan": "shorts", "yellow": "trim"},
    "libero": {"magenta": "trim", "cyan": "shorts", "yellow": "shirt"},
}

# Valor base de cada zona en el arte original, para conservar el sombreado.
BASE_VALUE = {"magenta": 0.84, "cyan": 0.85, "yellow": 0.99}


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def hsv(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    return colorsys.rgb_to_hsv(*(channel / 255 for channel in rgb))


def shade(target: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    h, s, v = hsv(target)
    s = min(1.0, s * (0.88 + 0.24 * factor))
    v = min(1.0, v * factor)
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (round(r * 255), round(g * 255), round(b * 255))


def classify(rgb: tuple[int, int, int]) -> str | None:
    r, g, b = (channel / 255 for channel in rgb)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if v < 0.18 or s < 0.28:
        return None
    if 0.78 <= h <= 0.94 and s > 0.4:
        return "magenta"
    if 0.46 <= h <= 0.60 and s > 0.4:
        return "cyan"
    if 0.115 <= h <= 0.20 and s > 0.5:
        return "yellow"
    return None


def is_green(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    return g > 64 and g > max(r, b) * 1.12


def cell_box(source: Image.Image, index: int) -> tuple[int, int, int, int]:
    width, height = source.size
    cell_w = width / CELLS
    cell_h = height / ROWS
    col = index % CELLS
    row = index // CELLS
    return (
        int(round(col * cell_w)) + 6,
        int(round(row * cell_h)) + 6,
        int(round((col + 1) * cell_w)) - 6,
        int(round((row + 1) * cell_h)) - 6,
    )


def keyed(cell: Image.Image) -> Image.Image:
    """Fondo verde a alfa cero, conservando el contorno negro."""
    clean = Image.new("RGBA", cell.size)
    data = []
    for rgb in cell.getdata():
        if is_green(rgb):
            data.append((0, 0, 0, 0))
        else:
            data.append((*rgb, 255))
    clean.putdata(data)
    # Erosiona un píxel el alfa: borra el fleco verde que deja el JPEG.
    clean.putalpha(clean.getchannel("A").filter(ImageFilter.MinFilter(3)))
    return clean


def content_bbox(frame: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = frame.getchannel("A")
    box = alpha.getbbox()
    return box


def despill(frame: Image.Image) -> Image.Image:
    """Borra los píxeles verdes que quedan pegados al borde del sprite."""
    out = frame.copy()
    pixels = out.load()
    width, height = out.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if not a or g <= 50 or g <= max(r, b) * 1.1:
                continue
            edge = False
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        edge = True
                    elif pixels[nx, ny][3] == 0:
                        edge = True
            if edge:
                pixels[x, y] = (0, 0, 0, 0)
    return out


def idle_height(source: Image.Image) -> int:
    """Alto del primer frame (reposo) para fijar la escala."""
    cell = source.crop(cell_box(source, 0)).convert("RGB")
    frame = keyed(cell)
    box = content_bbox(frame)
    if box is None:
        return 460
    return box[3] - box[1]


def build_frames(class_id: str) -> list[Image.Image]:
    source = Image.open(SRC / f"{class_id}.jpeg").convert("RGB")
    reference = idle_height(source)
    scale = TARGET_HEIGHT / reference
    print(class_id, "idle height", reference, "scale", round(scale, 4))
    frames: list[Image.Image] = []
    for index in range(CELLS * ROWS - 1):
        cell = source.crop(cell_box(source, index)).convert("RGB")
        clean = keyed(cell)
        box = content_bbox(clean)
        canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        if box is not None:
            cropped = clean.crop(box)
            size = (
                max(1, round(cropped.width * scale)),
                max(1, round(cropped.height * scale)),
            )
            small = cropped.resize(size, Image.NEAREST)
            x = (FRAME_W - small.width) // 2
            y = FEET_Y - small.height
            canvas.alpha_composite(small, (max(0, x), max(0, y)))
        frames.append(despill(canvas))
    return frames


def recolor(
    frame: Image.Image,
    class_id: str,
    colors: dict[str, tuple[int, int, int]],
    mapping: dict[str, str] | None = None,
) -> Image.Image:
    mapping = mapping or CLASS_MAP[class_id]
    out = Image.new("RGBA", frame.size)
    data = []
    for r, g, b, alpha in frame.getdata():
        if alpha == 0:
            data.append((0, 0, 0, 0))
            continue
        bucket = classify((r, g, b))
        if bucket is not None:
            region = mapping[bucket]
            factor = min(1.12, max(0.45, hsv((r, g, b))[2] / BASE_VALUE[bucket]))
            r, g, b = shade(colors[region], factor)
        data.append((r, g, b, alpha))
    out.putdata(data)
    return out


def write_players() -> None:
    for class_id in CLASS_MAP:
        frames = build_frames(class_id)
        for team, kit in TEAMS.items():
            colors = {
                "shirt": hex_rgb(kit[0]),
                "shorts": hex_rgb(kit[1]),
                "trim": hex_rgb(kit[2]),
            }
            sheet = Image.new(
                "RGBA", (FRAME_W * CELLS, FRAME_H * ROWS), (0, 0, 0, 0)
            )
            for index, frame in enumerate(frames):
                tinted = recolor(frame, class_id, colors)
                sheet.alpha_composite(
                    tinted,
                    ((index % CELLS) * FRAME_W, (index // CELLS) * FRAME_H),
                )
            path = OUT / f"players/{team}-{class_id}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            sheet.save(path, optimize=True)
            print("  ", path.relative_to(ROOT), path.stat().st_size, "bytes")


def write_ball() -> None:
    ball = Image.open(SRC / "ball.jpeg").convert("RGB")
    sheet = Image.new("RGBA", (16 * 4, 16), (0, 0, 0, 0))
    cell_w = ball.width / 2
    cell_h = ball.height / 2
    for index in range(4):
        col = index % 2
        row = index // 2
        cell = ball.crop(
            (
                int(col * cell_w) + 8,
                int(row * cell_h) + 8,
                int((col + 1) * cell_w) - 8,
                int((row + 1) * cell_h) - 8,
            )
        )
        clean = keyed(cell)
        box = content_bbox(clean)
        if box is None:
            continue
        cropped = clean.crop(box)
        side = min(cropped.width, cropped.height)
        cropped = cropped.crop(
            (
                (cropped.width - side) // 2,
                (cropped.height - side) // 2,
                (cropped.width + side) // 2,
                (cropped.height + side) // 2,
            )
        )
        small = cropped.resize((14, 14), Image.NEAREST)
        sheet.alpha_composite(despill(small), (index * 16 + 1, 1))
    path = OUT / "ball.png"
    sheet.save(path, optimize=True)
    print("  ", path.relative_to(ROOT), path.stat().st_size, "bytes")


# Orden de los retratos generados: setter, opposite, middle, libero.
PORTRAIT_INDEX = {"setter": 0, "opposite": 1, "middle": 2, "libero": 3}
# Los tres primeros traen camiseta magenta y detalle amarillo; el líbero
# los invierte, igual que su hoja de sprites.
PORTRAIT_MAP = {
    0: {"magenta": "shirt", "cyan": "shorts", "yellow": "trim"},
    1: {"magenta": "shirt", "cyan": "shorts", "yellow": "trim"},
    2: {"magenta": "shirt", "cyan": "shorts", "yellow": "trim"},
    3: {"magenta": "trim", "cyan": "shorts", "yellow": "shirt"},
}
PORTRAIT_KITS = {
    "home": ("#5b8cff", "#ffd166"),
    "away": ("#ff5d73", "#ffd166"),
}


def write_portraits() -> None:
    source = Image.open(SRC / "portraits.jpeg").convert("RGB")
    width, height = source.size
    cell_w = width / 2
    cell_h = height / 2
    for class_id, index in PORTRAIT_INDEX.items():
        col = index % 2
        row = index // 2
        cell = source.crop(
            (
                int(col * cell_w) + 6,
                int(row * cell_h) + 6,
                int((col + 1) * cell_w) - 6,
                int((row + 1) * cell_h) - 6,
            )
        )
        clean = keyed(cell)
        box = content_bbox(clean)
        if box is None:
            continue
        cropped = clean.crop(box)
        side = min(cropped.width, cropped.height)
        cropped = cropped.crop(
            (
                (cropped.width - side) // 2,
                (cropped.height - side) // 2,
                (cropped.width + side) // 2,
                (cropped.height + side) // 2,
            )
        )
        small = cropped.resize((128, 128), Image.NEAREST)
        small = despill(small)
        for side_name, (shirt, trim) in PORTRAIT_KITS.items():
            colors = {
                "shirt": hex_rgb(shirt),
                "shorts": hex_rgb(shirt),
                "trim": hex_rgb(trim),
            }
            tinted = recolor(
                small,
                class_id,
                colors,
                PORTRAIT_MAP[index],
            )
            path = OUT / f"portraits/{side_name}-{class_id}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            tinted.save(path, optimize=True)
        print("  portrait", class_id, "ok")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write_players()
    write_ball()
    write_portraits()


if __name__ == "__main__":
    main()
