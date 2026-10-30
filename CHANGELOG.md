# Changelog

All notable changes to this project are documented here. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/);
versioning follows [Semantic Versioning](https://semver.org/) --
pre-1.0, so MINOR bumps are breaking/notable changes and PATCH bumps
are fixes. `gedcom_privacy_guard/__init__.py`'s `__version__` is the
source of truth; each release here has a matching `git tag vX.Y.Z`.

See `ROADMAP.md` for the roadmap and `docs/adr/` for design
decisions -- this file tracks what actually shipped, not what's
planned.

## [Unreleased]

### Added

- The help pages are now part of the web page: "What it can and can't
  do", "Help us test it", getting your GEDCOM file, why your data is
  safe, how it decides and Legacy users, made from `docs/` at build
  time. Testers no longer land on GitHub. "Help us test it" now starts
  from the web page rather than the command line.
- `mask` action: replaces just the flagged words with `[removed]` and
  keeps the rest of the note. On the web page it's "Remove just the
  highlighted words", for one note or all of them.
- Web page: a progress ring, with an orca swimming round it, while a
  file is checked; "Rewrite it" starts from the note's own text; the
  Excel download is offered at the top of a long list; dropping a link
  instead of a file says so.
- Web page: a logo drawn as SVG, an orca leaping across a navy shield
  over the Cornelisons.com family shield (that site's own version of
  arms sold under the name, with no claim to be genuine), with and
  without a name ribbon; app icons, a list of what the tool offers, a "How it works"
  picture of what gets flagged, and links to GitHub and to a new
  [what-it-can-do.md](docs/what-it-can-do.md).
- Web page works offline and can be installed as an app: a service
  worker keeps the page's own files (never the user's tree), generated
  at build time with the list of files to keep.

### Fixed

- "During the Depression" and "the Depression years" are no longer
  flagged as mental health.
- A FamilySearch ID ending in `-SSN` (such as `ABCD-SSN`) is no longer
  flagged as a Social Security number.
- The web page scanned every file twice; it now scans once.

## [0.4.0b1] - 2026-10-29

First public release, as a beta for testers. Earlier versions were
private; the public repository starts from a single squashed commit,
so the tags for 0.1.0 to 0.3.1 exist only in this file.

### Added

- `pyproject.toml` with a `gedcom-privacy-guard` command, `uv.lock`, and a
  dev toolchain: ruff, pytest, pip-audit, pre-commit (including gitleaks
  and a hook blocking real GEDCOM files), GitHub Actions CI on
  Windows/macOS/Linux, and Dependabot.
- `ROADMAP.md`: one prioritized roadmap with a competitive analysis.
- Scans every place text hides, not only person notes: notes on events,
  families and sources, shared `NOTE` records, cause of death (`CAUS`),
  source text (`TEXT`), citation detail (`PAGE`), media paths (`FILE`),
  the submitter record (`SUBM`), addresses and custom `_TAG`s. A new
  `found_in` column says where each finding is.
- Reads UTF-8 (with or without BOM), UTF-16, ANSEL and Windows ANSI,
  with CRLF, LF or CR line endings.
- Rule presets `open`, `standard` (default) and `cautious` (`--preset`).
- Rules editor (`gedcom-privacy-guard editor`): one offline page to pick a
  preset, turn categories on or off, set severity, add or remove words and
  exceptions, add categories of your own, and test a pasted note. It opens
  and saves your rules file, which holds only your changes. Its JavaScript
  is checked against the Python scanner in the test suite (needs Node).
  Bundles js-yaml 4.1.0 (MIT).
  A user's rules file now holds only changes (`extends`, `add_terms`,
  `remove_terms`, `exceptions`, new categories), so built-in
  improvements still apply. Old-format rules files still load.
- Terms match whole words by default; `term*` matches a prefix and
  `*term*` matches anywhere. Exceptions suppress known harmless phrases
  ("Great Depression", "prisoner of war").
- New categories: identity-number and contact patterns (SSN, phone,
  email), submitter record, local file paths, text already marked
  private (`[[ ]]`, `{ }`), and cautious-only family secrets, medical,
  security questions and street addresses.
- `SECURITY.md`: how to report a vulnerability privately, and what counts
  as one.
- `docs/legacy.md`: exporting from Legacy, the `[[ ]]` privacy marker,
  bringing cleaned notes back in with Find Duplicates and Manual Merge,
  and Legacy quirks that show up in the report.
