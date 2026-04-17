#!/usr/bin/env tsx
/**
 * Council follow-up 2026-04-16 (Steward C4 + R3).
 *
 * Generate a named CSV of pending Bubble swap records for HR triage at
 * cutover. Strike-mcp drops swaprecords entirely (per council 2026-04-15)
 * but operations need to know WHO had pending swaps so managers can do
 * outreach + employees can re-initiate in v3.
 *
 * Output: reports/<workspace>-pending-swaps.csv
 *
 * Columns:
 *   bubble_swap_id, bubble_status, requested_at,
 *   initiator_email, initiator_name,
 *   counterparty_email, counterparty_name,
 *   shift_a_date, shift_a_role,
 *   shift_b_date, shift_b_role
 *
 * STATUS: STUB. The sidecar files used by discovery store column samples
 * (one column → up to N samples) but NOT row tuples — to produce per-row
 * CSV rows we need either:
 *
 *   Option A: a fresh Bubble fetch via the bubble client that emits rows
 *     instead of column samples (extension to bubble/types.ts + a new
 *     emit_full_rows mode).
 *   Option B: an operator-supplied CSV export from Bubble Data Tab that
 *     this script then enriches with v3 user/shift names by looking up
 *     bubble IDs in the existing sidecars.
 *
 * Recommend Option B for Tier 1 — operator does the export once. This
 * script then:
 *   1. Reads operator-supplied bubble_swaprecords_export.csv (raw Bubble
 *      Data Tab CSV, columns: _id, Wanted by?, Claimd by, _marketStatus,
 *      🗓️ Shift, Created Date, Approved by, etc.)
 *   2. Cross-references with users.sidecar.json (firstName, lastName)
 *   3. Cross-references with shifts.sidecar.json (date.start, shiftType)
 *   4. Writes reports/<workspace>-pending-swaps.csv with denormalized rows
 *
 * Until Option B is implemented, manually build the CSV from a Bubble
 * export. Wrightegaarden has 14 pending rows (council 2026-04-15 verdict).
 *
 * Usage (when implemented):
 *   STRIKE_WORKSPACE_SLUG=wrightegaarden \
 *     pnpm tsx scripts/gen_pending_swaps_csv.ts \
 *     --bubble-export=/path/to/bubble_swaprecords_export.csv
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const WORKSPACE = process.env.STRIKE_WORKSPACE_SLUG;
if (!WORKSPACE) { console.error("STRIKE_WORKSPACE_SLUG required"); process.exit(1); }

const BUBBLE_EXPORT_FLAG = process.argv.find((a) => a.startsWith("--bubble-export="));
const REPO = join(import.meta.dirname, "..");

if (!BUBBLE_EXPORT_FLAG) {
  console.error(`
This script is a STUB pending operator action. To produce the CSV today:

1. In Bubble Data Tab → ⏱️swaprecord → filter to active rows (those NOT
   _marketStatus=approved or completed).
2. Export to CSV with columns: _id, Wanted by?, Claimd by, _marketStatus,
   🗓️ Shift, Created Date, Approved by, Reason.
3. Re-run with: --bubble-export=/path/to/export.csv

Wrightegaarden expected: 14 rows (pending: 14, approved: 2, started: 1
per council 2026-04-15 — only the 14 pending matter for outreach).

Or: manually fill reports/wrightegaarden-pending-swaps.csv from the Bubble
data tab and skip this script entirely. The CSV header is:
  bubble_swap_id,bubble_status,requested_at,
  initiator_email,initiator_name,
  counterparty_email,counterparty_name,
  shift_a_date,shift_a_role,
  shift_b_date,shift_b_role
`);
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────
// Implementation skeleton — fill in when operator provides the export.
// ─────────────────────────────────────────────────────────────────────────

async function generate(): Promise<void> {
  const bubbleExportPath = BUBBLE_EXPORT_FLAG!.split("=")[1];
  const csvText = await readFile(bubbleExportPath, "utf-8");

  // TODO: parse Bubble CSV (likely UTF-8 BOM, semicolon delimiters in some
  // exports, emoji-prefixed column names → trim + canonicalize).
  // TODO: load users.sidecar.json + shifts.sidecar.json for name lookup.
  // TODO: emit denormalized rows.

  console.error("Implementation pending. CSV text length:", csvText.length);
  process.exit(3);

  // eslint-disable-next-line @typescript-eslint/no-unreachable -- skeleton
  const reportsDir = join(REPO, "reports");
  await mkdir(reportsDir, { recursive: true });
  const outPath = join(reportsDir, `${WORKSPACE}-pending-swaps.csv`);
  const header = "bubble_swap_id,bubble_status,requested_at,initiator_email,initiator_name,counterparty_email,counterparty_name,shift_a_date,shift_a_role,shift_b_date,shift_b_role\n";
  await writeFile(outPath, header, "utf-8");
  console.log(`Wrote ${outPath}`);
}

generate().catch((e) => { console.error(e); process.exit(1); });
