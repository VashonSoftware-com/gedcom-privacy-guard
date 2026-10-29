"""
GEDCOM parser.

Not a full spec implementation. It does three things:

1. Finds every place free text can hide (see ``TEXT_TAGS`` and
   ``_location``): notes at any level, shared ``NOTE`` records, cause of
   death, source text and citation detail, media file paths, the
   submitter's contact details and user-defined ``_TAG``s. Each becomes
   a ``TextBlock`` with the exact source lines it occupies, so the
   redactor can make surgical edits later.
2. Collects enough about each person (name, vitals, parents, spouses,
   cross-reference IDs) to tell same-named relatives apart in the report.
3. Fails with a ``GedcomError`` and a plain message, never a traceback,
   when the input isn't a GEDCOM file.

Names, dates and places are passed through exactly as the source
program wrote them; this module never reformats them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import cached_property

from .encoding import decode_gedcom


class GedcomError(ValueError):
    """The input can't be read as a GEDCOM file."""


@dataclass
class TextBlock:
    """One text field plus the exact source lines it occupies."""

    text: str
    start_line: int  # index into Gedcom.lines (0-based)
    cont_lines: list[int]  # CONT/CONC (and stray) lines that belong to it
    level: int
    tag: str
    xref: str  # set only on level-0 records, e.g. a shared "0 @N1@ NOTE"
    record_xref: str  # the level-0 record this sits in
    record_type: str  # INDI, FAM, NOTE, SOUR, SUBM, OBJE, REPO, HEAD, ...
    path: tuple[str, ...]  # tags below the record, e.g. ("DEAT", "CAUS")
    location: str  # note, cause, source_text, citation, media_file, ...

    @property
    def end_line(self) -> int:
        return max([self.start_line, *self.cont_lines])


# Kept for callers that think in terms of notes.
NoteBlock = TextBlock


@dataclass
class Individual:
    xref: str  # e.g. "@I1@"
    name: str = "(unknown)"
    sex: str = ""
    notes: list[TextBlock] = field(default_factory=list)  # person-level NOTEs only

    birth_date: str = ""
    birth_place: str = ""
    death_date: str = ""
    death_place: str = ""

    # Cross-reference identifiers, kept blank if not present in this
    # person's record -- never guessed or inferred.
    fsftid: str = ""  # FamilySearch Family Tree ID (_FSFTID)
    findagrave: str = ""  # Find A Grave memorial number (_FGRAVE)
    billiongraves: str = ""  # BillionGraves record number (_BGRAVE)
    afn: str = ""  # Ancestral File Number (standard AFN tag)
    refn: str = ""  # User reference number (standard REFN tag)

    famc: str = ""  # family xref this person is a child in
    fams: list[str] = field(default_factory=list)  # families as a spouse

    # Filled in after all records are parsed (needs FAM lookups)
    parent_names: list[str] = field(default_factory=list)
    spouse_names: list[str] = field(default_factory=list)


@dataclass
class Family:
    xref: str
    husb: str = ""
    wife: str = ""
    children: list[str] = field(default_factory=list)


@dataclass
class Gedcom:
    lines: list[str]
    individuals: list[Individual]
    families: dict[str, Family]
    text_blocks: list[TextBlock]
    encoding: str  # what the file was decoded as
    bom: bool
    newline: str  # the file's own line ending
    char_line: int | None  # index of the HEAD "1 CHAR" line, if any
    note_refs: dict[str, list[str]]  # shared note xref -> records pointing at it
    record_names: dict[str, str]  # SOUR/REPO/OBJE/SUBM xref -> a readable title
    warnings: list[str]

    @cached_property
    def by_xref(self) -> dict[str, Individual]:
        return {p.xref: p for p in self.individuals}


# Tags whose value is free text, wherever they appear.
TEXT_TAGS = {"NOTE", "TEXT", "CAUS", "PAGE", "FILE"}

# Contact fields: always scanned (PII patterns), and flagged outright
# in the submitter record.
CONTACT_TAGS = {"ADDR", "ADR1", "ADR2", "ADR3", "CITY", "STAE", "POST", "CTRY"}
CONTACT_TAGS |= {"PHON", "EMAIL", "FAX", "WWW", "_EMAIL", "_PHON", "_WWW"}

# Custom tags holding identifiers or flags, not prose.
ID_TAGS = {"_FSFTID", "_FGRAVE", "_BGRAVE", "_UID", "_APID", "_UPD", "_PRIM", "_TYPE"}
ID_TAGS |= {"_DATE", "_SCBK", "_PHOTO_RIN", "_FILESIZE", "_CROP", "_TAG", "_LKID"}
ID_TAGS |= {"_PREF", "_FSLINK", "_RESOLVED", "_PRIV", "_MSTAT", "_STAT", "_GUID", "_RIN"}

