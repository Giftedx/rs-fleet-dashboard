# Writes site/items.webp from site/items.png as lossless WebP and stops if any pixel differs.
# Usage: python scripts/make-items-webp.py   (needs Pillow)
from pathlib import Path
from PIL import Image

site = Path(__file__).resolve().parent.parent / 'site'
sheet = Image.open(site / 'items.png').convert('RGBA')
sheet.save(site / 'items.webp', lossless=True, quality=100, method=6)
if Image.open(site / 'items.webp').convert('RGBA').tobytes() != sheet.tobytes():
    raise SystemExit('items.webp pixels differ from items.png')
print(f"items.webp {(site / 'items.webp').stat().st_size} bytes, items.png {(site / 'items.png').stat().st_size} bytes")
