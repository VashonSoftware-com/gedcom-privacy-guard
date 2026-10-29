# Roadmap

One prioritized list for both release work and features:

- **P0:** before the repo goes public.
- **P1:** needed for 1.0.
- **P2:** after 1.0, worth doing.
- **P3:** only if users ask.

Each item names the gap it closes. Shipped work moves to `CHANGELOG.md`.

## Where this fits

Checked October 2026. Plenty of tools hide **living people**; none found
reads **note content** for sensitive topics.

- **Built-in export privacy** (Legacy, RootsMagic, Reunion, Gramps, Family
  Tree Maker): drops or renames living people and excludes text the user
  has already marked private (`[[ ]]` in Legacy, `{ }` in RootsMagic). None
  reads the notes to find what *should* have been marked.
- **Old standalone scrubbers** (Res Privata, GED2GO): strip living people
  and whole field types. Windows-only, and unmaintained since the 2000s.
- **Family Historian "Clean Unwanted Fields" plugin**: removes fields by
  type before upload. Family Historian only.
- **Libraries** (python-gedcom's Scrubber, R's tidyged.utils): strip
  facts, or redact living individuals. They're for developers, and they
  don't scan content.
- **General PII redactors** (Microsoft Presidio, scrubadub): find SSNs,
  phone numbers and emails in text. They don't understand GEDCOM.
- **Upload sites** (Ancestry, MyHeritage, FamilySearch, GEDmatch): hide
  living people at best. Their guidance tells users to review notes
  themselves.

**What that means for investment:**

- Don't build living-person *removal*: every program already does it. A
  cheap living-person *warning* is enough.
- The real gap is a note written about a dead person that exposes a
  living one ("her son, who is in prison"). Put effort into finding
  sensitive content, reviewed by a person, across every program.
- Borrow PII patterns rather than building detection; don't add an ML
  dependency.
- Other tools reach users through the program they already run. The
  browser version is how this one reaches people.

**Features no one else has, and some we're missing:**

- Scan *everywhere* text hides: notes on events and families, shared
  `NOTE` records, source text, `CAUS` (cause of death), media file paths.
  Today only person-level notes are scanned (P0).
- Flag text already marked private (`[[ ]]`, `{ }`). Those markers do
  nothing if the file goes straight to an upload site (P1).
- Flag the submitter record (`SUBM`: your address, phone and email) and
  local file paths in `OBJE`/`FILE` (`C:\Users\…`), which most users never
  look at (P1).
- Handle ANSEL-encoded files, which older Legacy and FTM exports use;
  today they're read as UTF-8 with replacement characters (P1).

**Lessons from Res Privata and GED2GO**, the two dedicated tools:

- **Both disappeared with their authors' websites.** Res Privata survives
  only as an archived download on a user-group site; GED2GO stopped at
  4.02 in 2007. Closed freeware dies with its author. A public repo, a
  PyPI package and a static web page survive. That's a reason to go open
  source (see "Public or private?").
- **Res Privata broke when files moved to Unicode.** It can't read UTF-8 or
  UTF-16 exports. Encoding is where these tools fail, so read UTF-8,
  UTF-16, ANSEL and either line ending, and test each one (P1).
- **Res Privata strips user-defined `_TAG`s.** Programs hide free text in
  custom tags, so scan their text too (P1).
- **Removing data must keep the file valid.** Deleting a record leaves
  dangling pointers. Today's redactor edits text in place, which is safe;
  any future "remove record" action must clean up pointers.
- **Their living-person modes (replace the name with "LIVING", or remove
  the person) are now built into every program and upload site.** That
  confirms we shouldn't build them.
- **Res Privata was free for individuals, with a fee for commercial
  use.** That's one precedent for the commercial question below.

