import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `vite preview` sends the same headers (including the CSP) as Cloudflare
// Pages does from public/_headers, so local testing matches production.
const headers = Object.fromEntries(
  readFileSync(new URL("public/_headers", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => /^\s+[\w-]+:/.test(line))
    .map((line) => line.trim().split(/:\s*(.*)/s).slice(0, 2)),
);

export default defineConfig({
  plugins: [react()],
  // Pyodide finds its runtime files itself (from /pyodide/); don't pre-bundle it.
  optimizeDeps: { exclude: ["pyodide"] },
  worker: { format: "es" },
  preview: { headers },
});
