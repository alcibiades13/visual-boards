"""Regenerates the small e2e image fixtures. sample.heic comes from the heic2any demo (MIT)."""
from pathlib import Path
from PIL import Image, ImageDraw

here = Path(__file__).parent

def scene(w, h, color, label):
    img = Image.new("RGB", (w, h), color)
    d = ImageDraw.Draw(img)
    # an arrow pointing "up" in the stored pixels, so rotation errors are visible
    d.polygon([(w // 2, h // 8), (w // 2 - w // 6, h // 3), (w // 2 + w // 6, h // 3)], fill="white")
    d.rectangle([w // 2 - w // 20, h // 3, w // 2 + w // 20, h * 7 // 8], fill="white")
    d.text((10, 10), label, fill="black")
    return img

# Stored landscape 600x300, EXIF orientation 6 => displayed as portrait 300x600.
img = scene(600, 300, (180, 90, 60), "rotated")
exif = Image.Exif()
exif[0x0112] = 6
img.save(here / "rotated-exif6.jpg", quality=85, exif=exif.tobytes())

scene(400, 300, (60, 110, 160), "landscape").save(here / "landscape.jpg", quality=85)
scene(300, 450, (90, 140, 90), "portrait").save(here / "portrait.png")
