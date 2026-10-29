/*
 * GEDCOM Privacy Guard: the rules editor's engine.
 *
 * The browser's copy of two Python modules:
 *   - rules.py:   merging a user's rules file onto a preset (buildRules)
 *   - scanner.py: finding terms, patterns and exceptions in text (scan)
 * plus the editing operations behind the page, and writing the rules
 * file back out as YAML (dumpYaml).
 *
 * tests/test_editor.py runs this file under Node and checks that it
 * flags exactly what the Python scanner flags, and that every file it
 * writes loads in Python. Change the two together.
 *
 * No DOM and no network here; editor.js draws the page.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RulesEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PRESETS = ["open", "standard", "cautious"];
  const SEVERITIES = ["high", "medium", "low"];
  const LOCATIONS = [
    "note",
    "cause",
    "source_text",
    "citation",
    "media_file",
    "submitter",
    "address",
    "custom_tag",
  ];
  const CATEGORY_KEYS = [
    "description",
    "severity",
    "enabled",
    "enabled_from",
    "terms",
    "add_terms",
    "remove_terms",
    "exceptions",
    "patterns",
    "add_patterns",
    "in",
    "flag_every_value",
  ];
  const LIST_KEYS = ["terms", "add_terms", "remove_terms", "exceptions", "patterns", "add_patterns", "in"];
  const TOP_KEYS = ["version", "extends", "categories", "exceptions"];
  const NAME_RE = /^[a-z][a-z0-9_]*$/;
  // Python's \w is Unicode-aware; JavaScript's isn't, even with the u flag.
  const W = "[\\p{L}\\p{N}_]";

  class RulesError extends Error {}

  // ---------------------------------------------------------------- terms

  function parseTerm(raw, legacy) {
    const text = String(raw).trim();
    if (legacy) return { text, mode: "substring" };
    if (text.length > 2 && text.startsWith("*") && text.endsWith("*")) {
      return { text: text.slice(1, -1).trim(), mode: "substring" };
    }
    if (text.endsWith("*")) return { text: text.slice(0, -1).trim(), mode: "prefix" };
    return { text, mode: "word" };
  }

  function termString(term) {
    if (term.mode === "prefix") return `${term.text}*`;
    if (term.mode === "substring") return `*${term.text}*`;
    return term.text;
  }

  function termBody(text) {
    return text
      .replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&")
      .replace(/ +/g, "\\s+")
      .replace(/'/g, "['’]");
  }

  // Length of scanner._term_body() in Python, which orders a category's
  // terms longest first. Where two terms match at the same place, the
  // first in that order wins, so the order has to be the same here.
  const PY_ESCAPED = new Set("()[]{}?*+-|^$\\.&~# \t\n\r\v\f");
  function pyBodyLength(text) {
    let n = 0;
    for (const run of text.split(/( +)/)) {
      if (run.startsWith(" ")) n += 3; // a run of spaces becomes \s+
      else for (const ch of run) n += ch === "'" ? 5 : PY_ESCAPED.has(ch) ? 2 : 1;
    }
    return n;
  }

  /** Regex source for one term: the same as scanner.term_regex(). */
  function termRegex(term) {
    const body = termBody(term.text);
    if (term.mode === "substring") return body;
    if (term.mode === "prefix") return `(?<!${W})${body}${W}*`;
    return `(?<!${W})${body}(?!${W})`;
  }

  // ------------------------------------------------------------ validation

  function isMap(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  function similarity(a, b) {
    // Close enough to Python's difflib for "did you mean" hints.
    const m = a.length;
    const n = b.length;
    if (!m || !n) return 0;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return 1 - prev[n] / Math.max(m, n);
  }

  function suggest(word, options) {
    let best = null;
    let score = 0.6;
    for (const o of options) {
      const s = similarity(String(word), String(o));
      if (s >= score) {
        best = o;
        score = s;
      }
    }
    return best ? ` Did you mean '${best}'?` : "";
  }

  function strList(value, where, key) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) value = [value];
    const out = value.map((v) => {
      if (typeof v === "boolean") return v ? "True" : "False"; // as Python's str()
      if (typeof v !== "string" && typeof v !== "number") {
        throw new RulesError(`${where}: '${key}' should be a list of words or phrases.`);
      }
      return String(v).trim();
    });
    if (out.some((v) => !v || v === "*" || v === "**")) {
      throw new RulesError(`${where}: '${key}' has an empty entry.`);
    }
    return out;
  }

  function checkPattern(pattern, where) {
    // Patterns are Python regular expressions. Most are valid JavaScript
    // too; one that isn't still works in the scanner, so this only notes it.
    try {
      new RegExp(pattern, "i");
      return null;
    } catch (e) {
      return `${where}: the browser can't test pattern ${JSON.stringify(pattern)}; the scanner still uses it.`;
    }
  }

  function isLegacy(data) {
    const keys = Object.keys(data);
    return keys.length > 0 && !keys.some((k) => TOP_KEYS.includes(k)) && keys.every((k) => isMap(data[k]));
  }

  // ------------------------------------------------------------- merging

  function newCategory(name) {
    return {
      name,
      severity: "medium",
      description: "",
      enabled: true,
      terms: [],
      exceptions: [],
      patterns: [],
      locations: [],
      flagEveryValue: false,
      builtin: false,
    };
  }

  function apply(base, name, spec, where, legacy, isUser, warnings) {
    where = `${where}, category '${name}'`;
    if (!NAME_RE.test(name)) {
      throw new RulesError(`${where}: category names use lowercase letters, digits and underscores (e.g. our_family).`);
    }
    if (spec === null || spec === undefined) spec = {};
    if (!isMap(spec)) throw new RulesError(`${where}: expected settings such as 'severity:' and 'terms:'.`);
    for (const key of Object.keys(spec)) {
      if (!CATEGORY_KEYS.includes(key)) {
        throw new RulesError(`${where}: unknown setting '${key}'.${suggest(key, CATEGORY_KEYS)}`);
      }
    }
    const isNew = !(name in base);
    if (isNew && isUser && !legacy) {
      if (!(nonEmpty(spec.terms) || nonEmpty(spec.patterns) || spec.flag_every_value)) {
        throw new RulesError(
          `${where}: there's no built-in category by that name.${suggest(name, Object.keys(base))} ` +
            "A new category needs 'terms:' or 'patterns:'."
        );
      }
    }
    if (isNew) base[name] = newCategory(name);
    const cat = base[name];

    if ("severity" in spec) {
      const sev = String(spec.severity).toLowerCase();
      if (!SEVERITIES.includes(sev)) {
        throw new RulesError(`${where}: severity must be high, medium or low (got ${JSON.stringify(spec.severity)}).`);
      }
      cat.severity = sev;
    }
    if ("description" in spec) cat.description = String(spec.description).split(/\s+/).filter(Boolean).join(" ");
    if ("enabled" in spec) {
      if (typeof spec.enabled !== "boolean") throw new RulesError(`${where}: enabled must be true or false.`);
      cat.enabled = spec.enabled;
    }
    if ("enabled_from" in spec && !PRESETS.includes(spec.enabled_from)) {
      throw new RulesError(`${where}: enabled_from must be open, standard or cautious.`);
    }

    if ("terms" in spec) cat.terms = strList(spec.terms, where, "terms").map((t) => parseTerm(t, legacy));
    for (const t of strList(spec.add_terms, where, "add_terms")) {
      const term = parseTerm(t);
      const s = termString(term).toLowerCase();
      if (cat.terms.every((x) => termString(x).toLowerCase() !== s)) cat.terms.push(term);
    }
    for (const t of strList(spec.remove_terms, where, "remove_terms")) {
      const text = parseTerm(t).text.toLowerCase();
      const before = cat.terms.length;
      const left = cat.terms.filter((x) => x.text.toLowerCase() !== text);
      if (left.length === before) {
        throw new RulesError(
          `${where}: can't remove '${t}': it isn't one of this category's terms.` +
            suggest(t, cat.terms.map((x) => x.text))
        );
      }
      cat.terms = left;
    }
    for (const e of strList(spec.exceptions, where, "exceptions")) {
      if (!cat.exceptions.some((x) => x.toLowerCase() === e.toLowerCase())) cat.exceptions.push(e);
    }
    if ("patterns" in spec) cat.patterns = strList(spec.patterns, where, "patterns");
    cat.patterns = cat.patterns.concat(strList(spec.add_patterns, where, "add_patterns"));
    for (const p of cat.patterns) {
      const w = checkPattern(p, where);
      if (w && warnings) warnings.push(w);
    }

    if ("in" in spec) {
      const locs = strList(spec.in, where, "in");
      for (const loc of locs) {
        if (!LOCATIONS.includes(loc)) {
          throw new RulesError(
            `${where}: '${loc}' isn't a place text is found.${suggest(loc, LOCATIONS)} ` +
              `Choose from: ${LOCATIONS.join(", ")}.`
          );
        }
      }
      cat.locations = locs;
    }
    if ("flag_every_value" in spec) cat.flagEveryValue = Boolean(spec.flag_every_value);
  }

  function nonEmpty(v) {
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  }

  /** The preset that a built-in category first turns on in. */
  function enabledFrom(builtin, name) {
    const spec = builtin.categories[name];
    return (spec && spec.enabled_from) || "standard";
  }

  /** Built-in rules for a preset plus a user's changes: rules.load_rules(). */
  function buildRules(builtin, user, preset, where) {
    user = user === undefined || user === null ? {} : user;
    where = where || "Your rules file";
    if (!isMap(user)) throw new RulesError(`${where} should be a set of 'key: value' settings.`);
    const legacy = isLegacy(user);
    if (legacy) user = { extends: "none", categories: user };

    for (const key of Object.keys(user)) {
      if (!TOP_KEYS.includes(key)) throw new RulesError(`${where}: unknown setting '${key}'.${suggest(key, TOP_KEYS)}`);
    }
    const version = "version" in user ? user.version : 1;
    if (version !== 1) {
      throw new RulesError(`${where}: version ${JSON.stringify(version)} isn't supported; this program reads version 1.`);
    }
    const ext = String(preset || user.extends || "standard").toLowerCase();
    if (!PRESETS.includes(ext) && ext !== "none") {
      throw new RulesError(`${where}: 'extends' must be open, standard, cautious or none (got ${JSON.stringify(ext)}).`);
    }

    const warnings = [];
    const categories = {};
    if (ext !== "none") {
      const level = PRESETS.indexOf(ext);
      for (const [name, spec] of Object.entries(builtin.categories)) {
        apply(categories, name, spec, "Built-in rules", false, false, null);
        categories[name].enabled = PRESETS.indexOf(enabledFrom(builtin, name)) <= level;
        categories[name].builtin = true;
      }
    }
    const exceptions = strList(builtin.exceptions, "Built-in rules", "exceptions");

    const userCats = user.categories || {};
    if (!isMap(userCats)) throw new RulesError(`${where}: 'categories' should list category names, each with settings.`);
    for (const [name, spec] of Object.entries(JSON.parse(JSON.stringify(userCats)))) {
      apply(categories, name, spec, where, legacy, true, warnings);
    }
    const userExceptions = strList(user.exceptions, where, "exceptions");

    for (const cat of Object.values(categories)) {
      if (!(cat.terms.length || cat.patterns.length || cat.flagEveryValue)) cat.enabled = false;
    }
    return {
      preset: ext,
      categories: Object.values(categories),
      exceptions: exceptions.concat(userExceptions),
      builtinExceptions: exceptions,
      warnings,
      legacy,
    };
  }

  // ------------------------------------------------------------- scanning

  function sortLongestFirst(terms) {
    const tail = { word: 6, prefix: 3, substring: 0 }; // (?!\w) and \w* in Python
    return terms
      .map((t, i) => ({ t, i, key: pyBodyLength(t.text) + tail[t.mode] }))
      .sort((a, b) => b.key - a.key || a.i - b.i)
      .map((x) => x.t);
  }

  function alternation(terms, tail) {
    return sortLongestFirst(terms)
      .map((t) => termBody(t.text) + tail(t))
      .join("|");
  }

  function phraseRegex(phrase) {
    // Exceptions take the same * syntax as terms ("prison camp*").
    return new RegExp(termRegex(parseTerm(phrase)), "giu");
  }

  function compilePatterns(patterns) {
    // Python joins a category's patterns into one alternation; do the
    // same, leaving out any the browser can't compile.
    const ok = patterns.filter((p) => checkPattern(p, "") === null);
    return ok.length ? new RegExp(ok.map((p) => `(?:${p})`).join("|"), "gi") : null;
  }

  /** Compile a rule set once, for scanning many texts. */
  function compile(rules) {
    const cats = rules.categories
      .filter((c) => c.enabled)
      .map((cat) => {
        const bounded = cat.terms.filter((t) => t.mode !== "substring");
        const anywhere = cat.terms.filter((t) => t.mode === "substring");
        const tail = { word: `(?!${W})`, prefix: `${W}*` };
        return {
          cat,
          bounded: bounded.length ? new RegExp(`(?<!${W})(?:${alternation(bounded, (t) => tail[t.mode])})`, "giu") : null,
          anywhere: anywhere.length ? new RegExp(alternation(anywhere, () => ""), "giu") : null,
          patterns: compilePatterns(cat.patterns),
          exceptions: cat.exceptions.map((e) => ({ phrase: e, rx: phraseRegex(e) })),
        };
      });
    return {
      categories: cats,
      exceptions: rules.exceptions.map((e) => ({ phrase: e, rx: phraseRegex(e) })),
    };
  }

  function spansOf(rx, text) {
    const out = [];
    if (rx) for (const m of text.matchAll(rx)) out.push([m.index, m.index + m[0].length]);
    return out;
  }

  function exceptionSpans(list, text) {
    const out = [];
    for (const { phrase, rx } of list) for (const [s, e] of spansOf(rx, text)) out.push([s, e, phrase]);
    return out;
  }

  /**
   * Findings in one text, as KeywordScanner.scan() reports them. Each is
   * {category, severity, term, start, end}. With explain, matches an
   * exception stopped come back too, as {skipped: phrase, ...}.
   */
  function scan(compiled, text, location, explain) {
    const findings = [];
    if (!text.trim()) return findings;
    location = location || "note";
    let globalSpans = null;
    const overlaps = (s, e) => ([a, b]) => a < e && s < b;
    for (const { cat, bounded, anywhere, patterns, exceptions } of compiled.categories) {
      if (cat.locations.length && !cat.locations.includes(location)) continue;
      if (cat.flagEveryValue) {
        findings.push({ category: cat.name, severity: cat.severity, term: text.trim(), start: 0, end: text.length });
        continue;
      }
      const spans = [...spansOf(anywhere, text), ...spansOf(bounded, text), ...spansOf(patterns, text)];
      spans.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      let blocked = null;
      const seen = [];
      for (const [start, end] of spans) {
        if (end === start || seen.some(overlaps(start, end))) continue;
        if (blocked === null) {
          if (globalSpans === null) globalSpans = exceptionSpans(compiled.exceptions, text);
          blocked = globalSpans.concat(exceptionSpans(exceptions, text));
        }
        const term = text.slice(start, end).split(/\s+/).filter(Boolean).join(" ");
        const by = blocked.find(overlaps(start, end));
        if (by) {
          if (explain) findings.push({ category: cat.name, severity: cat.severity, term, start, end, skipped: by[2] });
          continue;
        }
        seen.push([start, end]);
        findings.push({ category: cat.name, severity: cat.severity, term, start, end });
      }
    }
    return findings;
  }

  // -------------------------------------------------------------- editing
  //
  // The editor keeps the user's rules file as data ("doc") and changes
  // only what the person changes, so the file stays a short list of
  // differences from the preset. Every operation leaves the doc tidy:
  // no empty lists, no settings that repeat the built-in value.

  function emptyDoc(preset) {
    return { version: 1, extends: preset || "standard" };
  }

  function docPreset(doc) {
    return String(doc.extends || "standard").toLowerCase();
  }

  function builtinSpec(builtin, doc, name) {
    return docPreset(doc) === "none" ? null : builtin.categories[name] || null;
  }

  function presetEnabled(builtin, doc, name) {
    const ext = docPreset(doc);
    if (ext === "none" || !builtin.categories[name]) return true; // a category of your own is on
    return PRESETS.indexOf(enabledFrom(builtin, name)) <= PRESETS.indexOf(ext);
  }

  function catSpec(doc, name) {
    doc.categories = doc.categories || {};
    if (!isMap(doc.categories[name])) doc.categories[name] = {};
    return doc.categories[name];
  }

  const lower = (s) => String(s).toLowerCase();

  function tidy(builtin, doc) {
    const cats = doc.categories || {};
    for (const [name, spec] of Object.entries(cats)) {
      if (!isMap(spec)) continue;
      const base = builtinSpec(builtin, doc, name);
      for (const key of LIST_KEYS) {
        if (Array.isArray(spec[key]) && !spec[key].length && key !== "terms") delete spec[key];
      }
      if ("enabled" in spec && spec.enabled === presetEnabled(builtin, doc, name)) delete spec.enabled;
      if (base && "severity" in spec && spec.severity === (base.severity || "medium")) delete spec.severity;
      if (!Object.keys(spec).length) delete cats[name];
    }
    if (doc.categories && !Object.keys(doc.categories).length) delete doc.categories;
    if (Array.isArray(doc.exceptions) && !doc.exceptions.length) delete doc.exceptions;
    return doc;
  }

  function setPreset(builtin, doc, preset) {
    doc.extends = preset;
    if (preset === "none") {
      // Changes to built-in categories mean nothing without them.
      for (const name of Object.keys(doc.categories || {})) {
        const spec = doc.categories[name];
        if (builtin.categories[name] && !(nonEmpty(spec.terms) || nonEmpty(spec.patterns) || spec.flag_every_value)) {
          delete doc.categories[name];
        }
      }
    }
    return tidy(builtin, doc);
  }

  function setEnabled(builtin, doc, name, on) {
    catSpec(doc, name).enabled = Boolean(on);
    return tidy(builtin, doc);
  }

  function setSeverity(builtin, doc, name, severity) {
    if (!SEVERITIES.includes(severity)) throw new RulesError(`Severity must be high, medium or low.`);
    catSpec(doc, name).severity = severity;
    return tidy(builtin, doc);
  }

  function effectiveTerms(builtin, doc, name) {
    const rules = buildRules(builtin, doc);
    const cat = rules.categories.find((c) => c.name === name);
    return cat ? cat.terms : [];
  }

  /** Turn a category's changes into one full 'terms:' list. */
  function spellOutTerms(builtin, doc, name) {
    const spec = catSpec(doc, name);
    spec.terms = effectiveTerms(builtin, doc, name).map(termString);
    delete spec.add_terms;
    delete spec.remove_terms;
    return spec;
  }

  function cleanTerm(raw) {
    const term = parseTerm(raw);
    if (!term.text || term.text === "*") throw new RulesError("Type a word or phrase first.");
    return term;
  }

  function addTerm(builtin, doc, name, raw) {
    const term = cleanTerm(raw);
    const str = termString(term);
    if (effectiveTerms(builtin, doc, name).some((t) => lower(termString(t)) === lower(str))) {
      throw new RulesError(`'${str}' is already in the list.`);
    }
    const spec = catSpec(doc, name);
    if (Array.isArray(spec.terms) || !builtinSpec(builtin, doc, name)) {
      spec.terms = (spec.terms || []).concat(str);
      return tidy(builtin, doc);
    }
    const removed = (spec.remove_terms || []).filter((t) => lower(parseTerm(t).text) === lower(term.text));
    if (removed.length) {
      // Bringing back a built-in term the user had removed.
      spec.remove_terms = spec.remove_terms.filter((t) => !removed.includes(t));
      const back = effectiveTerms(builtin, doc, name).filter((t) => lower(t.text) === lower(term.text));
      if (back.some((t) => t.mode === term.mode)) return tidy(builtin, doc);
      // Same words, different matching: removal works by words alone, so
      // only a full list can say this.
      spec.remove_terms = (spec.remove_terms || []).concat(removed);
      spellOutTerms(builtin, doc, name);
      spec.terms.push(str);
      return tidy(builtin, doc);
    }
    spec.add_terms = (spec.add_terms || []).concat(str);
    return tidy(builtin, doc);
  }

  function removeTerm(builtin, doc, name, str) {
    const spec = catSpec(doc, name);
    const target = lower(str);
    if (Array.isArray(spec.terms)) {
      const left = spec.terms.filter((t) => lower(termString(parseTerm(t))) !== target);
      if (!left.length && !builtinSpec(builtin, doc, name) && !nonEmpty(spec.patterns) && !spec.flag_every_value) {
        throw new RulesError("That's this category's only term. Delete the category instead.");
      }
      spec.terms = left; // an empty list turns a built-in category off
      return tidy(builtin, doc);
    }
    const added = (spec.add_terms || []).filter((t) => lower(termString(parseTerm(t))) === target);
    if (added.length) {
      spec.add_terms = spec.add_terms.filter((t) => !added.includes(t));
      return tidy(builtin, doc);
    }
    const text = parseTerm(str).text;
    const others = effectiveTerms(builtin, doc, name).filter(
      (t) => lower(t.text) === lower(text) && lower(termString(t)) !== target
    );
    if (others.length) {
      // remove_terms would take the others with it.
      spellOutTerms(builtin, doc, name);
      return removeTerm(builtin, doc, name, str);
    }
    spec.remove_terms = (spec.remove_terms || []).concat(str);
    return tidy(builtin, doc);
  }

  /** Built-in terms this doc removes from a category (for "restore"). */
  function removedTerms(builtin, doc, name) {
    const base = builtinSpec(builtin, doc, name);
    const spec = (doc.categories || {})[name];
    if (!base || !spec) return [];
    const now = new Set(effectiveTerms(builtin, doc, name).map((t) => lower(termString(t))));
    return strList(base.terms, "", "terms").filter((t) => !now.has(lower(termString(parseTerm(t)))));
  }

  function addException(builtin, doc, name, phrase) {
    phrase = String(phrase).trim();
    if (!phrase) throw new RulesError("Type a word or phrase first.");
    const base = name ? builtinSpec(builtin, doc, name) : builtin;
    const target = name ? catSpec(doc, name) : doc;
    const existing = strList(base && base.exceptions, "", "exceptions").concat(target.exceptions || []);
    if (existing.some((e) => lower(e) === lower(phrase))) throw new RulesError(`'${phrase}' is already an exception.`);
    target.exceptions = (target.exceptions || []).concat(phrase);
    return tidy(builtin, doc);
  }

  function removeException(builtin, doc, name, phrase) {
    const target = name ? catSpec(doc, name) : doc;
    target.exceptions = (target.exceptions || []).filter((e) => e !== phrase);
    return tidy(builtin, doc);
  }

  function addCategory(builtin, doc, name, severity, description, firstTerm) {
    name = String(name).trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!NAME_RE.test(name)) {
      throw new RulesError("A category name uses lowercase letters, digits and underscores, starting with a letter (e.g. our_family).");
    }
    if (buildRules(builtin, doc).categories.some((c) => c.name === name)) {
      throw new RulesError(`There's already a category called ${name}.`);
    }
    const term = cleanTerm(firstTerm);
    doc.categories = doc.categories || {};
    const spec = { severity: SEVERITIES.includes(severity) ? severity : "medium", terms: [termString(term)] };
    if (description && description.trim()) spec.description = description.trim();
    doc.categories[name] = spec;
    return tidy(builtin, doc);
  }

  /** Drop a category of your own, or undo every change to a built-in one. */
  function resetCategory(builtin, doc, name) {
    if (doc.categories) delete doc.categories[name];
    return tidy(builtin, doc);
  }

  /** How many separate changes the doc makes, for the status line. */
  function countChanges(doc) {
    let n = Array.isArray(doc.exceptions) ? doc.exceptions.length : 0;
    for (const spec of Object.values(doc.categories || {})) {
      for (const [key, v] of Object.entries(spec || {})) n += Array.isArray(v) && key !== "terms" ? v.length : 1;
    }
    return n;
  }

  /** A loaded file, made ready to edit: legacy files are converted. */
  function normalizeDoc(data) {
    if (data === undefined || data === null) data = {};
    if (!isMap(data)) throw new RulesError("A rules file should be a set of 'key: value' settings.");
    let notice = null;
    if (isLegacy(data)) {
      // Old files matched every term anywhere; *term* says that now.
      const cats = {};
      for (const [name, spec] of Object.entries(data)) {
        const s = Object.assign({}, spec);
        if ("terms" in s) s.terms = strList(s.terms, name, "terms").map((t) => `*${t}*`);
        cats[name] = s;
      }
      data = { version: 1, extends: "none", categories: cats };
      notice =
        "This is an older rules file. It's been converted: it doesn't build on a preset ('extends: none'), " +
        "and each term is wrapped in *…* so it still matches anywhere. Save to keep the new format.";
    }
    const doc = JSON.parse(JSON.stringify(data));
    for (const spec of Object.values(doc.categories || {})) {
      if (!isMap(spec)) continue;
      for (const key of LIST_KEYS) if (key in spec && spec[key] !== null) spec[key] = strList(spec[key], "", key);
      for (const key of ["enabled", "flag_every_value"]) {
        // PyYAML (YAML 1.1) reads yes/no/on/off as true/false; js-yaml doesn't.
        if (typeof spec[key] === "string" && /^(yes|no|on|off)$/i.test(spec[key])) spec[key] = /^(yes|on)$/i.test(spec[key]);
      }
    }
    if ("exceptions" in doc && doc.exceptions !== null) doc.exceptions = strList(doc.exceptions, "", "exceptions");
    return { doc, notice };
  }

  // --------------------------------------------------------------- output

  const RESERVED = /^(true|false|yes|no|on|off|null|y|n|~)$/i;

  function scalar(v) {
    if (typeof v === "boolean" || typeof v === "number") return String(v);
    const s = String(v);
    if (/^[A-Za-z][A-Za-z0-9 _.,'’()/-]*$/.test(s) && !s.endsWith(" ") && !RESERVED.test(s)) return s;
    return JSON.stringify(s); // a JSON string is a valid double-quoted YAML string
  }

  const CATEGORY_ORDER = CATEGORY_KEYS;

  function dumpYaml(doc) {
    const lines = [
      "# GEDCOM Privacy Guard rules: your changes on top of a preset.",
      "# Written by the rules editor. Use it with:",
      "#   gedcom-privacy-guard scan FAMILY.ged --rules THIS-FILE.yaml",
      "",
      "version: 1",
      `extends: ${scalar(docPreset(doc))}`,
    ];
    const list = (indent, items) => items.forEach((x) => lines.push(`${indent}- ${scalar(x)}`));
    if (Array.isArray(doc.exceptions) && doc.exceptions.length) {
      lines.push("exceptions:");
      list("  ", doc.exceptions);
    }
    const cats = Object.entries(doc.categories || {});
    if (cats.length) {
      lines.push("", "categories:");
      for (const [name, spec] of cats) {
        lines.push(`  ${name}:`);
        const keys = Object.keys(spec).sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
        for (const key of keys) {
          const v = spec[key];
          if (Array.isArray(v)) {
            lines.push(`    ${key}:${v.length ? "" : " []"}`);
            list("      ", v);
          } else {
            lines.push(`    ${key}: ${scalar(v)}`);
          }
        }
      }
    }
    return lines.join("\n") + "\n";
  }

  return {
    PRESETS,
    SEVERITIES,
    LOCATIONS,
    RulesError,
    parseTerm,
    termString,
    termRegex,
    buildRules,
    compile,
    scan,
    emptyDoc,
    normalizeDoc,
    presetEnabled,
    enabledFrom,
    setPreset,
    setEnabled,
    setSeverity,
    addTerm,
    removeTerm,
    removedTerms,
    addException,
    removeException,
    addCategory,
    resetCategory,
    countChanges,
    dumpYaml,
  };
});
