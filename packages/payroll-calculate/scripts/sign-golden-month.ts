#!/usr/bin/env tsx
/**
 * sign-golden-month.ts — ADR-0341 Pontus signature pass for golden-month expected fixtures.
 *
 * Replaces PENDING_PONTUS_SIGN sentinels with signer email + ISO timestamp.
 * Idempotent: cells already signed are left alone (use --force to re-sign).
 * Lovsen fields (lovsenCitation*, verifiedBy/At) untouched — separate pass per ADR-0342.
 *
 * Usage:
 *   pnpm tsx scripts/sign-golden-month.ts --signer pontus@smartout.no
 *   pnpm tsx scripts/sign-golden-month.ts --signer pontus@smartout.no --force
 *   pnpm tsx scripts/sign-golden-month.ts --signer pontus@smartout.no --dry-run
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SENTINEL = "PENDING_PONTUS_SIGN";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EXPECTED_DIR = resolve(__dirname, "../__tests__/golden-month/expected");

type Cell = Record<string, unknown> & {
  computedBy: string;
  computedAt: string;
};

type FileSpec = {
  filename: string;
  containerKey: string;
  cellsKey: "cells" | "lines" | "entries";
};

const FILES: FileSpec[] = [
  { filename: "shift_snapshots.json", containerKey: "shift_snapshots", cellsKey: "cells" },
  { filename: "aggregated_periods.json", containerKey: "aggregated_periods", cellsKey: "cells" },
  { filename: "payroll_lines.json", containerKey: "payroll_lines", cellsKey: "lines" },
  { filename: "timebank_entries.json", containerKey: "timebank_entries", cellsKey: "entries" },
  { filename: "deviations.json", containerKey: "deviations", cellsKey: "cells" },
];

function parseArgs(): { signer: string; force: boolean; dryRun: boolean } {
  const args = process.argv.slice(2);
  const signerIdx = args.indexOf("--signer");
  if (signerIdx === -1 || !args[signerIdx + 1]) {
    console.error("ERROR: --signer <email> required");
    process.exit(1);
  }
  const signer = args[signerIdx + 1];
  if (!signer.includes("@")) {
    console.error(`ERROR: signer "${signer}" must be email-shaped`);
    process.exit(1);
  }
  return {
    signer,
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
  };
}

function signCell(cell: Cell, signer: string, ts: string, force: boolean): boolean {
  let changed = false;
  if (cell.computedBy === SENTINEL || (force && typeof cell.computedBy === "string")) {
    cell.computedBy = signer;
    changed = true;
  }
  if (cell.computedAt === SENTINEL || (force && typeof cell.computedAt === "string")) {
    cell.computedAt = ts;
    changed = true;
  }
  return changed;
}

function processFile(
  spec: FileSpec,
  signer: string,
  ts: string,
  force: boolean,
  dryRun: boolean,
): { signed: number; skipped: number; total: number } {
  const filepath = resolve(EXPECTED_DIR, spec.filename);
  const data = JSON.parse(readFileSync(filepath, "utf-8")) as Record<
    string,
    Array<Record<string, unknown>>
  >;
  const container = data[spec.containerKey];
  if (!Array.isArray(container)) {
    throw new Error(`${spec.filename}: missing or non-array container key "${spec.containerKey}"`);
  }

  let signed = 0;
  let total = 0;
  for (const group of container) {
    const cells = group[spec.cellsKey];
    if (!Array.isArray(cells)) continue;
    for (const cell of cells as Cell[]) {
      total++;
      if (signCell(cell, signer, ts, force)) signed++;
    }
  }

  if (!dryRun && signed > 0) {
    writeFileSync(filepath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  }

  return { signed, skipped: total - signed, total };
}

function main(): void {
  const { signer, force, dryRun } = parseArgs();
  const ts = new Date().toISOString();

  console.log(`ADR-0341 Pontus signature pass`);
  console.log(`  signer:   ${signer}`);
  console.log(`  ts:       ${ts}`);
  console.log(`  force:    ${force}`);
  console.log(`  dry-run:  ${dryRun}`);
  console.log("");

  let totalSigned = 0;
  let totalCells = 0;
  for (const spec of FILES) {
    const { signed, skipped, total } = processFile(spec, signer, ts, force, dryRun);
    totalSigned += signed;
    totalCells += total;
    console.log(`  ${spec.filename.padEnd(28)} signed=${signed} skipped=${skipped} total=${total}`);
  }
  console.log("");
  console.log(
    `Total: ${totalSigned}/${totalCells} cells signed${dryRun ? " (dry-run, no writes)" : ""}`,
  );
  if (totalSigned === 0 && !force) {
    console.log(`Note: 0 signed. Cells may be already-signed; use --force to override.`);
  }
}

main();
