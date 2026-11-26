// Sends every other address for the site to https://gedcomtools.com,
// keeping the path and query: www.gedcomtools.com, gedcomtools.org,
// www.gedcomtools.org and the old gedcom.vashonsoftware.com.
//
// The site itself stays plain static files (ADR-010); only this small
// Worker runs code, and it never sees anyone's family tree.
//
// /sw.js is the exception. Browsers that used the old address have the
// site's cache-first service worker installed there, and a browser
// won't update a service worker through a redirect, so they'd keep the
// old copy forever. Instead, the old address's /sw.js is a service
// worker that deletes the old cache, unregisters itself and moves any
// open tabs to the new address.

const TARGET = "https://gedcomtools.com";

const RETIRE_SW = `// This site moved to ${TARGET}.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: "window" })) {
      const url = new URL(client.url);
      client.navigate("${TARGET}" + url.pathname + url.search + url.hash);
    }
  })());
});
`;

export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/sw.js") {
      return new Response(RETIRE_SW, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    return Response.redirect(TARGET + url.pathname + url.search, 301);
  },
};
