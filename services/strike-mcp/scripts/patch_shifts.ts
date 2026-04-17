#!/usr/bin/env tsx
/**
 * Day 2 patch — shifts → public.schedule_shift.
 *
 * Per council 2026-04-16 Q4-Q5 verdicts:
 * - Q4: enum coercion deferred (drop _shiftStatus, leave v3 DEFAULT 'created').
 * - Q5: day_category constant 'weekday' + post-migration backfill via
 *       public_holiday + day-of-week join. Avoids transform-time holiday lookup.
 *
 * Uses 3 transforms registered Day 1 (commit d68f245):
 *   iso_to_date, iso_to_time, seconds_to_hours.
 *
 * FK ordering (apply-time only — strike-mcp emits SQL regardless):
 *   workspace → company → location → department → team → employee_type →
 *   user_identity (Day 3 manual) → profile (Day 3) → schedule_shift (this)
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_shifts.ts
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

type FieldPatch = { field: string; target: string; transform: string | null; reasoning: string };
type EntitySpec = {
  entity: string;
  targetTable: string;
  approvals: FieldPatch[];
  drops: { field: string; reasoning: string }[];
  derived: Record<string, { from: string; transform: string }>;
  constants: Record<string, string | number | boolean | null>;
  requiredSourceFields: string[];
  knownQuirks: string[];
};

const SHIFTS: EntitySpec = {
  entity: "shifts",
  targetTable: "public.schedule_shift",
  approvals: [
    { field: "_id",              target: "schedule_shift_id", transform: "fk_uuid:shift",       reasoning: "Bubble _id → deterministic v5 UUID keyed on entity=shift" },
    { field: "workspace",        target: "workspace_id",      transform: "fk_uuid:workspace",   reasoning: "Explicit FK to v3 workspace per ADR-0004" },
    { field: "profileId",        target: "employee_id",       transform: "fk_uuid:profile",     reasoning: "FK to v3 profile (nullable in v3 schema, but FK constraint enforced; profiles must apply before shifts)" },
    { field: "teamId",           target: "team_id",           transform: "fk_uuid:team",        reasoning: "FK to v3 team (nullable); teams already attested Day 1" },
    { field: "departmentId",     target: "department_id",     transform: "fk_uuid:department",  reasoning: "FK to v3 department (nullable); departments attested" },
    { field: "shiftType",        target: "role",              transform: "trim",                reasoning: "Bubble shiftType → v3 role text NOT NULL. Sample: 'Servitør', 'Kokk'." },
    { field: "isLive?",          target: "is_published",      transform: null,                  reasoning: "Boolean passthrough; v3 is_published default false. true = published to schedule." },
    { field: "Created Date",     target: "created_at",        transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble creation timestamp" },
    { field: "Modified Date",    target: "updated_at",        transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble modification timestamp" },
    { field: "durationsSeconds", target: "work_hours",        transform: "seconds_to_hours",    reasoning: "Bubble durationSeconds (number) → v3 work_hours numeric NOT NULL default 0. Transform: round(seconds/3600, 2)." },
  ],
  drops: [
    { field: "salary.int",                reasoning: "Denormalized total salary cache; v3 derives via payroll_ledger_archive aggregation" },
    { field: "team.title",                reasoning: "Denormalized team name cache; v3 derives via JOIN team_id → team.name" },
    { field: "department.title",          reasoning: "Denormalized department name cache; v3 derives via JOIN" },
    { field: " profileName",              reasoning: "Denormalized profile name cache (note leading space); v3 derives via JOIN" },
    { field: "_shiftStatus",              reasoning: "Q4 verdict: enum coercion deferred. v3 status DEFAULT 'created' applies. Post-migration backfill from Bubble values if needed." },
    { field: "_shiftType_color",          reasoning: "Bubble UI color hint; v3 indicator has DEFAULT 'blue'. Color belongs to team/role, not shift." },
    { field: "date.start",                reasoning: "Used by derived_columns (shift_date + start_time); not stored as raw datetime in v3 schedule_shift" },
    { field: "date.end",                  reasoning: "Used by derived_columns (end_time); not stored as raw datetime in v3 schedule_shift" },
    { field: "jobTitle",                  reasoning: "Bubble job title cache; covered by role text from shiftType" },
    { field: "Show in market?",           reasoning: "Bubble swap-marketplace flag; v3 models swaps as engine_process — out of schedule_shift scope" },
    { field: "date.punchout",             reasoning: "Bubble actual punch-out timestamp; v3 stores actuals in timesheet.time_entry, not schedule_shift" },
    { field: "date.punchin",              reasoning: "Bubble actual punch-in timestamp; same — belongs in timesheet, not schedule" },
    { field: "*Live",                     reasoning: "Bubble denormalized live flag (asterisk = computed); covered by isLive? → is_published" },
    { field: "*_shiftStatus",             reasoning: "Bubble computed dup of _shiftStatus; same drop reasoning (enum deferred)" },
    { field: "department",                reasoning: "Bubble department name string; covered by departmentId FK" },
    { field: "list of 🗓️ salaryStrings",  reasoning: "Bubble denormalized payroll display strings; v3 derives via payroll_ledger_archive" },
    { field: "*dateStart",                reasoning: "Bubble computed dup of date.start; covered by derived_columns" },
    { field: "tean",                      reasoning: "Bubble typo field 'tean' (sic); covered by teamId" },
    { field: "shift.Salary",              reasoning: "Bubble denormalized total salary; v3 derives via SUM payroll_ledger_archive.total_salary" },
    { field: "ID",                        reasoning: "Bubble auto-incrementing display ID; v3 uses uuid PK only" },
    { field: "shift.durationSeconds",     reasoning: "Bubble computed dup of durationsSeconds; covered" },
    { field: "*dateEnd",                  reasoning: "Bubble computed dup of date.end; covered by derived_columns" },
    { field: "baseSalary",                reasoning: "Bubble denormalized base salary; v3 derives via payroll_ledger_archive.base_salary" },
    { field: "*🎎 Profile",                reasoning: "Bubble denormalized profile object reference; covered by profileId → employee_id FK" },
    { field: "list of 🗓️ records",        reasoning: "Bubble linked time-record array; v3 inverts (timesheet.time_entry.shift_id FKs back to schedule_shift)" },
    { field: "access 🔑 key",              reasoning: "Bubble access-control key; out of Tier 1 scope" },
    { field: "payrollId",                 reasoning: "Bubble payroll FK array; v3 inverts (payroll_ledger_archive.schedule_shift_id FKs back)" },
    { field: "Api Id",                    reasoning: "Bubble external API ID for legacy integration; v3 has no equivalent" },
    { field: "placeholder.Json",          reasoning: "Bubble UI placeholder data; not operational, not migrated" },
    { field: "Log",                       reasoning: "Bubble per-shift audit log array; v3 has activity_trail (separate, derived from telemetry events)" },
    { field: "date.archived",             reasoning: "Bubble soft-delete timestamp; v3 schedule_shift has no soft-delete column (hard delete via cascade or migration filter)" },
    { field: "Archived ",                 reasoning: "Bubble soft-delete flag (note trailing space); v3 has no equivalent — should filter out archived rows during apply" },
    { field: "Admin log",                 reasoning: "Bubble admin audit log; v3 has activity_trail (separate)" },
    { field: "shift.Json",                reasoning: "Bubble debug JSON cache of full shift; not migrated (no v3 raw column for schedule_shift)" },
    { field: "*list 🔔 _channels",         reasoning: "Bubble notification channels array; out of Tier 1 scope (notification system handled separately)" },
    { field: "Title",                     reasoning: "Bubble shift title (often empty); v3 schedule_shift has no title column — role + date + employee identify a shift" },
    { field: "date.lastSalary_run",       reasoning: "Bubble timestamp of last payroll run; v3 derives via MAX(payroll_ledger_archive.archived_at)" },
    { field: "🗓️ salaryType 🚨",          reasoning: "Bubble salary-type FK; v3 derives via tariff_rate_table lookup at payroll time" },
    { field: "list of 🗓️ supplement",     reasoning: "Bubble supplement records array; v3 has supplement entries inside payroll_ledger_archive" },
    { field: "🗓️ shiftType",              reasoning: "Bubble shiftType FK (object) — different from text shiftType; covered by role text from text-typed shiftType" },
    { field: "employment_profile",        reasoning: "Bubble employment_profile FK on shift; v3 derives via employment_contract per profile (no per-shift contract reference)" },
    { field: "- overMidnight",            reasoning: "Bubble denormalized overnight flag; v3 derives from end_time < start_time comparison" },
    { field: "shift_satellite",           reasoning: "Bubble sidecar entity FK; per ADR-0003 satellites are folded into schedule_shift, not migrated as standalone" },
    { field: "worktime.hours",            reasoning: "Bubble denormalized worked-hours cache; v3 work_hours derived from durationsSeconds (planned), actuals live in timesheet" },
    { field: "list of 🗓️ salaryDetails",  reasoning: "Bubble salary-detail array; v3 has payroll_ledger_archive (per-row archive, not array)" },
    { field: "worktime.start",            reasoning: "Bubble actual punch-in; v3 stores in timesheet.time_entry, not schedule_shift" },
    { field: "worktime.end",              reasoning: "Bubble actual punch-out; v3 stores in timesheet.time_entry" },
    { field: "worktime.salary",           reasoning: "Bubble denormalized worktime salary; v3 derives via payroll_ledger_archive" },
    { field: "workTime_record",           reasoning: "Bubble FK to worktime record (🗓️record._recordType=workTime); v3 derives via timesheet.time_entry FK from time_entry side" },
    { field: "🔔 notification v.2",        reasoning: "Bubble notification reference; v3 has dedicated notification system separate from schedule_shift" },
    { field: "_shiftFlaggs",              reasoning: "Bubble flag array (sic — typo for flags); out of Tier 1 scope" },
    { field: "*Message",                  reasoning: "Bubble computed denormalized message text; out of Tier 1 scope" },
    { field: "User verified?",            reasoning: "Bubble verification flag (whether assignee accepted); v3 has confirmed_at/confirmed_by columns (currently nullable, default null)" },
    { field: "🗓️ salaryLog",              reasoning: "Bubble salary log FK; v3 derives via payroll_ledger_archive history" },
    { field: "salaryDetail_JSON",         reasoning: "Bubble cached JSON of salary details; not migrated (covered by payroll_ledger_archive.raw_json on each ledger row)" },
    { field: "swapRecord",                reasoning: "Bubble swap FK; v3 models swaps as engine_process — drop per council 2026-04-15 (all 18 swaps dropped)" },
    { field: "chat",                      reasoning: "Bubble chat reference; v3 messaging is separate, not on schedule_shift" },
    { field: "Created By",                reasoning: "Bubble user ID for record author; not v3 created_by (which is a timestamp; created_at handles this)" },
    { field: "shift",                     reasoning: "Bubble self-reference cache field; not meaningful for migration" },
  ],
  derived: {
    shift_date: { from: "date.start", transform: "iso_to_date" },
    start_time: { from: "date.start", transform: "iso_to_time" },
    end_time:   { from: "date.end",   transform: "iso_to_time" },
  },
  constants: {
    source: "bubble_migration",
    day_category: "weekday",
  },
  requiredSourceFields: ["_id", "workspace", "shiftType", "date.start", "date.end", "durationsSeconds"],
  knownQuirks: [
    "day_category constant 'weekday' per Q5 verdict — post-migration backfill via public_holiday + dow lookup. Cannot derive at transform time without holiday data already in v3.",
    "source constant 'bubble_migration' per ADR-0108 — overrides v3 DEFAULT 'operational' so M8 reconciliation triggers don't fire on imported rows.",
    "Status defaults to 'created' per v3 — Bubble _shiftStatus enum coercion deferred per Q4. May need post-migration cleanup if _shiftStatus held meaningful state.",
    "Indicator defaults to 'blue' per v3 — Bubble _shiftType_color was a UI hint only.",
    "Breaks defaults to 0 — Bubble has no break-minutes field on shift entity itself (break records live in 🗓️record where _recordType ∈ {break, meal}).",
    "shift_date / start_time / end_time derived from date.start / date.end via iso_to_date / iso_to_time (transforms registered Day 1 commit d68f245).",
    "work_hours derived from durationsSeconds via seconds_to_hours; v3 work_hours is numeric NOT NULL default 0.",
    "FK to employee_id is nullable in v3 schema BUT FK constraint to public.profile is enforced. Apply order: profiles must land before shifts.",
    "swapRecord field dropped — v3 models swaps as engine_process per council 2026-04-15.",
    "Archived rows: 'Archived ' boolean (note trailing space) is dropped here. Apply step should optionally filter out archived rows or migrate them as status='cancelled'.",
    "position_id always null on migrated rows — Bubble has no position concept; v3 position is per-shift but optional, derived elsewhere.",
  ],
};

async function patch(spec: EntitySpec): Promise<void> {
  const path = join(REPO, "mappings", `${spec.entity}.json`);
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;
  m.target_table = spec.targetTable;
  if (Object.keys(spec.derived).length > 0) m.derived_columns = spec.derived;
  if (Object.keys(spec.constants).length > 0) m.constant_columns = spec.constants;
  m.required_source_fields = spec.requiredSourceFields;

  await appendDecision(HISTORY, {
    scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
    action: "target_table_set", target: spec.targetTable, by: "pontus",
    reasoning: "Day 2 council 2026-04-16 verdict (Q4 enum deferral, Q5 day_category constant)",
  });

  let approved = 0;
  for (const p of spec.approvals) {
    const entry = m.field_map[p.field];
    if (!entry) { console.error(`WARN[${spec.entity}]: field not found: ${JSON.stringify(p.field)}`); continue; }
    entry.target = p.target;
    entry.transform = p.transform;
    entry.needs_review = false;
    await appendDecision(HISTORY, {
      scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
      action: "field_approved", field: p.field, target: p.target,
      transform: p.transform, by: "pontus", reasoning: p.reasoning,
    });
    approved++;
  }

  let dropped = 0;
  for (const d of spec.drops) {
    if (!(d.field in m.field_map)) { console.error(`WARN[${spec.entity}]: not in field_map: ${JSON.stringify(d.field)}`); continue; }
    delete m.field_map[d.field];
    await appendDecision(HISTORY, {
      scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
      action: "field_dropped", field: d.field, by: "pontus", reasoning: d.reasoning,
    });
    dropped++;
  }

  for (const [target, deriv] of Object.entries(spec.derived)) {
    await appendDecision(HISTORY, {
      scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
      action: "field_approved", target,
      transform: `${deriv.transform}(${deriv.from}) via derived_columns`,
      by: "pontus", reasoning: `ADR-0004 derived: ${target} from ${deriv.from} via ${deriv.transform}`,
    });
  }
  for (const [target, value] of Object.entries(spec.constants)) {
    await appendDecision(HISTORY, {
      scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
      action: "field_approved", target,
      transform: `constant ${JSON.stringify(value)}`,
      by: "pontus", reasoning: `ADR-0004 constant: ${target} = ${JSON.stringify(value)}`,
    });
  }

  m.last_verified = new Date().toISOString();
  m.known_quirks = spec.knownQuirks;
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");
  console.log(`${spec.entity}: ${approved} approved, ${dropped} dropped, ${Object.keys(m.field_map).length} field_map entries remain (expected 0).`);
}

(async () => {
  await patch(SHIFTS);
})().catch((e) => { console.error(e); process.exit(1); });