- A "Summary" sheet in the report: what was scanned and what wasn't,
  the preset and rules used, counts per category, and file warnings.
- `rules` command (check a rules file and list what's on) and
  `--version`.
- Docs: a one-screen README with a screenshot; `docs/how-it-works.md`
  (what it looks for, an example it catches and one it misses);
  `docs/exporting.md` (per program, including Ancestry and what a
  private tree doesn't cover); `docs/RULES.md` (writing your own rules
  file); ADR-009 (rules file format); `CONTRIBUTING.md`; and issue
  templates for a missed phrase and a false alarm.
- `docs/safety.md`, "Why your data is safe": what the tool does with
  your file, how that's checked, how to check it yourself, and the ways
  data can still leave (synced folders, sharing `review.xlsx`).
  `tests/test_no_network.py` backs it: no network or process imports in
  the package, a full scan → redact run under an audit hook that fails
  on any connection, DNS lookup or new process, and checks of the rules
  editor's Content-Security-Policy.
- `docs/help-wanted.md` for testers: a made-up family to enter and
  export from other programs, the 15-minute test, and how to report;
  issue templates *Sample export* and *Tried it*.
- Release workflow: pushing a `vX.Y.Z` tag checks it matches
  `__version__`, runs the tests, builds and smoke-tests the wheel, then
  publishes to PyPI by trusted publishing (no stored token; PyPI
  attestations link each file to its commit).

### Changed

- **Report columns:** `note_line_start`/`note_line_end` (0-based) are
  now `line`/`line_end` (1-based); `found_in` added after `name`.
  Reports from earlier versions are still read.
- `maiden name` moved to the cautious-only `security_questions`
  category; it flagged most genealogy notes.
- `redact`'s default `--out` is `cleaned.ged`.
- Scanning is about 15 times faster on large files.
- `requirements.txt` removed; install with `pipx install` or from
  `pyproject.toml`. `docs/ARCHITECTURE.md` describes the current
  parser, scanner and report, with new timings.
- `docs/reference/` (verbatim copies of Legacy's help) is replaced by
  `docs/legacy.md`, in our own words with links to Legacy's help.

### Fixed

- Exceptions take the same `*` syntax as terms. The built-in ones now
  cover plurals: "WWII prison camps", "POW camps", "prisoners of war"
  and "economic depressions" are no longer flagged.
- README links are absolute GitHub URLs, so they work on PyPI.
- `redact` checks that every report row points at the same text in
  this GEDCOM, and stops with no output if not, instead of overwriting
  the wrong lines.
- Redacted, rewritten and privatized text keeps its own level, xref and
  tag (it was always written as `1 NOTE`), is re-wrapped into
  `CONT`/`CONC` lines under 255 characters, and the output keeps the
  input's line endings and BOM. Non-UTF-8 input is written as UTF-8 with
  the header's `CHAR` updated.
- Spaces at the ends of `CONC` lines were dropped, joining words.
- Report cells are never written as formulas, and FamilySearch and Find
  a Grave URLs are built only from well-formed IDs.
- `scan` won't overwrite the GEDCOM or an existing report (use
  `--force`), and `redact` won't overwrite the GEDCOM or the report.
- Every expected error is one plain line and exit status 1, never a
  traceback; a Windows console no longer crashes on unusual characters.

### Not yet built

See `ROADMAP.md`, and open Action Items across
`docs/adr/*.md`, for what's planned but not implemented:
Vite+TS+Cloudflare deployment, LLM-based scanner, living-person
inference, diff mode, web-app support for `privatize`.

### Open questions (not yet verified)

- Whether Legacy's own "Ancestry Online Family Tree" GEDCOM export
  type's built-in Privacy button already handles some of what this
  tool checks for (see ADR-002, action item 3). Recommended export
  path in the meantime: manual GEDCOM export with that type selected,
  not the one-click direct-upload toolbar button, so there's always a
  file to scan before anything reaches Ancestry.
- Whether the Find Duplicates + Manual Merge reimport workflow for
  bringing privatized notes back into Legacy actually works as
  described (see `docs/legacy.md`) --
  not yet verified end-to-end on a real file.

## [0.3.1] - 2026-07-19

### Changed

- Report: `action` moved to column A (from last) and frozen alongside
  the header row, so it stays visible while scrolling right through
  context columns. `xref` moved to the tail next to `note_line_start`/
  `note_line_end` -- it's a GEDCOM pointer needed for bookkeeping, not
  something a human reviewer reads.
- Report: `action` now has an in-cell dropdown (keep / redact /
  privatize / rewrite:) instead of requiring free typing; picking
  `rewrite:` and typing your own text after it still works.

## [0.3.0] - 2026-07-19

### Added

- `privatize` action for `redact`: wraps just the flagged phrase in
  `[[double brackets]]` -- Legacy's own native "exclude from exports/
  reports" marker (see ADR-002) -- leaving the rest of the note
  untouched, instead of replacing the whole note like `redact`/
  `rewrite`. Multiple phrases flagged `privatize` on the same note
  each get wrapped independently; `redact`/`rewrite` still take
  priority over `privatize` over `keep` if a note has mixed actions.
- CLI now prints an explicit warning whenever any note was privatized:
  `[[ ]]` is inert outside Legacy, so a privatize-only output is not
  safe to upload directly to Ancestry/FamilySearch/etc. -- it needs to
  go back into Legacy first. README documents the two different
  post-`redact` paths accordingly.

### Fixed

- Privatize wraps the whole word around a matched keyword stem (e.g.
  `alcoholi` -> `[[alcoholism]]`), not just the literal stem, avoiding
  a stray suffix left outside the brackets.

## [0.2.1] - 2026-07-19

### Changed

- Report: `snippet` cells now wrap instead of running off-screen as one
  long line, with a taller row height to fit a wrapped ~200-character
  snippet.
- Report: `severity` now shows as a compact red/yellow/green circle
  icon instead of the plain word, with the actual word ("High" /
  "Medium" / "Low") available as a hover tooltip.

## [0.2.0] - 2026-07-19

### Changed

- **Review report is now `.xlsx`, not `.csv`** (ADR-006). The matched
  term inside the `snippet` column is highlighted as bold/colored rich
  text so it's visually distinct from its surrounding context at a
  glance. `scan`'s default `--out` is now `review.xlsx`; `redact`'s
  `--report` now expects `.xlsx`. New dependency: `openpyxl`.

## [0.1.2] - 2026-07-19

### Changed

- Scanner: snippet context window widened from 40 to 100 characters on
  each side of a match, so a reviewer can usually judge a flag from
  the CSV alone (e.g. tell "the Great Depression" or "WWII prison
  camps" apart from a real `depression`/`prison` hit) without opening
  the source file.
- Report: reordered review CSV columns so `severity`, `category`,
  `snippet`, and `matched_term` -- the primary things a reviewer reads
  to make a keep/redact decision -- sit right after `name`, ahead of
  the disambiguation and cross-reference columns that are only needed
  occasionally.

## [0.1.1] - 2026-07-19

### Fixed

- Parser: an unhandled level-1 GEDCOM tag (e.g. `CHAN`, the
  record-last-modified tag present in almost every real export) left
  stale birth/death event context in place, so its DATE/PLAC children
  could silently overwrite `birth_date`/`death_date`/`birth_place`/
  `death_place` -- corrupting the disambiguation data the review CSV
  depends on to tell same-named relatives apart.
- Redactor: `keep`/`redact`/`rewrite:` action matching is now
  case-insensitive, and an unrecognized action value now raises an
  error (and aborts before writing an output file) instead of
  silently defaulting to "keep" -- previously a typo in the reviewed
  CSV could leave a flagged note un-redacted with no warning.

### Added

- Regression tests for both fixes (`tests/test_pipeline.py`).

## [0.1.0] - 2026-07-18

### Added

- Initial Python CLI: `scan` and `redact` commands, keyword-based
  scanner, CSV review report, GEDCOM parser (INDI notes, CONT/CONC
  continuation lines).
- Parser: FAM record resolution (parents/spouses), vital dates/places,
  and identifier extraction (`_FSFTID`, `_FGRAVE`, `AFN`, `REFN`) for
  disambiguating same-named individuals -- populated only when present
  in the source file, never inferred.
- Test suite covering parsing, disambiguation, and scanning
  (`tests/test_pipeline.py`).
- ADR-001 through ADR-005 recorded (see `docs/adr/`).
- Web proof-of-concept built as a React/JS Claude Artifact: full scan
  pipeline running client-side (File API, no upload), per-row
  keep/redact/rewrite actions, CSV and cleaned-GEDCOM export. Stored
  at `web/reference/` as the spec to port into the real TypeScript
  project (ADR-005, action items still open).
