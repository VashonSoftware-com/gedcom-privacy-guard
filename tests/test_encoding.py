"""Every encoding and line ending genealogy programs write."""

import codecs

import pytest
from conftest import ged

from gedcom_privacy_guard.encoding import decode_ansel, decode_gedcom
from gedcom_privacy_guard.parser import read_gedcom
from gedcom_privacy_guard.redactor import apply_redactions

NAME = "José Müller-Łódź"  # José Müller-Łódź
GED = ged("0 @I1@ INDI", f"1 NAME {NAME}", "1 NOTE He had depression.").replace(
    "1 CHAR UTF-8", "1 CHAR {charset}"
)


@pytest.mark.parametrize(
    ("charset", "encoding", "bom", "expect"),
    [
        ("UTF-8", "utf-8", b"", "UTF-8"),
        ("UTF-8", "utf-8", codecs.BOM_UTF8, "UTF-8"),
        ("UNICODE", "utf-16-le", codecs.BOM_UTF16_LE, "UTF-16"),
        ("UNICODE", "utf-16-be", codecs.BOM_UTF16_BE, "UTF-16"),
        ("UNICODE", "utf-16-le", b"", "UTF-16"),  # no BOM
        ("UNICODE", "utf-16-be", b"", "UTF-16"),
    ],
)
@pytest.mark.parametrize("newline", ["\n", "\r\n", "\r"])
def test_reads_unicode_encodings_and_line_endings(
    write_ged, charset, encoding, bom, expect, newline
):
    text = GED.format(charset=charset).replace("\n", newline)
    ged_ = read_gedcom(write_ged(bom + text.encode(encoding)))
    assert ged_.encoding == expect
    assert ged_.newline == newline
    assert ged_.individuals[0].name == NAME
    assert ged_.individuals[0].notes[0].text == "He had depression."
    assert ged_.warnings == []


def test_reads_ansi(write_ged):
    path = write_ged(GED.format(charset="ANSI").replace(NAME, "José Müller"), "cp1252")
    ged_ = read_gedcom(path)
    assert ged_.encoding == "cp1252"
    assert ged_.individuals[0].name == "José Müller"


def test_mislabeled_utf8_falls_back_to_ansi_with_warning(write_ged):
    path = write_ged(GED.format(charset="UTF-8").replace(NAME, "José"), "cp1252")
    ged_ = read_gedcom(path)
    assert ged_.individuals[0].name == "José"
    assert any("cp1252" in w for w in ged_.warnings)


# ANSEL puts a combining mark *before* its letter: E2 = acute, E8 = diaeresis.
ANSEL_NAME = b"Jos\xe2e M\xe8uller-\xa1\xe2od\xe2z"


def test_decode_ansel():
    assert decode_ansel(ANSEL_NAME) == "José Müller-Łódź"
    assert decode_ansel(b"\xa5sop \xb2re \xcfe \xc3") == "Æsop øre ße ©"
    assert decode_ansel(b"\x80") == "�"


def test_reads_ansel_file(write_ged):
    text = GED.format(charset="ANSEL").encode("ascii", errors="ignore")
    data = text.replace(b"1 NAME ", b"1 NAME " + ANSEL_NAME)
    ged_ = read_gedcom(write_ged(data))
    assert ged_.encoding == "ANSEL"
    assert ged_.individuals[0].name.startswith(NAME)


def test_redacting_a_non_utf8_file_writes_utf8_and_updates_char(write_ged, tmp_path):
    text = GED.format(charset="ANSEL").encode("ascii", errors="ignore")
    path = write_ged(text.replace(b"1 NAME ", b"1 NAME " + ANSEL_NAME))
    out = str(tmp_path / "out.ged")
    apply_redactions(path, [], out)
    result = read_gedcom(out)
    assert result.encoding == "UTF-8"
    assert "1 CHAR UTF-8" in result.lines
    assert result.individuals[0].name.startswith(NAME)


@pytest.mark.parametrize("bom", [b"", codecs.BOM_UTF8])
def test_redact_keeps_bom_and_line_endings(write_ged, tmp_path, bom):
    text = GED.format(charset="UTF-8").replace("\n", "\r\n").encode("utf-8")
    path = write_ged(bom + text)
    out = tmp_path / "out.ged"
    apply_redactions(path, [], str(out))
    assert out.read_bytes() == bom + text


def test_undecodable_bytes_are_reported():
    decoded = decode_gedcom(b"0 HEAD\n1 CHAR UNICODE\n0 TRLR\n\xff")
    assert decoded.encoding == "cp1252"
    assert decode_gedcom(b"0 HEAD\n1 CHAR UTF-8\n1 NOTE \x81\n").warnings
