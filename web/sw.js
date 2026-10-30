// The service worker that lets the page work offline, and so be
// installed as an app. vite.config.ts copies this to dist/sw.js at build
// time, filling in FILES (every file the build produced, ~14 MB, mostly
// Pyodide) and VERSION (a hash of them all).
//
// Cache first: once a version is stored, the page never needs the
// network. A new deploy changes VERSION, so the browser installs the
// new copy in the background and uses it from the next visit.
// It only ever fetches from this site; it never sees the user's file,
// which is read straight from disk by the page.

const VERSION = "__VERSION__";
const FILES = __FILES__;
const CACHE = `gpg-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
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
  // Any page address opens the app; everything else is looked up as is.
  const key = req.mode === "navigate" ? "/" : req;
  event.respondWith(
    caches.open(CACHE).then((cache) => cache.match(key, { ignoreSearch: true }).then((hit) => hit ?? fetch(req))),
  );
});
