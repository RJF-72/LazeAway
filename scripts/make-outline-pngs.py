#!/usr/bin/env python3
"""Make colorless outline (black line art on white) PNGs for LazeAway.

Two modes:
  photo   — grayscale -> blur -> Sobel edge detect -> threshold -> dilate.
            For color photos (e.g. flowers/cactus on a solid background).
  lineart — grayscale -> threshold. For images that are already line art
            (e.g. the Texas outline), where Sobel would double every stroke.

Output is trimmed to the ink bounding box with a small white margin.
Used to build the built-in picture templates in src/renderer/src/assets/.

Usage:
  python3 scripts/make-outline-pngs.py <input> <output> <photo|lineart> [threshold]
  threshold: photo-mode edge cutoff, default 45. Higher = fewer, bolder lines.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

MAX_SIDE = 1200
MARGIN = 12


def to_gray(path: str) -> Image.Image:
    img = Image.open(path).convert("L")
    img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return img


def sobel(gray: np.ndarray) -> np.ndarray:
    """Sobel edge magnitude, 0..255, via padded shifts (no cv2 needed)."""
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
    ky = kx.T
    padded = np.pad(gray, 1, mode="edge")
    gx = np.zeros_like(gray, dtype=np.float32)
    gy = np.zeros_like(gray, dtype=np.float32)
    for dy in range(3):
        for dx in range(3):
            patch = padded[dy : dy + gray.shape[0], dx : dx + gray.shape[1]]
            gx += kx[dy, dx] * patch
            gy += ky[dy, dx] * patch
    mag = np.sqrt(gx * gx + gy * gy)
    peak = mag.max()
    if peak > 0:
        mag = mag / peak * 255.0
    return mag


def dilate(binary: np.ndarray) -> np.ndarray:
    """1px 3x3 max dilation so engraved lines read at laser spot size."""
    padded = np.pad(binary, 1, mode="constant", constant_values=255)
    out = binary.copy()
    for dy in range(3):
        for dx in range(3):
            out = np.minimum(out, padded[dy : dy + binary.shape[0], dx : dx + binary.shape[1]])
    return out


def trim(img: Image.Image) -> Image.Image:
    arr = np.array(img)
    ink = arr < 128
    if not ink.any():
        return img
    rows = np.where(ink.any(axis=1))[0]
    cols = np.where(ink.any(axis=0))[0]
    box = (
        max(0, cols.min() - MARGIN),
        max(0, rows.min() - MARGIN),
        min(img.width, cols.max() + 1 + MARGIN),
        min(img.height, rows.max() + 1 + MARGIN),
    )
    return img.crop(box)


def outline_photo(path: str, threshold: int = 45) -> Image.Image:
    img = to_gray(path).filter(ImageFilter.GaussianBlur(radius=1.0))
    mag = sobel(np.array(img, dtype=np.float32))
    # Strong edges -> black ink, everything else -> white paper.
    binary = np.where(mag > threshold, 0, 255).astype(np.uint8)
    binary = dilate(binary)
    return trim(Image.fromarray(binary, mode="L"))


def outline_lineart(path: str) -> Image.Image:
    img = to_gray(path)
    arr = np.array(img)
    binary = np.where(arr < 160, 0, 255).astype(np.uint8)
    return trim(Image.fromarray(binary, mode="L"))


def main() -> None:
    if len(sys.argv) not in (4, 5) or sys.argv[3] not in ("photo", "lineart"):
        print(__doc__)
        raise SystemExit(2)
    src, dst, mode = sys.argv[1], sys.argv[2], sys.argv[3]
    threshold = int(sys.argv[4]) if len(sys.argv) == 5 else 45
    out = outline_photo(src, threshold) if mode == "photo" else outline_lineart(src)
    out.save(dst, "PNG", optimize=True)
    print(f"{dst}: {out.size[0]}x{out.size[1]} mode={out.mode}")


if __name__ == "__main__":
    main()
