#!/usr/bin/env node
/**
 * Adds .js extensions to relative imports in compiled ESM output.
 * Node.js ESM requires explicit file extensions; tsc with moduleResolution:"bundler" doesn't add them.
 * Handles both file imports (./foo → ./foo.js) and directory imports (./bar → ./bar/index.js).
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";

const DIST = resolve(process.argv[2] ?? "dist");

const IMPORT_RE = /(?:from|import)\s+["'](\.[^"']+)["']/g;

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

// Simpler approach: collect all .js files, build a set, then fix imports
async function collectFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await collectFiles(full, files);
    else if (e.name.endsWith(".js")) files.push(full);
  }
  return files;
}

const allFiles = await collectFiles(DIST);
const fileSet = new Set(allFiles);

let fixCount = 0;

for (const filePath of allFiles) {
  const content = await readFile(filePath, "utf-8");
  const dir = dirname(filePath);

  const fixed = content.replace(IMPORT_RE, (match, specifier) => {
    if (specifier.endsWith(".js") || specifier.endsWith(".json")) return match;

    const asFile = resolve(dir, specifier + ".js");
    const asIndex = resolve(dir, specifier, "index.js");

    let resolved;
    if (fileSet.has(asFile)) {
      resolved = specifier + ".js";
    } else if (fileSet.has(asIndex)) {
      resolved = specifier + "/index.js";
    } else {
      return match; // external or already resolved
    }

    const keyword = match.match(/^(?:from|import)\s+/)[0];
    const quote = match.includes("'") ? "'" : '"';
    return `${keyword}${quote}${resolved}${quote}`;
  });

  if (fixed !== content) {
    await writeFile(filePath, fixed, "utf-8");
    fixCount++;
  }
}

console.log(`Fixed ESM imports in ${fixCount} files.`);
