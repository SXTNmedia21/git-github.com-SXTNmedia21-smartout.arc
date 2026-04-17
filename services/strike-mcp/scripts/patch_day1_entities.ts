#!/usr/bin/env tsx
/**
 * Day 1 patch — employee_types + teams + invitations.
 *
 * Per council 2026-04-16 Q1-Q7 verdicts:
 * - Q1: employee_types scoped to Wrightegaarden (workspace_id set, NOT platform-NULL).
 *       Wrightegaarden's "Frivillig" stays in this workspace; doesn't pollute K1a baseline.
 * - Q4: enum coercion deferred (drop _employementCategory, etc.); v3 has DEFAULTs.
 * - invitations: 0 samples in Wrightegaarden → known_empty_source=true.
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_day1_entities.ts
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
  knownQuirks: string[];
};

const EMPLOYEE_TYPES: EntitySpec = {
  entity: "employee_types",
  targetTable: "public.employee_type",
  approvals: [
    { field: "_id",                     target: "employee_type_id",        transform: "fk_uuid:employee_type", reasoning: "Bubble _id → deterministic v5 UUID keyed on entity=employee_type" },
    { field: "🏰 Workspace",            target: "workspace_id",            transform: "fk_uuid:workspace",     reasoning: "Q1 verdict: scope to Wrightegaarden, NOT platform-NULL. Wrightegaarden's Frivillig type doesn't auto-leak to other tenants." },
    { field: "Title",                   target: "title",                   transform: "trim",                  reasoning: "Bubble Title → v3 title (NOT NULL). Wrightegaarden values: Månedslønn, Timelønn sesongmedarbeider, Frivillig" },
    { field: "Fixed salary?",           target: "fixed_salary",            transform: null,                    reasoning: "Boolean passthrough; nullable in v3" },
    { field: "max_hours_week",          target: "max_hours_week",          transform: null,                    reasoning: "Numeric passthrough (37.5 = full week); v3 column is numeric(5,2)" },
    { field: "Accounting_Account_Code", target: "accounting_account_code", transform: "trim",                  reasoning: "Pass through to v3; carries to payroll_ledger_archive at apply time" },
    { field: " _colorPallet",           target: "color_pallet",            transform: "trim",                  reasoning: "Bubble color label (e.g. 'Curious Blue'); v3 stores as text, not enum" },
    { field: "max_vacation_days",       target: "max_vacation_days",       transform: null,                    reasoning: "Integer passthrough" },
    { field: "days_trailPeriod",        target: "days_trial_period",       transform: null,                    reasoning: "Bubble misspelling 'trail' → v3 'trial'; integer passthrough" },
    { field: "Created Date",            target: "created_at",              transform: "bubble_date_to_tstz",   reasoning: "Preserve Bubble creation timestamp" },
    { field: "Modified Date",           target: "updated_at",              transform: "bubble_date_to_tstz",   reasoning: "Preserve Bubble modification timestamp" },
  ],
  drops: [
    { field: "⏱️ _employementCategory", reasoning: "Q4 verdict: enum coercion deferred. Bubble 'Full time'/'Temporary' would map to v3 'permanent'/'temporary' but enum_value_map transform not registered. employment_form_derived is nullable; null is the 'do not sync to Tripletex' semantic per wt-3 plan." },
    { field: "Description",             reasoning: "Empty string in Wrightegaarden sample; v3 employee_type has no description column" },
    { field: "positionSize",            reasoning: "Bubble per-position size hint; not in v3 employee_type scope" },
    { field: "positionTitle",           reasoning: "Bubble redundant title alias; covered by Title → title" },
    { field: "max_sickLeave",           reasoning: "Bubble sick-leave cap; not in v3 employee_type (handled per-contract)" },
    { field: "⏱️ _rateType",            reasoning: "Bubble rate type marker; v3 derives from fixed_salary boolean" },
    { field: "⏱️ salary_types",         reasoning: "Bubble salary_type FK array; v3 models via separate tariff_rate_table (K1a)" },
    { field: "Created By",              reasoning: "Bubble user ID for record author; not v3 created_by (timestamp)" },
  ],
  derived: {},
  constants: {},
  knownQuirks: [
    "workspace_id scoped to Wrightegaarden (not platform-NULL) per Q1 verdict 2026-04-16.",
    "_employementCategory enum dropped pending enum_value_map transform; nullable in v3 = 'do not sync to Tripletex'.",
    "employee_type excluded from M7 source discriminator per council Q2; no constant_columns.source needed.",
    "color_pallet stored as text, not enum — v3 column accepts free text per K1a migration.",
  ],
};

const TEAMS: EntitySpec = {
  entity: "teams",
  targetTable: "public.team",
  approvals: [
    { field: "_id",           target: "team_id",       transform: "fk_uuid:team",       reasoning: "Bubble _id → deterministic v5 UUID keyed on entity=team" },
    { field: "🏰 Workspace",  target: "workspace_id",  transform: "fk_uuid:workspace",  reasoning: "Explicit FK to v3 workspace per ADR-0004" },
    { field: "🏠 Department", target: "department_id", transform: "fk_uuid:department", reasoning: "FK to v3 department; nullable in v3" },
    { field: "Title",         target: "name",          transform: "trim",               reasoning: "Bubble Title → v3 team.name (NOT NULL). Sample: 'Servitør'" },
    { field: "🎨_pallet",     target: "color",         transform: "trim",               reasoning: "Bubble color label (e.g. 'Teal Cyan'); v3 team.color is text" },
    { field: "Description",   target: "description",   transform: "trim",               reasoning: "Optional team description text" },
    { field: "Created Date",  target: "created_at",    transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble creation timestamp" },
    { field: "Modified Date", target: "updated_at",    transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble modification timestamp" },
  ],
  drops: [
    { field: "Active?",                  reasoning: "Boolean Active flag; v3 has is_active DEFAULT true. Bubble sample shows true; safe to use default." },
    { field: "_classStatus",             reasoning: "Bubble internal classification; no v3 equivalent" },
    { field: "_wageType",                reasoning: "Bubble wage type ('Hourly'); v3 stores wage rules in tariff_rate_table, not on team" },
    { field: "Wage",                     reasoning: "Bubble per-team wage; v3 wage data lives in tariff_rate_table per K1a model" },
    { field: "Sort",                     reasoning: "Bubble UI sort hint; v3 team has no sort_order column" },
    { field: "identifier",               reasoning: "Bubble composite display string ('Servitør - Wrightegaarden Langesund AS'); v3 derives" },
    { field: "Role?",                    reasoning: "Bubble boolean 'is this a role'; v3 separates team from role concept (role is per-shift)" },
    { field: "Show in shiftplan?",       reasoning: "Bubble UI flag; v3 derives team visibility from is_active" },
    { field: "Include in tip?",          reasoning: "Bubble feature flag for tip distribution; out of Tier 1 scope" },
    { field: "- allow manual punch in",  reasoning: "Bubble feature flag; v3 punch-in policy is workspace-level" },
    { field: "🎎 Manager",               reasoning: "Bubble manager FK; v3 has team.leader_profile_id but DEPENDS on profiles migrated first. Defer." },
    { field: "🎎 members",               reasoning: "Bubble member array; v3 doesn't model team membership directly (derived via shifts)" },
    { field: "🎎 Profile's",             reasoning: "Bubble profile array (alias for members); same reasoning" },
    { field: "🎖️ Badge ",                reasoning: "Bubble badge FK; out of Tier 1 scope" },
    { field: "list of jobs",             reasoning: "Bubble job array; v3 has dedicated job/role tables not on team" },
    { field: "List of 🚀 Tasks",         reasoning: "Bubble task array; v3 session_task is per-shift, not per-team" },
    { field: "list of 📍 location",      reasoning: "Bubble location FK array; v3 location is workspace-scoped, not team-scoped" },
    { field: "area 📍 venue",            reasoning: "Bubble venue FK; v3 doesn't model venue separately" },
    { field: "access🔑key",              reasoning: "Bubble access control; out of Tier 1 scope" },
    { field: "list of 🔑 accessKeys",    reasoning: "Same as access🔑key" },
    { field: "📨 chat v2",               reasoning: "Bubble chat reference; v3 messaging is separate" },
    { field: "Created By",               reasoning: "Bubble user ID; not v3 created_by (timestamp)" },
  ],
  derived: { slug: { from: "Title", transform: "slugify" } },
  constants: { source: "bubble_migration" },
  knownQuirks: [
    "slug derived via slugify(Title) per ADR-0004.",
    "source = 'bubble_migration' constant per ADR-0108.",
    "leader_profile_id left null; depends on profiles migration. Post-migration cleanup can wire from 🎎 Manager Bubble field.",
    "team_type uses v3 DEFAULT 'operational'; Bubble has no equivalent.",
    "season_id always null; Wrightegaarden teams are not season-scoped.",
  ],
};

async function patch(spec: EntitySpec): Promise<void> {
  const path = join(REPO, "mappings", `${spec.entity}.json`);
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;
  m.target_table = spec.targetTable;
  if (Object.keys(spec.derived).length > 0) m.derived_columns = spec.derived;
  if (Object.keys(spec.constants).length > 0) m.constant_columns = spec.constants;

  await appendDecision(HISTORY, {
    scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
    action: "target_table_set", target: spec.targetTable, by: "pontus",
    reasoning: "Day 1 council 2026-04-16 verdict",
  });

  let approved = 0;
  for (const p of spec.approvals) {
    const entry = m.field_map[p.field];
    if (!entry) { console.error(`WARN[${spec.entity}]: field not found: ${p.field}`); continue; }
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
    if (!(d.field in m.field_map)) { console.error(`WARN[${spec.entity}]: not in field_map: ${d.field}`); continue; }
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
      by: "pontus", reasoning: `ADR-0004: derived ${target} from ${deriv.from}`,
    });
  }
  for (const [target, value] of Object.entries(spec.constants)) {
    await appendDecision(HISTORY, {
      scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
      action: "field_approved", target,
      transform: `constant ${JSON.stringify(value)}`,
      by: "pontus", reasoning: `ADR-0004 + ADR-0108: ${target} = ${JSON.stringify(value)} constant`,
    });
  }

  m.last_verified = new Date().toISOString();
  m.known_quirks = spec.knownQuirks;
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");
  console.log(`${spec.entity}: ${approved} approved, ${dropped} dropped, ${Object.keys(m.field_map).length} field_map entries remain.`);
}

async function patchEmpty(entity: string, targetTable: string, reasoning: string): Promise<void> {
  const path = join(REPO, "mappings", `${entity}.json`);
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;
  m.target_table = targetTable;
  m.known_empty_source = true;
  m.last_verified = new Date().toISOString();
  m.known_quirks = [reasoning];
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");
  await appendDecision(HISTORY, {
    scope: "schema", workspace: WORKSPACE!, entity,
    action: "mapping_attested_empty", target: targetTable,
    by: "pontus", reasoning,
  });
  console.log(`${entity}: attested empty (target=${targetTable}, no rows to migrate).`);
}

(async () => {
  await patch(EMPLOYEE_TYPES);
  await patch(TEAMS);
  await patchEmpty(
    "invitations",
    "public.invitation",
    "Wrightegaarden has 0 active invitations. known_empty_source=true; no SQL emitted. Cutover notice: post-migration invitations created in Bubble must be manually re-created in v3.",
  );
})().catch((e) => { console.error(e); process.exit(1); });
