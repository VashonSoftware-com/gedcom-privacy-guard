# ADR-001: Human-reviewed flagging, never automated deletion

**Status:** Accepted
**Date:** 2026-07-18
**Deciders:** Project owner

## Context

The tool inspects notes containing sensitive family history (mental
health, addiction, unverified claims, identity-risk data) before
export to a shared platform. An automated tool could plausibly
auto-redact anything matching a rule.

## Decision

The tool never deletes or rewrites content automatically. It only
*flags* candidates and writes a human-reviewable report (CSV / on-screen
cards). Redaction only happens after a person explicitly sets an
`action` per flagged item.

## Options Considered

### Option A: Auto-redact on match

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Risk of false positives destroying legitimate content | High |
| Trust | Low — a wrong keyword match silently deletes real research |

### Option B: Flag-and-review (chosen)

| Dimension | Assessment |
|---|---|
| Complexity | Medium (needs a review UI/CSV) |
| Risk | Low — nothing changes without a human decision |
| Trust | High — the person stays in control of their own family history |

## Trade-off Analysis

Keyword matching has no contextual understanding — "institutionalized"
could describe a mental health event or an unrelated legal
institution. Auto-redaction on a false positive is a silent,
undetected data-loss bug. A review step costs time but is the only
safe default for irreversible edits to decades of research.

## Consequences

- Every interface (CLI, web) must expose an explicit review step
  before any rewrite happens.
- The original file is never modified in place, only read from.
- Future automated scanners (e.g. an LLM-based one, ADR-004-adjacent)
  must plug into the same flag-then-review flow, not bypass it.

## Action Items

1. [x] CLI `scan`/`redact` split into two commands with a CSV checkpoint.
2. [x] Web version keeps `keep` as the default action per row.
