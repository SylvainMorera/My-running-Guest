# My Running Guest — suivi course à pied et trail

Outil personnel de suivi des séances de course à pied. Il tient dans un seul fichier, `index.html`, et fonctionne sans serveur. Les données sont stockées uniquement dans le navigateur : IndexedDB, ou localStorage si IndexedDB n'est pas disponible.

## Utilisation

- **Sur ordinateur** : ouvre `index.html` dans un navigateur récent (Chrome, Edge, Firefox ou Safari). Tout fonctionne en fichier local, sauf l'installation sur l'écran d'accueil.
- **Sur téléphone, mode installable (PWA)** : l'outil doit être servi en HTTPS. Avec GitHub Pages :
  1. Settings → Pages → Source « Deploy from a branch ».
  2. Choisis la branche `main`, puis le dossier `/ (root)`.
  3. Ouvre `https://<compte>.github.io/<dépôt>/` sur le téléphone.
  4. Installe-le : sur iPhone, Safari → Partager → « Sur l'écran d'accueil » ; sur Android, Chrome → menu → « Installer l'application ».
- **Conditions de GitHub Pages** (documentation GitHub, consultée le 11/10/2026) :
  - Avec un compte gratuit, Pages ne fonctionne que pour un dépôt **public**. Pour un dépôt privé, il faut GitHub Pro, Team ou Enterprise.
  - Le **site** publié est accessible à toute personne qui a l'adresse, sauf avec GitHub Enterprise Cloud.
  - Le site ne contient que le code de l'outil : tes séances restent dans le navigateur de chaque appareil.
- **Hors connexion** : une fois l'outil ouvert en HTTPS, le service worker (`sw.js`) le garde en cache et il s'ouvre sans réseau. Une nouvelle version de l'outil est prise en compte au chargement suivant.
- **Transfert entre appareils** : onglet Données → « Exporter tout (JSON) » sur un appareil, puis « Importer une sauvegarde JSON » sur l'autre.
  - La sauvegarde contient les séances, les courses, les chaussures, les VMA, les paramètres et les réglages (zones, semaine type, réglages d'import, réglages Strava).
  - Elle ne contient pas les jetons Strava : sur chaque appareil, il faut cliquer une fois sur « Connecter Strava ».
  - Un rappel s'affiche si la dernière sauvegarde date de plus de 14 jours.
- **Exports** : JSON complet, CSV des séances (séparateur « ; », virgule décimale, UTF-8 avec BOM pour Excel), bilan mensuel imprimable. Pour le bilan, utilise le bouton « Imprimer / enregistrer en PDF », puis choisis « Enregistrer au format PDF » dans la fenêtre d'impression.

## Tests

- **Calculs** : `node tests/run.mjs` (77 tests, valeurs de référence calculées à la main, aucune donnée personnelle). Les mêmes tests sont disponibles dans l'outil : Données → « Lancer les autotests » (`#/tests`).
- **Cohérence sur tes données** : la page `#/tests` vérifie aussi que chaque carte du tableau de bord (semaine, mois, année) est égale à la somme directe des séances du journal.
- **Pas de page `tests.html` séparée** : ouverte en fichier local, elle ne pourrait pas charger `index.html`, car les navigateurs le bloquent. Les tests sont donc intégrés à l'outil.

## Fichiers

- `index.html` : l'application (HTML, CSS et JS dans un seul fichier, sans dépendance externe, logo inclus).
- `manifest.json`, `sw.js`, `icons/` : mode installable (PWA) et fonctionnement hors connexion.
- `strava-worker/` : fonction relais Cloudflare pour la synchronisation Strava (`worker.js`, `wrangler.toml`, `LISEZMOI.md`, `test.mjs`).
- `FORMULES.md` : toutes les formules, avec leur source ou leur statut.
- `tests/run.mjs` : exécution des tests du cœur de calcul sous Node.

## Charte graphique

Les couleurs de l'interface viennent du logo de l'ACN Anduze.

**Logo et icônes** : logo My Running Guest fourni par Sylvain (image d'icône arrondie sur fond marine). Le dessin n'est pas modifié. Seuls les coins blancs de l'image sont rendus transparents (logo d'en-tête, icônes « any ») ou remplis du marine du bord du logo, `#04285A` (icônes « maskable » pour Android et icône iPhone). Dans la version « maskable », le logo est réduit à 80 % pour rester entier quand Android découpe l'icône en cercle. Je les ai mesurées sur l'image fournie : ce ne sont pas des codes officiels. Elles se changent toutes en un point, dans les variables CSS de `index.html`.

| Rôle | Variable | Valeur | Contraste sur blanc |
|---|---|---|---|
| Bleu nuit du logo : texte, titres, série « prévu » | `--nuit`, `--texte`, `--prevu` | `#020317` | 20,4:1 |
| Bleu ciel du logo : filets et fonds, décoratif uniquement | `--azur` | `#5AB6CB` | 2,3:1 (trop faible pour du texte) |
| Bleu ciel assombri : boutons, liens, série « réalisé » | `--azur-fonce` | `#176C81` | 6,0:1 |
| Fond teinté | `--azur-clair` | `#E3F2F6` | — |

**Validateur de palette** (paire réalisé `#176C81` / prévu `#020317`, sur fond clair) :

- Ce qui passe : séparation pour les daltoniens (ΔE 41,6), séparation en vision normale (ΔE 42,8) et contraste ≥ 3:1.
- Ce qui échoue : deux critères esthétiques, la « bande de luminosité » (le bleu nuit est très sombre) et la « saturation minimale » (les deux bleus du club sont peu saturés).
- Pourquoi ce choix reste lisible : il garde la fidélité au logo, et prévu et réalisé se distinguent aussi autrement que par la couleur (légende, contour pointillé ou plein, libellés, tableau de données).

## État d'avancement

- [x] Phase 1 : socle (charte, stockage, modèle de données, export et import JSON, journal, séances prévues, réglages)
- [x] Phase 2 : import de tableaux Excel (.xlsx) ou CSV avec mapping mémorisé, aperçu, doublons et ré-import ; import d'activités FIT, GPX et TCX
- [x] Phase 3 : tableau de bord (cartes avec écart, graphiques, prévu vs réalisé, courses, records, chaussures)
- [x] Phase 4 : plan et calendrier (semaine / mois, prévu à côté du réalisé, glisser-déposer et « Déplacer », séances récurrentes, semaine type ; import et ré-import du plan via Données)
- [x] Phase 5 : calculateurs VMA (zones, séances types, temps de passage, Riegel, allure en pente Minetti, test VMA, convertisseur) ; formules et sources dans FORMULES.md
- [x] Phase 6 : PWA, logo, export CSV, bilan mensuel imprimable (PDF), passe d'accessibilité (axe-core : aucune violation WCAG 2.1 A/AA sur 10 écrans, ordinateur et mobile)
- [x] Phase 2 optionnelle : synchronisation Strava via une fonction relais Cloudflare Workers (option B choisie) : voir `strava-worker/LISEZMOI.md`
