// Messages between the page and the engine worker.

/** One flagged match, as gedcom_privacy_guard.report.build_rows makes it. */
export interface Row {
  xref: string;
  name: string;
  birth?: string;
  death?: string;
  parents?: string;
  spouses?: string;
  familysearch_url?: string;
  findagrave_url?: string;
  found_in: string;
  line: number;
  line_end: number;
  category: string;
  severity: string;
  matched_term: string;
  snippet: string;
  match_at: number;
  action: string;
}

export interface ScanResult {
  people: number;
  text_fields: number;
  preset: string;
  warnings: string[];
  rows: Row[];
  /** Full text of each flagged field, keyed by its line number. */
  texts: Record<string, string>;
}

export interface RedactStats {
  redacted: number;
  rewritten: number;
  masked: number;
  privatized: number;
  kept: number;
}

export type Request = { type: "scan"; bytes: Uint8Array } | { type: "redact"; rows: Row[] };

export type Response =
  | { type: "status"; text: string }
  | { type: "ready" }
  /** How far a scan has got, from 0 to 1, and what it's doing. */
  | { type: "progress"; fraction: number; stage: string }
  | { type: "error"; message: string }
  | { type: "scanned"; result: ScanResult; report: Uint8Array }
  | { type: "redacted"; stats: RedactStats; cleaned: Uint8Array };
