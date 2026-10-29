# GEDCOM Privacy Guard — Architecture

## Platform goal (constraint, not aspiration)

This must be usable on Windows, macOS, iPadOS, and Android — not just "a Python
script for people with a terminal." That rules out a Python CLI as the _only_
interface: iPad has no real Python/filesystem access, and Android realistically
needs Termux, which most people won't install.

Since everything here is pure text processing (parse GEDCOM → scan → report →
redact, no server-side state, no network calls needed), the whole pipeline can
run **client-side in a browser** — a file picker, in-memory JS processing, a
downloaded result. A browser is the one runtime guaranteed on every platform in
scope.

**Two parallel interfaces, one shared design:**

| Track | Language/runtime                                           | Platforms                                     | Role                                                       |
| ----- | ---------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| CLI   | Python, terminal                                           | Windows / macOS / Linux desktop               | Batch runs, scripting, portfolio piece                     |
| Web   | React + TypeScript + Vite → Cloudflare Pages (from GitHub) | Windows / macOS / iPadOS / Android / anything | The version anyone can actually open and use; resume piece |

**Deployment target for the web track:** React, built with Vite, TypeScript,
deployed via Cloudflare Pages with builds triggered from GitHub (push → CI build
→ deploy). This is also the professional version — worth doing properly (typed,
componentized, tested) rather than a quick script. `vite-plugin-pwa` adds the
manifest/service worker for installability once the core tool works.