_LINE_RE = re.compile(r"^\s*(\d{1,4})[ \t]+(?:(@[^@\s]+@)[ \t]+)?([^\s@][^ \t]*)(?:[ \t](.*))?$")
_POINTER_RE = re.compile(r"^@[^@\s]+@$")


def _location(record_type: str, path: tuple[str, ...], tag: str) -> str:
    if record_type == "SUBM" and (tag in CONTACT_TAGS or tag == "NAME"):
        return "submitter"
    if tag == "NOTE":
        return "note"
    if tag == "CAUS":
        return "cause"
    if tag == "TEXT":
        return "source_text"
    if tag == "PAGE":
        return "citation"
    if tag == "FILE":
        return "media_file"
    if tag in CONTACT_TAGS:
        return "address"
    return "custom_tag"


def _is_text_field(record_type: str, tag: str, value: str, level: int) -> bool:
    if record_type == "HEAD" and tag != "NOTE":
        return False  # software name, vendor address, file name: not family data
    if level == 0:
        return tag == "NOTE"  # shared note record; its text may be on the 0 line
    if _POINTER_RE.match(value.strip()):
        return False
    if tag in TEXT_TAGS or tag in CONTACT_TAGS:
        return True
    if record_type == "SUBM" and tag == "NAME":
        return True
    # A one-character custom value is a flag (Y/N), not text.
    return tag.startswith("_") and tag not in ID_TAGS and len(value.strip()) > 1


def split_lines(text: str) -> tuple[list[str], str]:
    """Split on CRLF, LF or CR (not on the other characters str.splitlines
    treats as breaks, which can appear inside GEDCOM values). Returns the
    lines and the dominant line ending."""
    crlf = text.count("\r\n")
    lf = text.count("\n") - crlf
    cr = text.count("\r") - crlf
    newline = max((crlf, "\r\n"), (lf, "\n"), (cr, "\r"))[1]
    lines = re.split(r"\r\n|\r|\n", text)
    if lines and lines[-1] == "":
        lines.pop()
    return lines, newline


def read_gedcom(path: str) -> Gedcom:
    """Read and parse a GEDCOM file. Raises GedcomError for anything that
    isn't one, and OSError if the file can't be opened."""
    with open(path, "rb") as f:
        data = f.read()
    if not data.strip():
        raise GedcomError(f"{path} is empty.")
    decoded = decode_gedcom(data)
    lines, newline = split_lines(decoded.text)
    ged = parse_lines(lines)
    ged.encoding = decoded.encoding
    ged.bom = decoded.bom
    ged.newline = newline
    if decoded.warnings and "�" in decoded.text:
        first = next(n for n, ln in enumerate(lines, 1) if "�" in ln)
        decoded.warnings[-1] += f" The first is on line {first}."
    ged.warnings = decoded.warnings + ged.warnings
    return ged


def parse_gedcom(path: str) -> Gedcom:
    return read_gedcom(path)


