// The service worker that lets the page work offline, and so be
// installed as an app. vite.config.ts copies this to dist/sw.js at build
// time, filling in FILES (every file the build produced, ~14 MB, mostly
// Pyodide) and VERSION (a hash of them all).
//
// The page itself is stored on the first visit, the engine the first time
// it is used (see ENGINE below).
// Cache first: once a version is stored, the page never needs the
// network. A new deploy changes VERSION, so the browser installs the
// new copy in the background and uses it from the next visit.
// It only ever fetches from this site; it never sees the user's file,
// which is read straight from disk by the page.

const VERSION = "__VERSION__";
const FILES = __FILES__;
const CACHE = `gpg-${VERSION}`;
// The engine (Pyodide, most of the 14 MB) is kept only once someone has
// used it: the page posts "keep-engine" when the engine is ready. Until
// then a visit downloads just the page itself.
const isEngine = (path) => path.startsWith("/pyodide/");
const SHELL = FILES.filter((f) => !isEngine(f));
const ENGINE = FILES.filter(isEngine);

// Whether an older version already kept the engine, so an update keeps
// working offline for people who have used it.
async function hadEngine() {
  for (const key of await caches.keys()) {
    if (key === CACHE) continue;
    const cache = await caches.open(key);
    if ((await cache.keys()).some((r) => isEngine(new URL(r.url).pathname))) return true;
  }
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL);
      if (await hadEngine()) await cache.addAll(ENGINE);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data === "keep-engine") {
    event.waitUntil(
      caches.open(CACHE).then(async (cache) => {
        for (const f of ENGINE) if (!(await cache.match(f))) await cache.add(f);
      }),
    );
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // A page address that isn't one of ours opens the app.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") {
        const home = await cache.match("/");
        if (home) return fetch(req).catch(() => home);
      }
      const res = await fetch(req);
      // Keep an engine file fetched by the page, as "keep-engine" would.
      if (res.ok && ENGINE.includes(new URL(req.url).pathname)) event.waitUntil(cache.put(req, res.clone()));
      return res;
    }),
  );
});
