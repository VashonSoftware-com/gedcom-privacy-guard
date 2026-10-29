# Contributing

Thanks for helping. Reports of missed words and false alarms are the
most useful contribution of all, and need no code.

## Never send real family data

Don't attach a GEDCOM file, a review spreadsheet or a screenshot of
either to an issue. Rewrite the note in your own words with names,
dates and places changed, keeping only the phrase that matters.

## Reporting a miss or a false alarm

Open an issue with the **Missed something** or **False alarm**
template. Give the phrase, the program that made the file, and (for a
miss) which category it belongs in.

## Setting up

You need [uv](https://docs.astral.sh/uv/). Node.js is optional; without
it the rules editor tests are skipped.

```powershell
uv sync
uv run pre-commit install
```

Before each commit:

```powershell
uv run ruff check .
uv run ruff format .
uv run pytest
```

CI runs the same checks on Windows, macOS and Linux. The pre-commit
hooks block `.ged` files and review spreadsheets outside
`sample_data/`; keep real files in the gitignored `private/` folder.

## Adding or changing a built-in rule

1. Edit [`gedcom_privacy_guard/rules.yaml`](gedcom_privacy_guard/rules.yaml).
   Prefer a whole word or a prefix (`term*`) to `*substring*`, and add
   an exception for each harmless phrase you know of.
2. Regenerate the rules editor's copy:
   `uv run python scripts/build_editor_data.py`. A test fails if you
   forget.
3. Add a test in `tests/test_rules.py` or `tests/test_pipeline.py`
   showing one note that should match and one that shouldn't.
4. Add a line to `CHANGELOG.md` under *Unreleased*. A changed built-in
   rule changes every user's results.

The rules file format is described in [`docs/RULES.md`](docs/RULES.md)
and [ADR-009](docs/adr/009-rules-file-format.md); how the code fits
together is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Pull requests

Keep each one to a single change, with tests. Decisions with real
trade-offs get an ADR in `docs/adr/`. Security problems go through
[`SECURITY.md`](SECURITY.md), not a public issue.
