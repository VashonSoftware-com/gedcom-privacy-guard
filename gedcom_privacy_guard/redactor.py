"""
Applies actions from a reviewed spreadsheet to produce a cleaned GEDCOM.

The input .ged file is never modified. This writes a new file.

Action values (in the spreadsheet's "action" column):
    keep              - do nothing (default if left blank)
    redact            - replace the whole text with "[REDACTED]"
    rewrite:<text>    - replace the whole text with <text>
    mask              - replace just the matched phrase(s) with "[removed]",
                         leaving the rest of the text untouched
    privatize         - wrap just the matched phrase(s) in "[[ ]]",
                         leaving the rest of the text untouched

If a text field has multiple findings with different actions, "redact"
wins over "rewrite" wins over "mask" wins over "privatize" wins over
"keep" -- i.e. we err
toward removing more, never less, since silently under-redacting is
the worse failure mode. Multiple findings set to "mask" or "privatize"
on the same text each get their own matched phrase changed.

Before changing anything, every row is checked against the GEDCOM: its
line numbers must point at the same text field the scan found there.
A report from a different or since-edited file stops the run with no
output, rather than overwriting the wrong lines.

The output is UTF-8 (the HEAD's CHAR line is updated to match), keeps
the input's line endings, and re-wraps changed text into CONT/CONC lines
short enough for any program to import.

IMPORTANT about "privatize": "[[ ]]" is Legacy's own native marker
(see ADR-002, docs/legacy.md) for "exclude this from exports/reports"
-- but that convention is honored by *Legacy*, not by Ancestry/
FamilySearch/etc. A privatized note still shows the phrase in plain
text (plus literal brackets) to anyone who doesn't run it through
Legacy first. Do NOT treat a privatize-only output as safe to upload
directly -- bring it back into Legacy (see docs/legacy.md for a guided
reimport path) so Legacy's own export logic actually excludes the
marked text, then export from Legacy as usual. `redact`/`rewrite`
and `mask` are the actions that make a `--out` file itself safe for
direct upload.
"""

from __future__ import annotations

import re

from .parser import Gedcom, TextBlock, read_gedcom

_PRIORITY = {"redact": 0, "rewrite": 1, "mask": 2, "privatize": 3, "keep": 4, "": 4}

REDACTED_TEXT = "[REDACTED BY GEDCOM PRIVACY GUARD]"
MASKED_TEXT = "[removed]"

# GEDCOM 5.5.1 caps a line at 255 characters; stay well under it.
MAX_VALUE_CHARS = 200


class InvalidActionError(ValueError):
    """Raised when a reviewed spreadsheet contains an action value we don't recognize."""


class ReportMismatchError(ValueError):
    """Raised when a reviewed spreadsheet doesn't match the GEDCOM it's applied to."""


def _normalize_action(raw_action) -> str:
    action = str(raw_action or "").strip()
    if action.lower().startswith("rewrite:"):
        return "rewrite:" + action[len("rewrite:") :]
    return action.lower()


def _priority(action: str) -> int:
    if action.startswith("rewrite:"):
        return _PRIORITY["rewrite"]
    return _PRIORITY[action]


def _change_terms(text: str, terms: set[str], change, skip: str) -> str:
    """Pass every occurrence of each term, case-insensitively, through
    ``change``. Some rule keywords are word stems (e.g. "alcoholi" to
    catch alcoholism/alcoholic), so the match is expanded to full word
    boundaries -- changing "alcoholism" whole rather than leaving a stray
    "sm" behind. Text matching ``skip`` (an earlier change) is left alone."""
    for term in sorted(terms, key=len, reverse=True):
        body = r"\s+".join(re.escape(word) for word in term.split())
        pattern = re.compile(skip + r"|[A-Za-z]*" + body + r"[A-Za-z]*", re.IGNORECASE | re.DOTALL)
        text = pattern.sub(
            lambda m: (
                m.group(0) if re.fullmatch(skip, m.group(0), re.DOTALL) else change(m.group(0))
            ),
            text,
        )
    return text


def _privatize_text(text: str, terms: set[str]) -> str:
    """Wrap every matched phrase in Legacy's [[ ]] private markers."""
    return _change_terms(text, terms, lambda s: f"[[{s}]]", r"\[\[.*?\]\]")


def _mask_text(text: str, terms: set[str]) -> str:
    """Replace every matched phrase with [removed]."""
    return _change_terms(text, terms, lambda s: MASKED_TEXT, re.escape(MASKED_TEXT))


def _split_value(value: str, limit: int = MAX_VALUE_CHARS) -> list[str]:
    """Split one line of text into CONC-sized chunks. Never split next to
    a space: some programs trim spaces at the ends of CONC lines."""
    chunks = []
    while len(value) > limit:
        cut = limit
        while cut > limit // 2 and (value[cut - 1] == " " or value[cut] == " "):
            cut -= 1
        if value[cut - 1] == " " or value[cut] == " ":
            cut = limit  # a long run of spaces; nothing better to do
        chunks.append(value[:cut])
        value = value[cut:]
    chunks.append(value)
    return chunks


