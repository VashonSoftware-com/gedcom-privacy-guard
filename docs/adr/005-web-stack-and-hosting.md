# ADR-005: Web track stack — React + TypeScript + Vite, deployed to Cloudflare Pages from GitHub

**Status:** Accepted; action item 2 (port the engine) superseded by [ADR-010](010-web-app-runs-python-engine-in-pyodide.md)
**Date:** 2026-07-18
**Deciders:** Project owner

## Context

The web track (ADR-004) needs a concrete stack and hosting decision.
Constraints: project owner already hosts other projects on Cloudflare
Pages built from GitHub; a React codebase is explicitly valuable for
their resume; the tool must be installable/offline-capable eventually
(PWA) for the tablet/phone use case that motivated ADR-004 in the
first place.

## Decision

- **Framework:** React
- **Language:** TypeScript (not plain JS) for the shipped version
- **Build tool:** Vite, with `vite-plugin-pwa` for the manifest/service
  worker once core functionality is stable
- **Hosting:** Cloudflare Pages, connected to the GitHub repo, building
  on push (no separate manual deploy step)

The Claude-Artifact React/JS proof-of-concept built during development
is explicitly a reference implementation, not the deployed app — it
exists to validate parsing/scanning logic quickly. It gets ported into
the real project, not shipped as-is.

## Options Considered

### Option A: Plain JS, no framework, single HTML file

| Dimension | Assessment |
|---|---|
| Resume value | Low |
| Type safety | None |
| Fits existing Cloudflare/GitHub workflow | Awkward — no real build step |

### Option B: React + TypeScript + Vite → Cloudflare Pages (chosen)

| Dimension | Assessment |
|---|---|
| Resume value | High — matches stated goal |
| Type safety | Full — catches GEDCOM-parsing edge cases at compile time |
| Fits existing workflow | Yes — matches how other projects are already hosted |
| PWA path | Clean — `vite-plugin-pwa` is a standard, low-effort addition |

## Trade-off Analysis

Option A would have been faster to ship but throws away the resume
value and type safety that Option B provides for roughly the same
underlying logic (already proven in the JS proof-of-concept). Given
the logic is simple, TS's overhead is low and its benefit (catching
malformed GEDCOM assumptions early) is real.

## Consequences

- Repo needs a `web/` subfolder as its own Vite project (package.json,
  tsconfig, etc.), separate from the Python package at the repo root.
- CI: Cloudflare Pages build settings need to point at `web/` as the
  project root once this is set up.
- Until the Vite project exists, the JSX proof-of-concept is kept in
  `web/reference/` as the spec to port from.

## Action Items

1. [ ] Scaffold `web/` with `npm create vite@latest -- --template react-ts`.
2. [ ] Port `web/reference/gedcom-privacy-guard-web.jsx` logic into typed
   modules (parser, scanner, report, redactor — mirroring the Python
   package's module split).
3. [ ] Add `vite-plugin-pwa`.
4. [ ] Connect repo to Cloudflare Pages, root directory `web/`.
