# Renfo Cross : suivi du programme de renforcement (PWA)

- **Régénérer le plan** : exporte chaque onglet du Google Sheet en CSV (Fichier > Télécharger > CSV) dans `data-source/` (`Plan.csv`, `Règles.csv`, `S1.csv`… `S16.csv` ; le nom « Classeur - S5.csv » de Google est accepté), puis lance `node tools/build-plan.js`. Le script écrit `renfo-cross/data/plan.json` et liste ses avertissements : lis-les avant de déployer.
- **Après toute modification** d'un fichier de `renfo-cross/` (plan compris) : incrémente `VERSION` dans `renfo-cross/sw.js` (ex. `renfo-cross-v5`). L'app affiche alors « Nouvelle version installée » ; la version en service est visible dans Données > À propos.
- **Icônes** : `node tools/build-icons.js` (Node seul, aucun service externe).
- **Déployer** : fusionne dans `main`. GitHub > Settings > Pages > « Deploy from a branch », branche `main`, dossier `/ (root)`.
- **Ouvrir sur iPhone** : `https://sylvainmorera.github.io/My-running-Guest/renfo-cross/` dans Safari, puis Partager > Sur l'écran d'accueil. L'ouvrir une fois avec du réseau pour la mettre en cache.
- **Données** : stockées uniquement dans le navigateur (localStorage), rien n'est envoyé. iOS peut effacer ce stockage : onglet Données > « Sauvegarde JSON » chaque semaine (rappel le dimanche), « Restaurer une sauvegarde » pour revenir.
- **Coller dans le Sheet** : Données > « Copier les séries » (une ligne par série, tabulations), puis coller dans une feuille.
- **Tester une autre date** : `index.html?jour=2026-11-12`.
