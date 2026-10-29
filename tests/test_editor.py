"""The rules editor: an offline page whose JavaScript must agree with Python.

The page (gedcom_privacy_guard/editor/) re-implements rule merging and
matching so it can test a note without a server. These tests run that
JavaScript under Node and compare it with rules.py and scanner.py, and
check that every file the editor writes loads in Python. They're skipped
where Node isn't installed.
"""

import json
import os
import re
import shutil
import subprocess
import textwrap

import pytest
from conftest import ROOT, SAMPLE

from gedcom_privacy_guard.parser import read_gedcom
from gedcom_privacy_guard.rules import (
    EDITOR_DATA,
    PRESETS,
    RulesError,
    builtin_definitions,
    editor_data_js,
    load_rules,
)
from gedcom_privacy_guard.scanner import KeywordScanner

EDITOR = os.path.join(ROOT, "gedcom_privacy_guard", "editor")
HARNESS = os.path.join(os.path.dirname(__file__), "js", "editor_harness.js")
NODE = shutil.which("node")
needs_node = pytest.mark.skipif(NODE is None, reason="Node.js isn't installed")

USER_RULES = """
    extends: standard
    exceptions: [Asylum Road]
    categories:
      mental_health:
        severity: medium
        add_terms: [melancholia, "*nervous*"]
        remove_terms: [bipolar]
        exceptions: [Depression era]
      unverified_claims:
        enabled: false
      medical:
        enabled: true
      our_family:
        severity: high
        terms: [Uncle Bob's other family, Bobby*]
"""

TEXTS = [
    "He suffered from depression after the war.",
    "The Great Depression ruined the farm; his depressions came later.",
    "Driver’s license and drivers license and driver's license",
    "She had a nervous\nbreakdown in 1931 and was institutionalized.",
    "Alcoholism, an alcoholic father, overdosed twice, went to rehab and a rehabilitation center.",
    "A prisoner of war, held in a prison camp; later sent to prison and jailed.",
    "WWII prison camps and POW camps held prisoners of war; two economic depressions.",
    "SSN 123-45-6789; also 000-12-3456 is not valid. Phone (206) 555-0142, mail joe.doe@example.com",
    r"Photo at C:\Users\joe\Pictures\x.jpg and \\server\share\ and /Users/joe/a and file:///tmp/x",
    "Private: [[Ask May first]] and {RootsMagic private} text",
    "Lived at 1234 North Main Street, then 9 Elm Rd.",
    "Adopted by the Smiths; her birth mother and a DNA match and half-siblings.",
    "Zoëdepression; édepression; depression-era; dépression; DEPRESSION.",
    "Asylum Road, Depression era photos, melancholia, nervousness, Bobby Joe, Uncle Bob's other family",
    "İstanbul: depression",  # lowercasing changes length: the scanner's slow path
    "Rumors, allegedly, according to family lore, unconfirmed and disputed.",
    "Cancer, dementia, Alzheimer's, tuberculosis; her first pet and maiden name.",
    "   ",
]


def _node(request: dict) -> dict:
    request = {"builtin": builtin_definitions(), **request}
    out = subprocess.run(  # noqa: S603 - fixed argv, our own script
        [NODE, HARNESS],
        input=json.dumps(request),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
        timeout=60,
    )
    return json.loads(out.stdout)


def _user_doc(text: str) -> dict:
    import yaml

    return yaml.safe_load(textwrap.dedent(text))


@pytest.fixture
def rules_file(tmp_path):
    def _write(text: str) -> str:
        path = tmp_path / "my-rules.yaml"
        path.write_text(textwrap.dedent(text), encoding="utf-8")
        return str(path)

    return _write


def _index(name: str) -> int:
    return list(builtin_definitions()["categories"]).index(name)


def _python_rules(rules):
    return [
        {
            "name": c.name,
            "enabled": c.enabled,
            "severity": c.severity,
            "terms": [str(t) for t in c.terms],
            "exceptions": c.exceptions,
            "patterns": c.patterns,
            "locations": c.locations,
        }
        for c in rules.categories
    ]


# ------------------------------------------------------------- the page


