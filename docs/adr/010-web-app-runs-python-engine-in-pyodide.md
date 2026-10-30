# ADR-010: The web app runs the Python engine in the browser with Pyodide

**Status:** Accepted (partly supersedes ADR-004 and ADR-005)
**Date:** 2026-10-29
**Deciders:** Project owner

## Context

The first testers are genealogists, not programmers: `pipx` and a
terminal are out of reach for them. The web version (ADR-004) was
planned for after 1.0 and as a separate TypeScript engine. It is
needed now, before 1.0, so testers can try the tool at all.

Constraints:

- The user's file must never leave their computer. That is the
  product's main promise and the reason a server-side service is ruled
  out (it would also cost money to run).
- Hosting must cost nothing or close to it.
- The Python engine is tested (160+ tests, Hypothesis fuzzing, a
  192k-person real export). A second engine would have to match it
  rule for rule, forever.

## Decision

- The web page runs the **same `gedcom_privacy_guard` package** in the
  browser with **Pyodide** (CPython compiled to WebAssembly), in a Web
  Worker. A small module, `gedcom_privacy_guard/web.py`, takes file
  paths in Pyodide's in-memory file system and returns JSON; it is
  tested with pytest like the rest of the package.
- The interface stays **React + TypeScript + Vite** (ADR-005).
- **Everything is served from our own site.** `web/scripts/stage-python.mjs`
  copies the Pyodide runtime from npm and, at build time only, fetches
  PyYAML (Pyodide's build) and the openpyxl/et-xmlfile wheels pinned in
  `uv.lock`, checking every sha256. The page makes no request to any
  other site.
- A **Content-Security-Policy** (`public/_headers`) enforces that:
  `connect-src 'self'`, no remote scripts, and only
  `'wasm-unsafe-eval'` (to compile WebAssembly, not to eval
  JavaScript).
- Hosting: **Cloudflare Workers with static assets** (no Worker
  script) at `gedcom.vashonsoftware.com`, built by Workers Builds from
  GitHub; config in `web/wrangler.jsonc`. Free plan. This replaces
  ADR-005's Cloudflare Pages: Cloudflare now steers new sites to
  Workers, which serves the same `_headers` file (John, 29 Oct 2026).

This replaces ADR-004's "two codebases, no shared code" and ADR-005's
action item to port the engine to TypeScript. The JSX proof of concept
in `web/reference/` stays as a design reference only.

## Options Considered

### Option A: Python engine in Pyodide, React interface (chosen)

| Dimension | Assessment |
|---|---|
| Behavior matches the CLI | Exactly; same code and rules file |
| Effort to first tester build | Small; no engine work |
| First visit | About 13 MB download, then cached |
| Speed | About 2.5× slower than native (192k people: ~95 s vs ~37 s); typical trees take seconds |

### Option B: Port the engine to TypeScript (ADR-004 as written)

| Dimension | Assessment |
|---|---|
| Behavior matches the CLI | Only as far as two codebases are kept in step |
| Effort | Large: parser, encodings (incl. ANSEL), scanner, redactor, XLSX, plus their tests |
| First visit | Small (~250 kB) |
| Speed | Faster |

### Option C: Hosted service (upload, process on a server)

Ruled out: breaks "your file never leaves this computer", and costs
money per use.

## Trade-off Analysis

B's smaller download and speed don't matter much for a tool people use
a few times a year, and its cost is permanent: every rule or parser
fix would be made twice. A gets testers a working page now, with the
engine that already passes the tests, and keeps the privacy promise
checkable: the CSP and the network panel show that nothing is sent.

## Consequences

- One engine. A fix in the Python package reaches the web page at the
  next build.
- The web build needs Python packaging (uv, or pip as a fallback) as
  well as Node.
- The Pyodide version is pinned in `web/package.json`; upgrading it
  also changes which PyYAML build is fetched.
- Very large trees (100k+ people) take a minute or more in the browser.
  The page says so while it works.
- Files under `/pyodide/` keep the same names between builds, so they
  are served with `Cache-Control: no-cache` (revalidated, not
  re-downloaded).

## Action Items

1. [x] `gedcom_privacy_guard/web.py` and `tests/test_web.py`.
2. [x] `web/` Vite project: worker, page, staging script, CSP headers.
3. [x] Tested in Chrome with `sample.ged` and a 192k-person export: no
   requests to other sites, no CSP violations.
4. [ ] CI job that builds `web/`.
5. [x] Workers Builds project at `gedcom.vashonsoftware.com` (`web/wrangler.jsonc`),
   live 29 Oct 2026.
6. [ ] Add `vite-plugin-pwa` so the page works offline (from ADR-005).
