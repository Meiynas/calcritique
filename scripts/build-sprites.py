#!/usr/bin/env python3
"""Construit src/data/sprites.json : petite icône (data URI PNG) par Pokémon du pool Champions.

Source : dépôt PokeAPI/sprites (icônes génération VIII, 40 px, quelques centaines d'octets chacune).
Repli : sprite 96 px classique quand l'icône n'existe pas (formes récentes).
"""
import base64, io, json, sys, urllib.request
from pathlib import Path
from PIL import Image


def normalize(data: bytes) -> bytes:
    """Recadre les marges transparentes puis centre l'image dans un carré : toutes les icônes ont la même taille apparente."""
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    side = max(im.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    if side > 64:
        sq = sq.resize((64, 64), Image.NEAREST)
    out = io.BytesIO()
    sq.save(out, format="PNG", optimize=True)
    return out.getvalue()


ROOT = Path(__file__).resolve().parent.parent
EXTRA = json.load(open(ROOT / "src" / "data" / "extra.json", encoding="utf-8"))
LEARN = json.load(open(ROOT / "src" / "data" / "learnsets.json", encoding="utf-8"))
OUT = ROOT / "src" / "data" / "sprites.json"
BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/"

old = json.load(open(OUT, encoding="utf-8")) if OUT.exists() else {}
out = {}
missing = []
for name in sorted(LEARN):
    info = EXTRA["species"].get(name)
    if not info:
        continue
    if name in old and "--refresh" not in sys.argv:
        # ancienne valeur : on la renormalise (décodage puis recadrage)
        raw = base64.b64decode(old[name].split(",", 1)[1])
        out[name] = "data:image/png;base64," + base64.b64encode(normalize(raw)).decode()
        continue
    pid = info["id"]
    data = None
    for url in (f"{BASE}versions/generation-viii/icons/{pid}.png", f"{BASE}{pid}.png"):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                data = r.read()
                break
        except Exception:
            continue
    if not data:
        missing.append(name)
        continue
    out[name] = "data:image/png;base64," + base64.b64encode(normalize(data)).decode()
    print(name, len(data), file=sys.stderr)

json.dump(out, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
print(f"{len(out)} sprites, manquants : {missing}", file=sys.stderr)
print(f"écrit {OUT} ({OUT.stat().st_size // 1024} Ko)", file=sys.stderr)