def test_builtin_data_matches_rules_yaml():
    with open(EDITOR_DATA, encoding="utf-8") as f:
        assert f.read() == editor_data_js(), (
            "builtin-rules.js is out of date: run `uv run python scripts/build_editor_data.py`"
        )


def test_page_loads_only_local_scripts_and_forbids_network():
    with open(os.path.join(EDITOR, "rules-editor.html"), encoding="utf-8") as f:
        html = f.read()
    assert "default-src 'none'" in html
    assert not re.search(r"""(?:src|href)\s*=\s*["']?(?:https?:)?//""", html)
    scripts = re.findall(r'<script src="([^"]+)"', html)
    assert scripts, "no scripts found"
    for src in scripts:
        assert os.path.exists(os.path.join(EDITOR, src)), f"missing {src}"
    for name in os.listdir(EDITOR):
        if name.endswith(".js"):
            with open(os.path.join(EDITOR, name), encoding="utf-8") as f:
                code = f.read()
            assert not re.search(r"\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon", code), name


def test_editor_command_finds_the_page(capsys):
    from gedcom_privacy_guard.cli import main

    assert main(["editor", "--no-browser"]) in (0, None)
    assert "rules-editor.html" in capsys.readouterr().out


# ------------------------------------------- JavaScript agrees with Python


def _cases():
    sample = read_gedcom(SAMPLE)
    return [{"text": t, "location": "note"} for t in TEXTS] + [
        {"text": b.text, "location": b.location} for b in sample.text_blocks
    ]


@needs_node
@pytest.mark.parametrize("preset", [*PRESETS, None])
def test_js_flags_exactly_what_python_flags(preset, rules_file):
    user = _user_doc(USER_RULES) if preset is None else {}
    rules = load_rules(rules_file(USER_RULES)) if preset is None else load_rules(preset=preset)
    scanner = KeywordScanner(rules)
    cases = _cases()
    js = _node({"mode": "scan", "user": user, "preset": preset, "cases": cases})["ok"]
    for case, got in zip(cases, js, strict=True):
        want = [[f.category, f.matched_term] for f in scanner.scan(case["text"], case["location"])]
        assert got == want, case["text"][:80]


@needs_node
@pytest.mark.parametrize("preset", [*PRESETS, None])
def test_js_merges_rules_like_python(preset, rules_file):
    user = _user_doc(USER_RULES) if preset is None else {}
    rules = load_rules(rules_file(USER_RULES)) if preset is None else load_rules(preset=preset)
    js = _node({"mode": "rules", "user": user, "preset": preset})["ok"]
    assert js["preset"] == rules.preset
    assert js["categories"] == _python_rules(rules)
    assert js["exceptions"] == rules.exceptions


@needs_node
@pytest.mark.parametrize(
    "text",
    [
        "extends: strict\n",
        "version: 2\n",
        "categories:\n  mental_health:\n    severity: severe\n",
        "categories:\n  mental_health:\n    remove_terms: [lunacy]\n",
        "categories:\n  mentle_health:\n    enabled: false\n",
        "categories:\n  mental_health:\n    colour: red\n",
        "categories:\n  Our-Family:\n    terms: [x]\n",
        "categories:\n  mental_health:\n    in: [notes]\n",
        "categorys:\n  mental_health:\n    enabled: false\n",
    ],
)
def test_js_rejects_what_python_rejects(text, rules_file):
    with pytest.raises(RulesError):
        load_rules(rules_file(text))
    assert "error" in _node({"mode": "rules", "user": _user_doc(text)})


# ------------------------------------------------ files the editor writes


def _edit(*ops) -> tuple[dict, str]:
    out = _node({"mode": "edit", "ops": [list(op) for op in ops]})["ok"]
    return out["doc"], out["yaml"]


def _load_written(tmp_path, text: str):
    path = tmp_path / "written.yaml"
    path.write_text(text, encoding="utf-8")
    return load_rules(str(path))


