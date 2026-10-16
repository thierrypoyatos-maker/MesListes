/* =========================================================
   MesListes — service worker
   Garde une copie des fichiers de l'application sur l'appareil
   pour qu'elle fonctionne sans connexion.
   ⚠ À chaque mise à jour de l'application, augmentez le numéro
   de VERSION ci-dessous : les téléphones téléchargeront alors
   la nouvelle version.
   ========================================================= */

const VERSION = "meslistes-v10";

const FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "synchro.js",
  "firebase-config.js",
  "manifest.webmanifest",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-masquable-512.png",
];

// Installation : on met les fichiers en réserve
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

// Activation : on supprime les anciennes versions
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(c => c !== VERSION).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

// Chaque demande : d'abord le réseau (pour avoir la dernière version),
// et si pas de connexion, la copie en réserve.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(reponse => {
        const copie = reponse.clone();
        caches.open(VERSION).then(c => c.put(e.request, copie));
        return reponse;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
