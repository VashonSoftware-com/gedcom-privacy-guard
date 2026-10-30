"""Entry points for the browser app (ADR-010).

The web page runs this package in the browser with Pyodide. It writes the
user's GEDCOM into Pyodide's in-memory file system, calls these functions,
and reads the output files back. Results cross into JavaScript as JSON, so
nothing here depends on Pyodide and it's tested like any other module.
"""

from __future__ import annotations

import json

from .parser import read_gedcom
from .redactor import apply_redactions
from .report import build_rows, write_report
from .rules import load_rules
from .scanner import KeywordScanner


def scan_to_json(gedcom_path: str, report_path: str, progress=None) -> str:
    """Scan a GEDCOM, write review.xlsx to report_path, and return the
    flagged rows, the full text of each flagged field (keyed by its line)
    and a summary as JSON. ``progress(fraction, stage)``, if given, hears
    how far along it is, from 0 to 1."""

    def report(fraction: float, stage: str) -> None:
        if progress:
            progress(round(fraction, 3), stage)

    # Shares of the time each stage took on a 60,000-person test tree.
    report(0, "Reading your file")
    rules = load_rules()
    ged = read_gedcom(gedcom_path)
    scanners = [KeywordScanner(rules)]
    report(0.15, "Checking the notes")
    built = build_rows(ged, scanners, lambda f: report(0.15 + 0.82 * f, "Checking the notes"))
    rows = built[0]
    report(0.97, "Making the list")
    write_report(report_path, ged, scanners, gedcom_path=gedcom_path, built=built)
    report(1, "Done")
    flagged = {row["line"] for row in rows}
    texts = {b.start_line + 1: b.text for b in ged.text_blocks if b.start_line + 1 in flagged}
    return json.dumps(
        {
            "people": len(ged.individuals),
            "text_fields": len(ged.text_blocks),
            "preset": rules.preset,
            "warnings": ged.warnings,
            "rows": rows,
            "texts": texts,
        }
    )


def redact_from_json(gedcom_path: str, rows_json: str, output_path: str) -> str:
    """Apply the actions chosen on the web page and return the counts as
    JSON. Rows are the ones scan_to_json returned, with 'action' filled in."""
    stats = apply_redactions(gedcom_path, json.loads(rows_json), output_path)
    return json.dumps(stats)