Sources: [Res Privata (FHUG)](https://www.fhug.org.uk/kb/link/res-privata-gedcom-privatisation-3/),
[Res Privata (Genealogy Software Guide)](https://genealogysoftwareguide.com/windows-r/res-privata/),
[Cyndi's List: privacy software](https://www.cyndislist.com/software/privacy/),
[Cyndi's List: Privacy in GEDCOM files](https://www.cyndislist.com/gedcom/privacy-in-gedcom-files/),
[RootsMagic: exporting data](https://help.rootsmagic.com/RM9/exporting-data.html),
[RootsMagic Community: privacy and the Living checkbox](https://community.rootsmagic.com/t/privacy-and-the-living-checkbox-for-a-person/11663),
[Family Historian: Clean Unwanted Fields](https://pluginstore.family-historian.co.uk/?p=2891),
[python-gedcom utilities](https://python-gedcom.readthedocs.io/en/latest/gedcom.utilities.html),
[tidyged.utils redaction](https://jl5000.r-universe.dev/tidyged.utils/doc/redaction.html),
[FamilySearch: GEDCOM to Family Tree](https://www.familysearch.org/help/helpcenter/article/how-do-i-copy-information-from-my-gedcom-file-into-family-tree),
[Gramps: GEDCOM export of confidential people](https://gramps.discourse.group/t/gedcom-export-of-confidential-people/7993).

## Public or private?

Decide before P1 ends. The reasons to keep the repo private, weighed:

- **To prevent hacking: no.** The tool runs on the user's own computer, with
  no server, accounts or secrets. Its attack surface is a hostile GEDCOM or
  spreadsheet, and an attacker can probe that with any copy, public source
  or not. Hiding the code mostly hides bugs from the people who would
  report them. The real risk of going public is leaking *our* data in the
  repo or its history, and P0 handles that.
- **To sell it: possible, but this isn't the product.** Genealogists rarely
  pay for small utilities, and a closed tool would follow Res Privata into
  obscurity. These ways to earn from it don't need closed code:
  - signed Windows and Mac installers;
  - the optional LLM scanner as a paid hosted add-on;
  - support or a branded setup for genealogy societies;
  - GitHub Sponsors.
  Res Privata's "free personal, paid commercial" model needs a
  source-available license (e.g. PolyForm Noncommercial). That isn't open
  source, and it would deter contributors.
- **To stop others profiting from it:** MIT lets anyone, including a
  company, ship a closed fork. If that matters, switch to GPL or AGPL now,
  before anyone else contributes (relicensing later needs every
  contributor's consent).
- **Because it isn't ready:** that's what P0 and P1 are for, not a reason to
  stay private.

**Decision:** go public under MIT once P0 is done, as a beta, and tag 1.0
once testers have tried it (John, 29 Oct 2026). Brand it as a Vashon Software
project with cornelisons.com as the reference site. Its value is
reputation, a portfolio piece and an audience for the blog posts. Keep any
paid add-on in a separate repo.

## Done

- Toolchain: `pyproject.toml` + `uv`, ruff, pytest, pre-commit (gitleaks,
  a hook blocking `.ged` files), CI on three OSes, `pip-audit`, Dependabot,
  SHA-pinned actions. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#toolchain).
- Real data kept in gitignored `private/`.
- Personal paths and references removed from tracked docs; cornelisons.com
  is credited as the reference site. `LICENSE` names Vashon Software.
- Rules loaded with `yaml.safe_load`; one `rules.yaml`, swappable with
  `--rules`.

## Next session

P0 is done except the steps that need the repo to be public. Engine
work for P1 is done and tested (161 tests, including Hypothesis
fuzzing; a 192k-person real export scans in ~37 s). The rules editor
and the 1.0 docs are done (29 Oct 2026). The release workflow, the
"why your data is safe" page with its no-network tests, and the
testers page ([`docs/help-wanted.md`](docs/help-wanted.md)) are done
too (29 Oct 2026). Left, in order: going-public steps with John, as a
beta (see "Going public") → real exports from other programs (at least
RootsMagic, Gramps and Ancestry, made up per the recipe in
help-wanted.md), sent in through the issue templates → the 15-minute
exit test with someone new → bump to 1.0.0 and release the CHANGELOG.
README links are absolute, so they work on PyPI (29 Oct 2026).
`v0.4.0b1` is on PyPI via trusted publishing (29 Oct 2026).
Testers can't use a terminal, so the web version moved ahead of the
announcement (John, 29 Oct 2026; ADR-010): it runs the Python engine
in the browser with Pyodide and works end to end locally, including a
192k-person export (~95 s). Next: deploy it to
`gedcom.vashonsoftware.com` (Cloudflare Pages), then announce to
testers with that link instead of `pipx`.

## P0 — Before the repo goes public

Safety and honesty. A privacy tool that leaks, or that silently skips
notes, does harm.

- [x] **Audit git history** with `gitleaks detect` and by eye (29 Oct
      2026). No secrets and no family data (every surname in the real
      export was checked against history). But history holds the
      author's local paths and verbatim Legacy Help text, so **publish
      from a fresh squashed history** (see "Going public" below).
- [x] **Replace verbatim Legacy Help** (copyrighted) with our own
      summary, [`docs/legacy.md`](docs/legacy.md), linking to Legacy's
      online help. The verbatim copies are in gitignored
      `private/reference/`.
- [x] **Spreadsheet formula injection:** GEDCOM values starting with `=`,
      `+`, `-`, `@`, tab or CR become live formulas in `review.xlsx`.
      Escape them in `report.py`, with a test.
- [x] **Validate FamilySearch and Find a Grave IDs** before building URLs
      (`report.py`). Anything unexpected leaves the column blank.
- [x] **Never overwrite inputs:** `redact` refuses an `--out` that resolves
      to the input GEDCOM or the report.
- [x] **Scan every text location** listed above. Until each one is done,
      the report says which locations it skipped.
- [x] `SECURITY.md`: report privately, don't send real family files,
      and what counts as a vulnerability.
- [x] Public as `0.4.0b1` from one squashed commit, with private
      vulnerability reporting on (29 Oct 2026).
- [x] Branch protection on `main`: ruleset "Protect main" blocks
      deletion and force-push and requires a PR; admins can bypass
      (29 Oct 2026).
- [x] Require 2FA for the org (John, 29 Oct 2026).

### Going public (needs John)

Decided 29 Oct 2026: public under MIT, as a Vashon Software project,
published from a squashed history. Go public as a beta once P0 is done,
so testers can use the issue templates and `pipx install`; 1.0 follows
once tested (John, Q-PG-07 via Q-VS-10). Order: bump to a beta version
(e.g. `0.4.0b1`) and update the CHANGELOG → squash history into one
commit on a fresh branch (or a new repo) → push → make public → turn on private
vulnerability reporting and branch protection (neither is available on
a private repo on the free plan) → confirm 2FA is required for the org
→ create a `pypi` environment on GitHub (Settings → Environments, John
as required reviewer) → on PyPI, add a pending trusted publisher
(owner `VashonSoftware-com`, repo `gedcom-privacy-guard`, workflow
`release.yml`, environment `pypi`) → tag the beta and publish it to
PyPI → announce to testers. Done through PyPI; the `pypi`
environment has John as reviewer and allows `v*` tags only (29 Oct 2026).

## P1 — 1.0

**Exit test:** a genealogist who has never seen the repo installs it,
scans their own export and produces a cleaned file in under 15 minutes
from the README alone. Then tag `v1.0.0` (the repo is already public as
a beta by then).

Install and robustness:

- [x] Publish to PyPI with trusted publishing (no API tokens), so it's
      `pipx install gedcom-privacy-guard`. `0.4.0b1` published 29 Oct
      2026 (`.github/workflows/release.yml`, `pypi` environment).
- [x] **"Why your data is safe"** ([`docs/safety.md`](docs/safety.md)),
      backed by `tests/test_no_network.py` (29 Oct 2026).
- [x] **Testers page** ([`docs/help-wanted.md`](docs/help-wanted.md))
      with a made-up family to export from each program, and *Sample
      export* / *Tried it* issue templates (29 Oct 2026).
- [x] Read UTF-8, UTF-16, ANSEL and either line ending, and scan text in
      custom `_TAG`s.
- [x] Fuzz the parser (Hypothesis): huge lines, deep `CONC` chains, bad
      levels, BOMs, each encoding, an empty file. It should fail with a clear
      message, never a traceback.
- [ ] Test real exports from RootsMagic, Family Tree Maker, Gramps and
      Ancestry, not only Legacy.

Ancestry users (the biggest audience, and the main upload target):

- [x] **Docs for people whose tree lives on Ancestry**
      ([`docs/exporting.md`](docs/exporting.md); still to check on a
      real export whether notes come through). Download it as a
      GEDCOM (Trees → Tree Settings → Export tree). The file has no
      media, and reports differ on whether notes come through, so check
      a real export. Then **fix the flagged notes on Ancestry itself**,
      using the report as a to-do list, rather than running `redact`.
      Uploading `cleaned.ged` creates a *new* tree and loses hints, DNA
      matches, photos and shared access. Family Tree Maker users with
      TreeSync can fix the notes in FTM and sync instead.
- [x] **Say plainly what a private tree doesn't cover.** Making an
      Ancestry tree private hides it from search, but invited relatives
      and anyone the file is shared with still see every note.

Detection (the differentiator):

- [x] Flag text already marked private (`[[ ]]`, `{ }`), with a note on
      which programs honor the markers.
- [x] Flag the `SUBM` record and local paths in `OBJE`/`FILE`.
- [x] PII patterns: SSNs, phone numbers, emails, street addresses.
- [x] Whole-word matching and exceptions, so "the Great Depression" stops
      matching `depression`.
- [x] Plural exceptions: exceptions take the term `*` syntax, so
      `prison camp*` covers "WWII prison camps" (29 Oct 2026).

Adjustable rules (so families can set their own line):

- [x] Presets `open` / `standard` / `cautious` (per
      [`docs/PRIVACY-RULES.md`](docs/PRIVACY-RULES.md)), with the user's
      changes saved as overrides, so later improvements to the built-in
      rules still apply.
- [x] Per category on/off and severity; per term add/remove and
      whole-word or substring; exceptions; schema validation with plain
      messages.
- [x] **Rules editor**: one offline HTML page. It shows categories with a
      toggle and severity picker, terms as removable chips, a preset
      dropdown, and a box to test a pasted note. Load and Save read and
      write the rules file. No server, and nothing leaves the computer.
      It later becomes the web version's first screen. Done 29 Oct 2026
      in `gedcom_privacy_guard/editor/`; `tests/test_editor.py` runs its
      JavaScript under Node against the Python scanner.

Docs, short and accurate (genealogists first, developers second):

- [x] **How it decides what to flag**: one plain page
      ([`docs/how-it-works.md`](docs/how-it-works.md), 29 Oct 2026). It's word lists
      (whole word, prefix, or anywhere), exceptions, regex patterns for
      SSNs/phones/emails/addresses/paths, structural checks (submitter
      record) and presets. It doesn't understand meaning: show an
      example it catches and one it misses. Link it from the README, and
      update `docs/ARCHITECTURE.md` (it still describes the old
      regex-per-rule scanner and says no profiling was done).
- [x] **ADR-009: rules file format** (built-ins plus overrides, presets,
      term modes), referenced from `rules.py`.

- [x] README is about one screen: what it does, a screenshot, install, the
      scan → review → redact loop, limitations. Move the Legacy walkthrough
      to `docs/legacy.md` and replace `requirements.txt` with the
      `pyproject.toml` install.
- [x] A few lines per program on exporting a GEDCOM
      ([`docs/exporting.md`](docs/exporting.md)).
- [x] Say plainly that keyword matching misses things, that it never
      decides for you, and that it passes names and places through
      unchanged (a garbled place came from the source program).
- [x] `CONTRIBUTING.md` (tests, adding a rule), plus issue templates for
      "false positive" and "missed something".

## P2 — After 1.0

- [x] **Web version** (ADR-004/005/010), moved up for testers: the
      Python engine runs in the browser with Pyodide, every file is
      served from our own site, and a strict CSP blocks other network
      calls (29 Oct 2026). Left: deploy to `gedcom.vashonsoftware.com`;
      offline support (PWA); try it on an iPad.
- [ ] **Living-person warning:** flag people with no death date and a
      birth year implying a living person (default 120 years, matching
      Legacy). A warning only; removal is left to the source program.
- [ ] **False positive to exception in one step**: mark a report row and
      the rules file learns it.
- [ ] **Consider fuzzy matching**, so misspellings common in old notes
      ("alchoholic", "seperated") still match. Weigh it against more
      false positives; if adopted, make it a per-term mode like whole
      word and prefix, off by default.
- [ ] **Easy term suggestions from users**: a "Suggest terms" button in
      the rules editor that opens a prefilled GitHub issue (terms,
      category, an example sentence, no tree data), building on the
      "missed something" template from P1. Accepted terms ship in the
      next release.
- [ ] **Term libraries that layer**: optional category packs (slavery
      and enslaved people, medical, church and religion, legal and
      court) that users switch on and stack on top of a preset, with
      their own overrides still applied last. Accept new packs as
      community contributions. Covered by the ADR-009 file format, or
      a follow-up ADR.
- [ ] Shared policy file (ADR-007) read by this tool and other site
      builds.
- [ ] Guided reimport through Legacy's Find Duplicates and Manual Merge
      (ADR-003), once verified end to end.

## P3 — Only if users ask

- [ ] **LLM scanner** with adjustable sensitivity: catches implied
      disclosures that keywords miss. Needs its own ADR first (where the
      profile lives, how its scores combine with keyword severities). It
      must stay optional and off by default, since it sends text off the
      machine.
- [ ] **Diff mode:** report only notes that are new since the last scan.
- [ ] **Ancestry person links** in the report, so each row opens the
      person to fix. Only if real Ancestry exports carry the tree and
      person IDs (check when testing an Ancestry export).
- [ ] **MCP server**, so an AI assistant can run a scan and walk the
      user through the findings. The wrapper is small, but anything it
      returns goes to the AI provider, breaking "nothing leaves your
      computer". If built, return categories, locations and record IDs
      by default (no note text), keep it a separate optional install,
      and decide it in the same ADR as the LLM scanner. Few
      genealogists run MCP clients today, so wait for demand; it's a
      good demo for the developer blog post either way.

## Blog posts

The same story, told for three audiences:

1. **vashonsoftware.com, for developers:** a short series, "A privacy
   tool that refuses to decide for you," on the design decisions behind
   the tool. The series outline lives in the vashonsoftware.com blog
   plan (series C); dev.to copies point back to it.
2. **cornelisons.com, for families:** "How we checked our tree before
   putting it online." A first-person account of the family-site
   rollout: what turned up in the notes (anonymized), and how the family
   agreed what stays private.
3. **cornelisons.com, for genealogists in general:** "What your family
   tree notes say about the living." The problem first, then the tool.
   This is the one to pitch to newsletters and forums.

**When:** the posts that make no safety claims and need no repo link
(series parts 2 and 3) can go out any time. Part 1 ("never auto-delete")
waits until the repo is public as a beta, so its links work and its
claims are enforced in code. The launch post goes out at 1.0, with the
outreach below.

## Outreach

Post once per venue, leading with the problem. Read each venue's
self-promotion rules first.

- **r/Genealogy**: lead with the genealogist post.
- **Legacy Family Tree user groups and forums**: the best fit, since the
  tool started there.
- **RootsMagic Community forum**: once RootsMagic exports are tested.
- **WikiTree G2G**: privacy of the living is a frequent topic there.
- **Cyndi's List**: submit a link to its GEDCOM privacy page, the first
  place people look.
- **Genealogy newsletters and podcasts**: a short announcement with the
  genealogist post.
- **GitHub "awesome-genealogy" lists**: open a pull request adding it.
- **Hacker News (Show HN), r/Python**: pair with the developer post.

**Success looks like:** outside users opening "false positive" and
"missed something" issues, and at least one rule contributed by someone
else.