The Claude Artifact built during development is a React proof-of-concept (JS,
not TS — Artifacts don't run a TS build step) used to validate the logic and get
a usable tool immediately. It is not the deployed version; treat it as the
spec/reference implementation to port into the real Vite+TS project.

## Why this exists

Genealogy research notes routinely contain sensitive material that was never
meant for a public family tree: mental health history, addiction, unverified
family rumors, or details about people who are still living. GEDCOM exports
carry all of that along for the ride unless someone manually reviews every note
field. This tool automates the _finding_ part and keeps a human in the loop for
the _deciding_ part.

Core principle: **never auto-delete, always auto-flag.** The tool never silently
rewrites your source of truth. It reads a GEDCOM, produces a human-reviewable
report, and only touches a _copy_ of the file after you've approved specific
changes.

## Pipeline

```text
Genealogy program (Legacy, RootsMagic, …; source of truth)
        │  export
        ▼
  input.ged  ──────────────► [1] Parser
                                   │
                                   ▼
                             [2] Scanners  (pluggable)
                                   │
                                   ▼
                         [3] Review Report (XLSX)
                                   │
                          (you edit the "action" column)
                                   ▼
                             [4] Redactor
                                   │
                                   ▼
                          output.ged  (reviewed copy to upload)
```

### 1. Parser (`parser.py`, `encoding.py`)

A small, dependency-free GEDCOM reader. `encoding.py` detects UTF-8 (with
or without a BOM), UTF-16, ANSEL and Windows ANSI, and either line ending.
The parser then finds every place free text can hide and turns each into a
`TextBlock` holding the text (with `CONT`/`CONC` lines joined), the exact
source lines it came from, the record it sits in and a `location`:

| Location | GEDCOM |
|---|---|
| `note` | `NOTE` at any level, including shared `0 @N1@ NOTE` records |
| `cause` | `CAUS` (cause of death and other events) |
| `source_text` | `SOUR`/`TEXT` |
| `citation` | `PAGE` under a source citation |
| `media_file` | `OBJE`/`FILE` paths |
| `submitter` | the `SUBM` record |
| `address` | `ADDR`, `PHON`, `EMAIL` and the like |
| `custom_tag` | text in user-defined `_TAG`s |

It also collects enough about each person (name, vitals, parents, spouses,
FamilySearch, Find a Grave and other IDs) to tell same-named relatives apart
in the report. Names, dates and places pass through unchanged. Input that
isn't a GEDCOM file raises a `GedcomError` with a plain message; Hypothesis
fuzzing in `tests/test_fuzz.py` checks that nothing else escapes.

_Deliberately not a full GEDCOM 5.5.1/7.0 implementation._ The rest of the
pipeline only needs `TextBlock`s and `Individual`s, so the parser could be
swapped for a library later.

### 2. Rules and scanner (`rules.py`, `rules.yaml`, `scanner.py`)

`rules.py` builds a `RuleSet` from the built-in `rules.yaml`, a preset
(`open`, `standard`, `cautious`) and the user's rules file, which holds only
changes ([ADR-009](adr/009-rules-file-format.md)). Each category has terms
(whole word, prefix or substring), regex patterns, exceptions, a severity,
and optionally a list of locations it applies to.

`KeywordScanner.scan(text, location)` returns `Finding`s (category,
severity, matched text, snippet). For speed on large files it first runs one
combined regex over the text to rule out the common case of no match, then
per category runs an alternation of that category's terms on lowercased
text, checking word starts in Python rather than with a lookbehind (Python's
regex engine can't skip ahead past a lookbehind). `term_regex` is the
reference definition of a match, and the rules editor mirrors it in
JavaScript. Overlapping hits within a category are reported once, and any
hit inside an exception phrase is dropped. How this looks to a user is in
[`how-it-works.md`](how-it-works.md).

Any scanner with the same `scan(text, location)` method can run alongside
the keyword scanner. A future LLM scanner (P3 in the roadmap) would plug in
there. The shipped scanner is keyword-only, so it works offline,
deterministically and with no API key.

### 3. Report (`report.py`)

Writes an `.xlsx` with two sheets ([ADR-006](adr/006-xlsx-review-report-with-highlighting.md)).
**Review** has one row per finding: an `action` dropdown first (`keep`,
`redact`, `rewrite:<text>`, `privatize`), then name, `found_in`, severity,
category, a snippet with the match highlighted, the matched term, the
person's details and IDs, and finally `xref`, `line` and `line_end` for the
redactor. **Summary** says what was scanned and skipped, the preset and
rules used, counts per category, and any warnings about the file. Every cell
is written as text, never a formula, and URLs are built only from
well-formed IDs.

### 4. Redactor (`redactor.py`)

Reads the reviewed spreadsheet and writes a _new_ GEDCOM. Before writing,
it checks that every row still points at the same text in this file, and
stops with no output if any doesn't. Changed text keeps its level, tag and
xref, is re-wrapped into `CONT`/`CONC` lines under 255 characters, and keeps
the input's line endings. Non-UTF-8 input is written as UTF-8 with the
header's `CHAR` updated. `privatize` wraps only the matched words in
`[[ ]]` (see [`legacy.md`](legacy.md)).

### Rules editor (`editor/`)

One offline HTML page (`gedcom-privacy-guard editor`) that loads, edits,
tests and saves a rules file in the browser. It runs from `file://` with no
network access, so the built-in rules are bundled as `builtin-rules.js`,
generated by `scripts/build_editor_data.py`. `rules-engine.js` reimplements
the rules loader and term matching; `tests/test_editor.py` runs it under
Node against the Python code on the same inputs. It's meant to become the
first screen of the web version.

## Design decisions worth knowing about

- **Minimal dependencies.** `PyYAML` for the rules file and `openpyxl` for the
  review spreadsheet (see ADR-006); no framework or database.
- **A spreadsheet as the review UI**, not a GUI. Fast to build, and
  Excel/Sheets is genuinely a fine review interface for a few hundred rows.
  Started as plain CSV; switched to `.xlsx` in ADR-006 so the matched term
  can be highlighted within the snippet, which CSV can't represent.
- **Nothing is overwritten.** `scan` won't replace an existing report without
  `--force`, and neither command will write over its inputs, so you can re-run
  `scan` as often as your data changes.

## Performance

Measured 29 Oct 2026 on a 162 MB, 7.1-million-line real export (192,444
people, 511,386 text fields, 624 findings with the `standard` preset):

| Stage | Time |
|---|---|
| Read and parse | 24.9 s |
| Scan and write report | 11.9 s |
| **Total** | **36.8 s** |

The scan was rewritten for 1.0 (the combined pre-check and the lowercase
term matcher above), making it about 15 times faster than the earlier
regex-per-term version. Parsing now dominates. That is fast enough for a
tool run a few times per upload, so there's no target to hit; this is a
baseline to compare changes against.

## Toolchain

- **Packaging and environments:** `pyproject.toml` (hatchling) and `uv`, with
  a committed `uv.lock`.
- **Lint and format:** `ruff` (pyflakes, pycodestyle, isort, bugbear,
  pyupgrade and bandit rules).
- **Tests:** `pytest` and `pytest-cov`; the rules editor's JavaScript runs
  under Node when it's installed.
- **Dependency vulnerabilities:** `pip-audit` in CI; Dependabot for `uv` and
  GitHub Actions.
- **Fuzzing:** Hypothesis, for the parser and decoder.
- **Pre-commit:** ruff, markdownlint, gitleaks, YAML/TOML checks, and a hook
  that blocks `.ged` files and review spreadsheets outside `sample_data/`.
- **CI:** GitHub Actions on Windows, macOS and Linux, Python 3.10 and 3.13,
  with a read-only token and actions pinned to commit SHAs.

Set up with `uv sync`, then `uv run pre-commit install`. Run
`uv run pytest` and `uv run ruff check .` before committing.

## Handling real family data

Real exports and review spreadsheets go in `private/` at the repo root, which
is gitignored, as are `*.ged` and `review*.xlsx` anywhere. The only GEDCOM in
git is the synthetic `sample_data/sample.ged`. The pre-commit hook and gitleaks
are a second line of defense, not the first.

## Roadmap

See [`ROADMAP.md`](../ROADMAP.md): one prioritized list covering release work
and features.
