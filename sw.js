/* Кладовая — работа без интернета.
   При обновлении приложения меняй номер версии ниже (kl-v2, kl-v3…). */
const V = "kl-v1";
const SHELL = ["./", "./index.html", "./app.js", "./data.js", "./supabase.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Свои файлы: сначала сеть (чтобы получать обновления), без сети — из кэша
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(req.mode === "navigate" ? "./index.html" : req, copy)); }
          return res;
        })
        .catch(() => caches.match(req.mode === "navigate" ? "./index.html" : req).then((r) => r || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }

  // Шрифты Google: кэшируем при первой загрузке
  if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(
      caches.open(V + "-fonts").then((c) =>
        c.match(req).then((r) => r || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))
      )
    );
  }
});
