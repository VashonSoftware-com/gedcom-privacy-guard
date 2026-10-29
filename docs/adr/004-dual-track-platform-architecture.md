# ADR-004: Dual-track architecture — Python CLI + browser-based web app

**Status:** Accepted
**Date:** 2026-07-18
**Deciders:** Project owner

## Context

Requirement: the tool must be usable on Windows, macOS, iPadOS, and
Android. The existing Python CLI only runs where a Python interpreter
and filesystem access exist — that's Windows/macOS/Linux desktops, not
iPad, and not realistically Android for a typical user.

## Decision

Maintain two interfaces sharing the same behavioral spec (rule
categories, action vocabulary, report columns) but implemented
separately:

- **CLI** (Python) — desktop/batch/scripting track, already built.
- **Web app** (React) — runs entirely client-side in a browser via the
  File API; no server, no install; works on every platform in scope.

## Options Considered

### Option A: Python-only, tell tablet/phone users to use a desktop

| Dimension | Assessment |
|---|---|
| Meets platform requirement | No |
| Effort | Lowest |

### Option B: Rewrite everything in JS/TS, drop the Python CLI

| Dimension | Assessment |
|---|---|
| Meets platform requirement | Yes |
| Loses | Easy local scripting/batch use, existing tested Python code |

### Option C: Maintain both, Python CLI + browser app (chosen)

| Dimension | Assessment |
|---|---|
| Meets platform requirement | Yes |
| Effort | Higher — two codebases to keep behaviorally in sync |
| Value | CLI remains useful for power-user batch work; web app satisfies the actual cross-platform constraint; both are legitimate portfolio pieces |

## Trade-off Analysis

Option C costs more to maintain than picking one, but the platform
constraint is real (not aspirational) and the two tracks serve
genuinely different use cases — a terminal-scriptable tool vs. an
installable, no-setup tool for a tablet. The risk (behavioral drift
between the two) is manageable by treating the CLI's `rules.yaml` and
CSV schema as the canonical spec the web app mirrors.

## Consequences

- Two codebases, two languages. No shared code, but shared *design*:
  same rule categories, same CSV columns, same action vocabulary
  (`keep`/`redact`/`rewrite`/`privatize`).
- Documentation must clearly state which track a given file belongs
  to (see repo folder layout: `gedcom_privacy_guard/` for CLI, `web/`
  for the browser app).
- Any new detection category added to one must be added to the other
  or explicitly logged as a known gap.

## Action Items

1. [x] Build CLI (Python) — done.
2. [x] Build web proof-of-concept (React/JS, as a Claude Artifact).
3. [ ] Port proof-of-concept into a proper Vite+TypeScript project (see ADR-005).
