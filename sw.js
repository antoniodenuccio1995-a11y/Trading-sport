// Service worker minimale: file dell'app con nome versionato (assets/) dalla cache,
// pagina principale dalla rete con ripiego sulla cache. I dati partite stanno in IndexedDB.
const CACHE = "ta-shell-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/matrimonio/")) return; // la partecipazione di nozze non fa parte dell'app
  if (url.pathname.includes("/scheda/")) return; // la scheda di investimento non fa parte dell'app
  if (url.pathname.includes("/assets/")) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })));
  } else if (e.request.mode === "navigate") {
    // solo la pagina dell'app: le altre pagine pubblicate sullo stesso sito (es. /scheda/) non vanno in cache
    const scope = new URL(self.registration.scope).pathname;
    if (url.pathname !== scope && url.pathname !== `${scope}index.html`) return;
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./", copy)); return r; }).catch(() => caches.match("./")));
  }
});
