# CLAUDE.md : Calcritique, calculateur de dégâts Pokémon Champions

Ce fichier est la mémoire du projet. Toute session Claude qui travaille dans ce dossier doit le lire en premier, le respecter, et le mettre à jour quand une décision est prise.

## 1. Le projet en une phrase

Calcritique : un calculateur de dégâts moderne, bilingue (français / anglais), dédié UNIQUEMENT à Pokémon Champions (mode Doubles, format Ranked), qui corrige les manques du calculateur de Pokémon Showdown (https://calc.pokemonshowdown.com/champions.html?mode=champions).

## 1 bis. Identité visuelle

- Nom : Calcritique (clin d'œil à Coup Critique).
- Style graphique : reprendre celui du site https://www.coupcritique.fr/ (hub francophone de stratégie Pokémon) : thème sombre, texte blanc, fort contraste, mise en page en cartes, navigation sobre, polices sans empattement, boutons discrets plutôt que très décorés. Avant de coder l'interface, aller regarder le site (captures d'écran) pour relever précisément les couleurs, polices et espacements, et les noter ici.
- S'inspirer du style, pas copier le logo ni les images de Coup Critique.

## 2. Le contexte humain (très important)

- Le propriétaire du projet (meiynas) n'est PAS développeur et n'a aucune connaissance en programmation.
- Claude fait le code. L'humain fait les choix produit, teste, et donne son avis de joueur.
- Conséquences pour Claude :
  - Toujours expliquer en français simple, sans jargon, ou en définissant le jargon la première fois.
  - Ne jamais demander à l'humain d'écrire ou de lire du code. S'il faut lancer une commande, la donner telle quelle, avec ce qu'elle fait, et l'expliquer.
  - Avant un gros choix (technologie, structure, hébergement, refonte), proposer 2 ou 3 options avec avantages / inconvénients, puis laisser l'humain choisir.
  - Travailler par petites étapes visibles et testables (une fonctionnalité à la fois, qu'on peut ouvrir dans le navigateur et essayer).
  - Ne pas faire "n'importe quoi" : ce projet doit rester simple à maintenir, sans dépendances exotiques.
- Style d'écriture : jamais de tiret cadratin (le signe "—"). Utiliser des virgules, des deux-points ou des parenthèses.

## 3. Pourquoi refaire un calculateur : les problèmes du calc Showdown

1. Recherche des Pokémon en anglais uniquement (pas de français).
2. Interface datée, pas moderne, peu lisible.
3. Impossible d'ajouter soi-même des sets prêts à l'emploi (spread, objet, talent, attaques) et de les réutiliser.
4. Le pourcentage de KO ignore la précision. Exemple : Exploforce touche à 70 % et tue à 50 % sur les rolls, le vrai taux de KO est 35 %, pas 50 %.
5. Pas de "speed tiers" : quand on règle sa Vitesse, rien ne dit "tu es plus rapide que Scalpereur 0 SP mais plus lent que Scalpereur 32 SP", à partir d'une liste de Pokémon choisie par le joueur.
6. Les conditions de terrain (météo, terrain, murs, pièges, Vent Arrière, etc.) sont des petites cases faciles à oublier. Il faut un rendu visuel fort, avec un effet visuel distinct par catégorie.
7. Pas de suggestion d'attaques : "cette attaque que tu n'as pas dans ton kit tuerait à X %".
8. Impossible de mettre ses 6 Pokémon d'équipe côte à côte pour enchaîner les comparaisons.

## 4. Ce que le calculateur doit faire (fonctionnalités cibles)

### 4.1 Base (indispensable, version 1)
- Recherche de Pokémon en français ET en anglais, avec tolérance aux accents et aux fautes (ex : "scalpereur", "Scalpereur", "kingambit" donnent le même résultat). Même chose pour les attaques, objets, talents et natures.
- Interface d'affichage bilingue (bouton FR / EN), mémorisée dans le navigateur.
- Règles Champions modélisées nativement : niveau 50, IV parfaits (31 partout, pas de réglage), Points de Stat (SP) au lieu des EV : 66 SP max au total par Pokémon, 32 max par stat, 1 SP = +1 point dans la stat finale au niveau 50. Natures, objets tenus, talents, Téracristal, Méga-Évolution (pierre méga = objet tenu). Un seul gimmick par combat (une Téra OU une Méga).
- Format Doubles uniquement : dégâts réduits sur attaque à cibles multiples (x0,75), Coup d'Main, Garde Amie, Intimidation, talents "Ruin", cibles, etc.
- Calcul de dégâts exact (mêmes formules que Showdown, voir section 6) avec les 16 rolls, affichage en % et en PV, et probabilité de OHKO / 2HKO / 3HKO.
- Vrai taux de KO = (chance de toucher) x (chance de tuer sur les rolls), avec prise en compte optionnelle du critique (1/24 par défaut) et des attaques multi-coups (chaque coup a sa propre précision quand c'est le cas dans le jeu).
- Toutes les conditions de combat : météo (Soleil, Pluie, Tempête de sable, Neige), terrains (Électrique, Herbu, Brumeux, Psychique), Distorsion (Trick Room), Vent Arrière, Protection, Mur Lumière, Reflet, Voile Aurore, Piège de Roc, Picots, Gravité, Zone Étrange, statuts (brûlure, paralysie, poison...), boosts de -6 à +6, PV actuels.
- Import / export au format texte Showdown (le "pokepaste", format universel des joueurs).

### 4.2 Les 8 corrections demandées (voir section 3), détaillées
- Sets personnels : une bibliothèque de sets créés par l'utilisateur (nom, Pokémon, nature, SP, objet, talent, Téra, 4 attaques), sauvegardés dans le navigateur, exportables / importables en fichier pour ne rien perdre. Pouvoir aussi partir d'un set existant et le dupliquer.
- Vue Équipe : les 6 Pokémon de l'équipe à gauche, chacun sélectionnable d'un clic comme attaquant ou défenseur, l'adversaire à droite. Idéalement une grille "mon équipe contre l'équipe adverse" (matrice 6 x 6 ou 4 x 4) avec un code couleur du taux de KO.
- Speed tiers : une liste de Pokémon de référence choisie par l'utilisateur (avec plusieurs variantes par Pokémon : 0 SP, 32 SP, nature + ou -, Mouchoir Choix, Vent Arrière, Distorsion, paralysie). Quand on règle sa Vitesse, on voit sa position dans cette liste ("plus rapide que X, plus lent que Y"), et un curseur indique combien de SP il faudrait pour dépasser le suivant.
- Barre de vitesse (décidé) : pour le duel attaquant / défenseur, UNE seule barre horizontale qui montre à quel point les vitesses sont proches. Le curseur vers la gauche = le joueur a l'avantage de vitesse, vers la droite = désavantage, au centre = égalité (speed tie). Inspiré de PokéChamps, qui en affiche deux ; ici une seule suffit.
- Rendu visuel des conditions : une "scène de combat" au centre. La météo change le fond (soleil, pluie, sable, neige), le terrain colore le sol, les murs apparaissent comme un voile devant le côté concerné, les pièges d'entrée sont dessinés au sol, Vent Arrière et Distorsion ont leur icône animée. Tout ce qui est actif est visible d'un coup d'œil, tout ce qui est inactif est discret.
- Suggestion d'attaques : pour l'attaquant sélectionné, parcourir toutes les attaques qu'il peut apprendre (dans le pool légal Champions), calculer le taux de KO sur le défenseur, et proposer celles qui dépassent un seuil choisi (ex : 80 %) et qui font mieux que le kit actuel. Afficher pourquoi (type, puissance, précision).

### 4.3 Idées validées par l'humain (le 5 septembre 2026)
- Calcul inversé ("combien de SP pour...") : "combien de SP en Défense pour survivre à Exploforce de Scalpereur Adamant 32 SP ?" et "combien de SP en Vitesse pour dépasser X ?". Le budget de 66 SP rend cette optimisation centrale en Champions. Un "assistant de répartition" pourra proposer un spread à partir de 2 ou 3 objectifs (survivre à A, dépasser B, tuer C).
- Compteur de budget SP : afficher en permanence "58 / 66 SP utilisés" et signaler tout dépassement. Signaler aussi les incohérences (attaque inapprenable, objet tenu en plus d'une pierre méga, Pokémon hors pool de la régulation en cours).
- Dégâts combinés avec déroulé du tour : l'utilisateur choisit ses 2 attaques avec leurs cibles, et les 2 attaques adverses avec leurs cibles. L'outil déroule le tour dans l'ordre de vitesse (avec priorité, Vent Arrière, Distorsion) et présente le meilleur scénario, le scénario moyen et le pire scénario (rolls hauts / moyens / bas, coups ratés, critiques). Résultat attendu : qui est KO, qui survit, avec combien de PV. Plus tard : dégâts résiduels (sable, brûlure, Piège de Roc), soins (Baie Sitrus, Restes), Protection, Bluff, changements. La forme exacte de l'interface est à concevoir avec l'humain (il a dit "un truc du genre").
- Presets issus des statistiques d'usage : à la manière d'OP.GG, pré-remplir les sets et spreads les plus joués à partir d'une source de données. Voir la section 6 bis pour les sources trouvées.
- Import d'équipes via les codes Champions : voir la limite technique en section 6 bis.

### 4.4 Autres suggestions de Claude (pas encore tranchées)
- Import de la Team Sheet adverse : en Champions, les listes d'équipe sont ouvertes (on voit toute l'équipe adverse pendant la sélection). Pouvoir saisir rapidement les 6 Pokémon adverses (objet, talent, Téra, attaques) et obtenir immédiatement la matrice équipe contre équipe.
- Lien partageable : chaque situation de calcul encodée dans l'adresse de la page, pour l'envoyer à un ami ou la garder.
- Comparaison rapide "et si" : afficher côte à côte le même calcul avec / sans Téra, avec / sans Méga, avec / sans Intimidation, avec / sans Coup d'Main, sans devoir tout re-cliquer.
- Histogramme des 16 rolls : voir la distribution des dégâts plutôt qu'un simple "45 % à 53 %".
- Régulations : une notion de "régulation en cours" (ex : M-B) qui filtre les Pokémon légaux, avec possibilité de changer quand une nouvelle régulation sort. Les données de régulation dans un fichier séparé, facile à modifier.
- Notes de matchup : pouvoir écrire une petite note libre attachée à un set ou à un matchup ("attention au Voile Aurore").
- Mode sombre / clair, raccourcis clavier (chercher un Pokémon, inverser attaquant / défenseur), et interface utilisable sur téléphone (application web installable, utilisable hors connexion).
- Sprites et icônes de type pour que tout soit reconnaissable en un coup d'œil.

À réfléchir plus tard :
- Utiliser les 32 rolls d'aléa "réels" côté précision + critique + multi-coups dans un simulateur de tour simplifié (Bluff puis attaque, Protection, etc.).
- Un mode "entraînement" : le calculateur pose une question de calcul et on doit deviner si ça tue.

## 5. Ce que le projet ne fait PAS (périmètre)

- Pas d'autres jeux ni d'autres formats : uniquement Pokémon Champions. Pas de Singles, pas de VGC Écarlate / Violet, pas de vieilles générations.
- Pas de compte utilisateur ni de serveur au départ : tout est stocké dans le navigateur, avec export / import en fichier. Un serveur pourra venir plus tard si le partage entre appareils devient important.
- Pas de simulateur de combat complet (ce n'est pas un Showdown).

## 6. Choix techniques recommandés (à confirmer avec l'humain)

Décision (5 septembre 2026) : Calcritique est d'abord un LOGICIEL WINDOWS, avec une version site web gardée en option.

- Forme du produit : application de bureau Windows construite avec Tauri. Le code de l'interface est du code web (voir plus bas) emballé dans une application légère (.exe de quelques Mo). Le même code pourra être publié comme site web plus tard sans réécriture (accès par lien, téléphone).
- L'humain ne veut rien héberger ni payer. Tout passe par GitHub (gratuit) : le code, les versions du logiciel (GitHub Releases) et, si un jour la version site est activée, GitHub Pages.
- Mises à jour : le logiciel vérifie au lancement s'il existe une nouvelle version sur GitHub Releases et propose de l'installer (mécanisme de mise à jour intégré de Tauri). Les données de presets (statistiques d'usage) se rafraîchissent par le même canal ou par un simple fichier téléchargé au lancement. Le logiciel doit rester utilisable hors ligne avec les dernières données connues.
- Sauvegarde : sets, équipes, liste de speed tiers et réglages enregistrés dans un fichier sur le PC de l'utilisateur (dossier de l'application), avec export / import pour partager ou sauvegarder.
- Avertissement connu : sans signature d'éditeur (payante), Windows affiche "éditeur inconnu" à l'installation. Accepté au départ ; à documenter pour les utilisateurs.
- Pour un non-développeur : l'installation des outils de construction (Node.js, Rust pour Tauri) sera faite pas à pas avec des commandes toutes prêtes, et le logiciel final doit se distribuer comme un simple fichier d'installation.

- Ne PAS réécrire les formules de dégâts. Le moteur de calcul de Showdown est publié en open source sous licence MIT (libre d'utilisation) sous le nom @smogon/calc (https://github.com/smogon/damage-calc). Il gère déjà le mode Champions (points de stat) et toutes les subtilités des dégâts. On l'utilise comme "moteur" et on construit notre propre interface par-dessus. Si une mécanique propre à Champions n'est pas couverte, on l'ajoute par-dessus, en le documentant ici.
- Interface : TypeScript + React + Vite (technologies très répandues, faciles à faire évoluer, beaucoup de documentation). Alternative acceptable : Svelte. Style : Tailwind CSS pour une interface moderne rapidement.
- Données : noms français / anglais des Pokémon, attaques, objets, talents et natures dans des fichiers de données locaux (source : PokéAPI ou les fichiers de traduction de Pokémon Showdown), pour que la recherche marche hors ligne et instantanément.
- Stockage : navigateur (localStorage / IndexedDB) pour les sets, l'équipe, la liste de speed tiers, la langue et le thème. Export / import JSON.
- Distribution : GitHub Releases pour le logiciel (fichier d'installation Windows). Version site web en option, sur GitHub Pages, sans rien changer au code.
- Tests : quelques tests automatiques qui comparent nos résultats à ceux du calc Showdown sur des cas connus (pour être sûr de ne jamais afficher un faux résultat).

## 6 bis. Sources de données pour les presets et les codes d'équipe

Statistiques d'usage (sets et spreads les plus joués) :
- championsbattledata.com propose une API publique gratuite, sans clé ni compte, en JSON : par Pokémon, les attaques, objets, talents, natures, spreads et partenaires classés par taux d'usage, avec historique quotidien par saison (https://championsbattledata.com/api_guide). Candidat numéro 1.
- Pikalytics publie les données du ladder Champions (Regulation M-B, saison en cours) ; un projet open source (eurekaffeine/pokemon-champions-scraper, licence MIT) montre comment les récupérer en JSON. Candidat de secours.
- Règle d'architecture : ne pas appeler ces sites en direct depuis le navigateur de chaque utilisateur (risque de panne ou de blocage). Récupérer les données périodiquement (script automatique, par exemple une fois par jour ou par semaine), les enregistrer dans un fichier de données du projet, et c'est ce fichier que le site lit. Le site reste fonctionnel même si la source disparaît.
- Toujours afficher la source et la date des données dans l'interface.

Codes d'équipe Champions (codes à 10 caractères, "Replica Teams") :
- Limite importante : un code n'est PAS décodable en dehors du jeu. Il renvoie à une équipe stockée sur les serveurs officiels, et il n'existe pas d'accès public à ces serveurs. On ne pourra donc pas taper n'importe quel code et récupérer l'équipe.
- Ce qui est faisable : (1) une base de codes connus, construite à partir des sites communautaires qui publient les équipes avec leur code (OP.GG, Pikalytics, Game8, etc.), avec une mise à jour périodique ; (2) permettre à l'utilisateur d'enregistrer ses propres équipes avec leur code, pour les retrouver et les partager ; (3) importer une équipe depuis un texte au format Showdown (pokepaste), qui est ce que les sites communautaires fournissent en général.
- À vérifier avant de coder : si OP.GG ou Pikalytics exposent une liste d'équipes avec codes réutilisable, et dans quelles conditions.

## 7. Feuille de route proposée (par étapes, chacune testable)

- Étape 0 : valider ce document, installer les outils sur le PC de l'humain (pas à pas), créer le squelette de l'application Tauri, produire un premier fichier d'installation (même vide) pour vérifier que toute la chaîne fonctionne, y compris la mise à jour automatique.
- Étape 1 (version minimale utile) : 1 attaquant contre 1 défenseur, recherche FR / EN, règles Champions, calcul exact avec vrai taux de KO (précision incluse), conditions de combat basiques, interface propre.
- Étape 2 : équipe de 6 à gauche, bibliothèque de sets personnels, import / export pokepaste, sets par défaut.
- Étape 3 : speed tiers personnalisés, scène de combat visuelle, suggestion d'attaques.
- Étape 4 : calcul inversé (SP pour survivre / dépasser), compteur SP avancé, déroulé de tour avec dégâts combinés, matrice équipe contre équipe, liens partageables.
- Étape 5 : presets depuis les statistiques d'usage, base de codes d'équipe, confort (mode hors ligne / mobile, raccourcis, histogramme des rolls, notes).

## 8. Questions ouvertes (à trancher avec l'humain)

1. (Tranché) Nom : Calcritique.
2. (Tranché) Logiciel Windows d'abord, via Tauri, mises à jour par GitHub Releases. Version site gardée en option.
3. Faut-il prévoir dès le début un partage de sets entre joueurs (nécessite un serveur), ou export de fichier suffisant pour commencer ? (recommandation : fichier d'abord)
4. Faut-il afficher les statistiques d'usage (sets les plus joués) ? Si oui, quelle source et à quelle fréquence de mise à jour ?
5. Y a-t-il des mécaniques propres à Champions (attaques modifiées, talents changés) qui diffèrent d'Écarlate / Violet ? À vérifier auprès de la communauté avant l'étape 1, et à lister ici.
6. Quelle est la régulation en cours au moment du démarrage, et quel est le pool légal ?

## 9. Références utiles

- Calculateur Showdown (mode Champions) : https://calc.pokemonshowdown.com/champions.html?mode=champions
- Code source du moteur de calcul : https://github.com/smogon/damage-calc (paquet @smogon/calc)
- Calculateurs concurrents observés (pour s'inspirer, pas pour copier) : Porygon Labs (speed tiers, explorateur de stats, sets curatés), VGC Multi Calc (multi-cibles, application installable), OP.GG Champions (interface en 20 langues dont le français, presets de stats), NCP VGC Calc (sets nommés, équipes).
- Règles Champions constatées lors de la recherche du 5 septembre 2026 : niveau 50, IV 31, 66 SP au total et 32 max par stat, Doubles, 6 Pokémon dont 4 choisis, listes d'équipe ouvertes, Téra et Méga présents mais un seul gimmick par combat, pas de Dynamax ni de capacités Z, régulation M-B (Méga officielles, sans légendaires de boîte ni Paradoxe). À revérifier régulièrement.

## 9 bis. État technique du dépôt (mis à jour à chaque étape)

- Dépôt GitHub : https://github.com/Meiynas/calcritique (public). Le dossier local E:\Fichiers\Bureau\Cal EST le dépôt. Particularité : le dossier .git actif vit HORS du dossier Cal (dans le dossier personnel de la machine virtuelle Claude, $HOME/calcritique.git), parce que Claude n'a pas le droit de supprimer des fichiers dans Cal et que Git a besoin d'effacer ses verrous. On utilise la commande `cgit` ($HOME/bin/cgit) à la place de `git` depuis la machine de l'humain. Le dossier .git présent dans Cal est un vestige inutile.
- Étape 0 réalisée le 6 septembre 2026 : squelette Vite + React + TypeScript + Tailwind 4, enveloppe Tauri 2 (src-tauri), plugin de mise à jour automatique (clé publique dans tauri.conf.json, clés dans le dossier secrets/ ignoré par Git et dans les secrets GitHub TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PASSWORD), workflow release.yml (installeur Windows NSIS sur étiquette vX.Y.Z) et workflow pages.yml (version site sur GitHub Pages, construite avec `npm run build:web`). Première version v0.1.0 publiée et vérifiée.
- Aucun outil de construction n'est installé sur le PC de l'humain : les installeurs sont fabriqués par GitHub Actions. Le développement se fait dans l'espace de travail Claude (npm install, npm run build, captures d'écran pour vérifier), les fichiers sont copiés dans le dossier Cal, puis envoyés sur GitHub avec `cgit` depuis la machine de l'humain (GitHub CLI dans $HOME/bin/gh, authentifié).
- Pour tester rapidement une interface sans installer : la version site https://meiynas.github.io/calcritique/ se met à jour à chaque envoi sur main.
- Publier une version : voir README.md (changer la version, poser l'étiquette, pousser).
- Le mode de construction "web" (base /calcritique/) sert à GitHub Pages ; le mode par défaut (base /) sert au logiciel.

## 9 ter. État fonctionnel (V1, 6 septembre 2026)

Fait dans la V1 (étape 1 de la feuille de route) :
- Un attaquant contre un défenseur, format Doubles. Recherche FR / EN tolérante (accents, tirets, majuscules) pour Pokémon, attaques, objets, talents ; natures et types traduits. Interface FR / EN (bouton en haut à droite), réglages sauvegardés dans le navigateur / le logiciel.
- Règles Champions : niveau 50, IV 31, SP (0 à 32 par stat, compteur 66 avec alerte de dépassement), 1 SP = 8 EV en interne (équivalence exacte au niveau 50, vérifiée par test). Natures, objets, talents (les talents possibles de l'espèce sont proposés en premier), Téracristal, Méga (choisir la forme Méga comme espèce), boosts, statuts, PV actuels.
- Conditions : météo, terrain, Distorsion, Gravité, Zone Magique, Zone Étrange ; par côté : Protection, Mur Lumière, Voile Aurore, Vent Arrière, Coup d'Main, Garde Amie, Piège de Roc, Picots. Boutons colorés avec icône, l'actif est bien visible.
- Résultats par attaque : dégâts min / max en % et en PV, précision effective (avec ce qui la modifie), vrai taux de KO sur 1 à 4 attaques (précision x rolls x critiques, options réglables), taux "rolls seuls" à titre de comparaison, mini histogramme des 16 rolls.
- Barre de vitesse unique (gauche = avantage) avec Mouchoir Choix, Vent Arrière, paralysie, talents météo, Distorsion.
- Tests automatiques (`npm test`, aussi lancés par GitHub avant chaque publication).

Ajouté en v1.1.0 (demande de l'humain du 6 septembre 2026) :
- Interface en trois colonnes : Équipe 1 à gauche (6 emplacements), calculs au centre, Équipe 2 à droite (6 emplacements). On clique sur une carte pour choisir le Pokémon actif de chaque équipe ; l'éditeur complet s'affiche sous les cartes. Le bouton central "Équipe 1 ⟶ Équipe 2" inverse le sens de l'attaque.
- Effets visuels plein écran (src/components/FxLayer.tsx + section FX de src/index.css) : vignettage coloré selon le terrain (vert Herbu, jaune Électrique, rose Psychique, mauve Brumeux), pluie / neige / soleil / tempête de sable animés sur tout le site, teinte violette quadrillée pour Distorsion, assombrissement pour Gravité, rafales de Vent Arrière qui traversent l'écran de gauche à droite (équipe 1) ou de droite à gauche (équipe 2).
- Les murs se voient sur la colonne de l'équipe qui les a : Protection = liseré rose, Mur Lumière = liseré doré, Voile Aurore = bordure arc-en-ciel animée.
- Pièges affichés au-dessus de chaque équipe (ceux que cette équipe subit) : Piège de Roc oui / non, Picots 0 à 3, Pics Toxik 0 à 2, Toile Gluante oui / non. Pics Toxik et Toile Gluante sont pour l'instant purement visuels (pas d'effet sur les dégâts).
- Les effets par côté (murs, Vent Arrière, Coup d'Main, Garde Amie) se règlent dans la colonne de l'équipe concernée ; le moteur les traduit en côté attaquant / défenseur selon le sens de l'attaque.
- La sauvegarde locale est passée en version 2 (clé calcritique.state.v2) : les réglages de la V1 ne sont pas repris.

Ajouté en v1.2.0 (retours de l'humain du 6 septembre 2026) :
- Statistiques d'usage intégrées (src/data/usage.json, source championsbattledata.com, saison M5, données du 3 septembre 2026, récupérées via le navigateur car le site est inaccessible depuis l'environnement Claude) : pour chaque Pokémon, les 10 attaques / objets / natures / spreads les plus joués, les talents et les 10 coéquipiers les plus fréquents (sans pourcentage, seulement le rang). Pool légal Champions et learnsets réels depuis PokéAPI (groupe de versions "champions", src/data/learnsets.json, script scripts/build-learnsets.py). À rafraîchir périodiquement (voir section 6 bis).
- Choisir un Pokémon applique automatiquement son set le plus joué (nature, spread, objet, talent, 4 attaques ; passe en forme Méga si la pierre est l'objet numéro 1). Bouton "★ Set le plus joué" pour réappliquer.
- Fenêtres de choix (src/components/MovePicker, ItemPicker, PokemonPicker) : attaques = top 10 les plus jouées hors celles déjà choisies, puis tout le learnset, filtres nom / catégorie / type ; objets = top 10 puis tous ; Pokémon = suggestions de coéquipiers (somme des rangs de partenaires de toute l'équipe, "affinité"), filtres type 1 / type 2, stats de base minimales, attaques requises par groupes "A OU B".
- Dans la liste d'attaques d'un Pokémon : clic = met l'attaque en avant dans les résultats (carte encadrée en premier), ✎ = changer, × = retirer. Pourcentage d'usage affiché à côté de chaque attaque, objet et nature. ⚠ si l'attaque n'est pas apprenable en Champions.
- Sous les stats : stades de précision, d'esquive et de coup critique, et bouton Abri. Abri bloque les dégâts sauf Ruse (et autres attaques qui percent Abri) et Poing Invisible sur une attaque de contact ; Infiltrateur est déjà géré par le moteur pour les murs.
- Effets visuels refaits (canvas + CSS) : pluie en gouttes, neige, sable en grains vifs, feuilles pour Herbu, petits éclairs pour Électrique, violet qui pulse pour Psychique, brume rose pour Brumeux, soleil avec rayons et artefacts d'objectif, poussières qui chutent pour Gravité, anneaux bleus pour Zone Magique, hachures pour Zone Étrange, halo doré pulsant pour Coup d'Main, filigrane hexagonal pour Garde Amie. Murs : Mur Lumière = rose, Protection = bleu, Voile Aurore = dégradé rose-bleu, Protection + Mur Lumière = dégradé épaisseur double.
- Équipes de départ tirées des stats d'usage (Kingambit, Sneasler, Incineroar contre Garchomp, Whimsicott, Sinistcha). Sauvegarde locale en version 3.

Ajouté en v1.2.1 (retours du 6 septembre 2026, suite) :
- Fenêtre attaques : après le top 10, les attaques sont rangées par type (nom du type dans la langue affichée), puis Physique, Spéciale, Statut ; dans Physique et Spéciale par puissance théorique décroissante (puissance x précision, précision 100 pour les attaques qui ne ratent jamais) ; Statut par ordre alphabétique. Un séparateur par type.
- Mettre Abri (ou Détection, Pics-Bouclier, Bouclier Royal, Blocage, Piège Soyeux...) en avant coche automatiquement le bouton Abri ("via l'attaque").
- Double-clic sur une carte de Pokémon ou sur une ligne d'attaque ouvre la fenêtre de choix.
- Fenêtre Pokémon : section "Méga-Évolutions" séparée.
- PV actuels affichés et réglables sur chaque carte de Pokémon (barre colorée), plus dans le bas du panneau.
- Barre de vitesse : la priorité des attaques mises en avant est prise en compte (Farceur, Ailes Bourrasque, Triage, Gliss'Herbe sur Champ Herbu) ; le verdict dit qui agit en premier et une ligne violette détaille les priorités.
- Soleil : rayons adoucis (flou), artefacts d'objectif hexagonaux. Dégradés de Voile Aurore et Protection + Mur Lumière fixes (plus d'animation). Recliquer sur la météo ou le terrain actif le désactive.

Ajouté en v1.2.2 :
- Sur chaque carte : clic sur "148/185" ou sur "80 %" pour saisir la valeur à la main (Entrée valide, Échap annule).
- Bouton ⇄ (Switch) sur chaque carte (src/lib/switch.ts) : applique les pièges du côté de l'équipe (Piège de Roc selon la faiblesse Roche, Picots 1/8, 1/6, 1/4 si au sol, Pics Toxik = poison ou poison grave si au sol et non Poison / Acier, un type Poison au sol retire les Pics Toxik, Toile Gluante = Vitesse −1 si au sol, bloquée par Corps Sain et similaires), Grosses Bottes et Garde Magik gérés, remise à zéro des boosts et des stades, Abri décoché. Un petit message vert résume ce qui s'est passé pendant 4 secondes.
- Le bouton Abri n'affiche plus "(via l'attaque)".

Ajouté en v1.3.0 (demande du 6 septembre 2026 : plus d'équipe "attaquante" / "défenseuse") :
- Format de combat 1v1 ou 2v2 (VGC) au centre. Chaque équipe a 1 ou 2 Pokémon "en jeu" (badges A / B sur les cartes ; cliquer une carte la met en jeu en remplaçant la plus ancienne). Les deux camps attaquent et défendent en même temps.
- Déroulé du tour (src/lib/turn.ts, src/components/TurnPanel.tsx) : les 2 ou 4 actions dans l'ordre réel (priorité, puis Vitesse avec Distorsion / Vent Arrière / Mouchoir Choix / paralysie ; "≈" signale une égalité de vitesse). Chaque Pokémon utilise son attaque mise en avant, avec sa cible (sélecteur "Cible" en 2v2 : adversaire A / B, allié, ou automatique = premier adversaire ; les attaques à cibles multiples touchent tout le monde avec x0,75). Un Pokémon KO n'agit plus, Abri bloque, les attaques de statut sont listées sans dégâts.
- Trois scénarios du point de vue de l'équipe 1 : meilleur (mes coups touchent, roll max, critique ; l'adversaire rate si sa précision est inférieure à 100, sinon roll min), moyen (roll médian, pas de critique, touche si précision d'au moins 50 %), pire (l'inverse du meilleur). Ligne "Fin du tour" avec les PV de chaque Pokémon. Le vrai taux de KO contre les PV du moment est rappelé quand il est entre 0 et 100 %.
- En dessous, "Détail par attaque" : la carte complète (précision, vrai taux de KO, rolls) pour chaque Pokémon en jeu contre chacune de ses cibles.
- Le composant SpeedBar et la notion attackerSide ont été retirés ; sauvegarde locale en version 4.

Ajouté en v1.4.0 (retours du 6 septembre 2026, VGC) :
- Nature par boutons + / − dans le tableau des stats (colonne "Nat.") : un + sur une stat et un − sur une autre choisissent la nature correspondante, même stat des deux côtés = nature neutre (Sérieux).
- Pokémon en jeu : bandeau "En jeu" en haut de chaque colonne avec les positions A et B, et boutons A / B sur chaque carte (un seul bouton ● en 1v1). Cliquer une carte ne fait plus que sélectionner pour l'édition.
- Cible : puces sous la liste d'attaques du Pokémon (A Carchacrok, B Farfaduvet, Allié) ; les attaques à cibles multiples affichent "toutes les cibles". La cible est rappelée dans l'ordre du tour.
- Attaques à cibles multiples : le x0,75 ne s'applique que s'il y a vraiment plusieurs cibles (une seule cible vivante = pas de réduction). En 1v1 le moteur passe en Singles (Protection / Mur Lumière / Voile Aurore divisent par 2) ; en 2v2 les murs réduisent d'un tiers (2/3) comme en VGC.
- Déroulé du tour, mécaniques VGC (src/lib/turn.ts) : Abri / Détection et variantes, Garde Large (bloque les attaques à cibles multiples sur son côté), Anti-Air (bloque les attaques prioritaires), Coup d'Main (l'allié frappe x1,5, icône 🤝), Par Ici / Poudre Fureur (redirige les attaques mono-cible adverses, "↪ redirigée"), Ruse perce Abri, Vent Arrière posé en cours de tour, baisses de Vitesse garanties (Vent Glacé, Toile Élek, Piétisol, Tomberoche, Tir de Boue, Balayette, Glaciation, Bondissement, Tempête Nordique, Tambour Battant), Bluff / Première Impression signalées "premier tour seulement". Vitesse dynamique : l'ordre est recalculé après chaque action (badge violet "3e" quand la position réelle diffère de l'ordre de départ).

Ajouté en v1.5.0 (retours du 6 septembre 2026, lisibilité) :
- Colonne "Nat." des + / − placée à gauche des noms de stats, largeurs de colonnes fixes (le tableau ne bouge plus), nature neutre possible (cliquer le + ou le − déjà actif le retire).
- Détail par attaque : la barre des 16 rolls est remplacée par une double jauge. "Dégâts" : la fourchette normale (blanc) et la fourchette critique (ambre) sur 0 à 100 % des PV max, avec des repères à 25 %, 33,4 %, 50 % et KO (✓ atteint sur les rolls, ~ possible en critique, ✗ jamais). "Chances" : raté / touché / critique. Une ligne d'efficacité (Super efficace x2, Hyper efficace x4, Peu efficace, Sans effet...) remplace le petit texte sous la jauge.
- Mode 2v2 : boutons "Stats" / "Attaques (A et B)" au-dessus de la fiche du Pokémon. La vue Attaques montre seulement les 4 attaques et les puces de cible des deux Pokémon en jeu (A et B), pour régler le tour sans faire défiler.
- Le bandeau "Équipe 1 · En jeu" a été retiré (les positions A / B se suffisent).
- Paralysie en cours de tour : Cage Éclair, Para-Spore, Regard Médusant et Nuzzle paralysent la cible (immunités : type Électrik, Sol contre Cage Éclair, Plante / Envelocape / Lunettes Filtre contre les poudres, Échauffement, Terrain Brumeux, statut déjà présent, Abri), sa Vitesse est divisée par 2 pour la suite du tour et l'ordre est recalculé. Le Vent Arrière posé en cours de tour accélérait déjà l'allié qui joue après (badge violet de position).
- Zone Magique : l'animation tourne autour du centre de l'écran sans coupure (carré de 200 % de l'écran).
- Test automatique ajouté pour la paralysie (13 tests).

Ajouté en v1.6.0 (retours du 6 septembre 2026, statuts et flinch) :
- Tableau des scénarios : les lignes suivent l'ordre réel du scénario moyen (après Vent Arrière, paralysie, etc.), plus l'ordre de départ. Le badge violet ne s'affiche que si un scénario diffère de cet ordre.
- Boutons Stats / Attaques (A et B) en bleu pour l'équipe 2.
- Nouveau module src/lib/status.ts : flinch (Bluff et Main Haute à 100 %, Éboulement / Tête de Fer / Lame d'Air 30 %, etc., Sérénité x2, Roche Royale 10 %, immunités Attention / Écran Poudre / Cape Cachée), paralysie totale (25 %), sommeil (réveil estimé 1/3 par tour, compteur inconnu), gel (dégel 20 %, 100 % avec Roue de Feu, Boutefeu, Ébullition, etc.), dégel de la cible touchée par une attaque Feu ou Ébullition.
- Déroulé du tour : un Pokémon qui a tressailli n'agit pas ("tressaille, n'agit pas"). Les statuts qui empêchent d'agir suivent la logique des scénarios : meilleur = l'adversaire est bloqué (para totale / dort / gelé) et nous agissons ; moyen = la paralysie laisse agir (75 %), le sommeil et le gel bloquent (67 % et 80 %) sauf attaque qui dégèle ; pire = l'inverse. Nuzzle paralyse aussi après ses dégâts.
- Jauge "Chances" du détail par attaque : segments gris (n'agit pas : paralysie totale, reste endormi, reste gelé), orange (raté), vert (touche), jaune (flinch), ambre (critique), avec le texte des taux (réveil, dégel, flinch...).
- Vue Attaques (A et B) : menu de statut (Sain, Brûlure, Paralysie, Poison, Sommeil, Gel) sous les cibles.
- 14 tests automatiques (flinch, gel avec Boutefeu).

Limites connues à traiter plus tard :
- Pas encore de filtre de légalité par régulation (tous les Pokémon connus du moteur sont proposés, hors fakemons).
- Précision : les stades de précision / esquive et les objets rares ne sont pas modélisés ; les attaques multi-coups font un seul test de précision (Triple Axel devrait en faire un par coup).
- Le taux de KO ne prend pas encore en compte les dégâts résiduels ni les soins (Baie Sitrus, Restes, sable, brûlure).
- Les noms français de quelques formes récentes (nouvelles Méga) sont construits automatiquement ("Méga-" + nom) et les nouvelles pierres Méga restent en anglais.
- Pas de sprites (les images seraient à embarquer pour rester hors ligne).
- Les fichiers de données src/data/names.json et src/data/extra.json sont générés par scripts/build-names.py et scripts/build-extra.py à partir des CSV de PokéAPI (à relancer quand le moteur ou PokéAPI évoluent).

## 10. Journal des décisions

- 2026-09-05 : création du projet et de ce fichier. Périmètre : Champions uniquement. Aucune décision technique définitive encore prise.
- 2026-09-05 : nom choisi : Calcritique. Style graphique : celui de coupcritique.fr. Une seule barre de vitesse (gauche = avantage, droite = désavantage). Validé : calcul inversé, compteur SP, déroulé de tour avec scénarios meilleur / moyen / pire, presets depuis une API de stats d'usage, import par codes d'équipe (dans la limite du possible).
- 2026-09-05 : forme du produit : logiciel Windows (Tauri) en priorité, mises à jour automatiques via GitHub Releases, aucun hébergement à gérer. Version site web gardée en option avec le même code.
- 2026-09-06 : dépôt GitHub créé (Meiynas/calcritique, public). Étape 0 réalisée (squelette, Tauri, mise à jour automatique, workflows, v0.1.0 publiée). L'humain a donné son accord global pour avancer sans redemander confirmation à chaque étape.
- 2026-09-06 : V1 (étape 1) réalisée et publiée en v1.0.0 : calculateur 1 contre 1 complet avec vrai taux de KO. Voir section 9 ter.
- 2026-09-06 : v1.6.0 : flinch, statuts qui empêchent d'agir (para / sommeil / gel) dans le tour et dans la jauge des chances, lignes du tableau dans l'ordre réel, statut modifiable dans la vue Attaques.
- 2026-09-06 : v1.5.0 : colonne Nat. à gauche et nature neutre, double jauge dégâts / chances avec seuils et efficacité, vue "Attaques (A et B)" en 2v2, paralysie en cours de tour, Zone Magique corrigée.
- 2026-09-06 : v1.4.0 : nature par + / −, positions A / B, cibles en puces, x0,75 selon le nombre de cibles, murs Singles / Doubles, attaques de soutien VGC dans le déroulé avec vitesse dynamique.
- 2026-09-06 : v1.3.0 : format 1v1 / 2v2, Pokémon en jeu par équipe, déroulé du tour avec trois scénarios, détail par attaque. Fin des rôles attaquant / défenseur.
- 2026-09-06 : v1.2.2 : PV saisissables à la main sur les cartes, bouton Switch (pièges, poison, Toile Gluante, remise à zéro).
- 2026-09-06 : v1.2.1 : tri des attaques par type / catégorie / puissance théorique, Abri via l'attaque, double-clic, Méga séparées, PV sur les cartes, priorité dans la vitesse, soleil adouci, dégradés fixes.
- 2026-09-06 : v1.2.0 : stats d'usage et presets, fenêtres de choix (attaques / objets / Pokémon avec suggestions et filtres), Abri et stades, effets visuels refaits. Décision : la source de stats d'usage est championsbattledata.com ; les learnsets viennent du groupe de versions "champions" de PokéAPI.
- 2026-09-06 : v1.1.0 : interface en trois colonnes (équipe 1, calculs, équipe 2) et effets visuels plein écran (terrain, météo, murs, pièges, Vent Arrière), à la demande de l'humain. La bibliothèque de sets (étape 2) reste à faire.
