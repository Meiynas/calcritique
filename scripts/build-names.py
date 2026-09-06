#!/usr/bin/env python3
"""Construit src/data/names.json : noms français et anglais pour tout ce que connaît le moteur de calcul.

Sources : fichiers CSV de PokéAPI (dossier /tmp/pokeapi, voir README des données) et
la liste des noms du moteur @smogon/calc (fichier /tmp/calcnames.json, généré avec node).
Langues PokéAPI : 5 = français, 9 = anglais.
"""
import csv, json, re, unicodedata, sys
from pathlib import Path

POKEAPI = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/pokeapi")
CALC = json.load(open(sys.argv[2] if len(sys.argv) > 2 else "/tmp/calcnames.json"))
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "names.json"

FR, EN = "5", "9"

def read(name):
    with open(POKEAPI / f"{name}.csv", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s.lower())

def by_lang(rows, idcol, namecol):
    fr, en = {}, {}
    for r in rows:
        if r["local_language_id"] == FR:
            fr[r[idcol]] = r[namecol]
        elif r["local_language_id"] == EN:
            en[r[idcol]] = r[namecol]
    return fr, en

def simple_table(rows_names, idcol, calc_list, label):
    """Associe les noms anglais du moteur aux noms français via le nom anglais PokéAPI."""
    fr, en = by_lang(rows_names, idcol, "name")
    en_to_id = {norm(v): k for k, v in en.items()}
    table, missing = {}, []
    for name in calc_list:
        k = en_to_id.get(norm(name))
        if k and k in fr:
            table[name] = {"fr": fr[k], "en": name}
        else:
            table[name] = {"fr": name, "en": name}
            missing.append(name)
    print(f"{label}: {len(table)} entrées, {len(missing)} sans traduction", file=sys.stderr)
    if missing:
        print("   ", ", ".join(missing[:40]), file=sys.stderr)
    return table

# --- Espèces et formes ---
species_rows = read("pokemon_species")
species_fr, species_en = by_lang(read("pokemon_species_names"), "pokemon_species_id", "name")
species_en_to_id = {norm(v): k for k, v in species_en.items()}

forms = read("pokemon_forms")                # identifier ex : landorus-therian
form_fr, form_en = by_lang(read("pokemon_form_names"), "pokemon_form_id", "pokemon_name")
form_by_ident = {norm(f["identifier"]): f["id"] for f in forms}

# Alias manuels : nom du moteur -> identifiant de forme PokéAPI
ALIASES = {
    "indeedee-f": "indeedee-female",
    "meowstic-f": "meowstic-female",
    "basculegion-f": "basculegion-female",
    "oinkologne-f": "oinkologne-female",
    "ogerpon-wellspring": "ogerpon-wellspring-mask",
    "ogerpon-hearthflame": "ogerpon-hearthflame-mask",
    "ogerpon-cornerstone": "ogerpon-cornerstone-mask",
    "tauros-paldea-combat": "tauros-paldea-combat-breed",
    "tauros-paldea-blaze": "tauros-paldea-blaze-breed",
    "tauros-paldea-aqua": "tauros-paldea-aqua-breed",
    "urshifu-rapid-strike": "urshifu-rapid-strike",
    "zacian-crowned": "zacian-crowned",
    "zamazenta-crowned": "zamazenta-crowned",
    "necrozma-dusk-mane": "necrozma-dusk",
    "necrozma-dawn-wings": "necrozma-dawn",
    "calyrex-ice": "calyrex-ice",
    "calyrex-shadow": "calyrex-shadow",
    "lycanroc-dusk": "lycanroc-dusk",
    "darmanitan-galar-zen": "darmanitan-galar-zen",
    "greninja-ash": "greninja-ash",
    "toxtricity-low-key": "toxtricity-low-key",
    "giratina-origin": "giratina-origin",
    "palafin-hero": "palafin-hero",
    "gimmighoul-roaming": "gimmighoul-roaming",
    "ursaluna-bloodmoon": "ursaluna-bloodmoon",
    "terapagos-terastal": "terapagos-terastal",
    "terapagos-stellar": "terapagos-stellar",
}

def species_entry(name):
    n = norm(name)
    # 1. espèce de base
    if n in species_en_to_id:
        sid = species_en_to_id[n]
        return {"fr": species_fr.get(sid, name), "en": name}
    # 2. forme connue de PokéAPI
    candidates = [ALIASES.get(name.lower().replace(" ", "-"), None), name.lower().replace(" ", "-")]
    for c in candidates:
        if c and norm(c) in form_by_ident:
            fid = form_by_ident[norm(c)]
            fr = form_fr.get(fid) or ""
            if fr:
                return {"fr": fr, "en": name}
    # 3. repli : nom FR de l'espèce de base + suffixe anglais
    base, _, suffix = name.partition("-")
    sid = species_en_to_id.get(norm(base))
    if sid:
        fr_base = species_fr.get(sid, base)
        if suffix.startswith("Mega"):
            return {"fr": "Méga-" + fr_base + suffix[4:].replace("-", " "), "en": name}
        if suffix == "Alola":
            return {"fr": fr_base + " d'Alola", "en": name}
        if suffix == "Galar":
            return {"fr": fr_base + " de Galar", "en": name}
        if suffix == "Hisui":
            return {"fr": fr_base + " de Hisui", "en": name}
        if suffix.startswith("Paldea"):
            return {"fr": fr_base + " de Paldea" + suffix[6:].replace("-", " "), "en": name}
        return {"fr": fr_base + " " + suffix.replace("-", " "), "en": name}
    return {"fr": name, "en": name}

species_table = {}
fallbacks = 0
for name in CALC["species"]:
    e = species_entry(name)
    species_table[name] = e
    if e["fr"] == name and "-" in name:
        fallbacks += 1
print(f"espèces: {len(species_table)} entrées, {fallbacks} sans traduction", file=sys.stderr)

moves_table = simple_table(read("move_names"), "move_id", CALC["moves"], "attaques")
items_table = simple_table(read("item_names"), "item_id", CALC["items"], "objets")
abilities_table = simple_table(read("ability_names"), "ability_id", CALC["abilities"], "talents")
natures_table = simple_table(read("nature_names"), "nature_id", CALC["natures"], "natures")
types_table = simple_table(read("type_names"), "type_id", CALC["types"], "types")

OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump(
    {"species": species_table, "moves": moves_table, "items": items_table,
     "abilities": abilities_table, "natures": natures_table, "types": types_table},
    open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"),
)
print(f"écrit {OUT} ({OUT.stat().st_size // 1024} Ko)", file=sys.stderr)
