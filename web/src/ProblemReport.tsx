// "Copy a problem report" (ROADMAP): plain text about the page and the
// file's shape, which the tester reads and pastes into a GitHub issue
// themselves. Nothing is sent from here. It holds no names, notes, places,
// dates or file names: only what file_facts allows, counts and our own
// warning messages (which give line numbers, never text from the file).

import { useState } from "react";
import type { ScanResult } from "./engine/protocol";

const NEW_ISSUE = "https://github.com/VashonSoftware-com/gedcom-privacy-guard/issues/new?template=problem.yml";

export interface ReportInput {
  scan: ScanResult | null;
  error: string;
  fileSize: number;
  seconds: number | null;
}

const n = (x: number) => x.toLocaleString("en-US");
const list = (counts: Record<string, number> | [string, number][]) =>
  (Array.isArray(counts) ? counts : Object.entries(counts)).map(([k, v]) => `${k} ${n(v)}`).join(", ") || "none";

export function problemReport({ scan, error, fileSize, seconds }: ReportInput): string {
  const out = [
    "GEDCOM Privacy Guard problem report",
    "",
    `Version ${__APP_VERSION__}, build ${__BUILD_SHA__.slice(0, 7)} (${__BUILD_DATE__})`,
    `Browser: ${navigator.userAgent}`,
    `Installed as an app: ${matchMedia("(display-mode: standalone)").matches ? "yes" : "no"}; online: ${navigator.onLine ? "yes" : "no"}`,
  ];
  if (fileSize)
    out.push(`File size: ${fileSize < 1e6 ? `${n(Math.ceil(fileSize / 1e3))} KB` : `${(fileSize / 1e6).toFixed(1)} MB`}`);

  if (scan) {
    const f = scan.facts;
    const name = f.program_name && f.program_name !== f.program ? ` (${f.program_name})` : "";
    out.push(
      "",
      "File",
      `  Made by: ${f.program || "not given"}${name}, version ${f.program_version || "not given"}`,
      `  GEDCOM version: ${f.gedcom_version || "not given"}`,
      `  Characters: says ${f.declared_charset || "nothing"}, read as ${f.read_as}` +
        `${f.bom ? " (with BOM)" : ""}; line endings ${f.line_ending}`,
      `  Lines: ${n(f.lines)}`,
      `  Records: ${list(f.records)}`,
      `  Custom tags (${f.custom_tag_kinds} ${f.custom_tag_kinds === 1 ? "kind" : "kinds"}): ${list(f.custom_tags)}`,
    );

    const severities: Record<string, number> = {};
    const categories: Record<string, number> = {};
    for (const r of scan.rows) {
      severities[r.severity] = (severities[r.severity] ?? 0) + 1;
      categories[r.category] = (categories[r.category] ?? 0) + 1;
    }
    out.push(
      "",
      "Scan",
      `  Took: ${seconds === null ? "?" : `${seconds.toFixed(1)} s`}`,
      `  People: ${n(scan.people)}; text checked: ${n(scan.text_fields)}; rules: ${scan.preset}`,
      `  Flagged notes: ${n(Object.keys(scan.texts).length)}; matches: ${n(scan.rows.length)} (${list(severities)})`,
      `  Matches by category: ${list(Object.entries(categories).sort((a, b) => b[1] - a[1]))}`,
    );
    if (scan.warnings.length) out.push("", "Warnings", ...scan.warnings.map((w) => `  - ${w}`));
  }
  if (error) out.push("", "Error", `  ${error}`);
  return out.join("\n");
}

export function ProblemReport(input: ReportInput) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  async function copy() {
    const report = problemReport(input);
    setText(report);
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="problem">
      <h2>Something not right?</h2>
      <p>
        Copy a short report about this page and the <em>shape</em> of your file (which program made it, how big it is,
        how many notes were flagged), then paste it into a problem report on GitHub. It has no names, notes, places or
        dates, and nothing is sent from here: you see every word before you paste it.
      </p>
      <details className="contents">
        <summary>What's in the report?</summary>
        <ul>
          <li>This page's version, and your browser and computer type</li>
          <li>Which program made your file, and its version</li>
          <li>How the file is stored: its size, character set and line endings</li>
          <li>How many people, families, sources and other records it has</li>
          <li>The names of any special tags your program added (like _UID)</li>
          <li>How many notes were flagged, in each category and severity</li>
          <li>Any warnings or error, which give line numbers but never the text on that line</li>
          <li>How long the check took</li>
        </ul>
        <p>
          <strong>Never included:</strong> names, notes, places, dates, your file's name, or anything you typed.
        </p>
      </details>
      <button onClick={copy}>Copy a problem report</button>
      {text && (
        <>
          <p>
            {copied ? "Copied. " : "Select all of the text below and copy it. "}
            Now{" "}
            <a href={NEW_ISSUE} target="_blank" rel="noreferrer">
              open a problem report on GitHub
            </a>{" "}
            and paste it in. This is exactly what you'll be pasting:
          </p>
          <textarea
            readOnly
            className="report"
            aria-label="The problem report"
            value={text}
            rows={Math.min(24, text.split("\n").length + 1)}
            onFocus={(e) => e.currentTarget.select()}
          />
        </>
      )}
    </section>
  );
}
