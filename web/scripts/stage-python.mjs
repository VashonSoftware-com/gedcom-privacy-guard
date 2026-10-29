// Puts everything the browser needs to run the Python engine into
// public/pyodide/, so the page loads it all from its own site (ADR-010):
//   - the Pyodide runtime, from node_modules/pyodide
//   - PyYAML, built for Pyodide, checked against pyodide-lock.json
//   - openpyxl and et-xmlfile, the exact wheels pinned in ../uv.lock
//   - a wheel of gedcom_privacy_guard built from this checkout
// Downloads happen here, at build time, and every file's sha256 is checked.
// The page itself makes no request outside its own site.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(WEB, "..");
const PYODIDE = join(WEB, "node_modules", "pyodide");
const OUT = join(WEB, "public", "pyodide");
const CACHE = join(WEB, ".cache");

const RUNTIME_FILES = ["pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
const LOCKED_WHEELS = ["et-xmlfile", "openpyxl"]; // pure-Python deps not in Pyodide's own set

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function fetchChecked(url, expected, fileName) {
  mkdirSync(CACHE, { recursive: true });
  const cached = join(CACHE, fileName);
  if (existsSync(cached) && sha256(readFileSync(cached)) === expected) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got !== expected) throw new Error(`${fileName}: sha256 ${got}, expected ${expected}`);
  writeFileSync(cached, buf);
  return cached;
}

// The wheel URL and hash for a package in uv.lock.
function lockedWheel(name) {
  const lock = readFileSync(join(REPO, "uv.lock"), "utf8");
  const block = lock.split("[[package]]").find((b) => b.includes(`\nname = "${name}"\n`));
  const m = block && /wheels = \[\s*\{ url = "([^"]+)", hash = "sha256:([0-9a-f]+)"/.exec(block);
  if (!m) throw new Error(`No wheel for ${name} in uv.lock`);
  return { url: m[1], sha: m[2], fileName: m[1].split("/").pop() };
}

function buildOwnWheel() {
  const before = new Set(readdirSync(OUT));
  try {
    execFileSync("uv", ["build", "--wheel", "--out-dir", OUT, REPO], { stdio: "inherit" });
  } catch {
    // Build hosts without uv (e.g. Cloudflare Pages) fall back to pip.
    execFileSync("python", ["-m", "pip", "wheel", "--no-deps", "--wheel-dir", OUT, REPO], { stdio: "inherit" });
  }
  const wheel = readdirSync(OUT).find((f) => f.startsWith("gedcom_privacy_guard-") && f.endsWith(".whl") && !before.has(f));
  if (!wheel) throw new Error("Building the gedcom_privacy_guard wheel produced no file");
  return wheel;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const f of RUNTIME_FILES) copyFileSync(join(PYODIDE, f), join(OUT, f));

const lock = JSON.parse(readFileSync(join(PYODIDE, "pyodide-lock.json"), "utf8"));
const version = JSON.parse(readFileSync(join(PYODIDE, "package.json"), "utf8")).version;
const pyyaml = lock.packages.pyyaml;
copyFileSync(
  await fetchChecked(`https://cdn.jsdelivr.net/pyodide/v${version}/full/${pyyaml.file_name}`, pyyaml.sha256, pyyaml.file_name),
  join(OUT, pyyaml.file_name),
);

const wheels = [];
for (const name of LOCKED_WHEELS) {
  const w = lockedWheel(name);
  copyFileSync(await fetchChecked(w.url, w.sha, w.fileName), join(OUT, w.fileName));
  wheels.push(w.fileName);
}
wheels.push(buildOwnWheel());

// The worker reads this to know which wheels to install, in order.
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ pyodidePackages: ["pyyaml"], wheels }, null, 2));
console.log(`Staged Pyodide ${version} and ${wheels.join(", ")} in public/pyodide/`);
