// Kill-switch service worker.
//
// Earlier versions of this SW (mpaios-v1, mpaios-v2) were caching the
// Settings page bundle that wired the LM Studio "Fetch" button to a
// requireAuth-gated proxy. Even after the server-side fix shipped,
// browsers kept serving the old bundle from SW cache and rendering
// "Unauthorized".
//
// This file replaces the SW with one that:
//   1) takes over on install (skipWaiting + clients.claim)
//   2) deletes every cache it can find
//   3) unregisters itself
//   4) reloads any open clients so they pick up the un-cached site
//
// After every browser has hit this once, we can drop sw.js entirely.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        try { client.navigate(client.url); } catch {}
      });
    })()
  );
});

self.addEventListener('fetch', () => {
  // Pass-through. Do not intercept any request.
});
