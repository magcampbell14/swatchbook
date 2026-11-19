/* swatchbook service worker — offline shell + always-fresh-when-online.
 *
 * Strategy:
 *   - Same-origin requests (the app HTML + all its JS/CSS/data): NETWORK-FIRST.
 *       Online  -> you always get the newly deployed version.
 *       Offline -> served from cache, so the whole app still works with no signal.
 *     This is why you do NOT have to bump CACHE_VERSION on every deploy — new code
 *     is picked up automatically whenever the phone has a connection.
 *   - Cross-origin (pinned unpkg React/Babel) + icons: CACHE-FIRST (they never change).
 *
 * Bump CACHE_VERSION only if you ever want to force-purge every phone's cache.
 */
const CACHE_VERSION = "swatchbook-v3";

// Shell precached on install so the very first offline launch works.
const PRECACHE = [
  "./",
  "index.html",
  "manifest.json",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "inventory.js",
  "cq-engine.js",
  "cq-ui.jsx",
  "sb-core.jsx",
  "sb-palette.jsx",
  "sb-autofill.jsx",
  "sb-pages.jsx",
  "sb-markers.jsx",
  "sb-palettes.jsx",
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Inter:wght@400;500;600&display=swap"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) =>
      // don't let one 404 abort the whole precache
      Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // network-first: fresh when online, cached fallback when offline
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("index.html") || caches.match("./"))
        )
    );
  } else {
    // cache-first for immutable third-party libs + anything cross-origin
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => hit)
      )
    );
  }
});
