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

## 10. Journal des décisions

- 2026-09-05 : création du projet et de ce fichier. Périmètre : Champions uniquement. Aucune décision technique définitive encore prise.
- 2026-09-05 : nom choisi : Calcritique. Style graphique : celui de coupcritique.fr. Une seule barre de vitesse (gauche = avantage, droite = désavantage). Validé : calcul inversé, compteur SP, déroulé de tour avec scénarios meilleur / moyen / pire, presets depuis une API de stats d'usage, import par codes d'équipe (dans la limite du possible).
- 2026-09-05 : forme du produit : logiciel Windows (Tauri) en priorité, mises à jour automatiques via GitHub Releases, aucun hébergement à gérer. Version site web gardée en option avec le même code.
