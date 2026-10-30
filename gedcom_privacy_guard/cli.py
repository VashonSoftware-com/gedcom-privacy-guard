"""
Command-line interface.

Usage:
    gedcom-privacy-guard scan   input.ged [--preset standard] [--rules my-rules.yaml] [--out review.xlsx]
    gedcom-privacy-guard redact input.ged --report review.xlsx [--out cleaned.ged]
    gedcom-privacy-guard rules  [--preset cautious] [--rules my-rules.yaml]
    gedcom-privacy-guard editor

Every expected failure (missing file, not a GEDCOM, a mistake in a rules
file or the reviewed spreadsheet) prints one plain message and exits
with status 1; no traceback.
"""

from __future__ import annotations

import argparse
import os
import sys
import webbrowser
import zipfile

from . import __version__
from .parser import GedcomError, read_gedcom
from .redactor import InvalidActionError, ReportMismatchError, apply_redactions
from .report import read_reviewed_report, write_report
from .rules import PRESETS, RulesError, load_rules
from .scanner import KeywordScanner

EDITOR_PAGE = os.path.join(os.path.dirname(__file__), "editor", "rules-editor.html")


class UserError(Exception):
    """A problem the user can fix; printed without a traceback."""


def _same_file(a: str, b: str) -> bool:
    if not (os.path.exists(a) and os.path.exists(b)):
        return os.path.normcase(os.path.realpath(a)) == os.path.normcase(os.path.realpath(b))
    return os.path.samefile(a, b)


def _refuse_overwrite(out: str, inputs: dict[str, str]) -> None:
    for label, path in inputs.items():
        if path and _same_file(out, path):
            raise UserError(f"--out {out} is your {label}. Choose a different output file.")


def cmd_scan(args):
    _refuse_overwrite(args.out, {"GEDCOM file": args.gedcom})
    if os.path.exists(args.out) and not args.force:
        raise UserError(
            f"{args.out} already exists and may hold your review decisions. "
            "Use a different --out, or add --force to replace it."
        )
    rules = load_rules(args.rules, args.preset)
    ged = read_gedcom(args.gedcom)
    scanners = [KeywordScanner(rules)]
    count = write_report(args.out, ged, scanners, gedcom_path=args.gedcom)
    print(f"Scanned {len(ged.individuals)} people and {len(ged.text_blocks)} text fields.")
    print(
        f"Preset: {rules.preset}" + (f", with your changes from {args.rules}" if args.rules else "")
    )
    print(f"Found {count} potential flags -> {args.out}")
    for warning in ged.warnings:
        print(f"Warning: {warning}")
    print(
        "Open that spreadsheet, fill in the 'action' column (keep / redact / "
        "rewrite:<text> / mask / privatize), then run the 'redact' command."
    )


def cmd_redact(args):
    _refuse_overwrite(args.out, {"GEDCOM file": args.gedcom, "review spreadsheet": args.report})
    try:
        reviewed_rows = read_reviewed_report(args.report)
    except (zipfile.BadZipFile, KeyError, ValueError) as e:
        raise UserError(f"Can't read {args.report} as an Excel review spreadsheet ({e}).") from None
    try:
        stats = apply_redactions(args.gedcom, reviewed_rows, args.out)
    except (InvalidActionError, ReportMismatchError) as e:
        raise UserError(
            f"Error in {args.report}: {e}\nFix it and re-run -- no output file was written."
        ) from None
    print(f"Wrote cleaned file -> {args.out}")
    print(f"  redacted: {stats['redacted']}")
    print(f"  rewritten: {stats['rewritten']}")
    print(f"  words removed: {stats['masked']}")
    print(f"  privatized: {stats['privatized']}")
    print(f"  kept as-is: {stats['kept']}")
    print("Original .ged was not modified.")
    if stats["privatized"]:
        print()
        print("NOTE: privatized text is wrapped in [[ ]] -- Legacy's own marker")
        print("for 'exclude from exports/reports', not something Ancestry/")
        print("FamilySearch/etc. understand. This file is NOT safe to upload")
        print("directly wherever it contains privatized text -- bring it back")
        print("into Legacy first (see docs/legacy.md), then export from Legacy")
        print("as usual.")


