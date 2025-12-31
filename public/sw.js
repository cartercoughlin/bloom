// Service Worker for Bloom Budget PWA
const CACHE_NAME = 'bloom-budget-v8';
const urlsToCache = [
  '/',
  '/dashboard',
  '/transactions',
  '/budgets',
  '/categories',
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  // Force immediate activation
  self.skipWaiting();
});

// Activate event - clean up old caches and notify clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Notify all clients about the update
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;

  // Skip cross-origin requests
  if (!requestUrl.startsWith(self.location.origin)) {
    return;
  }

  // Quick check: Skip auth/API routes using string matching (faster than URL parsing)
  if (requestUrl.includes('/auth/') ||
      requestUrl.includes('/api/') ||
      requestUrl.includes('/_next/')) {
    return; // Let browser handle these normally
  }

  // Cache-first strategy for better performance
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version immediately if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(event.request).then((response) => {
          // Only cache successful, non-redirect responses
          if (response &&
              response.status === 200 &&
              response.type === 'basic' &&
              !response.redirected) {

            // Clone and cache in background (don't block response)
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return response;
        });
      })
  );
});
