"""Presets, a user's overrides, and plain error messages for mistakes."""

import textwrap

import pytest

from gedcom_privacy_guard.rules import BUILTIN_RULES, RulesError, load_rules
from gedcom_privacy_guard.scanner import KeywordScanner


@pytest.fixture
def rules_file(tmp_path):
    def _write(text: str) -> str:
        path = tmp_path / "my-rules.yaml"
        path.write_text(textwrap.dedent(text), encoding="utf-8")
        return str(path)

    return _write


def _on(rules):
    return {c.name for c in rules.enabled}


def test_presets_turn_on_more_categories():
    open_, standard, cautious = (
        _on(load_rules(preset=p)) for p in ("open", "standard", "cautious")
    )
    assert open_ < standard < cautious
    assert {"identity_numbers", "submitter", "already_private"} <= open_
    assert "mental_health" in standard - open_
    assert "family_secrets" in cautious - standard


def test_default_is_standard():
    assert load_rules().preset == "standard"


def test_overrides_change_only_what_they_name(rules_file):
    path = rules_file(
        """
        extends: standard
        exceptions: [Asylum Road]
        categories:
          mental_health:
            severity: medium
            add_terms: [melancholia]
            remove_terms: [bipolar]
            exceptions: [Depression era]
          unverified_claims:
            enabled: false
          medical:
            enabled: true
          our_family:
            severity: high
            terms: [Uncle Bob's other family]
        """
    )
    rules = load_rules(path)
    cats = {c.name: c for c in rules.categories}
    mh = cats["mental_health"]
    assert mh.severity == "medium"
    assert "melancholia" in [t.text for t in mh.terms]
    assert "bipolar" not in [t.text for t in mh.terms]
    assert "depression" in [t.text for t in mh.terms]  # built-in terms still there
    assert "Great Depression" in mh.exceptions and "Depression era" in mh.exceptions
    assert not cats["unverified_claims"].enabled
    assert cats["medical"].enabled  # a cautious-only category, turned on by hand
    assert cats["our_family"].severity == "high"

    s = KeywordScanner(rules)
    assert [f.category for f in s.scan("Uncle Bob’s other family")] == ["our_family"]
    assert s.scan("She lived on Asylum Road.") == []
    assert s.scan("It was rumored.") == []


def test_preset_argument_overrides_extends(rules_file):
    path = rules_file("extends: open\n")
    assert load_rules(path, preset="cautious").preset == "cautious"


def test_extends_none_uses_only_the_users_categories(rules_file):
    path = rules_file(
        """
        extends: none
        categories:
          ours:
            terms: [secret]
        """
    )
    assert _on(load_rules(path)) == {"ours"}


def test_old_format_still_loads_with_substring_matching(rules_file):
    path = rules_file(
        """
        mental_health:
          severity: high
          terms: [depress]
        """
    )
    rules = load_rules(path)
    assert _on(rules) == {"mental_health"}
    assert [f.matched_term for f in KeywordScanner(rules).scan("she was depressed")] == ["depress"]


def test_builtin_file_loads_as_a_rules_file():
    assert _on(load_rules(BUILTIN_RULES)) == _on(load_rules())


def test_removing_every_term_turns_the_category_off(rules_file):
    path = rules_file(
        """
        categories:
          security_questions:
            enabled: true
            remove_terms: [maiden name, first pet, childhood nickname]
        """
    )
    assert "security_questions" not in _on(load_rules(path))


@pytest.mark.parametrize(
    ("text", "message"),
    [
        (
            "categories:\n  mental_health:\n    severity: hgih\n",
            "severity must be high, medium or low",
        ),
        ("categories:\n  mental_helth:\n    enabled: false\n", "Did you mean 'mental_health'"),
        ("categories:\n  mental_health:\n    trems: [x]\n", "Did you mean 'terms'"),
        ("categories:\n  mental_health:\n    remove_terms: [nope]\n", "can't remove 'nope'"),
        (
            "categories:\n  ours:\n    terms: [x]\n    patterns: ['(']\n",
            "isn't a valid regular expression",
        ),
        ("categories:\n  ours:\n    terms: [x]\n    in: [notes]\n", "Did you mean 'note'"),
        ("categories:\n  Our Family:\n    terms: [x]\n", "lowercase letters"),
        ("categories:\n  mental_health:\n    enabled: maybe\n", "true or false"),
        ("extends: strict\n", "must be open, standard, cautious or none"),
        ("extend: open\n", "Did you mean 'extends'"),
        ("version: 2\n", "isn't supported"),
        ("categories:\n  ours:\n    terms: ['']\n", "empty entry"),
        ("categories: [a, b]\n", "should list category names"),
        ("- just a list\n", "'key: value' settings"),
        ("categories:\n  ours:\n  terms: [x\n", "isn't valid YAML (line"),
    ],
)
def test_mistakes_get_plain_messages(rules_file, text, message):
    with pytest.raises(RulesError, match=None) as err:
        load_rules(rules_file(text))
    assert message in str(err.value)
    assert "my-rules.yaml" in str(err.value) or "Built-in" in str(err.value)


def test_missing_rules_file():
    with pytest.raises(RulesError, match="not found"):
        load_rules("no-such-rules.yaml")
