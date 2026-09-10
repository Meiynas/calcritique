#!/usr/bin/env bash
# Construit le moteur de calcul @smogon/calc à partir du dépôt GitHub de Showdown (branche master)
# et le range dans vendor/smogon-calc.tgz (utilisé par package.json : "file:vendor/smogon-calc.tgz").
#
# Pourquoi : le paquet npm @smogon/calc n'est publié que rarement (0.11.0 en mars 2026), alors que
# le calculateur Showdown est mis à jour sur GitHub quelques heures après chaque régulation
# (nouveaux Pokémon, Méga, objets, talents, changements propres à Champions).
#
# Usage : bash scripts/build-engine.sh [dossier de travail]
# Ne reconstruit rien si le dossier calc/ de Showdown n'a pas changé depuis la dernière fois.
# Mettre FORCE=1 pour reconstruire quand même.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:-$(mktemp -d)}"
REPO="https://github.com/smogon/damage-calc.git"
META="$ROOT/vendor/smogon-calc.json"
TGZ="$ROOT/vendor/smogon-calc.tgz"
mkdir -p "$ROOT/vendor" "$WORK"

if [ -d "$WORK/damage-calc/.git" ]; then
  git -C "$WORK/damage-calc" fetch --quiet --depth 1 origin master
  git -C "$WORK/damage-calc" reset --quiet --hard origin/master
else
  git clone --quiet --depth 1 "$REPO" "$WORK/damage-calc"
fi
cd "$WORK/damage-calc"
COMMIT="$(git rev-parse HEAD)"
TREE="$(git rev-parse HEAD:calc)"   # empreinte du dossier calc/ : change seulement si le moteur change
DATE="$(git log -1 --format=%cs)"

if [ -z "${FORCE:-}" ] && [ -f "$META" ] && [ -f "$TGZ" ] && grep -q "\"tree\": \"$TREE\"" "$META"; then
  echo "Moteur déjà à jour (calc/ $TREE)" >&2
  exit 0
fi

echo "Construction du moteur depuis smogon/damage-calc $COMMIT ($DATE)" >&2
cd calc
npm ci --ignore-scripts --no-audit --no-fund --loglevel=error >&2
npx --no-install tsc -p . >&2

STAGE="$WORK/engine-package"
rm -rf "$STAGE" && mkdir -p "$STAGE/package"
cp -R dist "$STAGE/package/dist"
rm -rf "$STAGE/package/dist/test"
find "$STAGE/package/dist" -name '*.map' -delete
cp README.md "$STAGE/package/" 2>/dev/null || true
cp ../LICENSE "$STAGE/package/" 2>/dev/null || true
BASE_VERSION="$(node -p "require('./package.json').version")"
SHORT="${COMMIT:0:7}"
node -e "
const p = require('./package.json')
const out = { name: p.name, version: '$BASE_VERSION-git.$SHORT', description: p.description, license: p.license,
  repository: p.repository, main: p.main, types: p.types }
require('fs').writeFileSync('$STAGE/package/package.json', JSON.stringify(out, null, 2) + '\n')
"
# Archive reproductible : même moteur = même fichier (dates, propriétaires et ordre fixés)
tar --sort=name --mtime='2020-01-01 00:00:00Z' --owner=0 --group=0 --numeric-owner -cf - -C "$STAGE" package | gzip -n -9 > "$TGZ.new"
mv "$TGZ.new" "$TGZ"
cat > "$META" <<JSON
{
  "source": "$REPO",
  "commit": "$COMMIT",
  "tree": "$TREE",
  "date": "$DATE",
  "version": "$BASE_VERSION-git.$SHORT"
}
JSON
echo "Moteur écrit dans vendor/smogon-calc.tgz ($(du -k "$TGZ" | cut -f1) Ko)" >&2

# Met à jour node_modules et package-lock.json avec la nouvelle archive
cd "$ROOT"
npm install --no-audit --no-fund --loglevel=error >&2
