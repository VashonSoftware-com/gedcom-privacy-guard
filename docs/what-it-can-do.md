# What it can and can't do

The web page and the command-line tool share one engine, so everything
here applies to both unless it says otherwise. For the word lists
themselves, see [how-it-works.md](how-it-works.md); for privacy, see
[safety.md](safety.md).

## In short

| It can | It can't (yet) |
|---|---|
| Read a GEDCOM from any genealogy program, in any of the four encodings GEDCOM has used | Understand what a note *means*; it matches words and patterns |
| Find sensitive words and phrases in every note, cause of death, source text, address and custom tag | Warn about **living people** (planned) |
| Find ID numbers, phone numbers, emails, street addresses and your own computer's file paths | Look inside photos, scans or other attached files |
| Show each hit for you to keep, remove or rewrite | Decide anything for you |
| Write a cleaned *copy*, changing only the notes you chose | Change names, dates or places |
| Run with no internet connection at all | Fix a tree that lives on a website (fix it there) |

## What it reads

**Any program's GEDCOM.** It reads GEDCOM 5.5 and 5.5.1, the versions
that Legacy, RootsMagic, Family Tree Maker, Gramps, Ancestry and most
others export. It isn't a full implementation of the standard: it reads
the text, the people and their families, and passes everything else
through untouched. Real exports have been tested from Legacy only so far.
[Help us test yours](help-wanted.md).

**Every encoding.** UTF-8 (with or without a byte-order mark), UTF-16,
ANSEL (older Legacy and Family Tree Maker exports) and Windows "ANSI".
Files that claim one encoding but use another are detected and you're
warned. Characters that can't be read are counted and reported, never
silently dropped.

**Messy and broken files.** Automated tests feed it hundreds of randomly
damaged files on every change. A file it can't read stops with a plain
message, never a crash, and redacting always produces a file that reads
back cleanly.

**Hostile files.** A GEDCOM is plain text, so it can't run code by
itself, and this tool never runs anything it finds in one. Text that
would act as a formula in Excel (`=HYPERLINK(...)`) is neutralized
before it goes into the review spreadsheet.

## What it looks for

Categories of sensitive text, each with its own word list, exceptions
and severity. The **standard** preset (the web page's setting) covers:

- ID numbers: Social Security and similar numbers
- Contact details: phone numbers and emails
- The submitter record: your own name and address, which most programs
  add to every export
- Paths on your own computer (`C:\Users\...`)
- Text already marked private in your program (`[[ ]]` in Legacy,
  `{ }` in RootsMagic), which upload sites show anyway
- Mental health, addiction, crime and scandal
- Rumor presented as fact ("according to family lore")

The **cautious** preset adds adoption and paternity, physical illness,
security-question answers (*maiden name*) and street addresses. The
**open** preset keeps only the first five. Presets and your own word
lists are available in the command-line tool and its rules editor; the
web page uses the standard preset.

## What it changes

Nothing, until you choose. For each flagged note you pick:

- **Keep**: left exactly as it was.
- **Remove**: the whole note is replaced with
  `[REDACTED BY GEDCOM PRIVACY GUARD]`.
- **Rewrite**: the note is replaced with your wording.
- **Mark private** (Legacy users only): the flagged words are wrapped in
  Legacy's `[[ ]]` private markers, so they disappear when you export
  from Legacy again. See [legacy.md](legacy.md).

If one note has several hits with different choices, the more cautious
one wins: remove beats rewrite beats mark private beats keep.

The result is a **new file**; your original is never changed. The new
file is UTF-8 (its header is updated to say so), keeps the original's
line endings, and wraps long text onto continuation lines as GEDCOM
requires. Every other line passes through as it was.

The command-line tool also refuses to apply a review spreadsheet to a
different or since-edited file, rather than overwrite the wrong notes.

## What it misses

It matches words, not meaning. These all pass without a flag in the
standard preset, because none uses a listed word or phrase:

- "She took her own life in 1931."
- "Uncle Bob was sent to the state hospital."
- "A hopeless drunk."
- "Served time at the state pen."
- "Committed to the asylum." (but "insane asylum" and "lunatic asylum"
  are caught)

Also missed for now:

- **Misspellings** common in old notes ("alchoholic").
- **Other languages.** The word lists are English.
- **Living people.** A planned warning will flag people with no death
  date who could still be alive. Your genealogy program can already
  leave living people out of an export; use that option too.
- **Pictures and documents.** Only the file names and paths of attached
  media are checked, not the images or PDFs themselves.

So **skim your notes yourself too**. If a common phrase is missed,
[tell us](../CONTRIBUTING.md#reporting-a-miss-or-a-false-alarm) and it
can be added for everyone.

## Where it runs

- **The web page**, <https://gedcom.vashonsoftware.com>, runs the engine
  inside your browser (Python compiled for the web, called Pyodide). The
  page loads every file from its own site, and its security settings
  forbid it to send anything anywhere. After the first visit it keeps a
  copy of itself, so it opens and works with no internet at all, and it
  can be installed like an app. That stored copy is the page's own
  files only, never your tree.
- **The command-line tool** (`pipx install gedcom-privacy-guard`) adds
  presets, your own word lists, the rules editor and a review
  spreadsheet you can work through in Excel. See the
  [README](../README.md).

## When to use it

- Before uploading a tree to Ancestry, FamilySearch, WikiTree, a family
  website or anywhere else public.
- Before giving a copy to your children or other relatives.
- Before merging someone else's research into your tree, to see what
  their notes say about your family first.
