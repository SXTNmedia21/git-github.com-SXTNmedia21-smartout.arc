// ============================================
// root.ts
// Monorepo root detection utility.
// Walks up the directory tree from CWD to find the project root,
// identified by the presence of pnpm-workspace.yaml.
// Connected to: all commands that need to resolve docs/ paths
// ============================================

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

/** Cached project root to avoid repeated filesystem walks */
let cachedRoot: string | null = null;

/**
 * Finds the monorepo root directory.
 *
 * Why: When scripts run via `pnpm --filter`, the CWD is the package
 * directory (packages/docs-pipeline/), not the monorepo root.
 * We need the root to resolve docs/ paths correctly.
 *
 * Walks up from CWD looking for pnpm-workspace.yaml as the root marker.
 *
 * @returns Absolute path to the monorepo root
 * @throws Error if no root is found (not in a pnpm workspace)
 */
export function findProjectRoot(): string {
  if (cachedRoot) return cachedRoot;

  let current = resolve(process.cwd());
  const root = dirname(current) === current ? current : undefined;

  while (current !== root) {
    if (existsSync(resolve(current, "pnpm-workspace.yaml"))) {
      cachedRoot = current;
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(
    "Could not find monorepo root (no pnpm-workspace.yaml found). " +
      "Run this command from within the Smartout monorepo.",
  );
}
