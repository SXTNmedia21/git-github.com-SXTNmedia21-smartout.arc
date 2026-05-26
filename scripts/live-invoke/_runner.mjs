// scripts/live-invoke/_runner.mjs
// Runs every <domain>.mjs in this directory and reports a pass/fail summary.
// Consumed by prod-ready scan to score axis 9 across all domains.

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const scripts = readdirSync(here)
  .filter((f) => f.endsWith(".mjs"))
  .filter((f) => !f.startsWith("_"))
  .sort();

if (scripts.length === 0) {
  console.error("[runner] no live-invoke scripts found");
  process.exit(2);
}

const results = [];
for (const script of scripts) {
  const start = Date.now();
  const r = spawnSync(process.execPath, [join(here, script)], {
    stdio: "inherit",
    env: process.env,
  });
  const ms = Date.now() - start;
  const domain = script.replace(/\.mjs$/, "");
  results.push({ domain, exitCode: r.status ?? -1, ms });
}

console.log("");
console.log("━━━ live-invoke summary ━━━");
let anyFail = false;
for (const r of results) {
  const tag = r.exitCode === 0 ? "✓" : "✗";
  if (r.exitCode !== 0) anyFail = true;
  console.log(`  ${tag} ${r.domain.padEnd(20)} ${r.exitCode === 0 ? "pass" : `fail(${r.exitCode})`}  ${r.ms}ms`);
}
console.log("");
console.log(JSON.stringify({ summary: results, anyFail }, null, 2));
process.exit(anyFail ? 1 : 0);
