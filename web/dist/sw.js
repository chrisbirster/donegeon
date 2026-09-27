// Safe fallback service worker for Go-only builds.
// Production Vite builds replace this file with the Workbox-generated service worker.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
