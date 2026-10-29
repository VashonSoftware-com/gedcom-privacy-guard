"""
Decode a GEDCOM file's bytes to text.

Genealogy programs have written GEDCOM in four encodings over the
years: UTF-8 (with or without a byte-order mark), UTF-16 (Unicode),
ANSEL (the GEDCOM 5.5 default, still used by older Legacy and Family
Tree Maker exports) and Windows "ANSI" (cp1252). The file says which
in its header (``1 CHAR ...``), but not always truthfully, so:

1. A byte-order mark wins.
2. Otherwise the declared ``CHAR`` decides, and a file declared UTF-8
   or ASCII that isn't valid UTF-8 falls back to cp1252 with a warning.
3. No declaration: try UTF-8, then cp1252.

Nothing is silently dropped: undecodable bytes become U+FFFD and are
reported as a warning.
"""

from __future__ import annotations

import codecs
import re
import unicodedata
from dataclasses import dataclass, field

# ANSEL (ANSI Z39.47) spacing characters, plus GEDCOM's additions
# (0xBE/0xBF boxes, 0xCD/0xCE midline e/o, 0xCF eszett).
_ANSEL_SPACING = {
    0xA1: "Ł",  # Ł
    0xA2: "Ø",  # Ø
    0xA3: "Đ",  # Đ
    0xA4: "Þ",  # Þ
    0xA5: "Æ",  # Æ
    0xA6: "Œ",  # Œ
    0xA7: "ʹ",  # ʹ
    0xA8: "·",  # ·
    0xA9: "♭",  # ♭
    0xAA: "®",  # ®
    0xAB: "±",  # ±
    0xAC: "Ơ",  # Ơ
    0xAD: "Ư",  # Ư
    0xAE: "ʼ",  # ʼ
    0xB0: "ʻ",  # ʻ
    0xB1: "ł",  # ł
    0xB2: "ø",  # ø
    0xB3: "đ",  # đ
    0xB4: "þ",  # þ
    0xB5: "æ",  # æ
    0xB6: "œ",  # œ
    0xB7: "ʺ",  # ʺ
    0xB8: "ı",  # ı
    0xB9: "£",  # £
    0xBA: "ð",  # ð
    0xBC: "ơ",  # ơ
    0xBD: "ư",  # ư
    0xBE: "□",  # □
    0xBF: "■",  # ■
    0xC0: "°",  # °
    0xC1: "ℓ",  # ℓ
    0xC2: "℗",  # ℗
    0xC3: "©",  # ©
    0xC4: "♯",  # ♯
    0xC5: "¿",  # ¿
    0xC6: "¡",  # ¡
    0xC7: "ß",  # ß (MARC position)
    0xC8: "€",  # €
    0xCD: "e",  # midline e
    0xCE: "o",  # midline o
    0xCF: "ß",  # ß (GEDCOM position)
}

# ANSEL combining marks. In ANSEL they come *before* the letter they
# modify; in Unicode they come after.
_ANSEL_COMBINING = {
    0xE0: "̉",  # hook above
    0xE1: "̀",  # grave
    0xE2: "́",  # acute
    0xE3: "̂",  # circumflex
    0xE4: "̃",  # tilde
    0xE5: "̄",  # macron
    0xE6: "̆",  # breve
    0xE7: "̇",  # dot above
    0xE8: "̈",  # diaeresis
    0xE9: "̌",  # caron
    0xEA: "̊",  # ring above
    0xEB: "︠",  # ligature, left half
    0xEC: "︡",  # ligature, right half
    0xED: "̕",  # comma above right
    0xEE: "̋",  # double acute
    0xEF: "̐",  # candrabindu
    0xF0: "̧",  # cedilla
    0xF1: "̨",  # ogonek
    0xF2: "̣",  # dot below
    0xF3: "̤",  # double dot below
    0xF4: "̥",  # ring below
    0xF5: "̳",  # double underline
    0xF6: "̲",  # underline
    0xF7: "̦",  # comma below
    0xF8: "̜",  # right cedilla
    0xF9: "̮",  # breve below
    0xFA: "︢",  # double tilde, left half
    0xFB: "︣",  # double tilde, right half
    0xFE: "̓",  # comma above
}

_CHAR_RE = re.compile(rb"^[ \t]*1[ \t]+CHAR[ \t]+([^\r\n]+)", re.MULTILINE)

