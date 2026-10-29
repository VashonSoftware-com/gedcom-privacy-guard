"""
Rules: what the scanner looks for.

The built-in rules (``rules.yaml`` beside this file) define every
category. A user's rules file holds only their changes:

    extends: standard          # open | standard | cautious | none
    exceptions: [Smith Asylum Road]
    categories:
      mental_health:
        severity: medium
        add_terms: [melancholia]
        remove_terms: [bipolar]
        exceptions: [Great Depression]
      unverified_claims:
        enabled: false
      our_family:              # a new category
        severity: high
        terms: [Uncle Bob's other family]

Because the file holds only changes, later improvements to the built-in
rules still apply (see ADR-009). A rules file in the old format (a plain
``category: {severity, terms}`` mapping) still loads: it replaces the
built-ins, and its terms match anywhere, as they always did.

Every mistake in a rules file is reported as a ``RulesError`` naming the
file, the category and the fix, never as a traceback.
"""

from __future__ import annotations

import copy
import difflib
import json
import os
import re
from dataclasses import dataclass, field

import yaml

BUILTIN_RULES = os.path.join(os.path.dirname(__file__), "rules.yaml")

PRESETS = ("open", "standard", "cautious")
SEVERITIES = ("high", "medium", "low")
LOCATIONS = (
    "note",
    "cause",
    "source_text",
    "citation",
    "media_file",
    "submitter",
    "address",
    "custom_tag",
)

_CATEGORY_KEYS = {
    "description",
    "severity",
    "enabled",
    "enabled_from",
    "terms",
    "add_terms",
    "remove_terms",
    "exceptions",
    "patterns",
    "add_patterns",
    "in",
    "flag_every_value",
}
_TOP_KEYS = {"version", "extends", "categories", "exceptions"}
_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")


class RulesError(ValueError):
    """A rules file is missing, unreadable or has a mistake in it."""


@dataclass
class Term:
    text: str
    mode: str  # word | prefix | substring

    @classmethod
    def parse(cls, raw: str, legacy: bool = False) -> Term:
        text = raw.strip()
        if legacy:
            return cls(text, "substring")
        if len(text) > 2 and text.startswith("*") and text.endswith("*"):
            return cls(text[1:-1].strip(), "substring")
        if text.endswith("*"):
            return cls(text[:-1].strip(), "prefix")
        return cls(text, "word")

    def __str__(self) -> str:
        return {"word": self.text, "prefix": f"{self.text}*", "substring": f"*{self.text}*"}[
            self.mode
        ]


@dataclass
class Category:
    name: str
    severity: str = "medium"
    description: str = ""
    enabled: bool = True
    terms: list[Term] = field(default_factory=list)
    exceptions: list[str] = field(default_factory=list)
    patterns: list[str] = field(default_factory=list)
    locations: list[str] = field(default_factory=list)  # empty = everywhere
    flag_every_value: bool = False


@dataclass
class RuleSet:
    preset: str
    categories: list[Category]
    exceptions: list[str]
    source: str  # where the user's changes came from, "" for built-ins only

    @property
    def enabled(self) -> list[Category]:
        return [c for c in self.categories if c.enabled]


def _read_yaml(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except FileNotFoundError:
        raise RulesError(f"Rules file not found: {path}") from None
    except OSError as e:
        raise RulesError(f"Can't read rules file {path}: {e.strerror}") from None
    except UnicodeDecodeError:
        raise RulesError(f"Rules file {path} isn't UTF-8 text. Save it as UTF-8.") from None
    except yaml.YAMLError as e:
        where = ""
        mark = getattr(e, "problem_mark", None)
        if mark is not None:
            where = f" (line {mark.line + 1}, column {mark.column + 1})"
        problem = getattr(e, "problem", None) or "invalid YAML"
        raise RulesError(
            f"Rules file {path} isn't valid YAML{where}: {problem}. "
            "Check indentation and that every list item starts with '- '."
        ) from None
    if data is None:
        return {}
    if not isinstance(data, dict):
        raise RulesError(f"Rules file {path} should be a set of 'key: value' settings.")
    return data


def _suggest(word: str, options) -> str:
    close = difflib.get_close_matches(str(word), list(options), n=1)
    return f" Did you mean '{close[0]}'?" if close else ""


def _is_legacy(data: dict) -> bool:
    return (
        bool(data)
        and not (set(data) & _TOP_KEYS)
        and all(isinstance(v, dict) for v in data.values())
    )


def _str_list(value, where: str, key: str) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list) or not all(isinstance(v, (str, int, float)) for v in value):
        raise RulesError(f"{where}: '{key}' should be a list of words or phrases.")
    out = [str(v).strip() for v in value]
    if any(not v or v in ("*", "**") for v in out):
        raise RulesError(f"{where}: '{key}' has an empty entry.")
    return out


def _check_pattern(pattern: str, where: str) -> None:
    try:
        re.compile(pattern)
    except re.error as e:
        raise RulesError(
            f"{where}: pattern {pattern!r} isn't a valid regular expression ({e})."
        ) from None