def cmd_rules(args):
    rules = load_rules(args.rules, args.preset)
    source = f" + your changes in {args.rules}" if args.rules else ""
    print(f"Preset: {rules.preset}{source}")
    for cat in rules.categories:
        state = "on " if cat.enabled else "off"
        print(f"  [{state}] {cat.name} ({cat.severity})")
        if args.verbose and cat.enabled:
            if cat.terms:
                print("        terms: " + ", ".join(str(t) for t in cat.terms))
            if cat.patterns:
                print(f"        patterns: {len(cat.patterns)}")
            if cat.exceptions:
                print("        exceptions: " + ", ".join(cat.exceptions))
    if rules.exceptions:
        print("Exceptions for every category: " + ", ".join(rules.exceptions))
    print("Rules are valid.")


def cmd_editor(args):
    if not os.path.exists(EDITOR_PAGE):
        raise UserError(f"The rules editor page is missing from this install ({EDITOR_PAGE}).")
    print(f"Rules editor: {EDITOR_PAGE}")
    print("It runs in your browser with no network access; nothing leaves your computer.")
    if not args.no_browser:
        webbrowser.open(f"file:///{EDITOR_PAGE.replace(os.sep, '/').lstrip('/')}")


def _add_rule_options(p):
    p.add_argument(
        "--preset",
        choices=PRESETS,
        help="Built-in rule set: open, standard (default) or cautious. "
        "Overrides 'extends' in your rules file.",
    )
    p.add_argument("--rules", help="Your rules file: changes on top of the preset")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="gedcom-privacy-guard",
        description="Flag sensitive text in a GEDCOM export for your review, "
        "then write a cleaned copy. Your original file is never changed.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    p_scan = sub.add_parser("scan", help="Scan a GEDCOM file and produce a review spreadsheet")
    p_scan.add_argument("gedcom", help="Path to input .ged file")
    _add_rule_options(p_scan)
    p_scan.add_argument("--out", default="review.xlsx", help="Path to output .xlsx")
    p_scan.add_argument("--force", action="store_true", help="Replace --out if it exists")
    p_scan.set_defaults(func=cmd_scan)

    p_redact = sub.add_parser(
        "redact", help="Apply a reviewed spreadsheet to produce a cleaned GEDCOM"
    )
    p_redact.add_argument("gedcom", help="Path to original input .ged file")
    p_redact.add_argument("--report", required=True, help="Path to your reviewed .xlsx")
    p_redact.add_argument("--out", default="cleaned.ged", help="Path to cleaned output .ged")
    p_redact.set_defaults(func=cmd_redact)

    p_rules = sub.add_parser("rules", help="Check a rules file and list what will be flagged")
    _add_rule_options(p_rules)
    p_rules.add_argument("-v", "--verbose", action="store_true", help="List every term")
    p_rules.set_defaults(func=cmd_rules)

    p_editor = sub.add_parser("editor", help="Open the rules editor in your browser")
    p_editor.add_argument("--no-browser", action="store_true", help="Only print its location")
    p_editor.set_defaults(func=cmd_editor)
    return parser


def main(argv: list[str] | None = None) -> int:
    # A Windows console can't show every character a GEDCOM may hold;
    # print a "?" rather than crash.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    args = build_parser().parse_args(argv)
    try:
        args.func(args)
    except (UserError, GedcomError, RulesError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except FileNotFoundError as e:
        print(f"Error: file not found: {e.filename}", file=sys.stderr)
        return 1
    except PermissionError as e:
        print(
            f"Error: can't open {e.filename}. If it's open in Excel or another program, "
            "close it and try again.",
            file=sys.stderr,
        )
        return 1
    except OSError as e:
        print(f"Error: {e.filename or ''}: {e.strerror}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
