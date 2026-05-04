#!/usr/bin/env node
/**
 * Invariant I2 — every emit('x.y') in the workspace must have a matching
 * entry in packages/telemetry/src/registry.ts.
 *
 * ADR-0116 + ADR-0175. Closes L-0094 (phantom emit contracts, 4th repeat).
 */
import { readFileSync } from "node:fs";
import { globby } from "globby";
import { join } from "node:path";

export type EmitViolation = {
  file: string;
  line: number;
  event: string;
};

export async function checkEmitRegistryCoverage(opts: {
  root: string;
}): Promise<{ violations: EmitViolation[] }> {
  const registryPath = join(opts.root, "registry.ts");
  // Also look for registry.ts in src/ — telemetry package ships src/registry.ts.
  let registryContent: string;
  try {
    registryContent = readFileSync(registryPath, "utf8");
  } catch {
    registryContent = readFileSync(join(opts.root, "src/registry.ts"), "utf8");
  }

  const registered = new Set<string>();
  for (const m of registryContent.matchAll(/"([a-z_]+\.[a-z0-9_.]+)"\s*:/gi)) {
    registered.add(m[1]);
  }

  const files = await globby(["src/**/*.ts"], {
    cwd: opts.root,
    absolute: true,
  });
  const violations: EmitViolation[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/emit\(\s*\{\s*event:\s*["']([a-z_]+\.[a-z0-9_.]+)["']/i);
      if (!m) continue;
      if (!registered.has(m[1])) {
        violations.push({ file, line: i + 1, event: m[1] });
      }
    }
  }
  return { violations };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? process.cwd();
  checkEmitRegistryCoverage({ root }).then((r) => {
    if (r.violations.length === 0) {
      console.log("ok: all emit() calls registered in registry.ts");
      process.exit(0);
    }
    console.error(`${r.violations.length} unregistered emit call(s):`);
    for (const v of r.violations) {
      console.error(`  ${v.file}:${v.line} — ${v.event}`);
    }
    process.exit(1);
  });
}
