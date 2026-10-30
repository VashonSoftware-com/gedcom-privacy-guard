"""The JSON entry points the browser app calls (gedcom_privacy_guard/web.py)."""

import json

from conftest import SAMPLE
from openpyxl import load_workbook

from gedcom_privacy_guard.redactor import REDACTED_TEXT
from gedcom_privacy_guard.web import redact_from_json, scan_to_json


def test_scan_returns_rows_and_writes_report(tmp_path):
    report = tmp_path / "review.xlsx"
    result = json.loads(scan_to_json(SAMPLE, str(report)))
    assert result["people"] == 4
    assert result["rows"], "sample.ged has flagged notes"
    first = result["rows"][0]
    assert {"name", "line", "line_end", "snippet", "action"} <= first.keys()
    assert first["matched_term"].lower() in result["texts"][str(first["line"])].lower()
    ws = load_workbook(report)["Review"]
    assert ws.max_row == len(result["rows"]) + 1


def test_scan_reports_progress_from_start_to_finish(tmp_path):
    calls = []
    scan_to_json(SAMPLE, str(tmp_path / "review.xlsx"), lambda f, stage: calls.append((f, stage)))
    fractions = [f for f, _ in calls]
    assert fractions[0] == 0 and fractions[-1] == 1
    assert fractions == sorted(fractions)
    assert all(stage for _, stage in calls)


def test_redact_applies_actions_from_the_page(tmp_path):
    rows = json.loads(scan_to_json(SAMPLE, str(tmp_path / "review.xlsx")))["rows"]
    for row in rows:
        row["action"] = "redact"
    out = tmp_path / "cleaned.ged"
    stats = json.loads(redact_from_json(SAMPLE, json.dumps(rows), str(out)))
    assert stats["redacted"] >= 1
    assert REDACTED_TEXT in out.read_text(encoding="utf-8")


def test_blank_actions_keep_everything(tmp_path):
    rows = json.loads(scan_to_json(SAMPLE, str(tmp_path / "review.xlsx")))["rows"]
    out = tmp_path / "cleaned.ged"
    stats = json.loads(redact_from_json(SAMPLE, json.dumps(rows), str(out)))
    assert stats["redacted"] == stats["rewritten"] == stats["privatized"] == 0
