// Tests every outside link in the site's pages (docs/*.md, which
// scripts/doc-pages.ts turns into pages) and the app's own source.
// Writes a Markdown report and exits 1 if any are broken.
//   node web/scripts/check-links.mjs [report.md]     (from the repo root)
// Run weekly by .github/workflows/link-check.yml.
// Adapted from new-site-kit's starter/tools/check-links.mjs (26 Nov 2026).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCES = ['docs', 'web/src', 'web/index.html', 'README.md'];
const TYPES = /\.(md|tsx?|html)$/i;

const files = [];
const walk = (path) => {
  if (statSync(path).isDirectory()) for (const name of readdirSync(path)) walk(join(path, name));
  else if (TYPES.test(path)) files.push(path);
};
SOURCES.forEach(walk);

const where = new Map();
for (const file of files) {
  for (let [url] of readFileSync(file, 'utf8').matchAll(/https?:\/\/[^\s)"'`<>\]{}$]+/g)) {
    url = url.replace(/[.,;:]+$/, '');
    if (/^https?:\/\/(www\.)?w3\.org\//.test(url) || /^https?:\/\/(localhost|127\.)/.test(url)) continue;
    if (!where.has(url)) where.set(url, new Set());
    where.get(url).add(file);
  }
}
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; site-link-check)', Accept: '*/*' };
const SLOW_MS = 30_000;

async function check(url) {
  let last = 'no response';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(SLOW_MS) });
      await response.body?.cancel();
      if (response.ok) return null;
      // These answer scripts with a refusal, which says nothing about the link itself.
      if ([401, 403, 429].includes(response.status)) return null;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error.name === 'TimeoutError' ? 'timed out' : (error.cause?.code ?? error.message);
    }
  }
  return last;
}

const queue = [...where.keys()];
const broken = [];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const url = queue.shift();
    const problem = await check(url);
    if (problem) broken.push({ url, problem });
  }
}));

console.log(`${where.size} outside links checked, ${broken.length} broken`);
const report = broken
  .sort((a, b) => a.url.localeCompare(b.url))
  .map(({ url, problem }) => `- ${url}\n  - ${problem}, in ${[...where.get(url)].join(', ')}`)
  .join('\n');
if (report) console.log(report);
if (process.argv[2]) writeFileSync(process.argv[2], report ? `These links on the site look broken:\n\n${report}\n` : '');
process.exit(broken.length ? 1 : 0);
