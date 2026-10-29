# ADR-008: Time windows: 110-year proof, 1-year recently deceased, 3-year ID-theft

**Status:** Accepted
**Date:** 2026-10-25
**Deciders:** Project owner

## Context

Three time limits decide what a public page may show. Other platforms
differ: FamilySearch and Ancestry treat a person as deceased-and-public as
soon as a death is recorded (0 years); the Social Security Death Master File
withholds new deaths for 3 years to deter identity theft.

## Decision

- **110 years**: with no death, burial or cremation record, a person counts
  as dead only if an event (theirs, a parent's or a child's) is old enough.
- **1 year recently deceased**: for a year after death, the public site
  shows only the name and a hand-written story. Chosen by the project owner
  on 18 Oct 2026 (earlier drafts used 20, then 10).
- **3-year ID-theft window**: a separate check. For 3 years after death,
  public pages show birth year only and hide birthplace, mother's maiden
  name, last address and ID numbers.
Each family sets its own values; these are the `cautious` preset.

## Options Considered

### Recently deceased: 0 years (FamilySearch, Ancestry)

Full facts public at once. Simple and conventional, but exposes details while
grief and identity-theft risk are highest.

### Recently deceased: 10 or 20 years

Very safe, but hides the stories the site exists to share, for a long time.

### Recently deceased: 1 year (chosen)

Deliberately more cautious than the big sites at small cost, because the
public page already shows only a name and a story during that year.

### One window for everything vs. a separate ID-theft window (chosen: separate)

Identity risk depends on specific fields, not on the whole page. A separate
3-year check matches the Death Master File's reasoning without hiding stories.

## Consequences

- `genealogy.config.json` `recentlyDeceasedYears: 1` and `provenDeadYears: 110`
  are the current values; the ID-theft check is still to build.
- Changing a window means editing `docs/PRIVACY-RULES.md`, this ADR (or a
  superseding one) and the config together.
