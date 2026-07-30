const CACHE_NAME = "grand-line-rpg-v1.1.3";

const FILES_TO_CACHE = [

  "/Grand-Line-RPG/",
  "/Grand-Line-RPG/index.html",

  "/Grand-Line-RPG/style.css",
  "/Grand-Line-RPG/guia.css",

  "/Grand-Line-RPG/icon-192.png",
  "/Grand-Line-RPG/icon-512.png"

];

self.addEventListener("install", event => {

  self.skipWaiting();

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(cache => cache.addAll(FILES_TO_CACHE))

  );

});

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys().then(keys =>

      Promise.all(

        keys.map(key => {

          if (key !== CACHE_NAME) {

            return caches.delete(key);

          }

        })

      )

    )

  );

  self.clients.claim();

});

self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") return;

  event.respondWith(

    caches.match(event.request)

      .then(response => {

        if (response) return response;

        return fetch(event.request)

          .then(networkResponse => {

            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {

              const copy = networkResponse.clone();

              caches.open(CACHE_NAME)

                .then(cache => cache.put(event.request, copy));

            }

            return networkResponse;

          })

          .catch(() => caches.match("/Grand-Line-RPG/index.html"));

      })

  );

});
