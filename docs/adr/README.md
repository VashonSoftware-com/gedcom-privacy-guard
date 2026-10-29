# Architecture Decision Records

| # | Title | Status |
|---|---|---|
| [001](001-human-reviewed-flagging.md) | Human-reviewed flagging, never automated deletion | Accepted |
| [002](002-privatize-at-source.md) | Privatize at the source (Legacy), not only at export time | Accepted |
| [003](003-reject-automated-reimport.md) | Reject automated reimport/merge into Legacy | Accepted |
| [004](004-dual-track-platform-architecture.md) | Dual-track architecture — Python CLI + browser-based web app | Accepted |
| [005](005-web-stack-and-hosting.md) | Web track stack — React + TypeScript + Vite → Cloudflare Pages | Accepted |
| [006](006-xlsx-review-report-with-highlighting.md) | Switch review report from CSV to XLSX for rich-text highlighting | Accepted |
| [007](007-shared-privacy-rules.md) | One privacy rules document and policy file, shared with family site builds | Accepted |
| [008](008-time-windows.md) | Time windows: 110-year proof, 1-year recently deceased, 3-year ID-theft | Accepted |
| [009](009-rules-file-format.md) | Rules file format: built-ins plus overrides, presets, term modes | Accepted |

The rules themselves, with their reasons, are in [`../PRIVACY-RULES.md`](../PRIVACY-RULES.md).

New decisions get a new numbered file here, following the format in
`/mnt/skills/plugins/engineering:architecture/SKILL.md` (Context /
Decision / Options Considered / Trade-off Analysis / Consequences /
Action Items). Supersede, don't silently edit — if a later decision
reverses an earlier one, mark the old ADR's Status as `Superseded by
ADR-00X` rather than deleting it.

## Not yet decided (future ADR candidates)

- **AI-based scanning with user-adjustable sensitivity** — see the P3
  item in [`ROADMAP.md`](../../ROADMAP.md). Deliberately not an ADR yet:
  no decision has been made on storage, scope (global vs. per-category),
  or how it reconciles with keyword-based severity. Write an ADR when
  this is actually picked up, not before.
