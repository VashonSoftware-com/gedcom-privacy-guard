# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue. Use
GitHub's private reporting: open the repository's **Security** tab and
choose **Report a vulnerability**
([direct link](https://github.com/VashonSoftware-com/gedcom-privacy-guard/security/advisories/new)).

Include the version (`gedcom-privacy-guard --version`), your operating
system, and the smallest file that shows the problem. **Don't send a
real family file.** Build a small made-up one, or replace names and
notes with placeholder text first.

We aim to reply within a week. Once a fix is released, we'll credit you
in the changelog unless you ask us not to.

## Supported versions

Only the latest release gets security fixes.

## What counts

The tool runs on your own computer. It has no server, no accounts and
no network access, so the risk comes from the files it reads. Please
report anything where a GEDCOM, rules file or review spreadsheet can:

- run code, or put a live formula into the review spreadsheet;
- read or write files other than the ones you named;
- overwrite your original GEDCOM or report;
- leave flagged text in the cleaned file when the report said to remove
  it;
- crash the tool or make it hang.

A sensitive note the scanner fails to flag is a missed detection, not a
vulnerability. Please open a public "missed something" issue for those,
using made-up text.