def _apply(base: dict[str, Category], name: str, spec, where: str, legacy: bool, is_user: bool):
    where = f"{where}, category '{name}'"
    if not isinstance(name, str) or not _NAME_RE.match(name):
        raise RulesError(
            f"{where}: category names use lowercase letters, digits and underscores "
            "(e.g. our_family)."
        )
    if spec is None:
        spec = {}
    if not isinstance(spec, dict):
        raise RulesError(f"{where}: expected settings such as 'severity:' and 'terms:'.")
    for key in spec:
        if key not in _CATEGORY_KEYS:
            raise RulesError(f"{where}: unknown setting '{key}'.{_suggest(key, _CATEGORY_KEYS)}")

    new = name not in base
    if new and is_user and not legacy:
        if not (spec.get("terms") or spec.get("patterns") or spec.get("flag_every_value")):
            raise RulesError(
                f"{where}: there's no built-in category by that name."
                f"{_suggest(name, base)} A new category needs 'terms:' or 'patterns:'."
            )
    cat = base.setdefault(name, Category(name=name))

    if "severity" in spec:
        sev = str(spec["severity"]).lower()
        if sev not in SEVERITIES:
            raise RulesError(
                f"{where}: severity must be high, medium or low (got {spec['severity']!r})."
            )
        cat.severity = sev
    if "description" in spec:
        cat.description = " ".join(str(spec["description"]).split())
    if "enabled" in spec:
        if not isinstance(spec["enabled"], bool):
            raise RulesError(f"{where}: enabled must be true or false.")
        cat.enabled = spec["enabled"]
    if "enabled_from" in spec and spec["enabled_from"] not in PRESETS:
        raise RulesError(f"{where}: enabled_from must be open, standard or cautious.")

    if "terms" in spec:
        cat.terms = [Term.parse(t, legacy) for t in _str_list(spec["terms"], where, "terms")]
    for t in _str_list(spec.get("add_terms"), where, "add_terms"):
        term = Term.parse(t)
        if all(str(term).lower() != str(x).lower() for x in cat.terms):
            cat.terms.append(term)
    for t in _str_list(spec.get("remove_terms"), where, "remove_terms"):
        before = len(cat.terms)
        cat.terms = [x for x in cat.terms if x.text.lower() != Term.parse(t).text.lower()]
        if len(cat.terms) == before:
            raise RulesError(
                f"{where}: can't remove '{t}': it isn't one of this category's terms."
                f"{_suggest(t, [x.text for x in cat.terms])}"
            )
    for e in _str_list(spec.get("exceptions"), where, "exceptions"):
        if e.lower() not in (x.lower() for x in cat.exceptions):
            cat.exceptions.append(e)
    if "patterns" in spec:
        cat.patterns = _str_list(spec["patterns"], where, "patterns")
    cat.patterns += _str_list(spec.get("add_patterns"), where, "add_patterns")
    for p in cat.patterns:
        _check_pattern(p, where)

    if "in" in spec:
        locs = _str_list(spec["in"], where, "in")
        for loc in locs:
            if loc not in LOCATIONS:
                raise RulesError(
                    f"{where}: '{loc}' isn't a place text is found.{_suggest(loc, LOCATIONS)} "
                    f"Choose from: {', '.join(LOCATIONS)}."
                )
        cat.locations = locs
    if "flag_every_value" in spec:
        cat.flag_every_value = bool(spec["flag_every_value"])


def builtin_definitions() -> dict:
    """The built-in rules file as data (used by the rules editor)."""
    return _read_yaml(BUILTIN_RULES)


EDITOR_DATA = os.path.join(os.path.dirname(__file__), "editor", "builtin-rules.js")


def editor_data_js() -> str:
    """The built-in rules as a script for the rules editor, which runs
    from a file:// page and so can't fetch ``rules.yaml`` itself.
    ``scripts/build_editor_data.py`` writes it; a test checks it's current."""
    data = json.dumps(builtin_definitions(), indent=1, ensure_ascii=False)
    return (
        "// Generated from rules.yaml by scripts/build_editor_data.py. Don't edit.\n"
        f"globalThis.GPG_BUILTIN_RULES = {data};\n"
    )


def load_rules(path: str | None = None, preset: str | None = None) -> RuleSet:
    """Built-in rules for a preset, plus the changes in ``path`` if given.
    ``preset`` overrides the file's own ``extends``."""
    user: dict = _read_yaml(path) if path else {}
    where = f"Rules file {path}" if path else "Built-in rules"
    legacy = _is_legacy(user)
    if legacy:
        user = {"extends": "none", "categories": user}

    for key in user:
        if key not in _TOP_KEYS:
            raise RulesError(f"{where}: unknown setting '{key}'.{_suggest(key, _TOP_KEYS)}")
    version = user.get("version", 1)
    if version != 1:
        raise RulesError(
            f"{where}: version {version!r} isn't supported; this program reads version 1."
        )

    extends = str(preset or user.get("extends") or "standard").lower()
    if extends not in (*PRESETS, "none"):
        raise RulesError(
            f"{where}: 'extends' must be open, standard, cautious or none (got {extends!r})."
        )

    builtin = builtin_definitions()
    categories: dict[str, Category] = {}
    if extends != "none":
        level = PRESETS.index(extends)
        for name, spec in builtin["categories"].items():
            _apply(categories, name, spec, "Built-in rules", False, False)
            categories[name].enabled = PRESETS.index(spec.get("enabled_from", "standard")) <= level
    exceptions = _str_list(builtin.get("exceptions"), "Built-in rules", "exceptions")

    user_cats = user.get("categories") or {}
    if not isinstance(user_cats, dict):
        raise RulesError(f"{where}: 'categories' should list category names, each with settings.")
    for name, spec in copy.deepcopy(user_cats).items():
        _apply(categories, name, spec, where, legacy, True)
    exceptions += _str_list(user.get("exceptions"), where, "exceptions")

    for cat in categories.values():
        if not (cat.terms or cat.patterns or cat.flag_every_value):
            cat.enabled = False  # every term removed: nothing left to look for

    return RuleSet(
        preset=extends,
        categories=list(categories.values()),
        exceptions=exceptions,
        source=path or "",
    )
