import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function slugify(input: string): string {
  // Drop diacritics, replace non-alphanumeric with dashes, collapse, trim
  // Pre-replace characters NFKD doesn't decompose (ø, Ø)
  const preNormalized = input.replace(/ø/g, "o").replace(/Ø/g, "O");
  const normalized = preNormalized.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const dashed = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return dashed === "" ? "unnamed" : dashed;
}

export interface WriteStagedFilesOptions {
  stagingDir: string;       // base staging directory (e.g. supabase/migration-staging)
  workspaceSlug: string;    // subdirectory under stagingDir
  orderIndex: number;       // 1-99 — used as zero-padded prefix
  entity: string;           // e.g. "workspaces", "locations"
  sql: string;
  report: string;
}

export interface StagedFiles {
  sqlPath: string;
  reportPath: string;
  workspaceDir: string;
}

export async function writeStagedFiles(opts: WriteStagedFilesOptions): Promise<StagedFiles> {
  const workspaceDir = join(opts.stagingDir, opts.workspaceSlug);
  await mkdir(workspaceDir, { recursive: true });

  const prefix = String(opts.orderIndex).padStart(2, "0");
  const sqlPath = join(workspaceDir, `${prefix}_${opts.entity}.sql`);
  const reportPath = join(workspaceDir, `${prefix}_${opts.entity}.report.md`);

  await writeFile(sqlPath, opts.sql, "utf-8");
  await writeFile(reportPath, opts.report, "utf-8");

  return { sqlPath, reportPath, workspaceDir };
}
