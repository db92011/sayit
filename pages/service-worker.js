const CACHE = "sayit-static-v10";

const APP_SHELL = [
  "/",
  "/index.html",
  "/app.html",
  "/style.css",
  "/app.css",
  "/app.js",
  "/site.webmanifest",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/assets/sayit-app-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => (key === CACHE ? null : caches.delete(key)))
      );

      await self.clients.claim();

      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({
          type: "SAYIT_SW_ACTIVATED",
          cache: CACHE
        });
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          const fallback =
            url.pathname === "/app" || url.pathname === "/app.html"
              ? (await cache.match("/app.html"))
              : (await cache.match("/")) || (await cache.match("/index.html"));

          return (
            fallback ||
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" }
            })
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          await cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      }
    })()
  );
});
