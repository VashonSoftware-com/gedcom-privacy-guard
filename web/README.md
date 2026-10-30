# Web page

The browser version of GEDCOM Privacy Guard, for people who don't use a
terminal. It runs the same Python package as the command line, inside
the browser with [Pyodide](https://pyodide.org) (see
[ADR-010](../docs/adr/010-web-app-runs-python-engine-in-pyodide.md)).
The user's file stays on their computer: the page only talks to its own
site, and its Content-Security-Policy (`public/_headers`) enforces that.

## Develop

Needs Node 24+ and [uv](https://docs.astral.sh/uv/).

```sh
cd web
npm ci
npm run dev       # stages the Python engine, then serves with hot reload
npm run build     # stages, type-checks and builds to dist/
npx vite preview  # serves dist/ with the production headers
```

`npm run stage` (part of `dev` and `build`) fills `public/pyodide/`:
the Pyodide runtime, PyYAML, the openpyxl wheels pinned in `../uv.lock`,
and a wheel built from this checkout. Downloads are checked against
their sha256. After changing the Python package, run it again.

## Layout

- `src/engine/worker.ts`: loads Pyodide and calls
  `gedcom_privacy_guard/web.py` off the main thread.
- `src/engine/protocol.ts`: messages between the page and the worker.
- `src/App.tsx`: the three steps (choose file, decide per note, save).
- `src/Landing.tsx`: what's shown before a file is chosen: features,
  the "How it works" picture, offline and install help.
- `sw.js`: the service worker for offline use and install. The build
  (`vite.config.ts`) writes `dist/sw.js` with the list of every built
  file and a version hash; `npx vite preview` is the place to test it,
  as `npm run dev` doesn't register it.
- `brand/orca-1024.webp`: the logo master, an orca over the
  Cornelisons.com shield. It began as a Canva design; the lettering and
  rounded corners were removed so it works as a square app icon. Make
  the page's copies from it:

  ```sh
  magick brand/orca-1024.webp -resize 320x320 -quality 85 public/logo.webp
  magick brand/orca-1024.webp -blur 0x0.6 -resize 512x512 -strip -colors 256 public/icon-512.png
  # likewise icon-192.png (192) and apple-touch-icon.png (180)
  magick brand/orca-1024.webp -crop 700x700+175+70 +repage -resize 64x64 -colors 128 public/favicon.png
  ```

  The favicon is cropped to the orca and shield, which stay readable
  in a browser tab.
- `reference/`: the original JSX proof of concept, kept as a design
  reference only.

## Deploy

Cloudflare Workers with static assets (no Worker script), set up in
`wrangler.jsonc`, at `gedcom.vashonsoftware.com`. Workers Builds is
connected to GitHub: root directory `web`, build command
`npm run build`, deploy command `npx wrangler deploy`. To check the
built site with Cloudflare's own handling of `_headers`:

```sh
npx wrangler dev
```
