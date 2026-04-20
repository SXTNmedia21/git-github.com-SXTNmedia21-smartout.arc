#!/usr/bin/env tsx
/**
 * Task #21 — fix shifts + salary_transactions field-name discrepancy.
 *
 * Live Bubble API returns different field names than discovery sidecar showed:
 *   - Shifts: starred variants (*dateStart, *dateEnd, *Live, *🎎 Profile,
 *     *_shiftStatus) + different bare names (shift.durationSeconds not
 *     durationsSeconds, tean not teamId, department not departmentId).
 *     shiftType/profileId/teamId/departmentId/isLive?/date.start/date.end
 *     do NOT exist in the live API response.
 *   - Salary_transactions: 4. Date uses "YYYY.MM.DD" (dots, not dashes).
 *     🏠 department and 🎎 team are absent on most rows (nullable, fine).
 *
 * This script:
 *   1. Rewrites shifts field_map with actual live API field names
 *   2. Updates derived_columns to use actual source fields
 *   3. Adds role = 'Vakt' constant (post-migration backfill via team.name join)
 *   4. Updates required_source_fields to match live API
 *   5. Removes 🏠 department and 🎎 team from salary_transactions
 *      required_source_fields (sparse on live API)
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_fix_live_api_fields.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { appendDecision } from "../src/history/decision_log.js";
import type { Mapping, FieldMapEntry } from "../src/research/mapping.js";

const WORKSPACE = process.env.STRIKE_WORKSPACE_SLUG;
if (!WORKSPACE) { console.error("STRIKE_WORKSPACE_SLUG required"); process.exit(1); }

const REPO = join(import.meta.dirname, "..");
const HISTORY = process.env.STRIKE_HISTORY_DIR ?? join(REPO, "history");

function mkField(target: string, transform: string | null, types: string[] = ["string"]): FieldMapEntry {
  return { target, transform, needs_review: false, source_value_types: types, occurrence_count: 100, sample_values: [] };
}

async function fixShifts(): Promise<void> {
  const path = join(REPO, "mappings", "shifts.json");
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;

  // Rebuild field_map with actual live API field names.
  // Old names (from stale sidecar) are deleted; new names inserted.
  const newFieldMap: Record<string, FieldMapEntry> = {
    "_id":                    mkField("schedule_shift_id", "fk_uuid:shift"),
    "workspace":              mkField("workspace_id", "fk_uuid:workspace"),
    "*🎎 Profile":            mkField("employee_id", "fk_uuid:profile"),
    "tean":                   mkField("team_id", "fk_uuid:team"),
    "department":             mkField("department_id", "fk_uuid:department"),
    "*Live":                  mkField("is_published", null, ["boolean"]),
    "shift.durationSeconds":  mkField("work_hours", "seconds_to_hours", ["number"]),
    "Created Date":           mkField("created_at", "bubble_date_to_tstz"),
    "Modified Date":          mkField("updated_at", "bubble_date_to_tstz"),
  };

  m.field_map = newFieldMap;

  // Derived columns: use actual live API field names
  m.derived_columns = {
    shift_date: { from: "*dateStart", transform: "iso_to_date" },
    start_time: { from: "*dateStart", transform: "iso_to_time" },
    end_time:   { from: "*dateEnd",   transform: "iso_to_time" },
  };

  // Constants: add role since shiftType/🗓️ shiftType is sparse or FK-only
  m.constant_columns = {
    source: "bubble_migration",
    day_category: "weekday",
    role: "Vakt",
  };

  m.required_source_fields = ["_id", "workspace", "*dateStart", "*dateEnd", "shift.durationSeconds"];

  m.known_quirks = [
    ...(m.known_quirks ?? []).filter(q => !q.startsWith("Sweep 2026")),
    "Task #21 fix 2026-04-17: live Bubble API returns starred variants (*dateStart, *dateEnd, *Live, *🎎 Profile, *_shiftStatus) + different bare names (shift.durationSeconds, tean, department) — NOT the names discovery sidecar showed (date.start, durationsSeconds, teamId, etc.). All field_map keys rewritten to match live API.",
    "role constant 'Vakt' (Norwegian for 'shift/duty') — shiftType field does not exist in live API; 🗓️ shiftType is a sparse FK (1/50 records). Post-migration backfill: UPDATE schedule_shift SET role = t.name FROM public.team t WHERE t.team_id = schedule_shift.team_id;",
    "day_category constant 'weekday' per Q5 — post-migration backfill via public_holiday + dow lookup.",
    "source constant 'bubble_migration' per ADR-0108.",
    "FK to employee_id via *🎎 Profile (Bubble starred computed field returning Bubble profile ID).",
    "tean is Bubble's typo for 'team' — live field name, not our error.",
  ];

  m.last_verified = new Date().toISOString();
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");

  await appendDecision(HISTORY, {
    scope: "schema", workspace: WORKSPACE!, entity: "shifts",
    action: "field_map_rewritten",
    target: "public.schedule_shift",
    by: "pontus",
    reasoning: "Task #21: discovery sidecar diverged from live API. All field_map keys rewritten to match actual Bubble Data API response. role constant 'Vakt' set (shiftType field absent in live API). Verified via live probe of 50 shifts.",
  });

  console.log(`shifts: field_map rewritten (${Object.keys(newFieldMap).length} fields), derived_columns updated, role='Vakt' constant added.`);
}

async function fixSalaryTransactions(): Promise<void> {
  const path = join(REPO, "mappings", "salary_transactions.json");
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;

  // Required source fields: remove 🏠 department and 🎎 team (sparse on live API)
  m.required_source_fields = ["_id", "🏰 workspace", "🎎 Profile", "4. Date"];

  // 🏠 department and 🎎 team stay in field_map but are not required — engine
  // produces null for missing fields (fk_uuid returns null for null/undefined).

  m.known_quirks = [
    ...(m.known_quirks ?? []).filter(q => !q.startsWith("Sweep 2026")),
    "Task #21 fix 2026-04-17: 🏠 department + 🎎 team removed from required_source_fields — sparse on live API (most salary_transaction rows lack them). FK transforms return null for absent fields, which is fine (both columns nullable in v3).",
    "4. Date field uses YYYY.MM.DD (dot-separated, not ISO). iso_to_date transform extended 2026-04-17 to accept dot format: '2024.06.12' → '2024-06-12'.",
    ...(m.known_quirks ?? []).filter(q => q.startsWith("raw_json") || q.startsWith("bubble_record_id") || q.startsWith("source constant") || q.startsWith("archived_at") || q.startsWith("Profile-level") || q.startsWith("FK to") || q.startsWith("17,607") || q.startsWith("a_melding")),
  ];

  m.last_verified = new Date().toISOString();
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");

  await appendDecision(HISTORY, {
    scope: "schema", workspace: WORKSPACE!, entity: "salary_transactions",
    action: "required_source_fields_fix",
    target: "public.payroll_ledger_archive",
    by: "pontus",
    reasoning: "Task #21: 🏠 department + 🎎 team removed from required (sparse on live API, nullable in v3). iso_to_date extended for dot-separated date format.",
  });

  console.log("salary_transactions: required_source_fields fixed (removed sparse 🏠 department + 🎎 team).");
}

(async () => {
  await fixShifts();
  await fixSalaryTransactions();
})().catch((e) => { console.error(e); process.exit(1); });
