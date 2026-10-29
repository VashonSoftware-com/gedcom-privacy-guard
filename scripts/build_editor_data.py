"""Regenerate the rules editor's copy of the built-in rules.

Run after changing gedcom_privacy_guard/rules.yaml:

    uv run python scripts/build_editor_data.py
"""

from gedcom_privacy_guard.rules import EDITOR_DATA, editor_data_js

with open(EDITOR_DATA, "w", encoding="utf-8", newline="\n") as f:
    f.write(editor_data_js())
print(f"Wrote {EDITOR_DATA}")
