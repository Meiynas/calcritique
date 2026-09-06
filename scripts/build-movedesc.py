#!/usr/bin/env python3
"""Construit src/data/movedesc.json : description FR / EN de chaque attaque connue (texte du jeu, dernière version disponible).

Source : PokéAPI move_flavor_text.csv (langue 5 = français, 9 = anglais) + move_names.csv.
"""
import csv, json, sys
from pathlib import Path

POKEAPI = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/pokeapi")
ROOT = Path(__file__).resolve().parent.parent
NAMES = json.load(open(ROOT / "src" / "data" / "names.json", encoding="utf-8"))
OUT = ROOT / "src" / "data" / "movedesc.json"

move_en = {}
with open(POKEAPI / "move_names.csv", encoding="utf-8", newline="") as f:
    for r in csv.DictReader(f):
        if r["local_language_id"] == "9":
            move_en[r["move_id"]] = r["name"]

best = {}  # (move_id, lang) -> (version_group, text)
with open(POKEAPI / "move_flavor_text.csv", encoding="utf-8", newline="") as f:
    for r in csv.DictReader(f):
        if r["language_id"] not in ("5", "9"):
            continue
        key = (r["move_id"], r["language_id"])
        vg = int(r["version_group_id"])
        if key not in best or vg > best[key][0]:
            txt = " ".join(r["flavor_text"].replace("­\n", "").replace("\n", " ").replace("\u2014", " - ").split())
            best[key] = (vg, txt)

known = set(NAMES["moves"].keys())
out = {}
for mid, en in move_en.items():
    if en not in known:
        continue
    fr = best.get((mid, "5"), (0, ""))[1]
    e = best.get((mid, "9"), (0, ""))[1]
    if fr or e:
        out[en] = {"fr": fr, "en": e}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(out)} descriptions, écrit {OUT} ({OUT.stat().st_size // 1024} Ko)", file=sys.stderr)
