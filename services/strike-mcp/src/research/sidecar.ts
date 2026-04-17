import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Saves raw (PII) sample values to a sidecar file outside the main mappings.
 * The .local directory is gitignored — raw values never enter version control.
 */
export async function saveSidecar(
  mappingsDir: string,
  entity: string,
  sidecar: Record<string, unknown[]>,
): Promise<void> {
  const localDir = join(mappingsDir, ".local");
  await mkdir(localDir, { recursive: true });
  const path = join(localDir, `${entity}.sidecar.json`);
  await writeFile(path, JSON.stringify(sidecar, null, 2) + "\n", "utf-8");
}

/**
 * Loads a sidecar file. Returns null if it does not exist.
 */
export async function loadSidecar(
  mappingsDir: string,
  entity: string,
): Promise<Record<string, unknown[]> | null> {
  const path = join(mappingsDir, ".local", `${entity}.sidecar.json`);
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as Record<string, unknown[]>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}
