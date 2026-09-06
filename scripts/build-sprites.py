#!/usr/bin/env python3
"""Construit src/data/sprites.json : petite icône (data URI PNG) par Pokémon du pool Champions.

Source : dépôt PokeAPI/sprites (icônes génération VIII, 40 px, quelques centaines d'octets chacune).
Repli : sprite 96 px classique quand l'icône n'existe pas (formes récentes).
"""
import base64, json, sys, urllib.request
from pathlib import Path

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
    if name in old:
        out[name] = old[name]
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
    out[name] = "data:image/png;base64," + base64.b64encode(data).decode()
    print(name, len(data), file=sys.stderr)

json.dump(out, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
print(f"{len(out)} sprites, manquants : {missing}", file=sys.stderr)
print(f"écrit {OUT} ({OUT.stat().st_size // 1024} Ko)", file=sys.stderr)
