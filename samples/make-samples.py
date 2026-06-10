#!/usr/bin/env python3
"""Generate the sample images that ship with MIRL Rephoto.

A matched pair of one building:

  now.png   the building today, photographed straight on, in colour.
  then.png  an older photograph of the same building, taken from a different
            angle (so it needs aligning), toned sepia with a vignette and a
            paper border.

Between the two, the building has changed: a window was bricked up and a
parapet band was added. Once you align "then" onto "now" in the tool, the
blink view makes those changes jump out. Everything is drawn from scratch
with Pillow, so there are no downloads and no licensing questions.

    python3 make-samples.py
"""

import os
from PIL import Image, ImageDraw, ImageOps, ImageChops, ImageFilter

W, H = 1600, 1200
HERE = os.path.dirname(os.path.abspath(__file__))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_sky(d):
    top, bot = (120, 168, 214), (210, 228, 242)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(top, bot, y / H))


def draw_window(d, x, y, w, h, bricked=False):
    frame = (238, 236, 228)
    gt, gb = (96, 120, 140), (54, 74, 96)
    if bricked:
        d.rectangle([x, y, x + w, y + h], fill=(176, 150, 116))
        for by in range(y, y + h, 10):
            d.line([(x, by), (x + w, by)], fill=(150, 128, 98), width=1)
        d.rectangle([x, y, x + w, y + h], outline=(150, 128, 98), width=3)
        return
    d.rectangle([x - 4, y - 4, x + w + 4, y + h + 8], fill=frame)
    for i in range(h):
        d.line([(x, y + i), (x + w, y + i)], fill=lerp(gt, gb, i / h))
    d.line([(x + w // 2, y), (x + w // 2, y + h)], fill=frame, width=4)
    d.line([(x, y + h // 2), (x + w, y + h // 2)], fill=frame, width=4)
    d.rectangle([x, y, x + w, y + h], outline=frame, width=4)


def draw_facade(variant="now"):
    """variant 'now' has the bricked window + parapet; 'then' is the older state."""
    img = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_sky(d)
    d.rectangle([0, H - 120, W, H], fill=(122, 120, 124))

    bx0, by0, bx1, by1 = 180, 150, W - 180, H - 120
    d.rectangle([bx0, by0, bx1, by1], fill=(198, 168, 128))
    for y in range(by0, by1, 26):
        d.line([(bx0, y), (bx1, y)], fill=(184, 156, 118), width=1)

    d.rectangle([bx0 - 14, by0 - 22, bx1 + 14, by0], fill=(170, 142, 104))
    d.rectangle([bx0 - 14, by0 - 22, bx1 + 14, by0 - 18], fill=(150, 124, 90))
    if variant == "now":  # parapet added in the modern state
        d.rectangle([bx0 - 14, by0 - 54, bx1 + 14, by0 - 22], fill=(158, 132, 98))
        d.rectangle([bx0 - 14, by0 - 54, bx1 + 14, by0 - 50], fill=(140, 116, 84))

    cols, rows, margin_x, margin_top, gap_x, gap_y = 4, 3, 70, 60, 40, 46
    ww = ((bx1 - bx0) - 2 * margin_x - (cols - 1) * gap_x) // cols
    wh = int(ww * 1.5)
    for r in range(rows):
        for c in range(cols):
            x = bx0 + margin_x + c * (ww + gap_x)
            y = by0 + margin_top + r * (wh + gap_y)
            draw_window(d, x, y, ww, wh, bricked=(variant == "now" and r == 0 and c == 2))

    dw, dh = 150, 230
    dx, dy = (W - dw) // 2, by1 - dh
    d.rectangle([dx, dy + 30, dx + dw, by1], fill=(108, 72, 46))
    d.pieslice([dx, dy, dx + dw, dy + 60], 180, 360, fill=(108, 72, 46))
    d.rectangle([dx + dw // 2 - 3, dy + 30, dx + dw // 2 + 3, by1], fill=(80, 52, 32))
    d.rectangle([dx - 40, by1, dx + dw + 40, by1 + 18], fill=(150, 148, 150))
    return img


def gauss_solve(A, b):
    """Solve an n x n system A x = b with partial-pivot Gaussian elimination."""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        M[col], M[piv] = M[piv], M[col]
        pv = M[col][col]
        for j in range(col, n + 1):
            M[col][j] /= pv
        for r in range(n):
            if r != col and M[r][col]:
                f = M[r][col]
                for j in range(col, n + 1):
                    M[r][j] -= f * M[col][j]
    return [M[i][n] for i in range(n)]


def find_coeffs(dest, src):
    """8 perspective coeffs mapping output (dest) -> input (src) for PIL."""
    A, b = [], []
    for (dx, dy), (sx, sy) in zip(dest, src):
        A.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]); b.append(sx)
        A.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]); b.append(sy)
    return gauss_solve(A, b)


def make_then(base):
    """Skew the frontal facade to a 3/4 viewpoint, then age it."""
    src = [(0, 0), (W, 0), (W, H), (0, H)]
    dest = [(150, 90), (W - 36, 168), (W - 96, H - 70), (62, H - 28)]  # camera to the left
    coeffs = find_coeffs(dest, src)
    warped = base.transform((W, H), Image.PERSPECTIVE, coeffs,
                            resample=Image.BICUBIC, fillcolor=(66, 54, 40))
    warped = warped.filter(ImageFilter.GaussianBlur(0.6))

    sepia = ImageOps.colorize(warped.convert("L"), black=(44, 30, 16), white=(252, 240, 206))

    vig = Image.new("L", (W, H), 0)  # vignette
    ImageDraw.Draw(vig).ellipse([-W * 0.15, -H * 0.15, W * 1.15, H * 1.15], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(180))
    sepia = ImageChops.multiply(sepia, Image.merge("RGB", (vig, vig, vig)))

    noise = Image.effect_noise((W, H), 10).convert("RGB")  # a touch of grain (kept light so the PNG stays small)
    sepia = ImageChops.overlay(sepia, Image.blend(Image.new("RGB", (W, H), (128, 128, 128)), noise, 0.08))

    sepia = ImageOps.expand(sepia, border=6, fill=(60, 48, 34))   # keyline
    sepia = ImageOps.expand(sepia, border=46, fill=(243, 236, 219))  # paper border
    return sepia


if __name__ == "__main__":
    now = draw_facade("now")
    now.save(os.path.join(HERE, "now.png"))
    print("wrote now.png")
    make_then(draw_facade("then")).save(os.path.join(HERE, "then.png"))
    print("wrote then.png")
