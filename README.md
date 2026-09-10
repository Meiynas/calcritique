# Calcritique

Calculateur de dégâts moderne, en français et en anglais, dédié à Pokémon Champions.

- Logiciel Windows : téléchargez le fichier `.exe` de la dernière version dans l'onglet **Releases**. Le logiciel se met à jour tout seul.
- Version site : https://meiynas.github.io/calcritique/

Le brief complet du projet (objectifs, fonctionnalités, décisions) est dans `CLAUDE.md`.

## Pour Claude : comment est organisé le projet

- `src/` : l'interface (React + TypeScript + Tailwind). `src/lib/engine.ts` fait le lien avec le moteur de dégâts (mode Champions, `src/lib/gen.ts`) et calcule le vrai taux de KO ; `src/lib/names.ts` la recherche FR / EN ; `src/data/` les données générées par `scripts/`. `src/updater.ts` gère la mise à jour automatique.
- `vendor/smogon-calc.tgz` : le moteur de calcul de Showdown, construit depuis leur GitHub par `scripts/build-engine.sh`.
- `scripts/refresh-data.sh` : régénère le pool légal, les attaques apprenables, les noms, les descriptions et les icônes (sources : Pokémon Showdown, PokéAPI). `scripts/fetch-usage.mjs` : statistiques d'usage.
- `.github/workflows/data-refresh.yml` : le robot qui lance tout ça toutes les 6 heures et publie une nouvelle version quand quelque chose a changé (nouvelle régulation, nouveaux Pokémon, statistiques).
- `src-tauri/` : l'enveloppe "logiciel Windows" (Tauri 2). `tauri.conf.json` contient la clé publique des mises à jour et l'adresse où le logiciel cherche les nouvelles versions.
- `.github/workflows/release.yml` : fabrique l'installeur Windows et le publie sur GitHub Releases quand on pousse une étiquette `vX.Y.Z`.
- `.github/workflows/pages.yml` : publie la version site sur GitHub Pages à chaque changement sur `main`.
- `secrets/` (ignoré par Git) : clés de signature des mises à jour. La clé privée est aussi dans les secrets du dépôt GitHub.

## Publier une nouvelle version

1. Changer le numéro de version dans `package.json` et `src-tauri/Cargo.toml`.
1 bis. Lancer `npm test` (les tests du moteur doivent passer).
2. Enregistrer les changements (`git commit`) puis poser l'étiquette : `git tag v0.2.0 && git push origin main --tags`.
3. GitHub fabrique l'installeur (environ 10 minutes) et le publie dans Releases. Les logiciels déjà installés proposent la mise à jour au prochain lancement.

Calcritique n'est pas affilié à Nintendo, Game Freak ou The Pokémon Company.
