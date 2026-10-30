import { useEffect, useMemo, useRef, useState } from "react";
import type { RedactStats, Request, Response, Row, ScanResult } from "./engine/protocol";
import { Features, HowItWorks, Offline } from "./Landing";
import { Progress } from "./Progress";

const PROJECT = "https://github.com/VashonSoftware-com/gedcom-privacy-guard";

type Choice = "keep" | "redact" | "mask" | "rewrite" | "privatize";

/** All matches in one text field: the page asks once per field. */
interface Group {
  line: number;
  text: string;
  rows: Row[];
  choice: Choice;
  rewrite: string;
}

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function groupRows({ rows, texts }: ScanResult): Group[] {
  const byLine = new Map<number, Group>();
  for (const row of rows) {
    const g = byLine.get(row.line) ?? { line: row.line, text: texts[row.line], rows: [], choice: "keep", rewrite: "" };
    g.rows.push(row);
    byLine.set(row.line, g);
  }
  return [...byLine.values()];
}

/** The whole note, with every flagged word or phrase highlighted. */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const escaped = [...new Set(terms)]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")); // phrases may wrap lines
  if (!escaped.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

export default function App() {
  const worker = useRef<Worker | null>(null);
  const [status, setStatus] = useState("Getting ready…");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [report, setReport] = useState<Uint8Array | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [legacy, setLegacy] = useState(false);
  const [done, setDone] = useState<RedactStats | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ fraction: number; stage: string } | null>(null);
  // The worker's handler is set once, so it reads the file name from here.
  const fileNameRef = useRef(fileName);
  fileNameRef.current = fileName;

  useEffect(() => {
    const w = new Worker(new URL("./engine/worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<Response>) => {
      const msg = e.data;
      if (msg.type === "status") setStatus(msg.text);
      else if (msg.type === "ready") setReady(true);
      else if (msg.type === "progress") setProgress({ fraction: msg.fraction, stage: msg.stage });
      else if (msg.type === "error") {
        setError(msg.message);
        setBusy(false);
        setProgress(null);
      } else if (msg.type === "scanned") {
        setProgress(null);
        setScan(msg.result);
        setReport(msg.report);
        setGroups(groupRows(msg.result));
        setBusy(false);
      } else if (msg.type === "redacted") {
        setDone(msg.stats);
        setBusy(false);
        download(msg.cleaned, fileNameRef.current.replace(/\.ged$/i, "") + "-cleaned.ged", "text/plain");
      }
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  const send = (req: Request, transfer: Transferable[] = []) => {
    setError("");
    setBusy(true);
    worker.current?.postMessage(req, transfer);
  };

  async function openFile(file: File) {
    setFileName(file.name);
    setScan(null);
    setDone(null);
    setProgress({ fraction: 0, stage: "Reading your file" });
    const bytes = new Uint8Array(await file.arrayBuffer());
    send({ type: "scan", bytes }, [bytes.buffer]);
  }

  function update(line: number, patch: Partial<Group>) {
    setDone(null);
    setGroups((gs) => gs.map((g) => (g.line === line ? { ...g, ...patch } : g)));
  }

  function setAll(choice: Choice) {
    setDone(null);
    setGroups((gs) => gs.map((g) => ({ ...g, choice })));
  }

  const missingRewrite = groups.some((g) => g.choice === "rewrite" && !g.rewrite.trim());

  function clean() {
    const rows = groups.flatMap((g) =>
      g.rows.map((r) => ({ ...r, action: g.choice === "rewrite" ? `rewrite:${g.rewrite.trim()}` : g.choice })),
    );
    send({ type: "redact", rows });
  }

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 } as Record<string, number>;
    for (const g of groups) c[g.rows[0].severity] = (c[g.rows[0].severity] ?? 0) + 1;
    return c;
  }, [groups]);

  // Once there's a scan, links open a new tab so the choices made so far aren't lost.
  const away = scan ? { target: "_blank", rel: "noreferrer" } : {};
  const baseName = fileName.replace(/\.ged$/i, "");
  const downloadReport = () =>
    report &&
    download(report, `${baseName}-review.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  return (
    <div className="page">
      <header>
        <img className="logo" src="/logo.svg" alt="" width="140" height="140" />
        <div>
          <h1>GEDCOM Privacy Guard</h1>
          <p className="tagline">
            Check your family tree file for sensitive notes before you upload or share it.
            <br />
            <strong>Your file never leaves this computer.</strong> Everything happens right here in your browser.
          </p>
          <nav>
            <a href="/what-it-can-do/" {...away}>
              What it can and can't do
            </a>
            <a href="/help-us-test/" {...away}>
              Help us test it
            </a>
            <a href={PROJECT} target="_blank" rel="noreferrer">
              Source code on GitHub
            </a>
          </nav>
        </div>
      </header>

      <main>
        {!scan && <Features />}

        {!scan && (
          <section>
            <h2>Step 1: Choose your family tree file</h2>
            <p>
              You need a GEDCOM file (it ends in <code>.ged</code>). Most family tree programs and Ancestry can save one.{" "}
              <a href="/exporting/">
                How to get your GEDCOM file
              </a>
            </p>
            <label
              className={`drop ${!ready || busy ? "disabled" : ""} ${dragging ? "over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                // Moving over the text inside the box fires this too; only
                // leaving the box itself counts.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (!f)
                  setError(
                    "That was a link or some text, not a file. Save your GEDCOM file to this computer first, " +
                      "then drag the file itself onto the box.",
                  );
                else if (ready && !busy) openFile(f);
              }}
            >
              {!ready ? (
                <Progress label={`${status} (the first visit takes a little longer)`} />
              ) : busy ? (
                <Progress
                  fraction={progress?.fraction ?? 0}
                  label={`${progress?.stage ?? "Reading your file"}: ${fileName}`}
                />
              ) : dragging ? (
                <span className="big">Drop it here</span>
              ) : (
                <>
                  <span className="big">Click here to choose your file</span>
                  <span>or drag it onto this box</span>
                </>
              )}
              <input
                type="file"
                accept=".ged,.GED"
                disabled={!ready || busy}
                onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])}
              />
            </label>
          </section>
        )}

        {error && (
          <div className="error">
            {fileName && !scan && <strong>{fileName}: </strong>}
            {error}
          </div>
        )}

        {!scan && !busy && (
          <>
            <HowItWorks />
            <Offline />
          </>
        )}

        {scan && (
          <>
            <section>
              <h2>Step 2: Decide what to do with each note</h2>
              <p>
                We checked <strong>{scan.people.toLocaleString()}</strong> people and{" "}
                <strong>{scan.text_fields.toLocaleString()}</strong> notes and other text in <em>{fileName}</em>.
              </p>
              {scan.warnings.map((w) => (
                <div className="warning" key={w}>
                  {w}
                </div>
              ))}
              {groups.length === 0 ? (
                <div className="ok">
                  Nothing was flagged. It's still worth a quick look yourself: this only finds words on its list.
                </div>
              ) : (
                <>
                  <p>
                    <strong>{groups.length}</strong> notes may be sensitive ({counts.high} high, {counts.medium} medium,{" "}
                    {counts.low} low). Read each one and choose. Anything you leave on <em>Keep</em> stays exactly as it
                    is.
                  </p>
                  <p className="small">
                    A long list?{" "}
                    <button className="link" onClick={downloadReport}>
                      Download it as an Excel spreadsheet
                    </button>{" "}
                    to sort and filter it, by person, category or severity.
                  </p>
                  <div className="bulk">
                    Set every note to: <button onClick={() => setAll("keep")}>Keep</button>
                    <button onClick={() => setAll("mask")}>Remove highlighted words</button>
                    <button onClick={() => setAll("redact")}>Remove whole note</button>
                    <label className="legacy">
                      <input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} /> I'll
                      bring the cleaned file back into Legacy Family Tree
                    </label>
                  </div>
                </>
              )}
            </section>

            {groups.map((g) => {
              const who = g.rows[0];
              return (
                <article key={g.line} className={`card sev-${who.severity}`}>
                  <div className="who">
                    <strong>{who.name}</strong>
                    <span className="where">{who.found_in}</span>
                    <span className="sev">{who.severity}</span>
                  </div>
                  <div className="life">
                    {[who.birth && `born ${who.birth}`, who.death && `died ${who.death}`].filter(Boolean).join(" · ")}
                  </div>
                  <blockquote>
                    <Highlighted text={g.text} terms={g.rows.map((r) => r.matched_term)} />
                  </blockquote>
                  <div className="why">
                    Flagged for: {[...new Set(g.rows.map((r) => r.category.replace(/_/g, " ")))].join(", ")}
                  </div>
                  <div className="choices" role="radiogroup" aria-label={`What to do with this note about ${who.name}`}>
                    {(
                      [
                        ["keep", "Keep as is"],
                        ["mask", "Remove just the highlighted words"],
                        ["redact", "Remove the whole note"],
                        ["rewrite", "Rewrite it"],
                        ...(legacy ? [["privatize", "Mark private (Legacy)"]] : []),
                      ] as [Choice, string][]
                    ).map(([value, label]) => (
                      <label key={value} className={g.choice === value ? "on" : ""}>
                        <input
                          type="radio"
                          name={`c${g.line}`}
                          checked={g.choice === value}
                          // Rewriting starts from the note itself, so only the bad bits need retyping.
                          onChange={() =>
                            update(g.line, { choice: value, ...(value === "rewrite" && !g.rewrite && { rewrite: g.text }) })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {g.choice === "rewrite" && (
                    <textarea
                      placeholder="Type the new wording for this note"
                      value={g.rewrite}
                      onChange={(e) => update(g.line, { rewrite: e.target.value })}
                    />
                  )}
                </article>
              );
            })}

            <section className="finish">
              <h2>Step 3: Save your cleaned file</h2>
              <p>
                This saves a <em>new</em> file. Your original file is not changed.
              </p>
              {missingRewrite && <div className="warning">Type the new wording for each note set to "Rewrite it".</div>}
              <button className="primary" disabled={busy || missingRewrite} onClick={clean}>
                {busy ? "Working…" : "Save cleaned file"}
              </button>
              {done && (
                <div className="ok">
                  Saved <strong>{baseName}-cleaned.ged</strong> to your Downloads folder: {done.redacted} removed,{" "}
                  {done.masked ? `${done.masked} with words removed, ` : ""}
                  {done.rewritten} rewritten
                  {done.privatized ? `, ${done.privatized} marked private` : ""}, {done.kept} kept.
                  {done.privatized > 0 && (
                    <p>
                      Notes marked private are only hidden once the file goes back into Legacy and you export from
                      there. Don't upload this file straight to Ancestry or FamilySearch.{" "}
                      <a href="/legacy/" target="_blank" rel="noreferrer">
                        How to bring it back into Legacy
                      </a>
                    </p>
                  )}
                </div>
              )}
              <p className="small">
                Prefer a spreadsheet?{" "}
                <button className="link" onClick={downloadReport}>
                  Download the list as an Excel file
                </button>
                .
              </p>
              <button
                className="link"
                onClick={() => {
                  setScan(null);
                  setGroups([]);
                  setDone(null);
                  setError("");
                }}
              >
                Check a different file
              </button>
            </section>
          </>
        )}

      </main>

      <footer>
        <p className="footer-copy">
          Free and{" "}
          <a href={PROJECT} target="_blank" rel="noreferrer">
            open source
          </a>
          . Beta: please{" "}
          <a href={`${PROJECT}/issues/new/choose`} target="_blank" rel="noreferrer">
            tell us
          </a>{" "}
          what worked and what didn't. Never send us your real family file.
          <br />
          <span className="footer-version">
            Version {__APP_VERSION__} · build{" "}
            <a href={`${PROJECT}/commit/${__BUILD_SHA__}`} target="_blank" rel="noreferrer">
              {__BUILD_SHA__.slice(0, 7)}
            </a>{" "}
            · {__BUILD_DATE__}
          </span>
        </p>
        <p className="footer-credit">
          <a className="site-credit-link" href="https://vashonsoftware.com" target="_blank" rel="noreferrer">
            Site by Vashon Software
          </a>
        </p>
      </footer>
    </div>
  );
}