def parse_lines(lines: list[str]) -> Gedcom:
    individuals: list[Individual] = []
    families: dict[str, Family] = {}
    by_xref: dict[str, Individual] = {}
    text_blocks: list[TextBlock] = []
    note_refs: dict[str, list[str]] = {}
    record_names: dict[str, str] = {}
    warnings: list[str] = []
    char_line: int | None = None

    first = next((ln for ln in lines if ln.strip()), "")
    if not re.match(r"^\s*0[ \t]+HEAD\b", first):
        raise GedcomError(
            "This doesn't look like a GEDCOM file: it should start with '0 HEAD'. "
            "Export a GEDCOM (.ged) file from your genealogy program and scan that."
        )

    # stack[i] = (level, tag, line index); stack[0] is the level-0 record
    stack: list[tuple[int, str, int]] = []
    record_type = ""
    record_xref = ""
    person: Individual | None = None
    fam: Family | None = None
    blocks_by_line: dict[int, TextBlock] = {}
    last_block: TextBlock | None = None  # receives stray, level-less lines
    extra: dict[int, list[str]] = {}  # continuation text, joined once at the end
    stray: list[int] = []
    bad_levels: list[int] = []

    for i, line in enumerate(lines):
        if not line.strip():
            continue
        m = _LINE_RE.match(line)
        if not m:
            # A line with no level number: usually a note whose line break
            # the exporting program failed to encode. Keep it with the
            # text above it so it's scanned and removed with it.
            stray.append(i + 1)
            if last_block is not None:
                last_block.text += "\n" + line
                last_block.cont_lines.append(i)
            continue
        level = int(m.group(1))
        xref = m.group(2) or ""
        tag = m.group(3).upper()
        value = m.group(4) or ""

        if level == 0:
            stack = [(0, tag, i)]
            record_type, record_xref = tag, xref
            person = fam = None
            last_block = None
            if tag == "INDI" and xref:
                person = Individual(xref=xref)
                individuals.append(person)
                by_xref[xref] = person
            elif tag == "FAM" and xref:
                fam = Family(xref=xref)
                families[xref] = fam
            if tag == "NOTE" and xref:
                block = TextBlock(value, i, [], 0, "NOTE", xref, xref, "NOTE", (), "note")
                text_blocks.append(block)
                blocks_by_line[i] = block
                last_block = block
            continue

        if not stack:
            continue  # lines before HEAD; can't happen after the check above
        while len(stack) > 1 and stack[-1][0] >= level:
            stack.pop()
        if level > stack[-1][0] + 1:
            bad_levels.append(i + 1)  # skipped a level; treat as a child of the line above
        parent_level, parent_tag, parent_line = stack[-1]

        if tag in ("CONT", "CONC"):
            block = blocks_by_line.get(parent_line)
            if block is not None:
                block.text += ("\n" if tag == "CONT" else "") + value
                block.cont_lines.append(i)
                last_block = block
            continue  # never pushed: CONT/CONC have no children

        path = tuple(t for _, t, _ in stack[1:]) + (tag,)
        stack.append((level, tag, i))
        last_block = None

        if record_type == "HEAD" and path == ("CHAR",):
            char_line = i

        if tag == "NOTE" and _POINTER_RE.match(value.strip()):
            note_refs.setdefault(value.strip(), []).append(record_xref)

        if record_xref and record_type in ("SOUR", "REPO", "OBJE", "SUBM"):
            if path in (("TITL",), ("NAME",)) and record_xref not in record_names:
                record_names[record_xref] = value.strip()

        if _is_text_field(record_type, tag, value, level):
            block = TextBlock(
                text=value,
                start_line=i,
                cont_lines=[],
                level=level,
                tag=tag,
                xref="",
                record_xref=record_xref,
                record_type=record_type,
                path=path,
                location=_location(record_type, path, tag),
            )
            text_blocks.append(block)
            blocks_by_line[i] = block
            last_block = block
            if person is not None and path == ("NOTE",):
                person.notes.append(block)

        if person is not None:
            _person_field(person, path, value)
        elif fam is not None and len(path) == 1:
            if tag == "HUSB":
                fam.husb = value.strip()
            elif tag == "WIFE":
                fam.wife = value.strip()
            elif tag == "CHIL":
                fam.children.append(value.strip())

    if stray:
        warnings.append(
            f"{len(stray)} line(s) had no level number, the first on line {stray[0]}; "
            "they were kept with the text above them."
        )
    if bad_levels:
        warnings.append(
            f"{len(bad_levels)} line(s) skipped a level number, the first on line "
            f"{bad_levels[0]}; read as best we could."
        )

    for p in individuals:
        if p.famc and p.famc in families:
            f = families[p.famc]
            for parent_xref in (f.husb, f.wife):
                if parent_xref in by_xref:
                    p.parent_names.append(by_xref[parent_xref].name)
        for fams_xref in p.fams:
            f = families.get(fams_xref)
            if not f:
                continue
            spouse_xref = f.wife if f.husb == p.xref else f.husb
            if spouse_xref in by_xref:
                p.spouse_names.append(by_xref[spouse_xref].name)

    for block in text_blocks:
        if id(block) in extra:
            block.text += "".join(extra[id(block)])

    return Gedcom(
        lines=lines,
        individuals=individuals,
        families=families,
        text_blocks=text_blocks,
        encoding="UTF-8",
        bom=False,
        newline="\n",
        char_line=char_line,
        note_refs=note_refs,
        record_names=record_names,
        warnings=warnings,
    )


_PERSON_IDS = {
    ("AFN",): "afn",
    ("REFN",): "refn",
    ("_FSFTID",): "fsftid",
    ("_FGRAVE",): "findagrave",
    ("_BGRAVE",): "billiongraves",
}
_VITALS = {
    ("BIRT", "DATE"): "birth_date",
    ("BIRT", "PLAC"): "birth_place",
    ("DEAT", "DATE"): "death_date",
    ("DEAT", "PLAC"): "death_place",
}


def _person_field(person: Individual, path: tuple[str, ...], value: str) -> None:
    """Record the first value seen for each field (a person can have
    several NAME or BIRT entries; the first is the preferred one)."""
    value = value.strip()
    if path == ("NAME",):
        if person.name == "(unknown)" and value:
            person.name = " ".join(value.replace("/", " ").split())
    elif path == ("SEX",):
        person.sex = person.sex or value
    elif path == ("FAMC",):
        person.famc = person.famc or value
    elif path == ("FAMS",):
        person.fams.append(value)
    elif path in _PERSON_IDS:
        attr = _PERSON_IDS[path]
        if not getattr(person, attr):
            setattr(person, attr, value)
    elif path in _VITALS:
        attr = _VITALS[path]
        if not getattr(person, attr):
            setattr(person, attr, value)
