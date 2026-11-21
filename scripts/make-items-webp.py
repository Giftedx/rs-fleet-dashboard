# Writes site/items.webp from an items.png sheet (default site/items.png) as lossless WebP and embeds its SHA-256.
# Usage: python scripts/make-items-webp.py [path/to/items.png] [--out path/to/items.webp]   (needs Pillow)
import hashlib
import sys
from pathlib import Path
from PIL import Image

site = Path(__file__).resolve().parent.parent / 'site'
args = sys.argv[1:]
out = site / 'items.webp'
if '--out' in args:
    idx = args.index('--out')
    out = Path(args[idx + 1]).resolve()
    args = args[:idx] + args[idx + 2:]

src = Path(args[0]).resolve() if args else site / 'items.png'
raw = src.read_bytes()
digest = hashlib.sha256(raw).hexdigest()
sheet = Image.open(src).convert('RGBA')
sheet.save(out, lossless=True, quality=100, method=6, xmp=f'items-png-sha256:{digest}'.encode())
if Image.open(out).convert('RGBA').tobytes() != sheet.tobytes():
    raise SystemExit('items.webp pixels differ from source items.png')
print(f"items.webp {out.stat().st_size} bytes from {src} ({len(raw)} bytes, sha256={digest[:12]})")
