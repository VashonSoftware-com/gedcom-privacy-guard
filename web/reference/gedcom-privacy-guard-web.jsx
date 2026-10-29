import { useState, useMemo, useCallback } from "react";
import { Upload, Download, ShieldCheck, AlertTriangle, FileText, ExternalLink } from "lucide-react";

// ---------------------------------------------------------------------------
// Rules (mirrors gedcom_privacy_guard/rules.yaml in the Python CLI --
// keep these two in sync by hand until the web version is the real one).
// ---------------------------------------------------------------------------
const RULES = {
  mental_health: {
    severity: "high",
    terms: ["depression", "anxiety disorder", "bipolar", "schizophreni", "suicid", "psychiatric", "nervous breakdown", "institutionalized"],
  },
  substance_use: {
    severity: "high",
    terms: ["alcoholi", "addict", "substance abuse", "drug problem", "rehab"],
  },
  identity_risk: {
    severity: "high",
    terms: ["social security", "ssn", "maiden name", "passport number", "driver's license", "drivers license", "credit card"],
  },
  unverified_claims: {
    severity: "medium",
    terms: ["unverified", "rumor", "rumour", "allegedly", "family legend", "not confirmed", "disputed", "unconfirmed", "according to family lore"],
  },
  legal_sensitive: {
    severity: "medium",
    terms: ["affair", "illegitimate", "out of wedlock", "arrested", "convicted", "prison", "divorce scandal", "disowned"],
  },
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
const SEVERITY_COLOR = {
  high: "#9B2C2C",
  medium: "#966400",
  low: "#4A5568",
};

const FAMILYSEARCH_URL = (id) => `https://www.familysearch.org/tree/person/details/${id}`;
const FINDAGRAVE_URL = (id) => `https://www.findagrave.com/memorial/${id}`;

// ---------------------------------------------------------------------------
// GEDCOM parser (JS port of parser.py). Not a full spec implementation --
// enough for INDI notes, vitals, and FAM-resolved parents/spouses.
// ---------------------------------------------------------------------------
function splitLine(line) {
  const trimmed = line.trim();
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace === -1) return [parseInt(trimmed, 10), "", ""];
  const level = parseInt(trimmed.slice(0, firstSpace), 10);
  const rest = trimmed.slice(firstSpace + 1);
  const secondSpace = rest.indexOf(" ");
  if (secondSpace === -1) return [level, rest, ""];
  return [level, rest.slice(0, secondSpace), rest.slice(secondSpace + 1)];
}

