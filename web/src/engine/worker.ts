// Runs the Python engine (gedcom_privacy_guard) in Pyodide, off the main
// thread. The GEDCOM lives only in this worker's in-memory file system.

import { loadPyodide, type PyodideInterface } from "pyodide";
import type { Request, Response } from "./protocol";

const BASE = new URL(`${import.meta.env.BASE_URL}pyodide/`, self.location.origin).href;
const GEDCOM = "/work/input.ged";
const REPORT = "/work/review.xlsx";
const CLEANED = "/work/cleaned.ged";

const post = (msg: Response, transfer: Transferable[] = []) => self.postMessage(msg, { transfer });

async function start(): Promise<PyodideInterface> {
  post({ type: "status", text: "Loading the privacy checker…" });
  const pyodide = await loadPyodide({ indexURL: BASE });
  const manifest = await (await fetch(`${BASE}manifest.json`)).json();
  post({ type: "status", text: "Loading the privacy rules…" });
  await pyodide.loadPackage([...manifest.pyodidePackages, ...manifest.wheels.map((w: string) => BASE + w)], {
    messageCallback: () => {},
  });
  pyodide.FS.mkdirTree("/work");
  pyodide.runPython("from gedcom_privacy_guard.web import scan_to_json, redact_from_json");
  post({ type: "ready" });
  return pyodide;
}

// A Python traceback's last line is "SomeError: message"; users see the message.
function friendly(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  const last = text.trim().split("\n").pop() ?? text;
  return last.replace(/^[\w.]+(Error|Exception): /, "");
}

const ready = start();
ready.catch((err) => post({ type: "error", message: `The checker couldn't start: ${friendly(err)}` }));

self.onmessage = async (event: MessageEvent<Request>) => {
  const req = event.data;
  try {
    const py = await ready;
    if (req.type === "scan") {
      py.FS.writeFile(GEDCOM, req.bytes);
      const progress = (fraction: number, stage: string) => post({ type: "progress", fraction, stage });
      const json = py.globals.get("scan_to_json")(GEDCOM, REPORT, progress) as string;
      const report = py.FS.readFile(REPORT);
      post({ type: "scanned", result: JSON.parse(json), report }, [report.buffer]);
    } else if (req.type === "redact") {
      const json = py.globals.get("redact_from_json")(GEDCOM, JSON.stringify(req.rows), CLEANED) as string;
      const cleaned = py.FS.readFile(CLEANED);
      post({ type: "redacted", stats: JSON.parse(json), cleaned }, [cleaned.buffer]);
    }
  } catch (err) {
    post({ type: "error", message: friendly(err) });
  }
};
