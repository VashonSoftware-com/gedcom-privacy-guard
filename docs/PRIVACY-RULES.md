# Privacy and sensitivity rules

**This is the one place to edit these rules and their reasons.** GEDCOM Privacy
Guard (this repo) and any family website built on it follow it; a site's
public privacy page should be a plain-English summary of it. Change a rule
here first, then update the code and the page to match. Decisions with real
trade-offs get an ADR
([ADR-007](adr/007-shared-privacy-rules.md), [ADR-008](adr/008-time-windows.md)).

These rules were first worked out for the Cornelison family site,
[cornelisons.com](https://cornelisons.com), the reference site below.
GEDCOM Privacy Guard is a [Vashon Software](https://vashonsoftware.com)
project.

Status (25 Oct 2026): the rules are written down; the shared policy *file*
that the engine and a site build will both read (presets, per-family values,
per-person overrides) is planned, not built. Until then this engine's values
live in [`rules.yaml`](../gedcom_privacy_guard/rules.yaml) and the reference
site keeps its own copy in its build configuration.

## Why the rules exist

A family history site is for the family's kids to read, copy and keep for
their own use over the next 10 to 20 years. Share generously inside the
family; protect living people; keep the warning attached to sensitive
material wherever it is copied. Publishing more widely (a book, a public
site) needs a complete new review, not a flag change.

## Levels

Rules come in three layers, so another family can reuse the engine by
changing a line or two:

1. **Preset**: `open`, `standard` or `cautious` (table below).
2. **Family values**: `extends: <preset>`, then any overrides.
3. **Per person**: self-redactions and approved retractions, keyed by
   GEDCOM ID. An override can narrow who sees something; it can never make a
   living person public.

| Setting | `open` | `standard` | `cautious` (reference site) |
|---|---|---|---|
| No death record: dead only if an event is older than | 110 years | 110 years | 110 years |
| Recently deceased window (public: name and story only) | 0 years | 1 year | 1 year |
| ID-theft window (public: hide identity fields) | 0 years | 3 years | 3 years |
| Sensitive categories default circle | family | cousins1 | cousins1, review required |
| Living people | opt-out | opt-out | opt-out (consent assumed; self-redaction honored) |

A reused or commercial version should default living people to **opt-in**:
nothing shows until the person agrees.

## Audiences (circles)

`public` · `family` · `cousins2` · `cousins1` · `immediate`, widest first;
each circle also sees the wider circles' material. `private` and `sealed`
exist only in working files and are never built into any site.

## Rules and reasons

**Living or dead.** A person is dead only on evidence: a death, burial or
cremation record, or an event (theirs, a parent's or a child's) old enough
that they can't be alive. No evidence means living.
*Why:* trees are full of people with no death record who are still alive;
guessing "probably dead" is how living people leak.

**Living people.** Never public, not even as a name in a list. Family circles
only. Consent is assumed within the family (the reference site's choice;
see the opt-in note above); anyone may **hide their own
details** (honored at the next build, reviewed after) and **suggest** a
retraction about someone else (reviewed first).
*Why:* the people affected should control their own data without having to
argue for it.

**Recently deceased** (1 year). The public site shows the name and a
hand-written story only; family circles see full facts.
*Why:* FamilySearch and Ancestry use 0 years. The reference site is deliberately
more cautious because the year after a death is when relatives are most
affected, and the public page is already reduced to a name and a story, so
the cost is small. See ADR-008.

*No death year:* someone known to be dead but with no death date is treated
as recently deceased, unless their own earliest event is more than 110 years
old or **any child's** earliest event is more than **130 years** old; then
they count as long dead.
*Why:* a parent whose child was born 130+ years ago cannot have died within
the last year in any realistic case, and many older records give burial or
death evidence without a year (decided 25 Oct 2026).

**ID-theft fields** (3 years, a separate check). For anyone who died within
the window, public pages show birth *year* only and hide birthplace,
mother's maiden name, last address and any ID number.
*Why:* the Social Security Death Master File withholds new deaths for 3
years for this reason; those fields are what identity thieves use. Not yet
built.

**Health history.** Deceased relatives: recorded accurately with a
certainty and a source; family circles only (`cousins1` for frank history
such as addiction or mental illness); never public without the family
reviewer's approval. Living people: a hook only. The person themself is the
only source, can withdraw it at any time, and others can only suggest. Never
stored in git.
*Why:* hereditary health is genuinely useful to descendants, but it is the
most damaging thing to leak.

**Other sensitive facts about the deceased**: adoption, birth outside
marriage, crime, suicide. Default `cousins1`, review required. A per-person
`commonKnowledge` override may widen it.
*Why:* publishing these can hurt living relatives even when the subject is
long dead; within the family they are often already known.

**DNA.** Not used. Kept as a disabled category so the rule exists: private
by default.
*Why:* a DNA result reveals relatives who never agreed to share it.

**Photos.** Living people in a photo need their consent before it goes beyond
the immediate family. Anyone submitting a photo or story confirms they have
the right to share it and allows the site to show it to the circles chosen,
and can ask for it to be taken down. Newspaper, agency and commercial-studio
photos are linked or cited rather than reposted. Images copied onto a site
have their EXIF/XMP/IPTC metadata (including GPS) stripped.
*Why:* family snapshots are usually owned by the photographer's heirs (the
family); press archives and portrait studios do enforce their rights.

**Labels survive copying.** Every family-only passage begins with a visible
text label (e.g. "Family only (1st cousins):"), not CSS-only styling, and
family builds carry a "please don't repost" banner at the top and bottom of
each page, kept in print.
*Why:* copied text loses styling and hidden markup; the warning has to be
part of the words. Not yet built.

**Corrections and takedowns.** Every page links to a way to suggest a change.
Requests marked *privacy* go to the family reviewer at once and get a reply
within 7 days.
*Why:* the National Genealogical Society's standards expect a published way
to ask for a fix or removal.

## Where each rule is enforced

| Rule | Reference site | This engine |
|---|---|---|
| Living or dead, recently deceased | build check (the build fails on a breach) | not yet (roadmap: living-person warning) |
| Sensitive text in notes | notes are never copied from the GEDCOM | `rules.yaml` keyword scan, human review |
| Circles | site build | — |
| Photo metadata | stripped by the site build | — |
| ID-theft fields, labels, policy file | planned | planned |