function parseGedcom(text) {
  const rawLines = text.split(/\r\n|\r|\n/);
  const individuals = [];
  const families = {};
  const byXref = {};

  let currentIndi = null;
  let currentFam = null;
  let eventContext = null;

  let inNote = false;
  let noteStart = null;
  let noteParts = [];

  const flushNote = (endIdx) => {
    if (currentIndi && inNote && noteParts.length) {
      currentIndi.notes.push({ text: noteParts.join(""), startLine: noteStart, endLine: endIdx });
    }
    inNote = false;
    noteStart = null;
    noteParts = [];
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line.trim()) continue;
    const firstToken = line.trim().split(" ", 1)[0];
    if (!/^\d+$/.test(firstToken)) continue;
    const [level, tag, value] = splitLine(line);

    if (level === 0) {
      flushNote(i - 1);
      currentFam = null;
      currentIndi = null;
      eventContext = null;
      if (tag.startsWith("@") && value === "INDI") {
        currentIndi = {
          xref: tag, name: "(unknown)", sex: "", notes: [],
          birthDate: "", birthPlace: "", deathDate: "", deathPlace: "",
          fsftid: "", findagrave: "", afn: "", refn: "",
          famc: "", fams: [], parentNames: [], spouseNames: [],
        };
        individuals.push(currentIndi);
        byXref[tag] = currentIndi;
      } else if (tag.startsWith("@") && value === "FAM") {
        currentFam = { xref: tag, husb: "", wife: "", children: [] };
        families[tag] = currentFam;
      }
      continue;
    }

    if (currentFam) {
      if (level === 1 && tag === "HUSB") currentFam.husb = value;
      else if (level === 1 && tag === "WIFE") currentFam.wife = value;
      else if (level === 1 && tag === "CHIL") currentFam.children.push(value);
      continue;
    }

    if (!currentIndi) continue;

    if (level === 1 && tag !== "NOTE") flushNote(i - 1);

    if (level === 1 && tag === "NAME") { currentIndi.name = value.replace(/\//g, "").trim(); eventContext = null; }
    else if (level === 1 && tag === "SEX") { currentIndi.sex = value; eventContext = null; }
    else if (level === 1 && tag === "BIRT") { eventContext = "BIRT"; }
    else if (level === 1 && tag === "DEAT") { eventContext = "DEAT"; }
    else if (level === 1 && tag === "FAMC") { currentIndi.famc = value; eventContext = null; }
    else if (level === 1 && tag === "FAMS") { currentIndi.fams.push(value); eventContext = null; }
    else if (level === 1 && tag === "AFN") { currentIndi.afn = value; eventContext = null; }
    else if (level === 1 && tag === "REFN") { currentIndi.refn = value; eventContext = null; }
    else if (level === 1 && tag === "_FSFTID") { currentIndi.fsftid = value; eventContext = null; }
    else if (level === 1 && tag === "_FGRAVE") { currentIndi.findagrave = value; eventContext = null; }
    else if (level === 2 && tag === "DATE" && eventContext === "BIRT") { currentIndi.birthDate = value; }
    else if (level === 2 && tag === "PLAC" && eventContext === "BIRT") { currentIndi.birthPlace = value; }
    else if (level === 2 && tag === "DATE" && eventContext === "DEAT") { currentIndi.deathDate = value; }
    else if (level === 2 && tag === "PLAC" && eventContext === "DEAT") { currentIndi.deathPlace = value; }
    else if (level === 1 && tag === "NOTE") { flushNote(i - 1); inNote = true; noteStart = i; noteParts = [value]; }
    else if (level >= 2 && tag === "CONT" && inNote) { noteParts.push("\n" + value); }
    else if (level >= 2 && tag === "CONC" && inNote) { noteParts.push(value); }
  }
  flushNote(rawLines.length - 1);

  for (const person of individuals) {
    if (person.famc && families[person.famc]) {
      const fam = families[person.famc];
      for (const parentXref of [fam.husb, fam.wife]) {
        if (parentXref && byXref[parentXref]) person.parentNames.push(byXref[parentXref].name);
      }
    }
    for (const famsXref of person.fams) {
      const fam = families[famsXref];
      if (!fam) continue;
      const spouseXref = fam.husb === person.xref ? fam.wife : fam.husb;
      if (spouseXref && byXref[spouseXref]) person.spouseNames.push(byXref[spouseXref].name);
    }
  }

  return { rawLines, individuals };
}

function scanText(text) {
  const findings = [];
  for (const [category, spec] of Object.entries(RULES)) {
    for (const term of spec.terms) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      let m;
      while ((m = re.exec(text)) !== null) {
        const start = Math.max(0, m.index - 40);
        const end = Math.min(text.length, m.index + m[0].length + 40);
        const snippet = text.slice(start, end).replace(/\n/g, " ").trim();
        findings.push({ category, severity: spec.severity, matchedTerm: m[0], snippet: `...${snippet}...` });
      }
    }
  }
  return findings;
}

function vital(date, place) {
  if (date && place) return `${date} in ${place}`;
  return date || place || "";
}

