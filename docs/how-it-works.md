# How it decides what to flag

GEDCOM Privacy Guard doesn't understand what a note means. It looks for
words, phrases and patterns, and lists every hit for you to judge. This
page explains exactly what it looks for, so you know what it can and
can't catch.

## Where it looks

Every place a GEDCOM file holds free text: notes on people, families,
events and sources; shared note records; cause of death; source text and
citation details; media file paths; addresses; the submitter record;
and custom tags (`_TAG`) that some programs add. The `found_in` column
of the report says which one each hit came from.

Names, dates and places are read only to help you tell people apart in
the report. They're never flagged or changed. If a name or place looks
garbled, the program that made the file wrote it that way.

## What it looks for

**Word lists.** Each category (mental health, addiction, crime, rumor
and so on) has a list of terms. A term can match in three ways:

| In the rules | Matches | Doesn't match |
|---|---|---|
| `depression` | the whole word *depression* | *depressions*, *depressed* |
| `alcoholi*` | any word starting *alcoholi*: *alcoholism*, *alcoholic* | *alcohol* |
| `*ssn*` | *ssn* anywhere, even inside a word | |

Case never matters. A space in a phrase matches any spacing, including a
line break, so a phrase split across two lines of a note is still found.

**Exceptions.** Known harmless phrases switch a hit off: *the Great
Depression* doesn't count as `depression`, and *prisoner of war* doesn't
count as `prison`.

**Patterns.** Regular expressions find things that aren't words: Social
Security numbers, phone numbers, email addresses, street addresses, file
paths on your own computer (`C:\Users\…`), and text already marked
private in your program (`[[ ]]` in Legacy, `{ }` in RootsMagic). Those
markers only work inside the program that made them; an upload site
shows the text.

**Structure.** The submitter record, which holds your own name, address
and email, is flagged whole, because most programs add it to every
export.

## Presets

Three built-in presets set how much gets flagged:

- **open**: only what exposes identity or contact details (ID numbers,
  phones, emails, the submitter record, local paths, text already marked
  private).
- **standard** (the default): open, plus mental health, addiction, crime
  and family scandal, and rumor presented as fact.
- **cautious**: standard, plus adoption and paternity, physical illness,
  answers to security questions (*maiden name*) and street addresses.

Run `gedcom-privacy-guard rules --preset cautious -v` to see every term
a preset uses. To change the lists, see [`RULES.md`](RULES.md).

## What it catches, and what it misses

From the sample file in this repo, this note is flagged three times:

> John struggled with **alcoholism** for much of his adult life,
> **according to family lore** he was **institutionalized** briefly in
> 1938.

But each of these passes without a flag, because none uses a listed
word:

> She took her own life in 1931.
>
> He drank himself to death.
>
> Uncle Bob was sent to the state hospital.

People who wrote about hard things often wrote around them. Keyword
matching can't read between the lines, so **skim your notes yourself
too**. If you find a common phrase it misses, please
[report it](../CONTRIBUTING.md#reporting-a-miss-or-a-false-alarm).

## It never decides for you

Every hit is a question, not a verdict. Nothing changes until you choose
an action for that row in the report and run `redact`, and `redact`
writes a new file: your original export is never changed. See
[ADR-001](adr/001-human-reviewed-flagging.md) for why.