def encode_text(block: TextBlock, text: str) -> list[str]:
    """GEDCOM lines for ``text`` in the place of ``block``: the same
    level, xref and tag, with CONT for line breaks and CONC for long lines."""
    head = f"{block.level} " + (f"{block.xref} " if block.xref else "") + block.tag
    child = block.level + 1
    out: list[str] = []
    for i, line in enumerate(text.replace("\r\n", "\n").replace("\r", "\n").split("\n")):
        for j, chunk in enumerate(_split_value(line)):
            if i == 0 and j == 0:
                out.append(f"{head} {chunk}" if chunk else head)
            else:
                tag = "CONC" if j else "CONT"
                out.append(f"{child} {tag} {chunk}" if chunk else f"{child} {tag}")
    return out


def _row_key(row: dict) -> tuple[int, int]:
    try:
        return int(row["line"]), int(row["line_end"])
    except (KeyError, TypeError, ValueError):
        raise ReportMismatchError(
            "This spreadsheet has no line numbers. Use the review.xlsx that the 'scan' "
            "command wrote, and don't delete its 'line' and 'line_end' columns."
        ) from None


def plan_redactions(ged: Gedcom, reviewed_rows: list[dict]) -> tuple[dict, dict]:
    blocks = {b.start_line + 1: b for b in ged.text_blocks}

    # Collapse to one chosen action per text field; separately collect
    # every distinct matched term flagged "mask" or "privatize" for that
    # field, since (unlike redact/rewrite) they don't replace the whole
    # text -- each flagged phrase within it is changed.
    chosen: dict[int, str] = {}
    phrase_terms: dict[int, set[str]] = {}
    for row in reviewed_rows:
        line, line_end = _row_key(row)
        action = _normalize_action(row.get("action"))
        who = row.get("name") or f"line {line}"
        if action not in _PRIORITY and not action.startswith("rewrite:"):
            raise InvalidActionError(
                f"Unrecognized action {row.get('action')!r} for {who} "
                f"(line {line}) -- expected 'keep', 'redact', "
                f"'rewrite:<text>', 'mask', or 'privatize'."
            )
        block = blocks.get(line)
        if block is None or block.end_line + 1 != line_end:
            raise ReportMismatchError(
                f"Row for {who} points at line {line}, but that isn't the same text in "
                "this GEDCOM. The spreadsheet must come from scanning this exact file; "
                "if the file was re-exported since, scan it again."
            )
        if action in ("mask", "privatize") and row.get("matched_term"):
            phrase_terms.setdefault(line, set()).add(str(row["matched_term"]))
        if line not in chosen or _priority(action) < _priority(chosen[line]):
            chosen[line] = action
    return chosen, phrase_terms


def apply_redactions(gedcom_path: str, reviewed_rows: list[dict], output_path: str) -> dict:
    ged = read_gedcom(gedcom_path)
    chosen, phrase_terms = plan_redactions(ged, reviewed_rows)
    blocks = {b.start_line + 1: b for b in ged.text_blocks}

    stats = {"redacted": 0, "rewritten": 0, "masked": 0, "privatized": 0, "kept": 0}
    drop: set[int] = set()
    replacements: dict[int, list[str]] = {}

    for line, action in chosen.items():
        block = blocks[line]
        if action == "redact":
            new_text = REDACTED_TEXT
            stats["redacted"] += 1
        elif action.startswith("rewrite:"):
            new_text = action.split(":", 1)[1].strip()
            stats["rewritten"] += 1
        elif action == "mask":
            new_text = _mask_text(block.text, phrase_terms.get(line, set()))
            stats["masked"] += 1
        elif action == "privatize":
            new_text = _privatize_text(block.text, phrase_terms.get(line, set()))
            stats["privatized"] += 1
        else:
            stats["kept"] += 1
            continue
        replacements[block.start_line] = encode_text(block, new_text)
        drop.update(block.cont_lines)

    if ged.encoding != "UTF-8" and ged.char_line is not None:
        old = ged.lines[ged.char_line]
        replacements[ged.char_line] = [re.sub(r"CHAR\s+.*$", "CHAR UTF-8", old)]

    output_lines: list[str] = []
    for i, line in enumerate(ged.lines):
        if i in replacements:
            output_lines.extend(replacements[i])
        elif i not in drop:  # drop CONT/CONC lines belonging to changed text
            output_lines.append(line)

    with open(output_path, "w", encoding="utf-8-sig" if ged.bom else "utf-8", newline="") as f:
        f.write(ged.newline.join(output_lines) + ged.newline)

    return stats
