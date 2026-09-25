// Legacy cleanup service worker.
// The previous PWA registered /sw.js and cached the old app shell. This file
// replaces that behavior on existing clients: it clears all caches and
// unregisters itself so the site now behaves as a plain static landing page.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
  );
});