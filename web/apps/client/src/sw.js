import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const navigationHandler = createHandlerBoundToURL("/index.html");

registerRoute(({ request }) => request.mode === "navigate", navigationHandler);

registerRoute(
  ({ request }) => ["script", "style", "worker", "font"].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: "donegeon-static-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 60 * 60 * 24 * 14,
      }),
    ],
  }),
);

registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "donegeon-images-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 160,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

const apiReadMatchers = [
  /^\/api\/tasks(?:\/|$)/,
  /^\/api\/projects(?:\/|$)/,
  /^\/api\/board\/state(?:\/|$)/,
  /^\/api\/auth\/me(?:\/|$)/,
  /^\/api\/team\/settings(?:\/|$)/,
];

registerRoute(
  ({ url, request }) =>
    request.method === "GET" && apiReadMatchers.some((matcher) => matcher.test(url.pathname)),
  new NetworkFirst({
    cacheName: "donegeon-api-get-v1",
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60,
      }),
    ],
  }),
  "GET",
);

setCatchHandler(async ({ request, event, url }) => {
  if (request.destination === "document") {
    return navigationHandler({ request, event, url });
  }
  return Response.error();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
