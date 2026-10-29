# Why your data is safe

GEDCOM Privacy Guard runs entirely on your own computer. It reads the
file you name and writes two files next to it: `review.xlsx` and
`cleaned.ged`. It has no server, no account, no updates that phone home
and no usage tracking. Your tree is never uploaded anywhere.

## How we make sure

No one can honestly *guarantee* software. What we can do is make the
claim easy to check, and check it ourselves on every change:

- **There's no network code in it.** An automated test reads every
  file of the program and fails if any of them uses anything that can
  reach the internet or start another program.
- **It's run with the network blocked.** Another test does a full scan,
  review and redact with Python's own monitor switched on. The test
  fails if anything tries to open a connection, look up a web address
  or start another program, including inside the two libraries it relies on
  (PyYAML, which reads the rules file, and openpyxl, which writes the
  spreadsheet).
- **The rules editor is locked down.** The editor page tells your
  browser to refuse every network request (its *Content Security
  Policy*), and its code is bundled with it, not loaded from the web.
- **Those tests run on Windows, macOS and Linux** for every change. A
  change that broke this promise couldn't be merged unnoticed.
- **You can match what you install to the public code.** Each release
  on PyPI is built by GitHub from this repository and carries a signed
  record of the exact commit it came from. Nobody's laptop is involved.

## Check it yourself

- **Turn off Wi-Fi** (or unplug the network cable) after installing,
  then scan and redact. Everything works the same.
- **Read the code.** It's open source and short: about 2,000 lines of
  Python, plus the editor page, in
  [`gedcom_privacy_guard/`](../gedcom_privacy_guard/). The safety tests are in
  [`tests/test_no_network.py`](../tests/test_no_network.py).

## Where your data *can* still go

The program keeps your notes on your computer. These are the ways they
could leave it anyway, and none of them is the program's doing:

- **`review.xlsx` is as private as your tree.** It quotes every
  flagged note. Don't email or share it. Delete it once you've made
  `cleaned.ged`, unless you want to keep it for the next scan.
- **Synced folders upload whatever you save.** If you work in a folder
  that OneDrive, Dropbox, iCloud or Google Drive syncs, your GEDCOM and
  the review spreadsheet go to that service, just as any file there
  would. Excel's AutoSave also uses OneDrive. Use a folder that isn't
  synced if that matters to you.
- **Links in the spreadsheet open websites when you click them.** The
  FamilySearch and Find a Grave columns link to those sites, and your
  browser only visits one when you click.
- **Installing downloads the program, not your data.** `pipx install`
  fetches the program from PyPI once. After that it never connects.
- **Uploading `cleaned.ged` is up to you.** That's the point of the
  tool: you decide what's in the file before you upload it.

## If you find a leak

Report it privately; see [SECURITY.md](../SECURITY.md). Anything that
makes the program send data, read files you didn't name, or leave text
in `cleaned.ged` that you asked to remove counts as a vulnerability.
