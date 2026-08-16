// Cashiea service worker — DESTROY / UNINSTALL stub.
// The PWA offline cache is temporarily DISABLED (it was trapping a stale app
// shell, so UI updates never showed). This stub is served at /sw.js so any
// previously-registered Cashiea service worker picks it up on its update check,
// then uninstalls itself and wipes its caches — WITHOUT reloading the page
// (no client.navigate), which avoids reload loops.
//
// To RE-ENABLE offline: set PWA_ENABLED = true in vite.config.ts and DELETE
// this file.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  if (self.caches) {
    self.caches.keys().then((keys) => keys.forEach((k) => self.caches.delete(k)))
  }
  self.registration.unregister()
})
