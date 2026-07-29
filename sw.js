// HB-Cockpit Service Worker — Phase 2: Offline-Fähigkeit über NETWORK-FIRST.
//
// Grundsätze (bewusst konservativ, damit nach Deploys nie alter Stand hängen bleibt):
//   • Nur SAME-ORIGIN GET wird behandelt. Cross-Origin (Supabase-API/-Auth, Tailwind-CDN,
//     Google-Fonts) wird NICHT angefasst und NIE gecacht -> Daten/Login immer live.
//   • NETWORK-FIRST: online kommt immer die frische Antwort; der Cache ist reiner
//     Offline-Fallback. Kombiniert mit dem ?v=-Cachebusting der App => keine Staleness.
//   • Navigationen offline -> zuletzt gecachte Seite bzw. dashboard/index als Shell.
//   • Alte Cache-Versionen werden beim Aktivieren entfernt.

const CACHE = 'hb-cache-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // nur GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Cross-Origin (Supabase/CDN/Fonts) unangetastet

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      // nur vollständige, gleiche-Origin-Antworten cachen (keine 206/opaque)
      if (res && res.status === 200 && res.type === 'basic' && !req.headers.has('range')) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = (await caches.match('/dashboard.html')) || (await caches.match('/index.html'));
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
