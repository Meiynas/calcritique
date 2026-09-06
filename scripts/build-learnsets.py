#!/usr/bin/env python3
"""Construit src/data/learnsets.json : attaques apprenables par Pokémon dans Pokémon Champions.

Source : PokéAPI, pokemon_moves.csv filtré sur le groupe de versions "champions" (id 32),
plus le fichier src/data/extra.json (correspondance nom du moteur -> id PokéAPI).
Les Pokémon présents ici forment le pool légal de Champions.
"""
import csv, json, sys
from pathlib import Path

POKEAPI = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/pokeapi")
ROOT = Path(__file__).resolve().parent.parent
EXTRA = json.load(open(ROOT / "src" / "data" / "extra.json", encoding="utf-8"))
NAMES = json.load(open(ROOT / "src" / "data" / "names.json", encoding="utf-8"))
OUT = ROOT / "src" / "data" / "learnsets.json"
EN = "9"
CHAMPIONS_VG = "32"

move_en = {}
with open(POKEAPI / "move_names.csv", encoding="utf-8", newline="") as f:
    for r in csv.DictReader(f):
        if r["local_language_id"] == EN:
            move_en[r["move_id"]] = r["name"]

known_moves = set(NAMES["moves"].keys())
by_pid = {}
with open(POKEAPI / "pokemon_moves.csv", encoding="utf-8", newline="") as f:
    for r in csv.DictReader(f):
        if r["version_group_id"] != CHAMPIONS_VG:
            continue
        m = move_en.get(r["move_id"])
        if m and m in known_moves:
            by_pid.setdefault(r["pokemon_id"], set()).add(m)

# id PokéAPI -> noms du moteur (plusieurs formes peuvent partager un id de repli)
species_by_pid = {}
for name, info in EXTRA["species"].items():
    species_by_pid.setdefault(str(info["id"]), []).append(name)

out = {}
unmatched = []
for pid, moves in by_pid.items():
    names = species_by_pid.get(pid)
    if not names:
        unmatched.append(pid)
        continue
    for n in names:
        out[n] = sorted(moves)

print(f"Pokémon avec learnset Champions : {len(out)} (ids PokéAPI sans correspondance : {len(unmatched)})", file=sys.stderr)
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"écrit {OUT} ({OUT.stat().st_size // 1024} Ko)", file=sys.stderr)
