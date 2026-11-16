const CACHE_NAME = "x-store-pwa-v2";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/x-store-intro.mp4",
  "/x-store-intro-desktop.mp4",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("x-store-pwa-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request) || await caches.match("/");
          if (cachedPage) return cachedPage;
          return new Response(
            "<!doctype html><html lang=\"ar\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>X-Store</title></head><body><div style=\"font-family:Arial,sans-serif;padding:40px;text-align:center\">تعذر تحميل الصفحة. تحقق من الاتصال ثم أعد المحاولة.</div></body></html>",
            { status: 503, headers: { "Content-Type": "text/html; charset=UTF-8" } },
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    }),
  );
});
