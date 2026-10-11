# Synchronisation Strava : mise en place (une seule fois, environ 30 minutes)

## Ce que fait la fonction relais

Strava exige un **secret client** pour délivrer et renouveler les jetons d'accès. Ce secret ne doit jamais se trouver dans `index.html`, puisque n'importe qui peut lire ce fichier. La fonction `worker.js` tourne donc sur Cloudflare et sert d'intermédiaire.

Elle ne fait que trois choses :
1. Elle échange le code de connexion Strava contre des jetons (`POST /token`).
2. Elle renouvelle le jeton d'accès quand il expire (`POST /refresh`).
3. Elle transmet à Strava la demande de liste de tes activités (`GET /activities`).

Elle ne stocke rien, ne renvoie jamais le secret et refuse toute page qui n'est pas ton outil (contrôle de l'origine).

### Ce qui est stocké, et où

- **Dans ton navigateur** (IndexedDB) : les jetons d'accès, propres à chaque appareil. Ils ne sont jamais inclus dans les sauvegardes JSON.
- **Dans Cloudflare** : le secret, chiffré.

### Limite à connaître

Le contrôle d'origine bloque les autres sites web, mais un programme peut en imiter une.

- **Le secret reste protégé dans tous les cas** : il ne sort jamais de Cloudflare.
- **Tes données Strava restent protégées** : sans tes jetons, un tiers ne peut rien lire.

## Prérequis

- Un **abonnement Strava**. Depuis le 30/06/2026, Strava l'exige pour créer une application API.
- L'outil **publié en HTTPS**, par exemple sur GitHub Pages (voir `README.md`). En fichier local, Strava ne peut pas renvoyer vers l'outil après la connexion.
- Un **compte Cloudflare** (offre gratuite : 100 000 requêtes par jour, largement suffisant).

## Étape 1 : créer l'application Strava

1. Connecte-toi à Strava sur ordinateur et ouvre la page des réglages API : https://www.strava.com/settings/api
2. Remplis les champs. Les intitulés de Strava peuvent évoluer.
   - **Application Name** : par exemple « Suivi trail ACN ».
   - **Website** : l'adresse de l'outil, par exemple `https://moncompte.github.io/my-running-guest/`.
   - **Authorization Callback Domain** : **le domaine seul**, sans `https://` ni chemin, par exemple `moncompte.github.io`.
3. Note le **Client ID** (un nombre) et le **Client Secret**. Le secret ne se saisit **que** dans Cloudflare, jamais dans l'outil.

Une nouvelle application ne peut servir qu'un athlète (« Single Player Mode »), ce qui suffit pour un usage personnel.

## Étape 2 : déployer la fonction sur Cloudflare (sans ligne de commande)

Les intitulés du tableau de bord Cloudflare peuvent évoluer.

1. Tableau de bord Cloudflare → **Workers & Pages** → **Create** → **Worker**.
2. Nomme-le, par exemple `suivi-trail-strava`, puis déploie le modèle proposé.
3. **Edit code** : remplace tout le contenu par celui de `worker.js`, puis **Deploy**.
4. **Settings** → **Variables and Secrets**, et ajoute :
   - `STRAVA_CLIENT_ID` (type texte) : ton Client ID.
   - `ALLOWED_ORIGIN` (type texte) : l'adresse de l'outil **sans chemin**, par exemple `https://moncompte.github.io`.
   - `STRAVA_CLIENT_SECRET` (type **Secret**) : ton Client Secret.
5. Note l'adresse de la fonction, par exemple `https://suivi-trail-strava.<ton-sous-domaine>.workers.dev`.

**En ligne de commande, si tu préfères :**
1. Complète `wrangler.toml`.
2. `npx wrangler deploy`
3. `npx wrangler secret put STRAVA_CLIENT_SECRET`

## Étape 3 : relier l'outil

1. Ouvre l'outil publié, puis l'onglet **Données** et la section **Synchronisation Strava**.
2. Dans **Réglages de la synchronisation**, saisis l'adresse de la fonction et le Client ID, puis **Enregistrer les réglages**.
3. Clique sur **Connecter Strava** et accepte l'accès. Le droit demandé est `activity:read_all` : la lecture de toutes tes activités, y compris celles visibles par toi seul. Strava te renvoie ensuite vers l'outil.
4. Clique sur **Synchroniser**. Les activités apparaissent dans l'aperçu d'import :
   - seuls les types retenus sont cochés, `Run, TrailRun, VirtualRun` par défaut (modifiable) ;
   - tu choisis le type de séance et la durée (temps en mouvement ou temps total) ;
   - les doublons avec tes séances existantes sont signalés, par exemple une même sortie importée en FIT ou depuis ton plan Excel.
5. **Importer les activités cochées**. La synchronisation suivante ne relit que les nouvelles activités. Une activité déjà importée est reconnue par son numéro Strava.

## Déconnecter

**Déconnecter** efface les jetons de l'appareil. Pour révoquer l'accès chez Strava, retire l'application dans les paramètres de ton compte Strava, rubrique des applications autorisées.

## Ce que je n'ai pas pu vérifier

| Point | Ce que fait l'outil |
|---|---|
| Adresse d'échange des jetons : deux formes sont citées (`/oauth/token` et `/api/v3/oauth/token`) | La fonction essaie la seconde si la première répond « introuvable » |
| Présence de `average_heartrate` dans la liste des activités | S'il est absent, la FC reste vide |
| Durée de vie des jetons | L'outil utilise la date d'expiration renvoyée par Strava et renouvelle le jeton 2 minutes avant |

## Tests

`node strava-worker/test.mjs` : 9 tests de la fonction, sans réseau, avec une fausse API Strava.