function buildRows(individuals) {
  const rows = [];
  individuals.forEach((person, personIdx) => {
    person.notes.forEach((note, noteIdx) => {
      const findings = scanText(note.text);
      findings.forEach((finding, findingIdx) => {
        rows.push({
          id: `${personIdx}-${noteIdx}-${findingIdx}`,
          xref: person.xref,
          name: person.name,
          sex: person.sex,
          birth: vital(person.birthDate, person.birthPlace),
          death: vital(person.deathDate, person.deathPlace),
          parents: person.parentNames.join("; "),
          spouses: person.spouseNames.join("; "),
          fsftid: person.fsftid,
          findagrave: person.findagrave,
          afn: person.afn,
          refn: person.refn,
          noteStartLine: note.startLine,
          noteEndLine: note.endLine,
          category: finding.category,
          severity: finding.severity,
          matchedTerm: finding.matchedTerm,
          snippet: finding.snippet,
          action: "keep",
          rewriteText: "",
        });
      });
    });
  });
  rows.sort((a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || a.name.localeCompare(b.name));
  return rows;
}

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows) {
  const cols = ["xref","name","sex","birth","death","parents","spouses","familysearch_id","familysearch_url","findagrave_id","findagrave_url","ancestral_file_number","reference_number","note_line_start","note_line_end","category","severity","matched_term","snippet","action"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.join(",")];
  for (const r of rows) {
    const action = r.action === "rewrite" ? `rewrite:${r.rewriteText}` : r.action;
    lines.push([
      r.xref, r.name, r.sex, r.birth, r.death, r.parents, r.spouses,
      r.fsftid, r.fsftid ? FAMILYSEARCH_URL(r.fsftid) : "",
      r.findagrave, r.findagrave ? FINDAGRAVE_URL(r.findagrave) : "",
      r.afn, r.refn, r.noteStartLine, r.noteEndLine,
      r.category, r.severity, r.matchedTerm, r.snippet, action,
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

function applyRedactions(rawLines, rows) {
  const chosen = {};
  const priority = { redact: 0, rewrite: 1, keep: 2 };
  for (const r of rows) {
    const key = `${r.noteStartLine}-${r.noteEndLine}`;
    const p = priority[r.action] ?? 2;
    if (!(key in chosen) || p < chosen[key].p) {
      chosen[key] = { p, action: r.action, rewriteText: r.rewriteText, start: r.noteStartLine, end: r.noteEndLine };
    }
  }
  const replacements = {};
  const blank = new Set();
  Object.values(chosen).forEach(({ action, rewriteText, start, end }) => {
    if (action === "redact") {
      replacements[start] = "1 NOTE [REDACTED BY GEDCOM PRIVACY GUARD]";
      for (let ln = start + 1; ln <= end; ln++) blank.add(ln);
    } else if (action === "rewrite" && rewriteText) {
      replacements[start] = `1 NOTE ${rewriteText}`;
      for (let ln = start + 1; ln <= end; ln++) blank.add(ln);
    }
  });
  const out = [];
  rawLines.forEach((line, i) => {
    if (i in replacements) out.push(replacements[i]);
    else if (blank.has(i)) return;
    else out.push(line);
  });
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
export default function App() {
  const [fileName, setFileName] = useState("");
  const [rawLines, setRawLines] = useState(null);
  const [rows, setRows] = useState([]);
  const [individualCount, setIndividualCount] = useState(0);
  const [error, setError] = useState("");

  const handleFile = useCallback((file) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { rawLines, individuals } = parseGedcom(e.target.result);
        setRawLines(rawLines);
        setIndividualCount(individuals.length);
        setRows(buildRows(individuals));
        setFileName(file.name);
      } catch (err) {
        setError("Could not parse this file. Make sure it's a plain-text GEDCOM (.ged) export.");
      }
    };
    reader.onerror = () => setError("Could not read this file.");
    reader.readAsText(file);
  }, []);

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const stats = useMemo(() => {
    const high = rows.filter((r) => r.severity === "high").length;
    const medium = rows.filter((r) => r.severity === "medium").length;
    return { total: rows.length, high, medium };
  }, [rows]);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4EC", fontFamily: "'Iowan Old Style', 'Georgia', serif", color: "#20221F" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 80px" }}>
        <header style={{ marginBottom: 36, borderBottom: "2px solid #20221F", paddingBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <ShieldCheck size={26} color="#2C4A3E" />
            <h1 style={{ fontSize: 28, letterSpacing: "-0.01em", margin: 0, fontWeight: 600 }}>GEDCOM Privacy Guard</h1>
          </div>
          <p style={{ fontFamily: "'Menlo', monospace", fontSize: 13, color: "#5C5A52", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            in-browser scan · nothing leaves this device · nothing is auto-deleted
          </p>
        </header>

        {!rawLines && (
          <label
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 12, border: "2px dashed #9C9587", borderRadius: 4, padding: "64px 24px",
              cursor: "pointer", background: "#FFFDF8",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          >
            <Upload size={32} color="#6B6656" />
            <div style={{ fontSize: 16 }}>Drop a <strong>.ged</strong> file here, or click to choose one</div>
            <div style={{ fontSize: 13, color: "#8A8474", fontFamily: "'Menlo', monospace" }}>Processed entirely in your browser — nothing is uploaded anywhere</div>
            <input type="file" accept=".ged" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
          </label>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: 14, background: "#FBEAEA", border: "1px solid #9B2C2C", borderRadius: 4, color: "#9B2C2C", fontSize: 14 }}>
            {error}
          </div>
        )}

        {rawLines && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#5C5A52" }}>
                <FileText size={16} /> {fileName}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => downloadBlob(fileName.replace(/\.ged$/i, "") + "_review.csv", rowsToCsv(rows), "text/csv")}
                  style={btnStyle("#20221F", "#FFFDF8")}>
                  <Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Download review CSV
                </button>
                <button onClick={() => downloadBlob(fileName.replace(/\.ged$/i, "") + "_cleaned.ged", applyRedactions(rawLines, rows), "text/plain")}
                  style={btnStyle("#2C4A3E", "#FFFDF8")}>
                  <Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Download cleaned GEDCOM
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 24, marginBottom: 28, fontFamily: "'Menlo', monospace", fontSize: 13 }}>
              <Stat label="individuals scanned" value={individualCount} />
              <Stat label="flags found" value={stats.total} />
              <Stat label="high severity" value={stats.high} color="#9B2C2C" />
              <Stat label="medium severity" value={stats.medium} color="#966400" />
            </div>

            {rows.length === 0 ? (
              <div style={{ padding: 24, background: "#EAF1EC", border: "1px solid #2C4A3E", borderRadius: 4, fontSize: 14 }}>
                No flagged notes found against the current keyword rules. Worth a manual skim regardless — this only catches what the rule list knows to look for.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {rows.map((r) => (
                  <div key={r.id} style={{ background: "#FFFDF8", border: "1px solid #DCD6C6", borderRadius: 4, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 16 }}>{r.name}</span>
                          <span style={{
                            fontFamily: "'Menlo', monospace", fontSize: 11, textTransform: "uppercase",
                            color: "#fff", background: SEVERITY_COLOR[r.severity], padding: "2px 8px", borderRadius: 2,
                          }}>{r.severity}</span>
                          <span style={{ fontFamily: "'Menlo', monospace", fontSize: 11, color: "#8A8474" }}>{r.category.replace(/_/g, " ")}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#5C5A52", marginTop: 4, lineHeight: 1.5 }}>
                          {r.birth && <>b. {r.birth}<br /></>}
                          {r.death && <>d. {r.death}<br /></>}
                          {r.parents && <>parents: {r.parents}<br /></>}
                          {r.spouses && <>spouse: {r.spouses}<br /></>}
                          {r.fsftid && (
                            <a href={FAMILYSEARCH_URL(r.fsftid)} target="_blank" rel="noreferrer" style={{ color: "#2C4A3E" }}>
                              FamilySearch: {r.fsftid} <ExternalLink size={11} style={{ verticalAlign: -1 }} />
                            </a>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {["keep", "redact", "rewrite"].map((opt) => (
                          <button key={opt} onClick={() => updateRow(r.id, { action: opt })}
                            style={{
                              ...btnStyle(r.action === opt ? "#2C4A3E" : "#fff", r.action === opt ? "#fff" : "#20221F"),
                              border: "1px solid #2C4A3E", fontSize: 12, padding: "5px 10px",
                            }}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {r.action === "rewrite" && (
                      <input
                        value={r.rewriteText}
                        onChange={(e) => updateRow(r.id, { rewriteText: e.target.value })}
                        placeholder="Replacement text for this note..."
                        style={{ width: "100%", marginTop: 10, padding: 8, border: "1px solid #DCD6C6", borderRadius: 3, fontFamily: "inherit", fontSize: 13 }}
                      />
                    )}
                    <div style={{
                      marginTop: 10, fontSize: 13, color: "#3D3B34", background: "#F7F4EC",
                      padding: "8px 10px", borderRadius: 3, fontStyle: "italic",
                    }}>
                      matched "<strong>{r.matchedTerm}</strong>" — {r.snippet}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => { setRawLines(null); setRows([]); setFileName(""); }}
              style={{ ...btnStyle("transparent", "#5C5A52"), marginTop: 28, border: "1px solid #9C9587" }}>
              Scan a different file
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "#20221F" }}>{value}</div>
      <div style={{ color: "#8A8474", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

function btnStyle(bg, fg) {
  return {
    background: bg, color: fg, border: "none", borderRadius: 3, padding: "8px 14px",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  };
}
