// Offline support. Bump VERSION whenever you deploy changes so phones pick them up.
const VERSION = "v17";
const CACHE = "koine-" + VERSION;
const SHELL = [
  "./", "index.html", "css/app.css", "manifest.webmanifest", "icon.svg", "icon-192.png",
  "js/app.js", "js/db.js", "js/data.js", "js/store.js", "js/greek.js", "js/ui.js", "js/gloss.js", "js/csv.js", "js/sync.js",
  "js/paradigms.js", "js/prepositions.js", "js/views/prepdrill.js", "js/corpus.js", "js/grade.js", "js/views/translate.js", "js/views/reader.js", "js/morph.js", "js/views/parse.js", "js/views/paradigms.js", "js/views/today.js", "js/views/vocab.js", "js/views/mistakes.js", "js/views/profile.js", "js/views/more.js",
  "vendor/ts-fsrs.mjs", "data/lexicon.json", "data/placement.json", "data/nt.json", "data/forms.json", "data/en-nt.json", "data/lxx/index.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Turso sync requests always go to the network.
  if (url.origin !== location.origin && !url.hostname.includes("fonts.")) return;
  const save = (res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  };
  if (url.origin !== location.origin) {
    // Fonts: cache first.
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then(save)));
    return;
  }
  // App files: network first so updates show up right away; cache when offline.
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(save).catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
