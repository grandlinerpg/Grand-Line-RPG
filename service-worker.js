const CACHE_NAME = "grand-line-rpg-v1.1.8";

const STATIC_FILES = [
  "/Grand-Line-RPG/",
  "/Grand-Line-RPG/index.html",
  "/Grand-Line-RPG/icon-192.png",
  "/Grand-Line-RPG/icon-512.png"
];


// ==========================================
// INSTALL
// ==========================================

self.addEventListener("install", event => {

  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
  );

});


// ==========================================
// ACTIVATE
// ==========================================

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys().then(keys => {

      return Promise.all(

        keys.map(key => {

          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }

        })

      );

    })

  );

  self.clients.claim();

});


// ==========================================
// FETCH
// ==========================================

self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Apenas seu próprio site
  if (url.origin !== self.location.origin) return;


  // ==========================================
  // HTML / CSS / JS
  // REDE PRIMEIRO
  // ==========================================

  if (
    event.request.destination === "document" ||
    event.request.destination === "style" ||
    event.request.destination === "script"
  ) {

    event.respondWith(

      fetch(event.request, {
        cache: "no-cache"
      })

      .then(networkResponse => {

        if (
          networkResponse &&
          networkResponse.status === 200
        ) {

          const copy = networkResponse.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, copy);
            });

        }

        return networkResponse;

      })

      .catch(() => {

        return caches.match(event.request);

      })

    );

    return;

  }


  // ==========================================
  // IMAGENS / FONTES / OUTROS
  // CACHE PRIMEIRO
  // ==========================================

  event.respondWith(

    caches.match(event.request)

      .then(cachedResponse => {

        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)

          .then(networkResponse => {

            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {

              const copy = networkResponse.clone();

              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, copy);
                });

            }

            return networkResponse;

          });

      })

  );

});
