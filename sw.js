// HB-Cockpit Service Worker — Phase 1: reine DURCHLEITUNG, KEIN Caching.
// Zweck: die App installierbar machen (Android verlangt einen SW mit fetch-Handler),
// OHNE das Verhalten zu ändern -> kein Staleness-Risiko, auch auf Prod.
// Offline-/Cache-Strategie kommt bewusst separat (Phase 2, getestet).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// fetch-Handler vorhanden, aber ohne respondWith -> der Browser lädt jede Anfrage
// ganz normal selbst. Nichts wird abgefangen oder zwischengespeichert.
self.addEventListener('fetch', () => { /* Durchleitung */ });
