// Service worker de Renfo Cross : fonctionnement hors ligne complet.
// Stratégie « cache d'abord, mise à jour en arrière-plan » : l'app s'ouvre instantanément à la salle,
// même sans réseau ; une nouvelle version (ou un nouveau plan.json) est utilisée au chargement suivant.
// Incrémenter VERSION à chaque modification d'un fichier de l'app.
// Le site héberge d'autres apps sur la même origine : on ne supprime QUE les caches « renfo-cross-* ».
// Aucune saisie n'est mise en cache ici : elles restent dans le stockage local du navigateur.
var VERSION = 'renfo-cross-v6';
var FICHIERS = ['./', './index.html', './manifest.webmanifest', './data/plan.json',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // cache: 'reload' : on contourne le cache HTTP pour ne pas figer une ancienne version.
    return c.addAll(FICHIERS.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k.indexOf('renfo-cross-') === 0 && k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Uniquement les fichiers de l'app (sous le dossier du service worker).
  var base = new URL('./', self.location).pathname;
  if (url.pathname.indexOf(base) !== 0) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    // ignoreSearch : « index.html?jour=… » (paramètre de test) sert la même page.
    return cache.match(e.request, { ignoreSearch: true }).then(function (enCache) {
      var reseau = fetch(e.request).then(function (rep) {
        if (rep && rep.ok && url.search === '') cache.put(e.request, rep.clone());
        return rep;
      }).catch(function () {
        // Hors ligne : une navigation vers une URL inconnue retombe sur la page de l'app.
        return enCache || (e.request.mode === 'navigate' ? cache.match('./') : Response.error());
      });
      if (enCache) { e.waitUntil(reseau.catch(function () {})); return enCache; }
      return reseau;
    });
  }));
});

// L'app demande la version installée (affichée dans l'onglet Données).
self.addEventListener('message', function (e) {
  if (e.data === 'version' && e.source) e.source.postMessage({ version: VERSION });
});