_UTF8_NAMES = {"UTF-8", "UTF8", "UNICODE-UTF8"}
_UTF16_NAMES = {"UNICODE", "UTF-16", "UTF16"}
_ANSI_NAMES = {"ANSI", "WINDOWS-1252", "CP1252", "WINDOWS", "IBMPC", "IBM WINDOWS", "LATIN1"}


@dataclass
class Decoded:
    text: str
    encoding: str  # what we actually decoded with, e.g. "UTF-8", "ANSEL"
    declared: str  # the file's own CHAR value, "" if none
    bom: bool = False
    warnings: list[str] = field(default_factory=list)


def decode_ansel(data: bytes) -> str:
    """Decode ANSEL bytes, moving each combining mark after its base
    letter and composing the result (NFC)."""
    out: list[str] = []
    pending: list[str] = []
    for b in data:
        if b < 0x80:
            out.append(chr(b))
            if pending:
                out.extend(pending)
                pending = []
        elif b in _ANSEL_COMBINING:
            pending.append(_ANSEL_COMBINING[b])
        else:
            out.append(_ANSEL_SPACING.get(b, "�"))
            if pending:
                out.extend(pending)
                pending = []
    out.extend(pending)  # dangling marks at end of input; keep, don't drop
    return unicodedata.normalize("NFC", "".join(out))


def _declared_charset(data: bytes) -> str:
    match = _CHAR_RE.search(data[:8192])
    return match.group(1).strip().decode("ascii", errors="replace").upper() if match else ""


def _looks_utf16(data: bytes) -> str | None:
    """A GEDCOM starts with '0 HEAD'; in UTF-16 without a BOM that's
    '0' next to a zero byte."""
    if data[:2] == b"0\x00":
        return "utf-16-le"
    if data[:2] == b"\x000":
        return "utf-16-be"
    return None


def decode_gedcom(data: bytes) -> Decoded:
    warnings: list[str] = []

    if data.startswith(codecs.BOM_UTF8):
        text = data[len(codecs.BOM_UTF8) :].decode("utf-8", errors="replace")
        return _finish(Decoded(text, "UTF-8", _declared_charset(data), bom=True), warnings)
    for bom, codec in ((codecs.BOM_UTF16_LE, "utf-16-le"), (codecs.BOM_UTF16_BE, "utf-16-be")):
        if data.startswith(bom):
            text = data[len(bom) :].decode(codec, errors="replace")
            return _finish(Decoded(text, "UTF-16", _char_from_text(text), bom=True), warnings)
    utf16 = _looks_utf16(data)
    if utf16:
        text = data.decode(utf16, errors="replace")
        return _finish(Decoded(text, "UTF-16", _char_from_text(text)), warnings)

    declared = _declared_charset(data)
    if declared == "ANSEL":
        return _finish(Decoded(decode_ansel(data), "ANSEL", declared), warnings)
    if declared in _ANSI_NAMES:
        return _finish(
            Decoded(data.decode("cp1252", errors="replace"), "cp1252", declared), warnings
        )

    try:
        return _finish(Decoded(data.decode("utf-8"), "UTF-8", declared), warnings)
    except UnicodeDecodeError as e:
        if declared in _UTF8_NAMES or declared == "ASCII":
            warnings.append(
                f"The file says it is {declared}, but byte {e.start} isn't valid {declared}; "
                "read it as Windows ANSI (cp1252) instead. Check accented names in the report."
            )
        elif declared and declared not in _UTF16_NAMES:
            warnings.append(
                f"Unknown character set {declared!r}; read it as Windows ANSI (cp1252)."
            )
        return _finish(
            Decoded(data.decode("cp1252", errors="replace"), "cp1252", declared), warnings
        )


def _char_from_text(text: str) -> str:
    match = re.search(r"^[ \t]*1[ \t]+CHAR[ \t]+(\S+)", text[:8192], re.MULTILINE)
    return match.group(1).upper() if match else ""


def _finish(decoded: Decoded, warnings: list[str]) -> Decoded:
    bad = decoded.text.count("�")
    if bad:
        warnings.append(
            f"{bad} character(s) couldn't be decoded ({decoded.encoding}) and show as �."
        )
    decoded.warnings = warnings
    return decoded
