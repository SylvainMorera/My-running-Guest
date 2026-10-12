// Service worker : fonctionnement hors connexion.
// Stratégie : réponse immédiate depuis le cache, puis mise à jour du cache en arrière-plan
// (la nouvelle version de l'outil est utilisée au chargement suivant).
// Aucune donnée personnelle n'est mise en cache ici : les séances restent dans IndexedDB.
var VERSION = 'my-running-lab-v9';
var PREFIXES = ['my-running-lab-', 'my-running-guest-', 'suivi-trail-'];
var FICHIERS = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    // Ne supprime que les anciens caches de cette application (noms utilisés au fil des versions) :
    // les autres applications publiées sur le même site (sylvainmorera.github.io) partagent l'espace des caches.
    return Promise.all(cles.filter(function (k) { return k !== VERSION && PREFIXES.some(function (p) { return k.indexOf(p) === 0; }); })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(e.request, { ignoreSearch: true }).then(function (enCache) {
      var reseau = fetch(e.request).then(function (rep) {
        if (rep && rep.ok) cache.put(e.request, rep.clone());
        return rep;
      }).catch(function () { return enCache; });
      return enCache || reseau;
    });
  }));
});
