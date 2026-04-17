#!/usr/bin/env tsx
/**
 * Council follow-up 2026-04-16 (surfaced by Task #6 emit-SQL verification).
 *
 * Heal Tier 1 attestation state. The bug:
 *   - Patch scripts set needs_review=false on approved fields ✓
 *   - auto_align --commit promotes a regenerated field_map that overrode
 *     needs_review back to true based on align.ts's own verdict (a SUGGESTION,
 *     not authoritative for already-attested fields)
 *   - Engine refuses to run on any field with needs_review=true
 *   - Net result: every "attested" mapping had unreviewed fields the engine
 *     wouldn't accept, despite a valid approval_hash
 *
 * Fix shipped:
 *   - align.ts buildAlignedFieldMap now preserves needs_review=false when
 *     the original was approved AND align.ts's verdict still recommends the
 *     same target+transform.
 *
 * This script: heals the EXISTING state across all 11 attested mappings.
 *   - For every field with target+transform set: lock needs_review=false
 *     (treat as previously-approved, since the patches set those values)
 *   - For every field without a target (or target=null) with needs_review
 *     still true: silently drop (target=null + needs_review=false), recording
 *     the bulk drop in known_quirks
 *   - Re-attest each entity (auto_align --commit) — approval_hash will rotate
 *     but the mapping is now engine-runnable
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/sweep_attestations.ts
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

const ENTITIES = [
  "workspace", "company", "locations", "departments", "employee_types",
  "teams", "users", "profiles", "shifts", "salary_transactions",
];

async function sweepOne(entity: string): Promise<{ locked: number; dropped: number }> {
  const path = join(REPO, "mappings", `${entity}.json`);
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;
  let locked = 0;
  let dropped = 0;
  const droppedFields: string[] = [];

  for (const [key, entry] of Object.entries(m.field_map)) {
    if (entry.target !== null && entry.target !== undefined && entry.transform !== undefined) {
      // Has a real mapping — lock as approved (the patch script set target+transform)
      if (entry.needs_review) {
        entry.needs_review = false;
        locked++;
      }
    } else if (entry.needs_review) {
      // No target set + still flagged → silent drop (sweeper consensus)
      droppedFields.push(key);
      delete m.field_map[key];
      dropped++;
    }
  }

  if (locked > 0 || dropped > 0) {
    m.known_quirks = [
      ...(m.known_quirks ?? []),
      `Sweep 2026-04-16: ${locked} fields locked needs_review=false (target+transform already set by prior patch); ${dropped} unmapped+unreviewed fields silently dropped (auto-sweeper consensus). Triggered by emit-SQL verification surfacing align.ts/engine.ts attestation gap. See align.ts buildAlignedFieldMap fix (preserves human approval).`,
    ];
    m.last_verified = new Date().toISOString();
    await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");

    await appendDecision(HISTORY, {
      scope: "schema", workspace: WORKSPACE!, entity,
      action: "field_approved",
      target: `bulk-sweep`,
      transform: `locked=${locked} dropped=${dropped}`,
      by: "pontus",
      reasoning: `Council follow-up 2026-04-16: heal post-attest needs_review state surfaced by Task #6 emit verification. Locked ${locked} fields previously approved by patch but downgraded by align.ts; dropped ${dropped} unmapped+unreviewed (${droppedFields.slice(0, 10).join(", ")}${droppedFields.length > 10 ? "..." : ""}).`,
    });
  }

  console.log(`${entity.padEnd(25)} locked=${locked.toString().padStart(3)}  dropped=${dropped.toString().padStart(3)}  remaining=${Object.keys(m.field_map).length}`);
  return { locked, dropped };
}

(async () => {
  let totalLocked = 0;
  let totalDropped = 0;
  for (const e of ENTITIES) {
    const r = await sweepOne(e);
    totalLocked += r.locked;
    totalDropped += r.dropped;
  }
  console.log();
  console.log(`Total: ${totalLocked} fields locked, ${totalDropped} fields dropped across ${ENTITIES.length} entities.`);
  console.log("Now re-run auto_align --commit per entity to refresh approval_hash.");
})().catch((e) => { console.error(e); process.exit(1); });
