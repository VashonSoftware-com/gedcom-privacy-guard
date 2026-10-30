import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// `vite preview` sends the same headers (including the CSP) as Cloudflare
// Pages does from public/_headers, so local testing matches production.
const headers = Object.fromEntries(
  readFileSync(new URL("public/_headers", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => /^\s+[\w-]+:/.test(line))
    .map((line) => line.trim().split(/:\s*(.*)/s).slice(0, 2)),
);

// After a build, write dist/sw.js from sw.js with the list of every file
// to keep for offline use (see sw.js). Headers, maps and the worker
// itself aren't page files.
function serviceWorker(): Plugin {
  return {
    name: "service-worker",
    apply: "build",
    closeBundle() {
      const dist = fileURLToPath(new URL("dist/", import.meta.url));
      const files = readdirSync(dist, { recursive: true, withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => relative(dist, join(d.parentPath, d.name)).replace(/\\/g, "/"))
        .filter((f) => !/^(_headers|sw\.js|404\.html)$|\.map$/.test(f))
        .sort();
      const hash = createHash("sha256");
      for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
      const urls = ["/", ...files.filter((f) => f !== "index.html").map((f) => `/${f}`)];
      writeFileSync(
        join(dist, "sw.js"),
        readFileSync(new URL("sw.js", import.meta.url), "utf8")
          .replace("__VERSION__", hash.digest("hex").slice(0, 16))
          .replace("__FILES__", JSON.stringify(urls, null, 1)),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // Pyodide finds its runtime files itself (from /pyodide/); don't pre-bundle it.
  optimizeDeps: { exclude: ["pyodide"] },
  worker: { format: "es" },
  preview: { headers },
});
