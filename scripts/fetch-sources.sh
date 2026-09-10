#!/usr/bin/env bash
# Télécharge les sources de données dans un dossier de travail (par défaut /tmp/calcritique-sources) :
#  - pokeapi/  : fichiers CSV de PokéAPI (noms français / anglais, descriptions, précision, identifiants pour les icônes)
#  - showdown/ : données de Pokémon Showdown (dossier data/ et data/mods/champions : pool légal et attaques apprenables
#                de la régulation en cours, précision et priorité propres à Champions)
# Usage : bash scripts/fetch-sources.sh [dossier]
set -euo pipefail

WORK="${1:-/tmp/calcritique-sources}"
mkdir -p "$WORK/pokeapi"

CSV_BASE="https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv"
CSVS="pokemon pokemon_species pokemon_species_names pokemon_forms pokemon_form_names pokemon_abilities
moves move_names move_flavor_text item_names ability_names nature_names type_names"
for f in $CSVS; do
  curl -fsSL --retry 3 --retry-delay 5 "$CSV_BASE/$f.csv" -o "$WORK/pokeapi/$f.csv.new"
  mv "$WORK/pokeapi/$f.csv.new" "$WORK/pokeapi/$f.csv"
done
echo "PokéAPI : $(ls "$WORK/pokeapi" | wc -l) fichiers CSV" >&2

if [ -d "$WORK/showdown/.git" ]; then
  git -C "$WORK/showdown" fetch --quiet --depth 1 origin master
  git -C "$WORK/showdown" reset --quiet --hard origin/master
else
  rm -rf "$WORK/showdown"
  git clone --quiet --depth 1 --filter=blob:none --sparse https://github.com/smogon/pokemon-showdown.git "$WORK/showdown"
  git -C "$WORK/showdown" sparse-checkout set data/mods/champions
fi
echo "Showdown : commit $(git -C "$WORK/showdown" rev-parse --short HEAD) du $(git -C "$WORK/showdown" log -1 --format=%cs)" >&2
