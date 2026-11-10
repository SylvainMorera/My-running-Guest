# Renfo Cross : suivi du programme de renforcement (PWA)

- **Régénérer le plan** : exporte chaque onglet du Google Sheet en CSV (Fichier > Télécharger > CSV) dans `data-source/` (`Plan.csv`, `Règles.csv`, `S1.csv`… `S16.csv` ; le nom « Classeur - S5.csv » de Google est accepté), puis lance `node tools/build-plan.js`. Le script écrit `renfo-cross/data/plan.json` et liste ses avertissements : ne déploie pas s'il y en a sans les avoir lus.
- **Après toute modification** d'un fichier de `renfo-cross/` (plan compris) : incrémente `VERSION` dans `renfo-cross/sw.js` (ex. `renfo-cross-v3`), sinon l'iPhone garde l'ancienne version en cache.
- **Icônes** : `node tools/build-icons.js` (Node seul, aucun service externe).
- **Déployer** : pousse sur `main`. GitHub > Settings > Pages > Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
- **Ouvrir sur iPhone** : `https://sylvainmorera.github.io/My-running-Guest/renfo-cross/` dans Safari, puis Partager > Sur l'écran d'accueil. L'ouvrir une fois avec du réseau pour le mettre en cache.
- **Données** : saisies stockées uniquement dans le navigateur (localStorage), rien n'est envoyé. iOS peut effacer ce stockage : exporte une sauvegarde chaque semaine.
- **Tester une autre date** : `index.html?jour=2026-11-12`.
