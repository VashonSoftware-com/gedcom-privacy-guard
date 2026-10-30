// Turns the user-facing docs in ../docs into pages on the site, so testers
// read them here rather than on GitHub. docs/*.md stays the one source:
// GitHub shows the same text. Links between these pages stay on the site;
// links to anything else in the repository go to GitHub.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { marked } from "marked";
import type { Plugin } from "vite";

const REPO = "https://github.com/VashonSoftware-com/gedcom-privacy-guard";

/** Each page: the doc it comes from, its address on the site, and its name in the menu. */
export const PAGES = [
  { doc: "what-it-can-do.md", slug: "what-it-can-do", nav: "What it can and can't do" },
  { doc: "help-wanted.md", slug: "help-us-test", nav: "Help us test it" },
  { doc: "exporting.md", slug: "exporting", nav: "Getting your GEDCOM file" },
  { doc: "safety.md", slug: "safety", nav: "Why your data is safe" },
  { doc: "how-it-works.md", slug: "how-it-works", nav: "How it decides" },
  { doc: "legacy.md", slug: "legacy", nav: "Legacy users" },
];

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Where a link in docs/<from> should point on the site. */
function rewrite(href: string): string {
  if (/^([a-z]+:|#|\/)/i.test(href)) return href;
  const [path, hash = ""] = href.split("#");
  const target = posix.normalize(posix.join("docs", path));
  const page = PAGES.find((p) => `docs/${p.doc}` === target);
  if (page) return `/${page.slug}/` + (hash && `#${hash}`);
  const kind = target.endsWith("/") || !target.includes(".") ? "tree" : "blob";
  return `${REPO}/${kind}/main/${target}` + (hash && `#${hash}`);
}

function render(markdown: string): { title: string; description: string; html: string } {
  const title = markdown.match(/^# (.+)$/m)?.[1] ?? "GEDCOM Privacy Guard";
  const first = markdown.split(/\n\s*\n/).find((p) => p.trim() && !p.startsWith("#")) ?? "";
  const description = first.replace(/[*_`[\]]|\(([^)]*)\)/g, "").replace(/\s+/g, " ").trim().slice(0, 155);
  const html = (marked.parse(markdown) as string).replace(/href="([^"]*)"/g, (_, h) => {
    const to = rewrite(h.replace(/&amp;/g, "&"));
    const external = /^https?:/.test(to) ? ' target="_blank" rel="noreferrer"' : "";
    return `href="${escape(to)}"${external}`;
  });
  return { title, description, html };
}

export function docPages(footer: { version: string; sha: string; date: string }): Plugin {
  return {
    name: "doc-pages",
    apply: "build",
    // After the build's own files are written, before closeBundle lists
    // every file for the service worker.
    writeBundle(options, bundle) {
      const dist = options.dir!;
      const css = Object.keys(bundle).find((f) => f.endsWith(".css"));
      const nav = PAGES.map((p) => `<a href="/${p.slug}/">${escape(p.nav)}</a>`).join("\n          ");
      for (const page of PAGES) {
        const { title, description, html } = render(readFileSync(new URL(`../../docs/${page.doc}`, import.meta.url), "utf8"));
        const out = join(dist, page.slug);
        mkdirSync(out, { recursive: true });
        writeFileSync(
          join(out, "index.html"),
          `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escape(description)}" />
    <meta name="theme-color" content="#152a41" />
    <title>${escape(title)} · GEDCOM Privacy Guard</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/manifest.webmanifest" />
    ${css ? `<link rel="stylesheet" href="/${css}" />` : ""}
  </head>
  <body>
    <div class="page">
      <header class="doc-head">
        <a href="/"><img class="logo small" src="/logo.svg" alt="" width="64" height="64" /></a>
        <div>
          <p class="site-name"><a href="/">GEDCOM Privacy Guard</a></p>
          <nav>
          <a href="/">Check a file</a>
          ${nav}
          </nav>
        </div>
      </header>
      <main class="doc">
${html}
      </main>
      <footer>
        <p class="footer-copy">
          Free and <a href="${REPO}">open source</a>. This page is also on
          <a href="${REPO}/blob/main/docs/${page.doc}">GitHub</a>.
          <br />
          <span class="footer-version">Version ${escape(footer.version)} · build
          <a href="${REPO}/commit/${footer.sha}">${footer.sha.slice(0, 7)}</a> · ${footer.date}</span>
        </p>
        <p class="footer-credit">
          <a class="site-credit-link" href="https://vashonsoftware.com" target="_blank" rel="noreferrer">Site by Vashon Software</a>
        </p>
      </footer>
    </div>
  </body>
</html>
`,
        );
      }
    },
  };
}
