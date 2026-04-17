import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Extract the leading numeric prefix from a migration filename.
 * Handles both 5-digit (00001_) and 14-digit (20260227120000_) prefixes.
 * Returns BigInt for accurate comparison across prefix widths.
 */
function extractNumericPrefix(filename: string): bigint {
  const match = filename.match(/^(\d+)/);
  if (!match) return BigInt(0);
  return BigInt(match[1]);
}

/**
 * Reads a migrations directory, filters .sql files, and returns their full
 * paths sorted by numeric prefix (ascending). Handles mixed 5-digit and
 * 14-digit prefixes via BigInt comparison.
 */
export async function readAndSortMigrationFiles(
  migrationsDir: string,
): Promise<string[]> {
  const entries = await readdir(migrationsDir);
  const sqlFiles = entries.filter((f) => f.endsWith(".sql"));

  sqlFiles.sort((a, b) => {
    const pa = extractNumericPrefix(a);
    const pb = extractNumericPrefix(b);
    if (pa < pb) return -1;
    if (pa > pb) return 1;
    return a.localeCompare(b);
  });

  return sqlFiles.map((f) => join(migrationsDir, f));
}

/**
 * Reads each migration file in order, concatenates contents, and returns
 * the SHA-256 hex digest. Deterministic: same files in same order always
 * produce the same hash. Adding, removing, or modifying any file changes
 * the hash.
 */
export async function computeV3SchemaHash(
  migrationFilePaths: string[],
): Promise<string> {
  const hash = createHash("sha256");
  for (const filePath of migrationFilePaths) {
    const content = await readFile(filePath, "utf-8");
    hash.update(content);
  }
  return hash.digest("hex");
}
