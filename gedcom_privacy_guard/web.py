"""Entry points for the browser app (ADR-010).

The web page runs this package in the browser with Pyodide. It writes the
user's GEDCOM into Pyodide's in-memory file system, calls these functions,
and reads the output files back. Results cross into JavaScript as JSON, so
nothing here depends on Pyodide and it's tested like any other module.
"""

from __future__ import annotations

import json
import re
from collections import Counter

from .parser import Gedcom, read_gedcom
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
            "facts": file_facts(ged),
        }
    )


_LEVEL_TAG = re.compile(r"^\s*(\d{1,2})[ \t]+(?:@[^@\s]+@[ \t]+)?(\S+)(?:[ \t](.*))?$")
# A custom tag, as programs name them. Anything else (a typo, a word from a
# broken line) is left out, since it could be the user's own text.
_CUSTOM_TAG = re.compile(r"^_[A-Z0-9_]{1,24}$", re.IGNORECASE)
_RECORDS = {"INDI", "FAM", "NOTE", "SOUR", "REPO", "OBJE", "SUBM", "SUBN"}
_NEWLINES = {"\r\n": "CRLF", "\n": "LF", "\r": "CR"}


def file_facts(ged: Gedcom) -> dict:
    """What a problem report may say about a file: the program that made
    it, its encoding and shape, and the custom tags it uses. Never names,
    notes, places, dates or file names, so a tester can paste it into a
    public issue (ROADMAP: "Copy a problem report")."""
    head: dict[str, str] = {}
    path: list[str] = []
    records: Counter = Counter()
    custom: Counter = Counter()
    in_head = False
    for line in ged.lines:
        m = _LEVEL_TAG.match(line)
        if not m:
            continue
        level, tag, value = int(m.group(1)), m.group(2).upper(), (m.group(3) or "").strip()
        if level == 0:
            in_head = tag == "HEAD"
            if not in_head and tag != "TRLR":
                records[tag if tag in _RECORDS else "other"] += 1
        del path[level:]
        path.append(tag)
        if in_head:
            # Only these HEAD fields; FILE, SUBM and the program's CORP
            # address can name the user.
            key = ".".join(path[1:])
            if key in ("SOUR", "SOUR.NAME", "SOUR.VERS", "GEDC.VERS", "GEDC.FORM", "CHAR", "LANG"):
                head[key] = value[:60]
        if _CUSTOM_TAG.match(tag):
            custom[tag] += 1
    return {
        "program": head.get("SOUR", ""),
        "program_name": head.get("SOUR.NAME", ""),
        "program_version": head.get("SOUR.VERS", ""),
        "gedcom_version": head.get("GEDC.VERS", ""),
        "declared_charset": head.get("CHAR", ""),
        "read_as": ged.encoding,
        "bom": ged.bom,
        "line_ending": _NEWLINES.get(ged.newline, repr(ged.newline)),
        "lines": len(ged.lines),
        "records": dict(records.most_common()),
        "custom_tags": dict(custom.most_common(20)),
        "custom_tag_kinds": len(custom),
    }


def redact_from_json(gedcom_path: str, rows_json: str, output_path: str) -> str:
    """Apply the actions chosen on the web page and return the counts as
    JSON. Rows are the ones scan_to_json returned, with 'action' filled in."""
    stats = apply_redactions(gedcom_path, json.loads(rows_json), output_path)
    return json.dumps(stats)
