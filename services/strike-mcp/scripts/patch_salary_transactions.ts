#!/usr/bin/env tsx
/**
 * Day 2 patch — salary_transactions → public.payroll_ledger_archive.
 *
 * Per smartout.ai ADR-0110 + strike-mcp ADR-0005: every migrated payroll-ledger
 * row carries the full Bubble source record as raw_json (jsonb NOT NULL).
 * Field-level mappings populate the typed columns (workspace_id, profile_id,
 * transaction_date, hours, base_salary, total_salary, a_melding_code,
 * accounting_account_code) for direct querying; the raw_json column preserves
 * the full audit trail for any field not mapped here.
 *
 * 17,607 rows in Wrightegaarden — biggest table by row count. Apply order:
 * profiles must land before salary_transactions (profile_id is NOT NULL FK).
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_salary_transactions.ts
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
  rawJsonTarget: string | null;
  requiredSourceFields: string[];
  knownQuirks: string[];
};

const SALARY_TRANSACTIONS: EntitySpec = {
  entity: "salary_transactions",
  targetTable: "public.payroll_ledger_archive",
  approvals: [
    { field: "_id",                     target: "payroll_ledger_id",       transform: "fk_uuid:payroll_ledger", reasoning: "Bubble _id → deterministic v5 UUID keyed on entity=payroll_ledger" },
    { field: "🏰 workspace",            target: "workspace_id",            transform: "fk_uuid:workspace",      reasoning: "Explicit FK to v3 workspace per ADR-0004" },
    { field: "🎎 Profile",              target: "profile_id",              transform: "fk_uuid:profile",        reasoning: "FK to v3 profile (NOT NULL); profiles must apply before salary_transactions" },
    { field: "Related_Shift",           target: "schedule_shift_id",       transform: "fk_uuid:shift",          reasoning: "FK to v3 schedule_shift (nullable); shifts attested earlier this Day 2" },
    { field: "🏠 department",           target: "department_id",           transform: "fk_uuid:department",     reasoning: "FK to v3 department (nullable); departments attested Day 1" },
    { field: "🎎 team",                 target: "team_id",                 transform: "fk_uuid:team",           reasoning: "FK to v3 team (nullable); teams attested Day 1" },
    { field: "4. Date",                 target: "transaction_date",        transform: "iso_to_date",            reasoning: "Bubble ISO datetime → v3 date NOT NULL. Strips time component (settlement is per-day)." },
    { field: "9. Hours",                target: "hours",                   transform: null,                     reasoning: "Numeric passthrough (hours worked); v3 hours is numeric nullable" },
    { field: "10. Base Salary",         target: "base_salary",             transform: null,                     reasoning: "Numeric passthrough (base salary in NOK); v3 base_salary is numeric nullable" },
    { field: "11. Total Salary",        target: "total_salary",            transform: null,                     reasoning: "Numeric passthrough (total salary in NOK = base + supplements); v3 total_salary is numeric nullable" },
    { field: "a_melding_code",          target: "a_melding_code",          transform: "trim",                   reasoning: "Norwegian a-melding payroll code (e.g. 'fastloenn', 'timeloenn'); carried for Tripletex sync" },
    { field: "Accounting_Account_Code", target: "accounting_account_code", transform: "trim",                   reasoning: "Tripletex accounting account code (e.g. '5000'); carried for direct GL posting" },
  ],
  drops: [
    { field: "13. Profile.salaryIdentifyer", reasoning: "Bubble denormalized profile.salaryIdentifier cache; recoverable from raw_json. Profile-level data, not transaction-level." },
    { field: "8. Stop time",                 reasoning: "Bubble per-transaction end timestamp; v3 derives from related schedule_shift.end_time. Available in raw_json for audit." },
    { field: "Comment",                      reasoning: "Bubble per-transaction free-text comment; v3 has no comment column on payroll_ledger_archive. Preserved in raw_json." },
    { field: "Created Date",                 reasoning: "Bubble creation timestamp; v3 archived_at has DEFAULT now() (the archive timestamp, not the source creation). Bubble Created Date in raw_json." },
    { field: "5. Titel “name”",              reasoning: "Bubble per-transaction display title; v3 derives from related shift role. In raw_json." },
    { field: "7. Start time",                reasoning: "Bubble per-transaction start timestamp; v3 derives from related schedule_shift.start_time. In raw_json." },
    { field: "Active?",                      reasoning: "Bubble soft-active flag; v3 payroll_ledger_archive has no equivalent (every archived row is by definition final). In raw_json." },
    { field: "Created By",                   reasoning: "Bubble user ID for record author; v3 has no created_by column on payroll_ledger_archive. In raw_json." },
    { field: "⏱️ salary_type",               reasoning: "Bubble salary_type FK; v3 derives via tariff_rate_table at re-resolution time. FK identity preserved in raw_json." },
    { field: "Related_shiftType",            reasoning: "Bubble denormalized shiftType cache; v3 derives via JOIN through schedule_shift_id → schedule_shift.role. In raw_json." },
    { field: "⏱️ employmentProfile",         reasoning: "Bubble employment_profile FK at transaction time; v3 derives via employment_contract per profile. In raw_json." },
    { field: "Payroll",                      reasoning: "Bubble FK array linking transaction to parent payroll batches; v3 has no batch concept on payroll_ledger_archive (archive is flat). In raw_json." },
    { field: "dateTransaction",              reasoning: "Bubble computed dup of '4. Date'; covered by transaction_date. In raw_json." },
    { field: "Worktime?",                    reasoning: "Bubble flag distinguishing workTime vs supplement rows; v3 derives from a_melding_code value. In raw_json." },
    { field: "🗓️ _shiftFlags",               reasoning: "Bubble shift flags array (sic); not relevant at payroll archive level. In raw_json." },
    { field: "Modified Date",                reasoning: "Bubble modification timestamp; v3 archived_at captures the archive event (write-once). In raw_json." },
  ],
  derived: {
    bubble_record_id: { from: "_id", transform: "trim" },
  },
  constants: {
    source: "bubble_migration",
  },
  rawJsonTarget: "raw_json",
  requiredSourceFields: ["_id", "🏰 workspace", "🎎 Profile", "4. Date"],
  knownQuirks: [
    "raw_json captures the entire Bubble source record (28 fields × 17,607 rows ≈ several MB JSON inline in emitted SQL). Per ADR-0005 + ADR-0110 (smartout.ai).",
    "bubble_record_id derived from _id via trim (identity transform on string). v3 column is text NOT NULL — preserves the original Bubble ID alongside the deterministic v5 UUID for traceability.",
    "source constant 'bubble_migration' per ADR-0108 (matches v3 column DEFAULT but explicit override is safer than relying on default propagation).",
    "archived_at uses v3 DEFAULT now() — captures the migration event, not the original Bubble creation date. Original creation lives in raw_json.Created Date.",
    "Profile-level data (salaryIdentifyer, employmentProfile snapshot) intentionally not extracted — recoverable from raw_json + JOIN to current profile state.",
    "FK to profile_id is NOT NULL in v3 — profiles must apply before salary_transactions. FK to schedule_shift_id is nullable but constrained.",
    "17,607 rows is the largest single-entity migration in Tier 1. Apply in single transaction (single emitted SQL file per ADR-0002 dry-run model).",
    "a_melding_code values (fastloenn, timeloenn, etc.) are per-row Norwegian payroll classification — must be preserved for Tripletex sync; not derivable post-migration.",
  ],
};

async function patch(spec: EntitySpec): Promise<void> {
  const path = join(REPO, "mappings", `${spec.entity}.json`);
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;
  m.target_table = spec.targetTable;
  if (Object.keys(spec.derived).length > 0) m.derived_columns = spec.derived;
  if (Object.keys(spec.constants).length > 0) m.constant_columns = spec.constants;
  if (spec.rawJsonTarget) m.raw_json_target = spec.rawJsonTarget;
  m.required_source_fields = spec.requiredSourceFields;

  await appendDecision(HISTORY, {
    scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
    action: "target_table_set", target: spec.targetTable, by: "pontus",
    reasoning: "Day 2 council 2026-04-16 verdict + ADR-0005 raw_json_target",
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
    if (!(d.field in m.field_map)) { console.error(`SKIP[${spec.entity}]: not in field_map (already removed or duplicate): ${JSON.stringify(d.field)}`); continue; }
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
  if (spec.rawJsonTarget) {
    await appendDecision(HISTORY, {
      scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
      action: "field_approved", target: spec.rawJsonTarget,
      transform: `raw_json_target = full source record`,
      by: "pontus", reasoning: `ADR-0005: raw_json captures entire Bubble source record verbatim for archive fidelity`,
    });
  }

  m.last_verified = new Date().toISOString();
  m.known_quirks = spec.knownQuirks;
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");
  console.log(`${spec.entity}: ${approved} approved, ${dropped} dropped, raw_json_target=${spec.rawJsonTarget}, ${Object.keys(m.field_map).length} field_map entries remain.`);
}

(async () => {
  await patch(SALARY_TRANSACTIONS);
})().catch((e) => { console.error(e); process.exit(1); });
