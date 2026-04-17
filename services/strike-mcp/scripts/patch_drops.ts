#!/usr/bin/env tsx
/**
 * Day 4 patch — formalize entities intentionally NOT migrated.
 *
 * shift_satellites: per ADR-0003 conflict_strategy="folded" (concept).
 *   Bubble has 100/2750 rows but data is folded into schedule_shift at
 *   transform time, not migrated as a standalone v3 table. Currently no
 *   sidecar fields are folded (no extracted shift_satellite columns mapped
 *   to schedule_shift), but the entity is reserved for future extension.
 *
 * swaprecords: per council 2026-04-15. Bubble has 18 rows (14 pending,
 *   2 approved, 1 started). v3 models swaps as engine_process instances,
 *   not as table rows. ALL are dropped at migration. Cutover notice
 *   required: pending swaps must be re-initiated in v3 post-migration.
 *
 * Both are attested with known_empty_source=true (semantically: no SQL
 *   emitted) and the drop reasoning recorded in known_quirks for the
 *   handoff doc.
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_drops.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { appendDecision } from "../src/history/decision_log.js";
import type { Mapping } from "../src/research/mapping.js";

const WORKSPACE = process.env.STRIKE_WORKSPACE_SLUG;
if (!WORKSPACE) { console.error("STRIKE_WORKSPACE_SLUG required"); process.exit(1); }

const REPO = join(import.meta.dirname, "..");
const HISTORY = process.env.STRIKE_HISTORY_DIR ?? join(REPO, "history");

type DropSpec = {
  entity: string;
  // Conceptual target (for documentation only — no SQL emitted)
  conceptualTarget: string;
  reasoning: string;
  knownQuirks: string[];
};

const DROPS: DropSpec[] = [
  {
    entity: "shift_satellites",
    conceptualTarget: "(folded into public.schedule_shift)",
    reasoning:
      "Bubble shift_satellite is a denormalized sidecar for schedule_shift. " +
      "Per ADR-0003, satellite data is conceptually folded into the parent " +
      "schedule_shift row at transform time, not migrated as a standalone v3 " +
      "table. Tier 1 schedule_shift attestation does not currently extract " +
      "any satellite-specific columns (notes, custom rates, etc.); future " +
      "schedule_shift mapping extensions can pull from satellite at need.",
    knownQuirks: [
      "ADR-0003 conflict_strategy='folded': no v3 target table; no SQL emitted.",
      "Bubble shift_satellite has 100/2750 sample rows. If satellite-specific data is needed in v3 (notes, custom_rate, custom_rate_type), extend mappings/shifts.json with derived_columns reading the relevant satellite fields rather than reactivating this mapping.",
      "Apply step: do nothing for shift_satellites. The schedule_shift INSERTs already cover all migrated shift data.",
    ],
  },
  {
    entity: "swaprecords",
    conceptualTarget: "(dropped — v3 models swaps as engine_process)",
    reasoning:
      "Per council 2026-04-15: v3 models shift swaps as engine_process " +
      "instances (workflow runtime), not as table rows. Bubble's 18 swap " +
      "records (14 pending, 2 approved, 1 started) cannot be 1:1 migrated " +
      "to v3. ALL are dropped at migration time. Cutover communication: " +
      "employees with pending swaps must re-initiate them in v3 post-migration.",
    knownQuirks: [
      "Council 2026-04-15 verdict: drop all 18 swaprecords. v3 swaps are engine_process workflow instances, not table rows.",
      "Cutover notice REQUIRED: 14 pending swaps in Bubble are silently lost at migration. Employees affected: review with HR before cutover and either resolve in Bubble (approve/reject) OR notify employees to re-initiate in v3 day 1.",
      "Apply step: do nothing for swaprecords. No engine_process instances are pre-seeded for migrated workspaces — they're created on demand by employee swap actions.",
      "Future audit of dropped swaprecord IDs lives in raw Bubble export (out of strike-mcp scope); not preserved in v3.",
    ],
  },
];

async function patchDropped(spec: DropSpec): Promise<void> {
  const path = join(REPO, "mappings", `${spec.entity}.json`);
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;
  m.target_table = null;
  m.known_empty_source = true;
  m.known_quirks = spec.knownQuirks;
  m.last_verified = new Date().toISOString();
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");

  await appendDecision(HISTORY, {
    scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
    action: "mapping_attested_empty",
    target: spec.conceptualTarget,
    by: "pontus",
    reasoning: spec.reasoning,
  });

  console.log(`${spec.entity}: attested as drop. target=null, known_empty_source=true.`);
}

(async () => {
  for (const spec of DROPS) {
    await patchDropped(spec);
  }
})().catch((e) => { console.error(e); process.exit(1); });
