# ADR-003: Reject automated reimport/merge into Legacy

**Status:** Accepted
**Date:** 2026-07-18
**Deciders:** Project owner

## Context

A tempting design was: script edits a GEDCOM export, reimports it into
Legacy, and the corrected notes land back in the master file
automatically — closing the loop without manual editing.

Investigated Legacy's actual GEDCOM import behavior: import always
lands in a *separate temporary family file*. Legacy does not match
incoming records to existing people by ID and update them in place;
the person must manually drag-and-drop individuals from the temp file
into the primary file. There is no supported "update existing record"
import mode.

## Decision

Do not build automated reimport/merge. This is out of scope, not
deferred — it's unsafe given how Legacy's import actually works.

## Options Considered

### Option A: Automated reimport/merge

| Dimension | Assessment |
|---|---|
| Feasibility | Low — Legacy has no update-by-ID import |
| Risk | High — realistic outcome is duplicate individuals across a few hundred people |
| Effort to make safe | Very high (would need custom dedup logic Legacy itself doesn't provide) |

### Option B: Guided manual edit (chosen — see ADR-002)

| Dimension | Assessment |
|---|---|
| Feasibility | High — uses Legacy's own editing UI |
| Risk | Low — no bulk import step at all |
| Effort | Medium, proportional to number of flagged notes |

## Trade-off Analysis

The automation would save manual effort, but the failure mode (silent
duplicate creation across a large tree) is worse than the problem it
solves, and there's no supported Legacy feature to build it safely on
top of. This isn't a "we'll get to it" item — it's a rejected
direction, recorded so it isn't re-proposed without new information
(e.g. if Legacy later ships an update-by-ID import API).

## Consequences

- The tool's job stops at producing a review worklist; applying edits
  inside Legacy is manual, by design.
- If Legacy (or a successor tool) ever exposes a real update-in-place
  import, this ADR should be revisited and marked Superseded.

## Action Items

1. [ ] **New information, refines the guided-manual-edit path (Option
   B), does not contradict the Decision above:** Legacy's Find
   Duplicates + Manual Merge feature (see
   [`docs/legacy.md`](../legacy.md#bringing-cleaned-notes-back-into-legacy))
   offers a better mechanism than plain drag-and-drop for bringing corrected notes
   back into the master file: import `cleaned.ged` as a *separate*
   Legacy database, run Find Duplicates to match it against the
   master file, then use Manual Merge's side-by-side, field-by-field
   picker to select the corrected/redacted `NOTE` over the original,
   per person. Still entirely human-driven (a click per field/person,
   no scripting/API) — same as the drag-and-drop path this ADR
   originally described, just more guided and less error-prone for a
   few hundred records. Not verified end-to-end on a real file yet;
   once verified, fold into user-facing documentation (README or a
   how-to doc) as the recommended reimport path.
