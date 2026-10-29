# ADR-009: Rules file format: built-ins plus overrides, presets, term modes

**Status:** Accepted
**Date:** 2026-10-29
**Deciders:** Project owner

## Context

Until 0.3, the rules were one `rules.yaml` of categories, each with a
severity and a list of terms matched anywhere as plain substrings. A
user who wanted a change copied the whole file and edited it. That had
three problems:

- A copied file froze the user on that version's rules. New terms and
  fixes in later releases never reached them.
- Substring matching flagged *the Great Depression* as `depression` and
  *prisoner of war* as `prison`, so reports were noisy.
- Families draw the line in different places (ADR-007, ADR-008), and
  there was no way to say "more cautious than the default" short of
  editing every list.

## Decision

1. **Built-ins plus overrides.** The built-in `rules.yaml` ships with
   the package and isn't meant to be edited. A user's rules file holds
   only changes: `extends`, then per category `enabled`, `severity`,
   `add_terms`, `remove_terms`, `exceptions`, `add_patterns`, or a whole
   new category with `terms` or `patterns`.
2. **Presets.** Each built-in category has `enabled_from: open |
   standard | cautious`, the smallest preset that turns it on. `extends`
   (or `--preset`) picks the level; `extends: none` uses only the user's
   categories.
3. **Term modes.** `word` (the default) matches a whole word, `word*`
   a prefix, `*word*` anywhere. Spaces match any whitespace, and a
   straight apostrophe also matches a curly one.
4. **Exceptions,** global and per category, are phrases whose span
   cancels any hit inside it.
5. **Validation.** Every mistake is a `RulesError` naming the file, the
   category and the fix, with a "did you mean" suggestion; never a
   traceback. `version: 1` is the only version.
6. **Old files still load.** A file with no top-level keys, only
   categories, is read as the old format: it replaces the built-ins and
   its terms match as substrings, exactly as before.

The rules editor reads and writes this same format, and
`tests/test_editor.py` checks its JavaScript against the Python loader
and scanner.

## Options Considered

### Keep the single editable file

Simplest, but every user forks the rules on day one and misses later
fixes. Rejected.

### Overrides as a list of operations

For example `- {remove: bipolar, from: mental_health}`. Precise, but
harder to read and to write by hand than settings grouped by category.
Rejected.

### Regular expressions for every term

Already possible through `patterns`, but most families shouldn't need to
know regex to add a word. Rejected as the default; kept for patterns.

## Trade-off Analysis

Overrides keep users current but make a rules file harder to read on its
own, since its meaning depends on the built-ins. The `rules -v` command
and the editor answer that by showing the combined result. Whole-word
matching misses some variants that substring matching caught
(*depressed*); the prefix mode and per-category exceptions let the
built-in lists choose per term.

## Consequences

- Changing a built-in term is a release note, because it changes every
  user's results.
- `remove_terms` naming a term that isn't there is an error, so a
  user's file can break when a built-in term is renamed. The message
  names the term and suggests the closest one.
- The format is the basis for the planned shared policy file (ADR-007)
  and the layered term libraries in `ROADMAP.md`.

## Action Items

1. [x] Implement in `gedcom_privacy_guard/rules.py`, with tests in
   `tests/test_rules.py`.
2. [x] Rules editor reads and writes the format.
3. [x] User guide: [`docs/RULES.md`](../RULES.md).
4. [ ] Revisit when layered term libraries are designed (P2).
