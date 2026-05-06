#!/usr/bin/env node
/**
 * Adds .js extensions to relative imports in compiled ESM output.
 * Node.js ESM requires explicit file extensions; tsc with moduleResolution:"bundler" doesn't add them.
 * Handles both file imports (./foo → ./foo.js) and directory imports (./bar → ./bar/index.js).
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";

const DIST = resolve(process.argv[2] ?? "dist");

// Static (`from "..."` / `import "..."`) AND dynamic (`import("...")` /
// `await import("...")`) imports. Both need .js suffix in compiled ESM
// output for Node.js to resolve.
const IMPORT_RE = /(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g;

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function fixFile(filePath) {
  const content = await readFile(filePath, "utf-8");
  const dir = dirname(filePath);

  const fixed = content.replace(IMPORT_RE, (match, specifier) => {
    if (specifier.endsWith(".js") || specifier.endsWith(".json")) return match;
    const quote = match.includes("'") ? "'" : '"';
    const prefix = match.startsWith("from") ? "from " : "import ";

    const asFile = resolve(dir, specifier + ".js");
    const asIndex = resolve(dir, specifier, "index.js");

    // Check synchronously which exists (files are already built)
    try {
      const { statSync } = require("node:fs");
      // Can't use require in ESM, use a different approach
    } catch {}

    // We'll collect and fix in a second pass
    return match;
  });

  if (fixed !== content) {
    await writeFile(filePath, fixed, "utf-8");
  }
}

// Collect all .js and .d.ts files, build a set keyed on .js paths
async function collectFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await collectFiles(full, files);
    else if (e.name.endsWith(".js") || e.name.endsWith(".d.ts")) files.push(full);
  }
  return files;
}

const allFiles = await collectFiles(DIST);
// Resolution set uses .js paths (both .js and .d.ts resolve to the same module)
const jsFileSet = new Set(allFiles.filter((f) => f.endsWith(".js")));

let fixCount = 0;

for (const filePath of allFiles) {
  // Skip .d.ts.map files
  if (filePath.endsWith(".d.ts.map")) continue;

  const content = await readFile(filePath, "utf-8");
  const dir = dirname(filePath);

  const fixed = content.replace(IMPORT_RE, (match, specifier) => {
    if (specifier.endsWith(".js") || specifier.endsWith(".json")) return match;

    const asFile = resolve(dir, specifier + ".js");
    const asIndex = resolve(dir, specifier, "index.js");

    let resolved;
    if (jsFileSet.has(asFile)) {
      resolved = specifier + ".js";
    } else if (jsFileSet.has(asIndex)) {
      resolved = specifier + "/index.js";
    } else {
      return match; // external or already resolved
    }

    // Replace just the specifier portion. Preserves the surrounding
    // syntax (works for static `from "x"` and dynamic `import("x")`).
    const quote = match.includes("'") ? "'" : '"';
    const specifierIdx = match.lastIndexOf(specifier);
    const prefix = match.slice(0, specifierIdx);
    return `${prefix}${resolved}${quote}`;
  });

  if (fixed !== content) {
    await writeFile(filePath, fixed, "utf-8");
    fixCount++;
  }
}

console.log(`Fixed ESM imports in ${fixCount} files.`);
