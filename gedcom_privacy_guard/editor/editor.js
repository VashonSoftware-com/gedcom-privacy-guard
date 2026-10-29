/*
 * GEDCOM Privacy Guard: the rules editor page.
 *
 * Draws the page and handles Open and Save. The rules themselves (merging,
 * matching, editing, writing YAML) are in rules-engine.js. Everything
 * happens in this browser tab: there's no server and no network access
 * (the page's Content-Security-Policy forbids it).
 */
(function () {
  "use strict";

  const E = window.RulesEngine;
  const BUILTIN = window.GPG_BUILTIN_RULES;

  const PRESET_HELP = {
    open: "Only what exposes identity or contact details.",
    standard: "Also health, addiction, crime and family scandal. The default.",
    cautious: "Also adoption, paternity, illness and street addresses.",
    none: "No built-in categories: only your own.",
  };
  const LOCATION_LABELS = {
    note: "a note",
    cause: "a cause of death",
    source_text: "source text",
    citation: "a citation",
    media_file: "a media file link",
    submitter: "the submitter record (you)",
    address: "an address",
    custom_tag: "a custom tag",
  };
  const MODE_HELP = {
    word: "Whole word or phrase",
    prefix: "Any word starting with this",
    substring: "Anywhere, even inside a word",
  };
  const SAMPLE =
    "Grandpa Joe spent 1931 in the state mental hospital after a nervous breakdown; " +
    "the family blamed the Great Depression. Allegedly he was jailed once for drunkenness. " +
    "Aunt May (SSN 123-45-6789, phone 206-555-0142) says he was adopted. " +
    "[[Ask May before sharing this.]]";

  const state = {
    doc: E.emptyDoc(),
    name: null, // file name, once opened or saved
    handle: null, // a file handle, where the browser offers them
    dirty: false,
    notice: null,
  };
  let rules = E.buildRules(BUILTIN, state.doc);
  let compiled = E.compile(rules);

  // ------------------------------------------------------------- helpers

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const $ = (id) => document.getElementById(id);
  const title = (name) => name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");
  const lower = (s) => String(s).toLowerCase();

  let toastTimer = null;
  function toast(message, kind) {
    const el = $("toast");
    el.textContent = message;
    el.className = `toast show ${kind || ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = "toast"), kind === "error" ? 6000 : 3000);
  }

  /** Change the rules. Returns false (and says why) if the change can't be made. */
  function change(fn) {
    const next = JSON.parse(JSON.stringify(state.doc));
    try {
      fn(next);
      E.buildRules(BUILTIN, next); // never keep a doc the scanner would reject
    } catch (e) {
      if (!(e instanceof E.RulesError)) throw e;
      toast(e.message, "error");
      return false;
    }
    state.doc = next;
    state.dirty = true;
    refresh();
    return true;
  }

  // ------------------------------------------------------------ rendering

  function refresh() {
    const focus = document.activeElement && document.activeElement.dataset.focus;
    rules = E.buildRules(BUILTIN, state.doc);
    compiled = E.compile(rules);
    renderStatus();
    renderCategories();
    renderGlobal();
    renderTest();
    $("yaml").textContent = E.dumpYaml(state.doc);
    if (focus) {
      const el = document.querySelector(`[data-focus="${CSS.escape(focus)}"]`);
      if (el) el.focus();
    }
  }

  function renderStatus() {
    $("preset").value = E.PRESETS.concat("none").includes(rules.preset) ? rules.preset : "standard";
    $("preset-help").textContent = PRESET_HELP[rules.preset] || "";
    const n = E.countChanges(state.doc);
    $("file-name").textContent = state.name || "New rules file";
    $("file-state").textContent =
      (n ? `${n} change${n === 1 ? "" : "s"} to the ${rules.preset} preset` : `The ${rules.preset} preset, unchanged`) +
      (state.dirty ? " · not saved" : "");
    $("save").disabled = false;
    const notice = $("notice");
    notice.hidden = !state.notice && !rules.warnings.length;
    notice.replaceChildren(
      ...[state.notice, ...rules.warnings].filter(Boolean).map((m) => h("p", { text: m })),
      state.notice ? h("button", { class: "link", text: "Dismiss", onclick: () => ((state.notice = null), refresh()) }) : null
    );
    document.title = `${state.dirty ? "• " : ""}${state.name ? state.name + " · " : ""}Rules editor`;
  }

  function chip(text, opts) {
    return h(
      "span",
      { class: `chip ${opts.cls || ""} ${opts.locked ? "locked" : ""}`, title: opts.title },
      h("span", { class: "chip-text", text }),
      opts.onremove
        ? h("button", { class: "chip-x", "aria-label": `Remove ${text}`, title: "Remove", onclick: opts.onremove }, "×")
        : null,
      opts.onrestore
        ? h("button", { class: "chip-x", "aria-label": `Put back ${text}`, title: "Put back", onclick: opts.onrestore }, "↺")
        : null
    );
  }

  function adder(key, placeholder, onadd, hint) {
    const input = h("input", { type: "text", name: key, placeholder, "data-focus": key, "aria-label": placeholder, autocomplete: "off" });
    const go = () => {
      if (!input.value.trim()) return input.focus();
      const value = input.value;
      if (onadd(value)) toast(`Added ${value.trim()}`);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        go();
      }
    });
    return h("div", { class: "adder" }, input, h("button", { class: "btn small", onclick: go }, "Add"), hint ? h("span", { class: "hint", text: hint }) : null);
  }

  function categoryCard(cat) {
    const spec = (state.doc.categories || {})[cat.name];
    const base = cat.builtin ? BUILTIN.categories[cat.name] : null;
    const baseTerms = new Set(base ? (base.terms || []).map(lower) : []);
    const baseExceptions = new Set(base ? (base.exceptions || []).map(lower) : []);
    const empty = !(cat.terms.length || cat.patterns.length || cat.flagEveryValue);
    const id = `cat-${cat.name}`;

    const toggle = h("input", {
      type: "checkbox",
      role: "switch",
      id: `${id}-on`,
      "data-focus": `${id}-on`,
      checked: cat.enabled,
      disabled: empty,
      onchange: (e) => change((d) => E.setEnabled(BUILTIN, d, cat.name, e.target.checked)),
    });
    const severity = h(
      "select",
      {
        "aria-label": `Severity for ${title(cat.name)}`,
        "data-focus": `${id}-sev`,
        class: `sev sev-${cat.severity}`,
        onchange: (e) => change((d) => E.setSeverity(BUILTIN, d, cat.name, e.target.value)),
      },
      E.SEVERITIES.map((s) => h("option", { value: s, selected: s === cat.severity }, s))
    );

    let presetNote = null;
    if (base && rules.preset !== "none") {
      const from = E.enabledFrom(BUILTIN, cat.name);
      const onByDefault = E.presetEnabled(BUILTIN, state.doc, cat.name);
      if (onByDefault !== cat.enabled && !empty) {
        presetNote = `You've turned this ${cat.enabled ? "on" : "off"}; the ${rules.preset} preset has it ${onByDefault ? "on" : "off"}.`;
      } else if (!onByDefault) {
        presetNote = `Off in the ${rules.preset} preset; the ${from} preset turns it on.`;
      }
    }

    const terms = cat.terms.map((t) => {
      const s = E.termString(t);
      const yours = !baseTerms.has(lower(s));
      return chip(s, {
        cls: yours ? "yours" : "",
        title: `${MODE_HELP[t.mode]}${yours ? " · added by you" : ""}`,
        onremove: () => change((d) => E.removeTerm(BUILTIN, d, cat.name, s)) && toast(`Removed ${s}`),
      });
    });
    const removed = E.removedTerms(BUILTIN, state.doc, cat.name).map((s) =>
      chip(s, {
        cls: "removed",
        title: "Built-in term you removed",
        onrestore: () => change((d) => E.addTerm(BUILTIN, d, cat.name, s)),
      })
    );
    const exceptions = cat.exceptions.map((e) =>
      baseExceptions.has(lower(e))
        ? chip(e, { locked: true, title: "Built-in exception" })
        : chip(e, { cls: "yours", onremove: () => change((d) => E.removeException(BUILTIN, d, cat.name, e)) })
    );

    const reset = spec
      ? h(
          "button",
          {
            class: "link",
            onclick: () => {
              const what = base ? `Undo your changes to ${title(cat.name)}?` : `Delete the ${title(cat.name)} category?`;
              if (confirm(what)) change((d) => E.resetCategory(BUILTIN, d, cat.name));
            },
          },
          base ? "Undo changes" : "Delete category"
        )
      : null;

    return h(
      "section",
      { class: `card cat ${cat.enabled ? "" : "off"} ${spec ? "changed" : ""}`, id, "aria-labelledby": `${id}-title` },
      h(
        "header",
        { class: "cat-head" },
        h("label", { class: "switch", for: `${id}-on` }, toggle, h("span", { class: "track", "aria-hidden": "true" })),
        h("h3", { id: `${id}-title` }, h("label", { for: `${id}-on`, text: title(cat.name) })),
        h("span", { class: `tag ${base ? "" : "tag-yours"}`, text: base ? "built in" : "yours" }),
        spec ? h("span", { class: "tag tag-changed", text: "changed" }) : null,
        h("span", { class: "spacer" }),
        severity
      ),
      cat.description ? h("p", { class: "desc", text: cat.description }) : null,
      presetNote ? h("p", { class: "note", text: presetNote }) : null,
      empty ? h("p", { class: "note warn", text: "Every term is removed, so this category is off." }) : null,
      cat.locations.length
        ? h("p", { class: "note", text: `Only looks in ${cat.locations.map((l) => LOCATION_LABELS[l] || l).join(", ")}.` })
        : null,
      cat.flagEveryValue ? h("p", { class: "note", text: "Flags every value found there, so you can review each one." }) : null,
      cat.terms.length || removed.length || !(cat.patterns.length || cat.flagEveryValue)
        ? h(
            "div",
            { class: "group" },
            h("h4", { text: "Words and phrases" }),
            h("div", { class: "chips" }, terms, removed, !terms.length && !removed.length ? h("span", { class: "hint", text: "None." }) : null),
            adder(`${id}-term`, "Add a word or phrase", (v) => change((d) => E.addTerm(BUILTIN, d, cat.name, v)))
          )
        : null,
      cat.terms.length || cat.exceptions.length
        ? h(
            "div",
            { class: "group" },
            h("h4", { text: "Exceptions" }, h("span", { class: "hint", text: " Text that looks like a match but isn't." })),
            exceptions.length ? h("div", { class: "chips" }, exceptions) : null,
            adder(`${id}-exc`, "Add an exception", (v) => change((d) => E.addException(BUILTIN, d, cat.name, v)))
          )
        : null,
      cat.patterns.length
        ? h(
            "details",
            { class: "group patterns" },
            h("summary", { text: `${cat.patterns.length} pattern${cat.patterns.length === 1 ? "" : "s"} (regular expressions)` }),
            h("ul", {}, cat.patterns.map((p) => h("li", {}, h("code", { text: p })))),
            h("p", { class: "hint", text: "Patterns are for experts; change them in the rules file itself (add_patterns:)." })
          )
        : null,
      reset ? h("footer", { class: "cat-foot" }, reset) : null
    );
  }

  function renderCategories() {
    $("categories").replaceChildren(...rules.categories.map(categoryCard));
  }

  function renderGlobal() {
    const builtinExc = new Set(rules.builtinExceptions.map(lower));
    $("global-exceptions").replaceChildren(
      ...rules.exceptions.map((e) =>
        builtinExc.has(lower(e))
          ? chip(e, { locked: true, title: "Built-in exception" })
          : chip(e, { cls: "yours", onremove: () => change((d) => E.removeException(BUILTIN, d, null, e)) })
      )
    );
    $("global-exceptions-empty").hidden = rules.exceptions.length > 0;
  }

  function renderTest() {
    const text = $("test-text").value;
    const location = $("test-loc").value;
    const found = E.scan(compiled, text, location, true);
    const flagged = found.filter((f) => !f.skipped);
    const out = $("test-out");
    const list = $("test-list");

    if (!text.trim()) {
      out.replaceChildren(h("span", { class: "hint", text: "Paste a note above to see what would be flagged." }));
      list.replaceChildren();
      $("test-summary").textContent = "";
      return;
    }

    // Split the text wherever a match starts or ends, then mark each piece.
    const cuts = new Set([0, text.length]);
    for (const f of found) cuts.add(f.start).add(f.end);
    const points = [...cuts].sort((a, b) => a - b);
    const rank = { high: 0, medium: 1, low: 2 };
    const pieces = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [s, e] = [points[i], points[i + 1]];
      const piece = text.slice(s, e);
      const over = found.filter((f) => f.start <= s && f.end >= e);
      const hits = over.filter((f) => !f.skipped);
      if (hits.length) {
        hits.sort((a, b) => rank[a.severity] - rank[b.severity]);
        pieces.push(h("mark", { class: `hit sev-${hits[0].severity}`, title: hits.map((f) => `${title(f.category)} (${f.severity}): ${f.term}`).join("\n") }, piece));
      } else if (over.length) {
        pieces.push(h("span", { class: "skipped", title: over.map((f) => `Not flagged: exception "${f.skipped}"`).join("\n") }, piece));
      } else {
        pieces.push(piece);
      }
    }
    out.replaceChildren(...pieces);

    $("test-summary").textContent = flagged.length
      ? `${flagged.length} flag${flagged.length === 1 ? "" : "s"}`
      : "Nothing flagged";
    list.replaceChildren(
      ...found.map((f) =>
        h(
          "li",
          { class: f.skipped ? "skipped-row" : "" },
          h("span", { class: `pill sev-${f.severity}`, text: f.skipped ? "skip" : f.severity }),
          h(
            "span",
            {},
            h("strong", { text: f.term.length > 60 ? f.term.slice(0, 57) + "…" : f.term }),
            " ",
            h("span", { class: "hint", text: f.skipped ? `${title(f.category)}, but exception "${f.skipped}" applies` : title(f.category) })
          )
        )
      )
    );
  }

  // ------------------------------------------------------------ open/save

  function loadText(text, name, handle) {
    let data;
    try {
      data = window.jsyaml.load(text);
    } catch (e) {
      const where = e.mark ? ` (line ${e.mark.line + 1}, column ${e.mark.column + 1})` : "";
      toast(`${name} isn't valid YAML${where}: ${e.reason || e.message}. Check indentation and that every list item starts with '- '.`, "error");
      return;
    }
    let loaded;
    try {
      loaded = E.normalizeDoc(data);
      E.buildRules(BUILTIN, loaded.doc, null, `Rules file ${name}`);
    } catch (e) {
      if (!(e instanceof E.RulesError)) throw e;
      toast(e.message, "error");
      return;
    }
    if (state.dirty && !confirm("Open this file and lose your unsaved changes?")) return;
    const notes = [loaded.notice];
    if (/^\s*#/m.test(text) && !text.startsWith("# GEDCOM Privacy Guard rules: your changes")) {
      notes.push("Comments in this file won't be kept when you save it from here.");
    }
    Object.assign(state, { doc: loaded.doc, name, handle: handle || null, dirty: false, notice: notes.filter(Boolean).join(" ") || null });
    refresh();
    toast(`Opened ${name}`);
  }

  async function openFile() {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: "Rules file", accept: { "text/yaml": [".yaml", ".yml"] } }],
        });
        const file = await handle.getFile();
        return loadText(await file.text(), file.name, handle);
      } catch (e) {
        if (e.name === "AbortError") return;
        // Not allowed here (some browsers, file:// pages): use the plain picker.
      }
    }
    $("file-input").click();
  }

  function download(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/yaml" }));
    const a = h("a", { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function save(asNew) {
    const text = E.dumpYaml(state.doc);
    const name = state.name || "my-rules.yaml";
    try {
      if (state.handle && !asNew) {
        const w = await state.handle.createWritable();
        await w.write(text);
        await w.close();
      } else if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: "Rules file", accept: { "text/yaml": [".yaml", ".yml"] } }],
        });
        const w = await handle.createWritable();
        await w.write(text);
        await w.close();
        Object.assign(state, { handle, name: handle.name });
      } else {
        download(text, name);
        state.name = name;
        toast(`Downloaded ${name}. Move it next to your GEDCOM file.`);
        state.dirty = false;
        return refresh();
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      download(text, name); // the browser refused the save dialog: fall back
      state.name = name;
    }
    state.dirty = false;
    refresh();
    toast(`Saved ${state.name}`);
  }

  function startOver() {
    if (state.dirty && !confirm("Start a new rules file and lose your unsaved changes?")) return;
    Object.assign(state, { doc: E.emptyDoc(), name: null, handle: null, dirty: false, notice: null });
    refresh();
  }

  // --------------------------------------------------------------- wiring

  function addCategoryFromForm(e) {
    e.preventDefault();
    const f = e.target;
    const name = f.elements.name.value;
    const ok = change((d) =>
      E.addCategory(BUILTIN, d, name, f.elements.severity.value, f.elements.description.value, f.elements.term.value)
    );
    if (ok) {
      f.reset();
      const id = `cat-${name.trim().toLowerCase().replace(/[\s-]+/g, "_")}`;
      const card = $(id);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Category added. Add more words to it below its name.");
    }
  }

  function init() {
    const preset = $("preset");
    for (const p of E.PRESETS.concat("none")) preset.append(h("option", { value: p }, p === "none" ? "none (only my own)" : p));
    preset.addEventListener("change", (e) => {
      const p = e.target.value;
      const own = Object.keys(state.doc.categories || {}).some((n) => BUILTIN.categories[n]);
      if (p === "none" && own && !confirm("With no preset, your changes to built-in categories will be dropped. Go on?")) {
        e.target.value = rules.preset;
        return;
      }
      change((d) => E.setPreset(BUILTIN, d, p));
    });

    const loc = $("test-loc");
    for (const l of E.LOCATIONS) loc.append(h("option", { value: l }, LOCATION_LABELS[l]));
    $("test-text").addEventListener("input", renderTest);
    loc.addEventListener("change", renderTest);
    $("test-sample").addEventListener("click", () => {
      $("test-text").value = SAMPLE;
      renderTest();
    });

    $("open").addEventListener("click", openFile);
    $("save").addEventListener("click", () => save(false));
    $("save-as").addEventListener("click", () => save(true));
    $("new").addEventListener("click", startOver);
    $("file-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) loadText(await file.text(), file.name, null);
      e.target.value = "";
    });
    $("new-category").addEventListener("submit", addCategoryFromForm);
    $("global-adder").replaceWith(
      adder("global-exc", "Add an exception for every category", (v) => change((d) => E.addException(BUILTIN, d, null, v)))
    );

    document.addEventListener("dragover", (e) => {
      e.preventDefault();
      document.body.classList.add("dropping");
    });
    document.addEventListener("dragleave", (e) => {
      if (!e.relatedTarget) document.body.classList.remove("dropping");
    });
    document.addEventListener("drop", async (e) => {
      e.preventDefault();
      document.body.classList.remove("dropping");
      const file = e.dataTransfer.files[0];
      if (file) loadText(await file.text(), file.name, null);
    });
    window.addEventListener("beforeunload", (e) => {
      if (state.dirty) e.preventDefault();
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save(e.shiftKey);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openFile();
      }
    });

    refresh();
  }

  if (!E || !BUILTIN || !window.jsyaml) {
    document.getElementById("app").replaceChildren(
      h("p", { class: "card note warn", text: "Part of the rules editor is missing (its .js files should sit beside this page). Reinstall gedcom-privacy-guard." })
    );
    return;
  }
  init();
})();
