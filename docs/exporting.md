# Getting a GEDCOM file out of your program

Every major genealogy program can save your tree as a GEDCOM (`.ged`)
file. Menu names change between versions, so if these don't match
yours, search your program's help for "export GEDCOM".

So far the tool has been tested on real exports from Legacy only. If
you use another program, please
[send us a made-up sample export](help-wanted.md).

## Desktop programs

**Legacy Family Tree:** File → Export → GEDCOM File. For Ancestry,
choose the *Ancestry Online Family Tree* export type. Don't use the
one-click *Upload to Ancestry* button, which leaves no file to scan.
More in [legacy.md](legacy.md).

**RootsMagic:** File → Export, then choose GEDCOM. RootsMagic marks
private text with `{ braces }` and has an export option to leave it
out; the scanner flags braced text in case that option is off.

**Family Tree Maker:** File → Export, choose *Entire file* and the
GEDCOM format. If you use TreeSync with Ancestry, fix flagged notes in
Family Tree Maker and sync, rather than uploading a new file.

**Gramps:** Family Trees → Export, then choose *GEDCOM*. Gramps can
leave out private records and living people while exporting; the
scanner still reads whatever is in the file.

## Trees that live on a website

**Ancestry:** Trees → *your tree* → Tree Settings → Export tree. When
Ancestry emails that it's ready, download the `.ged` file. It has no
photos or documents, only text.

Then **fix flagged notes on Ancestry itself**, using the report as a
to-do list. Don't run `redact` and upload `cleaned.ged`: uploading
creates a *new* tree, and you'd lose hints, DNA match links, photos and
who you've shared it with.

**MyHeritage:** Family tree → Manage trees → Export to GEDCOM. The same
advice applies: fix notes on the site rather than uploading a new tree.

**FamilySearch:** the shared Family Tree has no GEDCOM export. Notes you
added there are public to every FamilySearch user, so check them on the
site directly.

## What a private tree doesn't cover

Making an Ancestry or MyHeritage tree private hides it from search and
from other members' hints. It doesn't hide anything from the people you
invite, or from anyone they share the tree or a downloaded copy with.
Every one of them sees every note. A private tree is a smaller
audience, not a safe place for things you wouldn't tell them.
