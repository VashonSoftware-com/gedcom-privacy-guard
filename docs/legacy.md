# Using it with Legacy Family Tree

The tool reads any GEDCOM, but it started with Legacy Family Tree, and a
few Legacy features affect how you use it. This page summarizes them in
our own words. For the full instructions, see
[Legacy's help center](https://legacyfamilytree.com/help/en/).

## Exporting a file to scan

Use **File → Export → GEDCOM File** and save a `.ged` file. If the file
is going to Ancestry, choose **Ancestry Online Family Tree** as the
export type.

Avoid the one-click **Upload to Ancestry** toolbar button. It sends your
tree straight to Ancestry with no file in between, so there is nothing
to scan.

The export dialog has its own **Privacy** options. They can hide living
people and text you've marked private, but they don't read your notes.
Use them alongside this tool, not instead of it.

## Marking text private

In any Legacy field, highlight text and press **Ctrl-P**. Legacy wraps
it in double square brackets, `[[like this]]`, and can leave bracketed
text out of reports and exports. See Legacy's post
[Legacy 101: Privacy](https://legacyfamilytree.com/blog/2018/02/legacy-101-privacy/).

This tool's `privatize` action writes the same `[[ ]]` markers, so a
privatized note means the same thing to Legacy as one you marked by
hand. Two cautions:

- **The brackets only work inside Legacy.** Ancestry, FamilySearch and
  most other sites show the text, brackets and all. A file that has
  been through `privatize` must go back into Legacy (below) before you
  upload it anywhere else.
- **The scanner flags existing `[[ ]]` text** for the same reason: if
  you upload a raw export directly, those markers protect nothing.

## Bringing cleaned notes back into Legacy

Legacy can't update existing people from a GEDCOM. An import always
adds people, so this tool never writes back to your Legacy file (see
[ADR-003](adr/003-reject-automated-reimport.md)). Legacy's merge tools
offer a guided way to do it by hand:

1. Import `cleaned.ged` into a **new, separate** Legacy family file.
2. Make a backup of your main family file.
3. Use **Find Duplicates** to match people between the two files, then
   **Manual Merge** to compare each pair field by field and keep the
   cleaned note.
4. Export from your main file as usual.

Don't use **AutoMerge** for this. It only merges exact duplicates, and
a cleaned note is, by design, not an exact duplicate.

This workflow hasn't yet been tested end to end on a real file. If you
try it, please open an issue saying how it went.

## Old formatting codes in notes

Notes from older versions of Legacy can contain codes such as
`«b»bold«/b»` or `«i»italic«/i»`. They don't stop the scanner finding a
word: `«b»alcoholism«/b»` is still flagged. A test checks this.

## Garbled names and places

The tool passes names and places through unchanged. If a place looks
wrong in the report, the error came from Legacy, not from this tool.

A common cause is Legacy's automatic capitalization. When it is set to
**Initial Caps**, short words that look like state or province codes
can be capitalized: `Pla de Manlleu` becomes `Pla DE Manlleu`
(Delaware), and `la` becomes `LA` (Louisiana). Fix these once in
**View → Master Lists → Location**, and every record that uses the
place is corrected.

## Living people and the Potential Problems report

Legacy's **Potential Problems** report is a data-quality check. Among
much else, it warns about anyone recorded as dying after age 120 (the
age limit is adjustable). See
[Legacy 101: Potential Problems](https://legacyfamilytree.com/blog/2018/04/legacy-101-potential-problems/).

It doesn't warn about the case that matters for privacy: someone with
no death date, born less than 120 years ago, who may still be alive.
The planned living-person warning (see `ROADMAP.md`) fills that gap,
using the same 120-year default.

Running Potential Problems before a scan is worthwhile. Cleaner names
and dates make it easier to tell people apart in the review
spreadsheet.
