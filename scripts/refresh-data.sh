#!/usr/bin/env bash
# Met à jour le moteur et toutes les données de Calcritique depuis leurs sources (lancé chaque nuit par le robot,
# voir .github/workflows/data-refresh.yml ; peut aussi se lancer à la main) :
#  1. moteur de calcul : GitHub de Showdown (smogon/damage-calc), mode Champions   -> vendor/smogon-calc.tgz
#  2. pool légal et attaques apprenables de la régulation en cours : Pokémon Showdown -> src/data/learnsets.json
#  3. noms FR / EN, précision, talents, descriptions : PokéAPI + Showdown            -> src/data/names.json, extra.json, movedesc.json
#  4. icônes des nouveaux Pokémon : PokeAPI/sprites                                  -> src/data/sprites.json
# Les statistiques d'usage (scripts/fetch-usage.mjs) sont une étape séparée.
# Prérequis : Node 22 (npm ci déjà fait), Python 3 avec Pillow, git, curl.
# Usage : bash scripts/refresh-data.sh [dossier de travail]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:-/tmp/calcritique-sources}"
mkdir -p "$WORK"
cd "$ROOT"

echo "== 1. Moteur de calcul" >&2
bash scripts/build-engine.sh "$WORK"

echo "== 2. Sources (PokéAPI, Pokémon Showdown)" >&2
bash scripts/fetch-sources.sh "$WORK"

echo "== 3. Pool légal et attaques apprenables" >&2
npx --no-install tsx scripts/build-showdown-data.mts "$WORK/showdown" "$WORK"

echo "== 4. Noms, précision, talents, descriptions" >&2
python3 scripts/build-names.py "$WORK/pokeapi" "$WORK/calcnames.json"
python3 scripts/build-extra.py "$WORK/pokeapi" "$WORK/calcnames.json" "$WORK/showdown.json"
python3 scripts/build-movedesc.py "$WORK/pokeapi"

echo "== 5. Icônes des nouveaux Pokémon" >&2
python3 scripts/build-sprites.py

echo "Terminé." >&2
