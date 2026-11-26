// Turns the user-facing docs in ../docs into pages on the site, so testers
// read them here rather than on GitHub. docs/*.md stays the one source:
// GitHub shows the same text. Links between these pages stay on the site;
// links to anything else in the repository go to GitHub.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { marked } from "marked";
import type { Plugin } from "vite";
import { GLOBE_SVG, GREEN_NOTE_HTML } from "../src/greenNote";

const REPO = "https://github.com/VashonSoftware-com/gedcom-privacy-guard";

/** Each page: the doc it comes from, its address on the site, and its name
 * in the menu (none: linked from the footer only). */
export const PAGES: { doc: string; slug: string; nav?: string }[] = [
  { doc: "what-it-can-do.md", slug: "what-it-can-do", nav: "What it can and can't do" },
  { doc: "help-wanted.md", slug: "help-us-test", nav: "Help us test it" },
  { doc: "exporting.md", slug: "exporting", nav: "Getting your GEDCOM file" },
  { doc: "safety.md", slug: "safety", nav: "Why your data is safe" },
  { doc: "how-it-works.md", slug: "how-it-works", nav: "How it decides" },
  { doc: "legacy.md", slug: "legacy", nav: "Legacy users" },
  { doc: "privacy.md", slug: "privacy" },
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

const SITE = "https://gedcomtools.com";

export function docPages(footer: { version: string; sha: string; date: string }): Plugin {
  return {
    name: "doc-pages",
    apply: "build",
    // After the build's own files are written, before closeBundle lists
    // every file for the service worker.
    writeBundle(options, bundle) {
      const dist = options.dir!;
      const css = Object.keys(bundle).find((f) => f.endsWith(".css"));
      const nav = PAGES.filter((p) => p.nav).map((p) => `<a href="/${p.slug}/">${escape(p.nav!)}</a>`).join("\n          ");

      /** A whole page in the site's frame. `doc` is the docs/ file it
       * comes from (none for the 404 page, which isn't indexed). */
      const frame = (o: { title: string; description: string; html: string; path: string; doc?: string }) => {
        const url = SITE + o.path;
        const meta = o.doc
          ? `<link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="GEDCOM Tools" />
    <meta property="og:title" content="${escape(o.title)}" />
    <meta property="og:description" content="${escape(o.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />`
          : `<meta name="robots" content="noindex" />`;
        const source = o.doc
          ? ` This page is also on
          <a href="${REPO}/blob/main/docs/${o.doc}">GitHub</a>.`
          : "";
        return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escape(o.title)} · GEDCOM Privacy Guard</title>
    <meta name="description" content="${escape(o.description)}" />
    ${meta}
    <meta name="theme-color" content="#152a41" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/favicon.png" type="image/png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    ${css ? `<link rel="stylesheet" href="/${css}" />` : ""}
  </head>
  <body>
    <div class="page">
      <header class="doc-head">
        <a href="/"><img class="logo small" src="/logo-plain.webp" alt="" width="64" height="64" /></a>
        <div>
          <p class="site-name"><a href="/">GEDCOM Privacy Guard</a></p>
          <nav>
          <a href="/">Check a file</a>
          ${nav}
          </nav>
        </div>
      </header>
      <main class="doc">
${o.html}
      </main>
      <footer>
        <p class="footer-copy">
          Free and <a href="${REPO}">open source</a>.${source}
          <br />
          <span class="footer-version">Version ${escape(footer.version)} · build
          <a href="${REPO}/commit/${footer.sha}">${footer.sha.slice(0, 7)}</a> · ${footer.date}</span>
        </p>
        <p class="footer-credit">
          <a href="/privacy/">Privacy</a>
          <a class="site-credit-link" href="https://vashonsoftware.com" target="_blank" rel="noreferrer">Site by Vashon Software</a>
        </p>
        <p class="green-note">${GLOBE_SVG}<span>${GREEN_NOTE_HTML}</span></p>
        <p class="footer-trademark">GEDCOM is a registered trademark of Intellectual Reserve, Inc. This site is not affiliated with or endorsed by FamilySearch.</p>
      </footer>
    </div>
  </body>
</html>
`;
      };

      for (const page of PAGES) {
        const rendered = render(readFileSync(new URL(`../../docs/${page.doc}`, import.meta.url), "utf8"));
        const out = join(dist, page.slug);
        mkdirSync(out, { recursive: true });
        writeFileSync(join(out, "index.html"), frame({ ...rendered, path: `/${page.slug}/`, doc: page.doc }));
      }

      // Cloudflare serves this for any address that doesn't exist
      // ("not_found_handling": "404-page" in wrangler.jsonc), with status 404.
      writeFileSync(
        join(dist, "404.html"),
        frame({
          title: "Page not found",
          description: "There's no page at this address.",
          path: "/404.html",
          html: `<h1>Page not found</h1>
<p>There's no page at this address. It may have moved, or the link may have a typo.</p>
<p><a href="/">Check a family tree file</a>, or pick a page from the menu above.</p>`,
        }),
      );

      // For search engines. Cloudflare's managed robots.txt adds its own
      // content signals above these lines.
      const urls = ["/", ...PAGES.map((p) => `/${p.slug}/`)];
      writeFileSync(
        join(dist, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${footer.date}</lastmod></url>`).join("\n")}
</urlset>
`,
      );
      writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
    },
  };
}
