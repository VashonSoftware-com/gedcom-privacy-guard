# ADR-002: Privatize at the source (Legacy), not only at export time

**Status:** Accepted
**Date:** 2026-07-18
**Deciders:** Project owner

## Context

Legacy Family Tree is the user's system of record. Sensitive notes
live there and get carried into every future GEDCOM export (Ancestry,
FamilySearch, a cousin's request, a printed book) unless dealt with
every single time. Legacy has a native privacy convention: text
wrapped in `[[double brackets]]` inside any note field is excluded
from exports/reports by default.

## Decision

Treat "fix it in Legacy using `[[ ]]`" as the primary remediation
path, not a one-off cleaned export for a single destination. The tool
produces a *worklist* pointing at exactly which person/note/phrase to
bracket; the person makes that edit inside Legacy itself.

## Options Considered

### Option A: Downstream export-time cleaning only

Produce a cleaned copy of each export as needed.

| Dimension | Assessment |
|---|---|
| Effort per use | Low, repeatable |
| Permanence | None — has to be redone for every future export/destination |
| Fixes the master record | No |

### Option B: Fix at the source via `[[ ]]` (chosen), export-time cleaning kept as a secondary net

| Dimension | Assessment |
|---|---|
| Effort | Higher up front (manual edits in Legacy) |
| Permanence | High — respected by every future export automatically |
| Fixes the master record | Yes |

## Trade-off Analysis

Option A is a treadmill: every new export destination requires
re-scrubbing the same notes. Option B costs more up front but the
privacy decision becomes durable. Keeping Option A available as a
secondary, stricter filter still makes sense for one-off shares that
should be more redacted than the Legacy default (e.g., a fully public
tree vs. a private family share).

## Consequences

- The CLI/web `review` output must be structured so a person can find
  the *exact* note field to edit in Legacy (see ADR-003 on
  disambiguation).
- A `privatize` action (wrap matched phrase in `[[ ]]`, don't delete)
  is on the roadmap alongside `redact`/`rewrite`.
- This does not remove the need for Option A entirely; both paths stay
  documented in the README as separate use cases.

## Action Items

1. [x] Add `privatize` action to CLI redactor (v0.3.0). Wraps the
   matched phrase in literal `[[` and `]]` -- exactly what Legacy's
   own Ctrl-P "Privatize" command produces (see
   [`docs/legacy.md`](../legacy.md#marking-text-private)). **Important caveat
   surfaced during implementation:** `[[ ]]` only means something to
   Legacy -- a `privatize`-only output is *not* safe to upload
   directly to Ancestry/FamilySearch/etc., since those platforms don't
   honor the marker and would show the phrase in plain text plus
   literal brackets. The CLI now prints an explicit warning when any
   note was privatized, and the README documents the two different
   post-`redact` paths (direct upload vs. reimport into Legacy). Web
   app support still open.
2. [x] Worklist carries enough identifying detail to locate the record in Legacy.
3. [ ] **Open question — verify before relying on this ADR's workflow
   being sufficient on its own:** Legacy's GEDCOM export dialog has a
   dedicated "Ancestry Online Family Tree" export type with its own
   **Privacy button** (`File > Export > GEDCOM File`, select that type,
   click Privacy). Unknown, and needs checking at the desktop: does it
   already honor `[[ ]]` private-note markers on export? Does it exclude
   living people by rule, independent of the `Living` flag? If it
   covers meaningful ground, this tool becomes a second-opinion pass on
   top of Legacy's own privacy export rather than the only line of
   defense — worth knowing either way, since it changes how much this
   tool needs to catch on its own.
4. [ ] **Export path decision:** prefer the manual export
   (`File > Export > GEDCOM File`, type = "Ancestry Online Family
   Tree") over the one-click "My Toolbar > Ancestry.com > Upload to
   Ancestry Online Family Tree" button. The one-click button uploads
   directly with no intermediate file, which removes the only
   checkpoint where this tool's scan can run before data reaches
   Ancestry. The manual export produces a `.ged` to scan first, and
   still gets Ancestry-specific formatting since it uses the dedicated
   export type — best of both.
