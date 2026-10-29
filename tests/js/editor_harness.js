// Runs the rules editor's engine for tests/test_editor.py.
// Reads one JSON request on stdin and writes one JSON answer on stdout.
//   {mode: "scan",  builtin, user, preset, cases: [{text, location}]}
//   {mode: "rules", builtin, user, preset}
//   {mode: "edit",  builtin, ops: [[name, ...args]]}    (starts from a new doc)
//   {mode: "load",  builtin, text}                      (YAML text, as Open does)
const fs = require("fs");
const path = require("path");
const E = require(path.join(__dirname, "..", "..", "gedcom_privacy_guard", "editor", "rules-engine.js"));
const jsyaml = require(path.join(__dirname, "..", "..", "gedcom_privacy_guard", "editor", "vendor", "js-yaml.min.js"));

const req = JSON.parse(fs.readFileSync(0, "utf8"));
const B = req.builtin;

function rulesOut(rules) {
  return rules.categories.map((c) => ({
    name: c.name,
    enabled: c.enabled,
    severity: c.severity,
    terms: c.terms.map(E.termString),
    exceptions: c.exceptions,
    patterns: c.patterns,
    locations: c.locations,
  }));
}

function run() {
  if (req.mode === "scan") {
    const compiled = E.compile(E.buildRules(B, req.user, req.preset));
    return req.cases.map(({ text, location }) => E.scan(compiled, text, location).map((f) => [f.category, f.term]));
  }
  if (req.mode === "rules") {
    const rules = E.buildRules(B, req.user, req.preset);
    return { preset: rules.preset, categories: rulesOut(rules), exceptions: rules.exceptions };
  }
  if (req.mode === "edit") {
    let doc = E.emptyDoc();
    for (const [name, ...args] of req.ops) doc = E[name](B, doc, ...args);
    return { doc, yaml: E.dumpYaml(doc) };
  }
  if (req.mode === "load") {
    const { doc, notice } = E.normalizeDoc(jsyaml.load(req.text));
    E.buildRules(B, doc);
    return { doc, notice, yaml: E.dumpYaml(doc) };
  }
  throw new Error(`unknown mode ${req.mode}`);
}

try {
  process.stdout.write(JSON.stringify({ ok: run() }));
} catch (e) {
  if (!(e instanceof E.RulesError)) throw e;
  process.stdout.write(JSON.stringify({ error: e.message }));
}
