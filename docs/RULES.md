# Your own rules

The built-in rules suit most families. To change them, keep a small
rules file that lists **only your changes**. Improvements to the
built-in rules in later versions then still reach you.

The easy way is the rules editor, which runs in your browser with no
network access:

```powershell
gedcom-privacy-guard editor
```

Pick a preset, switch categories on or off, add or remove words, test a
pasted note, and save. To write the file by hand instead, read on.

## A rules file

```yaml
extends: standard            # open | standard | cautious | none
exceptions: [Asylum Road]    # never flagged, in any category
categories:
  mental_health:
    severity: medium         # high | medium | low
    add_terms: [melancholia, state hospital]
    remove_terms: [bipolar]
    exceptions: [economic depression]
  unverified_claims:
    enabled: false
  our_family:                # a category of your own
    severity: high
    terms: [Uncle Bob's other family]
```

Use it with `--rules`:

```powershell
gedcom-privacy-guard scan export.ged --rules my-rules.yaml
```

`--preset` on the command line overrides the file's `extends`.

## Settings

Top level:

| Setting | Meaning |
|---|---|
| `extends` | The preset to start from. `none` starts empty, so only your categories apply. Default `standard`. |
| `exceptions` | Phrases that are never flagged in any category. |
| `categories` | Changes to built-in categories, or new ones. |

Per category:

| Setting | Meaning |
|---|---|
| `enabled` | `true` or `false`. |
| `severity` | `high`, `medium` or `low`. |
| `add_terms` / `remove_terms` | Add to or take from the built-in list. |
| `terms` | Replace the whole list (and the only way to give a new category its words). |
| `exceptions` | Phrases that don't count in this category. |
| `add_patterns` / `patterns` | Regular expressions, for things that aren't words. |
| `in` | Only look in these places: `note`, `cause`, `source_text`, `citation`, `media_file`, `submitter`, `address`, `custom_tag`. |

Terms match whole words. End a term with `*` to match any word starting
with it (`alcoholi*`), or wrap it in `*` to match anywhere (`*ssn*`).
Exceptions take the same syntax, so `prison camp*` also covers
"prison camps". See [how-it-works.md](how-it-works.md).

## Checking a file

```powershell
gedcom-privacy-guard rules --rules my-rules.yaml -v
```

lists every category with its terms, and stops with a plain message if
something is wrong, such as a misspelled setting or category name (it
suggests the right one).

Rules files from before version 1.0 (a plain list of categories, each
with `severity` and `terms`) still load. They replace the built-in rules
entirely, and their terms match anywhere, as they always did. The design
is recorded in [ADR-009](adr/009-rules-file-format.md).
