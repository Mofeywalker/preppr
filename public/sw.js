// Service Worker for preppr PWA
const CACHE_VERSION = "preppr-v1";
const STATIC_CACHE = `preppr-static-${CACHE_VERSION}`;
const PAGES_CACHE = `preppr-pages-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icon.svg",
  "/favicon.ico",
  "/manifest.webmanifest",
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== PAGES_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle HTTP/HTTPS GET requests from the same origin
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Never cache API, auth, or Next.js server actions / data endpoints
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/api") ||
    request.headers.get("x-action") ||
    request.headers.get("next-action")
  ) {
    return;
  }

  // Navigation requests (HTML pages): Network-first with cache & offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If response is valid, save a copy in pages cache
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Network failed: try cache first
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to offline page
          const offlinePage = await caches.match("/offline.html");
          return offlinePage || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        })
    );
    return;
  }

  // Next.js static files and hashed assets: Cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Other assets (images, uploads, etc.): Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Skip waiting message handler
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
