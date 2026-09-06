#!/usr/bin/env python3
"""Construit src/data/extra.json : précision des attaques et talents possibles par Pokémon.

Sources : CSV PokéAPI (moves.csv, pokemon.csv, pokemon_abilities.csv, ability_names.csv, move_names.csv)
et la liste des noms du moteur (/tmp/calcnames.json).
"""
import csv, json, re, unicodedata, sys
from pathlib import Path

POKEAPI = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/pokeapi")
CALC = json.load(open(sys.argv[2] if len(sys.argv) > 2 else "/tmp/calcnames.json"))
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "extra.json"
EN = "9"

def read(name):
    with open(POKEAPI / f"{name}.csv", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s.lower())

# --- Précision des attaques ---
move_en = {r["move_id"]: r["name"] for r in read("move_names") if r["local_language_id"] == EN}
acc_by_norm = {}
for r in read("moves"):
    name = move_en.get(r["id"])
    if not name:
        continue
    acc = int(r["accuracy"]) if r["accuracy"] else None  # None = ne rate jamais
    acc_by_norm[norm(name)] = {"acc": acc, "prio": int(r["priority"] or 0)}

moves = {}
missing = []
for name in CALC["moves"]:
    e = acc_by_norm.get(norm(name))
    if e is None:
        missing.append(name)
        e = {"acc": 100, "prio": 0}
    moves[name] = e
print(f"attaques: {len(moves)}, précision inconnue (100 par défaut) : {len(missing)}", file=sys.stderr)

# --- Talents par Pokémon ---
ability_en = {r["ability_id"]: r["name"] for r in read("ability_names") if r["local_language_id"] == EN}
calc_abilities = {norm(a): a for a in CALC["abilities"]}
pokemon_rows = read("pokemon")
pokemon_by_ident = {norm(p["identifier"]): p["id"] for p in pokemon_rows}
default_by_species = {p["species_id"]: p["id"] for p in pokemon_rows if p["is_default"] == "1"}
species_en_to_id = {norm(r["name"]): r["pokemon_species_id"] for r in read("pokemon_species_names") if r["local_language_id"] == EN}
abilities_by_pokemon = {}
for r in read("pokemon_abilities"):
    a = ability_en.get(r["ability_id"])
    if not a:
        continue
    ca = calc_abilities.get(norm(a))
    if ca:
        abilities_by_pokemon.setdefault(r["pokemon_id"], []).append((int(r["slot"]), ca))

ALIASES = {
    "indeedee-f": "indeedee-female", "meowstic-f": "meowstic-female",
    "basculegion-f": "basculegion-female", "oinkologne-f": "oinkologne-female",
    "ogerpon-wellspring": "ogerpon-wellspring-mask", "ogerpon-hearthflame": "ogerpon-hearthflame-mask",
    "ogerpon-cornerstone": "ogerpon-cornerstone-mask",
    "tauros-paldea-combat": "tauros-paldea-combat-breed", "tauros-paldea-blaze": "tauros-paldea-blaze-breed",
    "tauros-paldea-aqua": "tauros-paldea-aqua-breed",
    "necrozma-dusk-mane": "necrozma-dusk", "necrozma-dawn-wings": "necrozma-dawn",
}

species = {}
nomatch = []
for name in CALC["species"]:
    ident = name.lower().replace(" ", "-")
    cands = [ALIASES.get(ident), ident]
    pid = None
    for c in cands:
        if c and norm(c) in pokemon_by_ident:
            pid = pokemon_by_ident[norm(c)]
            break
    if pid is None and norm(name) in species_en_to_id:
        pid = default_by_species.get(species_en_to_id[norm(name)])
    if pid is None and "-" in name:
        # forme inconnue de PokéAPI : on prend le Pokémon par défaut de l'espèce de base
        base = norm(name.split("-")[0])
        if base in species_en_to_id:
            pid = default_by_species.get(species_en_to_id[base])
    if pid is None:
        nomatch.append(name)
        continue
    abl = sorted(set(abilities_by_pokemon.get(pid, [])))
    species[name] = {"abilities": [a for _, a in abl], "id": int(pid)}
print(f"espèces avec talents: {len(species)}, sans correspondance: {len(nomatch)}", file=sys.stderr)
if nomatch:
    print("   ", ", ".join(nomatch[:30]), file=sys.stderr)

json.dump({"moves": moves, "species": species}, open(OUT, "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print(f"écrit {OUT} ({OUT.stat().st_size // 1024} Ko)", file=sys.stderr)
