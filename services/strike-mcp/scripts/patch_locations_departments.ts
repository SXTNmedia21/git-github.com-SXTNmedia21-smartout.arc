#!/usr/bin/env tsx
/**
 * Patches mappings/locations.json and mappings/departments.json per
 * council 2026-04-16 P.1 framework (ADR-0004).
 *
 * Both entities follow the same pattern:
 * - Explicit 🏰 Workspace → workspace_id (fk_uuid:workspace) — required, engine
 *   does not auto-inject from MigrationContext.
 * - derived_columns.slug = slugify(name source)
 * - constant_columns.source = 'bubble_migration' (ADR-0108)
 *
 * Locations: 8 approvals (id, workspace_id, name, description, sort_order,
 * is_active, timestamps). _locationType dropped — Bubble values like "3- Storage"
 * don't parse as v3 location_type enum; v3 has DEFAULT 'main'.
 *
 * Departments: 5 approvals (id, workspace_id, name, timestamps). Bubble
 * department has no description/color/icon equivalent — those v3 columns
 * stay null.
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_locations_departments.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { appendDecision } from "../src/history/decision_log.js";
import type { Mapping } from "../src/research/mapping.js";

const WORKSPACE = process.env.STRIKE_WORKSPACE_SLUG;
if (!WORKSPACE) {
  console.error("STRIKE_WORKSPACE_SLUG required");
  process.exit(1);
}

const REPO = join(import.meta.dirname, "..");
const HISTORY = process.env.STRIKE_HISTORY_DIR ?? join(REPO, "history");

type FieldPatch = {
  field: string;
  target: string;
  transform: string | null;
  reasoning: string;
};

type EntitySpec = {
  entity: string;
  targetTable: string;
  approvals: FieldPatch[];
  drops: { field: string; reasoning: string }[];
  derived: Record<string, { from: string; transform: string }>;
  constants: Record<string, string | number | boolean | null>;
  knownQuirks: string[];
};

const LOCATIONS: EntitySpec = {
  entity: "locations",
  targetTable: "public.location",
  approvals: [
    { field: "_id",           target: "location_id",  transform: "fk_uuid:location",   reasoning: "Bubble _id → deterministic v5 UUID keyed on entity=location" },
    { field: "🏰 Workspace",  target: "workspace_id", transform: "fk_uuid:workspace",  reasoning: "Explicit FK to v3 workspace; engine does not auto-inject (ADR-0004)" },
    { field: "Title",         target: "name",         transform: "trim",               reasoning: "Bubble Title → v3 location.name (NOT NULL). Wrightegaarden sample: 'Kjøkken lager'" },
    { field: "Description",   target: "description",  transform: "trim",               reasoning: "Optional description text; faithful import even if Bubble values are stale ('Vakthold rules this venue' in sample)" },
    { field: "Sort",          target: "sort_order",   transform: null,                 reasoning: "Integer passthrough; v3 has DEFAULT 0 if missing" },
    { field: "Active",        target: "is_active",    transform: null,                 reasoning: "Boolean passthrough; v3 has DEFAULT true if missing" },
    { field: "Created Date",  target: "created_at",   transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble creation timestamp" },
    { field: "Modified Date", target: "updated_at",   transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble modification timestamp" },
  ],
  drops: [
    { field: "_locationType",            reasoning: "Bubble values like '3- Storage' don't parse as v3 location_type enum. enum_coerce transform not registered. v3 has DEFAULT 'main'." },
    { field: "_color",                   reasoning: "Bubble UI hint; no v3 location.color column." },
    { field: "_modifyer",                reasoning: "Bubble internal classification (e.g. 'Area - Work area'); no v3 column." },
    { field: "Show in shiftplan",        reasoning: "Bubble UI flag; v3 derives location visibility from is_active + shift assignments." },
    { field: "Control point?",           reasoning: "Bubble feature flag for control-list checkpoint; v3 models via control_list table." },
    { field: "- can have tasks?",        reasoning: "Bubble feature flag; v3 models task assignment via session_task table." },
    { field: "preppTime",                reasoning: "Bubble per-location preparation time; v3 models via shift session timing, not on location." },
    { field: "question options",         reasoning: "Bubble question metadata; not in v3 location scope." },
    { field: "🚦 nps_value",             reasoning: "Bubble NPS rating; v3 doesn't track per-location NPS on the location entity." },
    { field: "📍Venue",                  reasoning: "Bubble venue FK; v3 doesn't model venue separately from location." },
    { field: "parant 📍 location",       reasoning: "Bubble recursive parent location; v3 location has no parent_location_id (flat hierarchy)." },
    { field: "list of 📍 subLocation's", reasoning: "Bubble children array; v3 has no recursive structure." },
    { field: "list of 📍 asset's",       reasoning: "Bubble assets array; v3 asset table separate (out of scope Tier 1)." },
    { field: "list of 🚀 task's",        reasoning: "Bubble tasks array; v3 session_task is per-shift, not per-location." },
    { field: "🏠 Department",            reasoning: "Bubble location → department FK; v3 models via shift.department_id + shift.location_id (separate FKs on shift, not nested)." },
    { field: "duty ⚔️ teams",            reasoning: "Bubble team-on-duty array; v3 models via team table separately, not on location." },
    { field: "access🔑Key",              reasoning: "Bubble per-location access key; access control out of Tier 1 scope." },
    { field: "list of access🔑keys",     reasoning: "Bubble access keys array; out of Tier 1 scope." },
    { field: "🏳️‍🌈 titles",            reasoning: "Bubble i18n title array; v3 location.name is single-language. Defer i18n until ADR registers." },
    { field: "🏳️‍🌈 descriptions",      reasoning: "Bubble i18n description array; same reasoning as 🏳️‍🌈 titles." },
    { field: "📨 channel",               reasoning: "Bubble UI channel reference; not in v3 location." },
    { field: "Created By",               reasoning: "Bubble user ID; not v3 created_by (which is timestamp-only)." },
  ],
  derived: { slug: { from: "Title", transform: "slugify" } },
  constants: { source: "bubble_migration" },
  knownQuirks: [
    "slug derived via slugify(Title) per ADR-0004 derived_columns.",
    "source = 'bubble_migration' constant per ADR-0108 (M8 trigger filter).",
    "_locationType not coerced to v3 location_type enum; using v3 DEFAULT 'main'.",
    "Bubble parent/sub-location hierarchy flattened; v3 has no parent_location_id.",
  ],
};

const DEPARTMENTS: EntitySpec = {
  entity: "departments",
  targetTable: "public.department",
  approvals: [
    { field: "_id",           target: "department_id", transform: "fk_uuid:department", reasoning: "Bubble _id → deterministic v5 UUID keyed on entity=department" },
    { field: "🏰 Workspace",  target: "workspace_id",  transform: "fk_uuid:workspace",  reasoning: "Explicit FK to v3 workspace per ADR-0004" },
    { field: "Titel",         target: "name",          transform: "trim",               reasoning: "Bubble Titel (Norwegian spelling) → v3 department.name (NOT NULL). Wrightegaarden sample: 'Restaurant'" },
    { field: "Created Date",  target: "created_at",    transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble creation timestamp" },
    { field: "Modified Date", target: "updated_at",    transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble modification timestamp" },
  ],
  drops: [
    { field: "_classStatus",            reasoning: "Bubble internal status; no v3 equivalent." },
    { field: "Display",                 reasoning: "Bubble composite display string ('Restaurant - Wrightegaarden Langesund AS'); v3 derives display from name + workspace context." },
    { field: "Mains 🚫",                reasoning: "Bubble blocker array; not in v3 department scope." },
    { field: "active_schedule_profiles", reasoning: "Bubble runtime cache of active profile FKs; v3 derives via profile.workspace_id + employment_contract." },
    { field: "jobs",                    reasoning: "Bubble jobs array; v3 has dedicated job/role tables." },
    { field: "locations",               reasoning: "Bubble department → locations array; v3 models via shift.department_id + shift.location_id." },
    { field: "list of 🎖️ badges",       reasoning: "Bubble badge system; out of Tier 1 scope." },
    { field: "list of 📍 areas",        reasoning: "Bubble areas array; v3 has location/zone tables instead." },
    { field: "list of 🔑 adminKeys",    reasoning: "Bubble access control; out of Tier 1 scope." },
    { field: "ℹ️ contants",             reasoning: "Bubble channel content reference; not in v3 department." },
    { field: "🎎 Employee Groups",      reasoning: "Bubble employee groups; v3 models via team table." },
    { field: "🎎 Manager",              reasoning: "Bubble manager FK; v3 has team.leader_profile_id, not on department." },
    { field: "🎎 Memeber's",            reasoning: "Bubble member array; v3 models via profile.workspace_id (departments don't own profiles directly)." },
    { field: "🏳️‍🌈 biography ",       reasoning: "Bubble i18n biography text; v3 department has no biography column." },
    { field: "🏳️‍🌈 context",          reasoning: "Bubble i18n context array; not in v3 department scope." },
    { field: "🏳️‍🌈 languages",        reasoning: "Bubble i18n language array; v3 department.name is single-language." },
    { field: "🏳️‍🌈 slogans",          reasoning: "Bubble i18n slogan array; not in v3 department scope." },
    { field: "🏳️‍🌈 valueProps",       reasoning: "Bubble i18n value-proposition array; not in v3 department scope." },
    { field: "📍 venue",                reasoning: "Bubble venue FK; v3 doesn't model venue separately." },
    { field: " 📨channel",              reasoning: "Bubble UI channel reference; not in v3 department." },
    { field: "access 🔑 key",           reasoning: "Bubble per-department access key; out of Tier 1 scope." },
    { field: "Created By",              reasoning: "Bubble user ID; not v3 created_by." },
  ],
  derived: { slug: { from: "Titel", transform: "slugify" } },
  constants: { source: "bubble_migration" },
  knownQuirks: [
    "slug derived via slugify(Titel) per ADR-0004.",
    "source = 'bubble_migration' constant per ADR-0108.",
    "v3 department.description, color, icon left null; Bubble has no equivalent fields.",
  ],
};

async function patch(spec: EntitySpec): Promise<void> {
  const path = join(REPO, "mappings", `${spec.entity}.json`);
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;

  m.target_table = spec.targetTable;
  m.derived_columns = spec.derived;
  m.constant_columns = spec.constants;

  await appendDecision(HISTORY, {
    scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
    action: "target_table_set", target: spec.targetTable, by: "pontus",
    reasoning: "Council 2026-04-16; ADR-0004 framework for slug + source",
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

  // Decision entries for derived + constant columns (one-shot per attest)
  for (const [target, deriv] of Object.entries(spec.derived)) {
    await appendDecision(HISTORY, {
      scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
      action: "field_approved", target, transform: `${deriv.transform}(${deriv.from}) via derived_columns`,
      by: "pontus", reasoning: `ADR-0004: derived ${target} from ${deriv.from} via ${deriv.transform}`,
    });
  }
  for (const [target, value] of Object.entries(spec.constants)) {
    await appendDecision(HISTORY, {
      scope: "schema", workspace: WORKSPACE!, entity: spec.entity,
      action: "field_approved", target, transform: `constant ${JSON.stringify(value)}`,
      by: "pontus", reasoning: `ADR-0004 + ADR-0108: ${target} = ${JSON.stringify(value)} constant injection`,
    });
  }

  m.last_verified = new Date().toISOString();
  m.known_quirks = spec.knownQuirks;
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");
  console.log(`${spec.entity}: ${approved} approved, ${dropped} dropped, ${Object.keys(m.field_map).length} field_map entries remain.`);
}

(async () => {
  await patch(LOCATIONS);
  await patch(DEPARTMENTS);
})().catch((e) => { console.error(e); process.exit(1); });
