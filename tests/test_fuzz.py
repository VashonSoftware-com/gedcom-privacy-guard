"""Property tests: hostile or broken files fail with a clear message,
never a traceback, and redaction always produces a file that parses."""

import os
import tempfile

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from gedcom_privacy_guard.encoding import decode_gedcom
from gedcom_privacy_guard.parser import GedcomError, parse_lines, read_gedcom, split_lines
from gedcom_privacy_guard.redactor import REDACTED_TEXT, apply_redactions
from gedcom_privacy_guard.report import build_rows
from gedcom_privacy_guard.rules import load_rules
from gedcom_privacy_guard.scanner import KeywordScanner

SCANNER = KeywordScanner(load_rules(preset="cautious"))
FUZZ = settings(max_examples=300, deadline=None, suppress_health_check=[HealthCheck.too_slow])

TAGS = ["INDI", "FAM", "NOTE", "CONT", "CONC", "NAME", "SOUR", "TEXT", "CAUS", "FILE", "_X", "SUBM"]

line = st.one_of(
    st.builds(
        lambda lvl, xref, tag, value: f"{lvl} {xref}{tag} {value}".rstrip(),
        st.integers(min_value=0, max_value=12),
        st.sampled_from(["", "@I1@ ", "@N1@ ", "@@ ", "@ "]),
        st.sampled_from(TAGS),
        st.text(max_size=300),
    ),
    st.text(max_size=80),  # garbage
)
gedcom_text = st.lists(line, max_size=60).map(lambda ls: "\n".join(["0 HEAD", *ls, "0 TRLR"]))


def _scan_all(ged):
    rows, _ = build_rows(ged, [SCANNER])
    return rows


@FUZZ
@given(st.binary(max_size=2000))
def test_any_bytes_decode_or_fail_cleanly(data):
    decoded = decode_gedcom(data)
    lines, _ = split_lines(decoded.text)
    try:
        _scan_all(parse_lines(lines))
    except GedcomError:
        pass


@FUZZ
@given(gedcom_text)
def test_structured_garbage_parses_and_scans(text):
    lines, _ = split_lines(text)
    ged = parse_lines(lines)
    for block in ged.text_blocks:
        assert 0 <= block.start_line <= block.end_line < len(lines)
    _scan_all(ged)


@FUZZ
@given(
    gedcom_text, st.sampled_from(["utf-8", "utf-16", "utf-8-sig"]), st.sampled_from(["\n", "\r\n"])
)
def test_redacting_everything_leaves_a_valid_file(text, encoding, newline):
    fd, path = tempfile.mkstemp(suffix=".ged")
    out = path + ".out"
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(text.replace("\n", newline).encode(encoding, errors="replace"))
        ged = read_gedcom(path)
        rows = [
            {"line": b.start_line + 1, "line_end": b.end_line + 1, "action": "redact"}
            for b in ged.text_blocks
        ]
        apply_redactions(path, rows, out)
        cleaned = read_gedcom(out)
        assert len(cleaned.text_blocks) == len(ged.text_blocks)
        assert all(b.text == REDACTED_TEXT for b in cleaned.text_blocks)
    finally:
        for p in (path, out):
            if os.path.exists(p):
                os.remove(p)


def test_huge_line_and_deep_conc_chain(tmp_path):
    lines = ["0 HEAD", "0 @I1@ INDI", "1 NOTE " + "x" * 1_000_000 + " prison. "]
    lines += ["2 CONC more text"] * 50_000 + ["0 TRLR"]
    path = tmp_path / "big.ged"
    path.write_text("\n".join(lines), encoding="utf-8")
    ged = read_gedcom(str(path))
    assert len(ged.text_blocks[0].cont_lines) == 50_000
    assert [r["matched_term"] for r in _scan_all(ged)] == ["prison"]


def test_bad_level_numbers_are_tolerated(tmp_path):
    path = tmp_path / "x.ged"
    path.write_text("0 HEAD\n0 @I1@ INDI\n3 NOTE jumped a level: prison\nx NOTE no level\n0 TRLR\n")
    ged = read_gedcom(str(path))
    assert any("skipped a level" in w for w in ged.warnings)
    assert any("no level number" in w for w in ged.warnings)
    assert [r["matched_term"] for r in _scan_all(ged)] == ["prison"]
