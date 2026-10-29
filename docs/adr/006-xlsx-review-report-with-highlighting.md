# ADR-006: Switch review report from CSV to XLSX for rich-text highlighting

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Project owner

## Context

ADR-001 established a human-reviewable spreadsheet checkpoint between
scanning and redaction. ARCHITECTURE.md's "Design decisions worth
knowing about" chose plain CSV for it specifically, citing "Excel/
Sheets is genuinely a fine review interface." A real scan against a
491-person production GEDCOM export (22 flags, several false
positives like "the Great Depression" and "WWII prison camps"
tripping keyword matches) surfaced a usability gap: nothing in the
snippet visually distinguishes the actual matched word/phrase from
its surrounding context, so a reviewer has to read the whole 200+
character snippet carefully every time instead of glancing at what
tripped the flag. Plain CSV has no way to fix this -- it's flat
delimited text with no concept of cell-level, let alone
run-level/partial-cell, formatting.

## Decision

Switch `scan`'s report output from `.csv` to `.xlsx`, written via
`openpyxl`, with the matched term inside the `snippet` cell rendered
as a separate bold/colored rich-text run so it's visually distinct
from the surrounding context at a glance. `redact`'s `--report` input
correspondingly now reads `.xlsx` instead of `.csv`.

## Options Considered

### Option A: Stay CSV, fake highlighting with plain-text markup

E.g. wrap the matched term in `**word**` or `>>word<<` inside the
snippet text.

| Dimension | Assessment |
|---|---|
| New dependency | None |
| Real visual highlighting | No -- still requires reading text carefully, just with extra punctuation noise |
| Effort | Very low |

### Option B: Offer `.xlsx` as an additional opt-in format, keep CSV as default

Add a `--format` flag to `scan`; `redact` accepts either.

| Dimension | Assessment |
|---|---|
| New dependency | Same as Option C, but only exercised when opted into |
| Preserves current default behavior | Yes |
| Implementation/test surface | Doubled -- two report writers/readers to keep in sync |

### Option C: Switch entirely to `.xlsx` (chosen)

| Dimension | Assessment |
|---|---|
| New dependency | `openpyxl` (MIT-licensed) |
| Real visual highlighting | Yes, every run, no flag to remember |
| Implementation/test surface | Single code path |
| Compatibility | Opens fine in both Excel and Google Sheets, same as CSV did |

## Trade-off Analysis

Option B preserves current behavior for any hypothetical existing
consumer of `review.csv`, but there are no other consumers yet
(pre-1.0, single project owner), and the whole point of this file is
human review in a spreadsheet -- doubling the implementation and test
surface for two formats isn't worth it before there's a second,
decoupled consumer that actually needs plain CSV. Chose Option C.

## Consequences

- New dependency: `openpyxl`, in addition to `PyYAML`. ARCHITECTURE.md's
  "Stdlib-only for v1" design note is no longer accurate and needs
  updating alongside the "CSV as the review UI" note.
- `report.py`'s `write_report`/`read_reviewed_report` now do file I/O
  via `openpyxl` instead of the stdlib `csv` module.
- `cli.py`'s default `--out` for `scan` changes from `review.csv` to
  `review.xlsx`; README's Quickstart needs the matching update.
- The web track (ADR-004/005) can't reuse this Python code and will
  need its own answer for highlighting eventually -- not solved here.

## Action Items

1. [x] Implement in `report.py`/`cli.py`/README/tests.
2. [ ] When the web track's review UI is built, decide whether it also
   needs `.xlsx` output (a browser-side xlsx writer is a heavier
   dependency than this) or a different review artifact entirely
   (e.g. on-screen cards, per ADR-001's original wording) -- revisit
   then, don't assume the CLI's answer carries over unexamined.