@needs_node
def test_edits_write_a_short_file_python_loads(tmp_path):
    doc, text = _edit(
        ("removeTerm", "mental_health", "bipolar"),
        ("addTerm", "mental_health", "melancholia*"),
        ("setEnabled", "medical", True),
        ("setEnabled", "unverified_claims", False),
        ("setSeverity", "legal_sensitive", "high"),
        ("addException", None, "Asylum Road"),
        ("addException", "mental_health", "Depression era"),
        ("addCategory", "Our family", "high", "Things only we know", "Uncle Bob's other family"),
        ("addTerm", "our_family", "*bobby*"),
    )
    assert doc == {
        "version": 1,
        "extends": "standard",
        "exceptions": ["Asylum Road"],
        "categories": {
            "mental_health": {
                "add_terms": ["melancholia*"],
                "remove_terms": ["bipolar"],
                "exceptions": ["Depression era"],
            },
            "medical": {"enabled": True},
            "unverified_claims": {"enabled": False},
            "legal_sensitive": {"severity": "high"},
            "our_family": {
                "severity": "high",
                "terms": ["Uncle Bob's other family", "*bobby*"],
                "description": "Things only we know",
            },
        },
    }
    rules = _load_written(tmp_path, text)
    cats = {c.name: c for c in rules.categories}
    assert "bipolar" not in [t.text for t in cats["mental_health"].terms]
    assert "melancholia*" in [str(t) for t in cats["mental_health"].terms]
    assert cats["medical"].enabled and not cats["unverified_claims"].enabled
    assert cats["legal_sensitive"].severity == "high"
    assert [str(t) for t in cats["our_family"].terms] == ["Uncle Bob's other family", "*bobby*"]
    assert rules.exceptions == ["Asylum Road"]


@needs_node
def test_undoing_an_edit_leaves_no_trace():
    doc, _ = _edit(
        ("removeTerm", "mental_health", "bipolar"),
        ("addTerm", "mental_health", "bipolar"),
        ("setEnabled", "medical", True),
        ("setEnabled", "medical", False),
        ("setSeverity", "legal_sensitive", "high"),
        ("setSeverity", "legal_sensitive", "medium"),
        ("addTerm", "substance_use", "tippler"),
        ("removeTerm", "substance_use", "tippler"),
    )
    assert doc == {"version": 1, "extends": "standard"}


@needs_node
def test_putting_back_a_term_with_different_matching(tmp_path):
    # remove_terms works by words alone, so this needs the full list.
    doc, text = _edit(
        ("removeTerm", "mental_health", "suicid*"), ("addTerm", "mental_health", "suicid")
    )
    spec = doc["categories"]["mental_health"]
    assert "suicid" in spec["terms"] and "suicid*" not in spec["terms"]
    assert "add_terms" not in spec and "remove_terms" not in spec
    terms = [
        str(t) for t in _load_written(tmp_path, text).categories[_index("mental_health")].terms
    ]
    assert "suicid" in terms and "suicid*" not in terms and "depression" in terms


@needs_node
@pytest.mark.parametrize(
    "value",
    [
        "no",
        "Yes",
        "true",
        "null",
        "123",
        "a: b",
        "#tag",
        "- dash",
        "*x*",
        "x*",
        "trailing ",
        "back\\slash",
        'quote"d',
        "it's",
        "Zoë’s",
        "[x]",
        "{y}",
        "a\tb",
        "%p",
        "@at",
        "`tick`",
        "!bang",
        "&amp",
        "|bar",
        ">gt",
    ],
)
def test_awkward_words_survive_the_round_trip(value, tmp_path):
    term = value.strip()
    _, text = _edit(("addTerm", "mental_health", value), ("addException", None, value))
    rules = _load_written(tmp_path, text)
    assert term.lower() in [str(t).lower() for t in rules.categories[_index("mental_health")].terms]
    assert rules.exceptions == [term]


@needs_node
def test_old_format_file_is_converted_and_keeps_its_meaning(tmp_path):
    old = "mental_health:\n  severity: high\n  terms: [depress, asylum]\nmine:\n  terms: [bob]\n"
    out = _node({"mode": "load", "text": old})["ok"]
    assert out["notice"]
    new = _load_written(tmp_path, out["yaml"])
    path = tmp_path / "old.yaml"
    path.write_text(old, encoding="utf-8")
    assert _python_rules(new) == _python_rules(load_rules(str(path)))


@needs_node
def test_yes_and_no_read_as_python_reads_them():
    out = _node({"mode": "load", "text": "categories:\n  medical:\n    enabled: yes\n"})["ok"]
    assert out["doc"]["categories"]["medical"]["enabled"] is True
