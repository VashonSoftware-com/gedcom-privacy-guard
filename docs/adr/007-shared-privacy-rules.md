# ADR-007: One privacy rules document and policy file, shared with family site builds

**Status:** Accepted (document); policy file planned
**Date:** 2026-10-25
**Deciders:** Project owner

## Context

The privacy rules had spread across five places: the genealogy chats'
instructions, a practices note in the owner's notes, the reference family
site's build (cornelisons.com), this engine's
`rules.yaml`, and a generic website privacy page. They had already drifted
(e.g. a 20-year vs. 10-year vs. 1-year recently-deceased window at different
times), and none recorded *why* a rule was chosen.

## Decision

`docs/PRIVACY-RULES.md` in this repo is the single place where the rules and
their reasons are edited. Code and the public privacy page follow it. Next,
a machine-readable `privacy-policy.yaml` with three layers (preset, family
values, per-person overrides), validated by one JSON Schema kept here, will
be read by both the Python engine and the Node site build.

## Options Considered

### Option A: Keep rules in each project

| Dimension | Assessment |
|---|---|
| Effort | None now |
| Drift | Already happening |
| Reuse by other families | Hard: no single statement to copy |

### Option B: Rules document in the owner's notes

| Dimension | Assessment |
|---|---|
| Effort | Low |
| Next to code | No; the notes aren't where the engine or site live |
| Reuse | Tied to one family's notes |

### Option C: Rules document and schema in this engine repo (chosen)

| Dimension | Assessment |
|---|---|
| Effort | Low now; moderate for the policy file |
| Next to code | Yes, for the engine; the site already reads files from here |
| Reuse | Presets make it usable by other families |

## Trade-off Analysis

The engine is the generic, reusable part; the site is one family's use of
it. Putting the rules with the engine keeps family-specific data (names,
per-person overrides) out of it and in the private site repo.

## Consequences

- Rule changes start in `docs/PRIVACY-RULES.md`.
- The owner's genealogy instructions keep a short operational summary and
  point here for reasons.
- Family values and per-person overrides stay in each family's own site
  repo, never here.

## Action Items

1. [x] Write `docs/PRIVACY-RULES.md`.
2. [ ] JSON Schema and `open` / `standard` / `cautious` presets.
3. [ ] Engine reads the policy; keyword categories map onto policy categories.
4. [ ] Site build reads the policy instead of its own thresholds.
