// Checks the built site in dist/. Runs at the end of `npm run build`, or
// on its own:  node scripts/check-site.mjs
// Stops the build (so the last good version stays live) for:
//  - a file over Cloudflare's 25 MiB limit (the deploy would fail anyway)
//  - a page without a <title> or description, or a missing 404 page,
//    sitemap or robots.txt
// Warns, and still publishes, for internal links, images and #anchors that
// don't resolve. The warnings go into dist/build-checks.json, which the
// build-alert workflow turns into a "Site check found problems" issue.
// Adapted from new-site-kit's starter/tools/check-site.mjs (26 Nov 2026).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const MAX_BYTES = 25 * 1024 * 1024;
const files = readdirSync(DIST, { recursive: true })
  .map((f) => join(DIST, f))
  .filter((f) => statSync(f).isFile());
const urlOf = (f) => "/" + relative(DIST, f).split(sep).join("/");
const pageUrl = (f) => urlOf(f).replace(/(^|\/)index\.html$/, "$1");
const known = new Set(files.map(urlOf));
const html = files.filter((f) => f.endsWith(".html"));
for (const f of html) known.add(pageUrl(f));

const anchors = new Map(
  html.map((f) => [pageUrl(f), new Set([...readFileSync(f, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]),
);
const resolves = (path) => known.has(path) || known.has(path.replace(/\/$/, "")) || known.has(path + "/");

const problems = []; // stop the build
const warnings = []; // publish anyway, but report

for (const f of html) {
  const page = readFileSync(f, "utf8");
  if (!/<title>[^<]+<\/title>/.test(page)) problems.push(`${pageUrl(f)}: no <title>`);
  if (!/<meta name="description" content="[^"]+"/.test(page)) problems.push(`${pageUrl(f)}: no description`);
  for (const [, raw] of page.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:|tel:|blob:)/.test(raw) || raw.startsWith("//")) continue;
    const link = raw.replace(/&amp;/g, "&");
    const [path, hash] = link.split("#");
    const target = (path || pageUrl(f)).split("?")[0];
    if (!target.startsWith("/")) warnings.push(`${pageUrl(f)}: relative link ${link}`);
    else if (!resolves(target)) warnings.push(`${pageUrl(f)}: links to a missing page or file, ${link}`);
    else if (hash && anchors.has(target) && !anchors.get(target).has(hash))
      warnings.push(`${pageUrl(f)}: links to a missing spot on a page, ${link}`);
  }
}

for (const need of ["/404.html", "/robots.txt", "/sitemap.xml", "/favicon.ico", "/og-image.png"]) {
  if (!known.has(need)) problems.push(`${need} is missing`);
}
for (const f of files) {
  if (statSync(f).size > MAX_BYTES) problems.push(`${urlOf(f)}: over Cloudflare's 25 MiB file limit`);
}

let commit = process.env.WORKERS_CI_COMMIT_SHA || "";
if (!commit)
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    // Not a git checkout: the file still records the warnings.
  }
const unique = [...new Set(warnings)];
writeFileSync(
  join(DIST, "build-checks.json"),
  JSON.stringify({ commit, time: new Date().toISOString(), warnings: unique }, null, 1),
);

console.log(`Site check: ${html.length} pages, ${files.length} files.`);
if (unique.length) console.warn(`Warnings (the site still publishes):\n${unique.join("\n")}`);
if (problems.length) {
  console.error(`Stopping the build; the live site keeps its last good version:\n${[...new Set(problems)].join("\n")}`);
  process.exit(1);
}
console.log(unique.length ? "No problems that stop the build." : "All checks passed.");
