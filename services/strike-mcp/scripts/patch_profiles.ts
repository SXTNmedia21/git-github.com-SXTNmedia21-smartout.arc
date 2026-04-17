#!/usr/bin/env tsx
/**
 * Day 4 patch — profiles → public.profile.
 *
 * Per Q3 verdict (2026-04-16): profile_code = "EMP-" + first 8 chars of
 * uuidv5("profile", bubble_id). Deterministic, readable, sortable, low
 * collision risk for ~135 profiles.
 *
 * COMPANY_ID GAP: profile.company_id is NOT NULL FK→company but Bubble
 * has no per-profile company link (company is per-workspace). For
 * Wrightegaarden specifically (single workspace + single company),
 * company_id is hardcoded as a constant. For multi-workspace tenants
 * this script must be re-parameterized OR a future ADR adds cross-entity
 * lookup framework support.
 *
 * Wrightegaarden constants (computed via scripts/compute_wrightegaarden_uuids.ts):
 *   workspace_id (v3 uuid): 65532a8c-9571-5e8f-8890-f551ed242795
 *   company_id   (v3 uuid): 8d22ac74-1813-510e-81b1-e742e5aaf813
 *
 * Apply order: workspace + company + user_identity + department must land
 * BEFORE profiles. user_identity itself depends on auth-bridge step (ADR-0006).
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_profiles.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { appendDecision } from "../src/history/decision_log.js";
import type { Mapping } from "../src/research/mapping.js";

const WORKSPACE = process.env.STRIKE_WORKSPACE_SLUG;
if (!WORKSPACE) { console.error("STRIKE_WORKSPACE_SLUG required"); process.exit(1); }
if (WORKSPACE !== "wrightegaarden") {
  console.error(`This patch script hardcodes Wrightegaarden's company_id. STRIKE_WORKSPACE_SLUG=${WORKSPACE} not supported.`);
  console.error("Re-run scripts/compute_wrightegaarden_uuids.ts with the correct Bubble company _id and update the WRIGHTEGAARDEN_COMPANY_UUID constant before running for another tenant.");
  process.exit(1);
}

const REPO = join(import.meta.dirname, "..");
const HISTORY = process.env.STRIKE_HISTORY_DIR ?? join(REPO, "history");

// Computed via uuidv5("company", "1683059156184x868193356345167900").
// See scripts/compute_wrightegaarden_uuids.ts for verification.
const WRIGHTEGAARDEN_COMPANY_UUID = "8d22ac74-1813-510e-81b1-e742e5aaf813";

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

const PROFILES: EntitySpec = {
  entity: "profiles",
  targetTable: "public.profile",
  approvals: [
    { field: "_id",            target: "profile_id",              transform: "fk_uuid:profile",        reasoning: "Bubble _id → deterministic v5 UUID keyed on entity=profile" },
    { field: "User",           target: "user_id",                 transform: "fk_uuid:user_identity",  reasoning: "FK to v3 user_identity (NOT NULL). Apply order: auth-bridge → user_identity → profiles. Same uuidv5 formula used by auth-bridge." },
    { field: "🏰 Workspace",   target: "workspace_id",            transform: "fk_uuid:workspace",      reasoning: "Explicit FK to v3 workspace per ADR-0004" },
    { field: "🏡 Department",  target: "department_id",           transform: "fk_uuid:department",     reasoning: "FK to v3 department (nullable). NOTE Bubble uses '🏡' (house with garden) on profiles; '🏠' (house) on departments table — same FK target." },
    { field: "Profile Name",   target: "display_name",            transform: "trim",                   reasoning: "Bubble Profile Name → v3 display_name (NOT NULL). Composite of first+last (e.g. 'Pontus lindroth W')." },
    { field: "Profile Image",  target: "avatar_url",              transform: "trim",                   reasoning: "Bubble CDN URL → v3 avatar_url. Sample: //2c7b72955...cdn.bubble.io/.../Sheriffen.jpeg" },
    { field: "kioskCode",      target: "external_employee_number", transform: "trim",                  reasoning: "Bubble 4-digit kiosk login code → v3 external_employee_number (text). Numeric but stored as text. Used for shared-tablet authentication in v3 punch-in flow." },
    { field: "Created Date",   target: "created_at",              transform: "bubble_date_to_tstz",    reasoning: "Preserve Bubble creation timestamp" },
    { field: "Modified Date",  target: "updated_at",              transform: "bubble_date_to_tstz",    reasoning: "Preserve Bubble modification timestamp" },
  ],
  drops: [
    { field: "🎎 Training",                reasoning: "Bubble Training FK; v3 training lives in protocol/runbook completion model (different shape, not on profile)." },
    { field: "Email",                       reasoning: "Bubble email duplicated on profile + user; v3 email lives ONLY on user_identity (single source of truth). Bubble redundancy not propagated." },
    { field: "🎎 Preferences",              reasoning: "Bubble Preferences FK; v3 preferences live in profile.notification_pref jsonb (not migrated as Tier 1)." },
    { field: "logged in URL",               reasoning: "Bubble last-login URL (debug field); v3 has no equivalent column on profile." },
    { field: "keyString",                   reasoning: "Bubble internal key string; not v3." },
    { field: "🎎 profileEmplyment",         reasoning: "Bubble FK to employment_profile (sic — typo 'Emplyment'). Employment data lives in v3 employment_contract (separate manual SQL synthesis per ADR-0109)." },
    { field: "profile_XP",                  reasoning: "Bubble gamification XP counter; v3 gamification (if any) lives in separate engine_state or telemetry, not on profile." },
    { field: "online?",                     reasoning: "Bubble realtime online flag; v3 derives from session_active or last_seen telemetry, not stored on profile." },
    { field: "lastName",                    reasoning: "Covered by Profile Name composite. v3 display_name is NOT NULL; first/last separation is on user_identity for legal name purposes." },
    { field: "Created By",                  reasoning: "Bubble user ID for record author; not v3 created_by (no such column on profile; created_at handles temporal)." },
    { field: "ID",                          reasoning: "Bubble auto-incrementing display ID; v3 uses uuid PK only." },
    { field: "Sort",                        reasoning: "Bubble UI sort hint; v3 has no sort_order column on profile." },
    { field: "_status",                     reasoning: "Q4 verdict: enum coercion deferred. Bubble values 'Onboarding'/'Employeed' (sic)/'Active' would map to v3 status enum 'trainee'/'active'/'inactive' but coercion deferred. v3 DEFAULT 'trainee' — most safe assumption for migrated profiles." },
    { field: "🏡 Department's",             reasoning: "Bubble multi-department array (note '🏡' house-with-garden + apostrophe). v3 has departments uuid[] DEFAULT '{}' but cross-array FK transform fk_uuid_array exists; deferred to keep first attestation simple. Single-department case via 🏡 Department covers most." },
    { field: "Phone Number",                reasoning: "Phone duplicated on profile + user; v3 phone lives ONLY on user_identity (single source of truth)." },
    { field: "📍 Venues",                   reasoning: "Bubble venue array; v3 has no venue concept (locations are workspace-scoped, not profile-scoped)." },
    { field: "profile.Json",                reasoning: "Bubble cached JSON snapshot of profile state; not migrated (no profile.raw_json column; profile is intentionally lean)." },
    { field: "validated_date",              reasoning: "Bubble email-validation timestamp; covered by user_identity-level email_confirm at auth-bridge step." },
    { field: "📍 Venue",                    reasoning: "Bubble single-venue FK; v3 has no venue (see 📍 Venues drop)." },
    { field: "Schedule Active departments", reasoning: "Bubble per-profile schedule department visibility array; out of Tier 1 scope (UI preference, not core profile data)." },
    { field: "_userRole",                   reasoning: "Q4 verdict: enum coercion deferred. Bubble 'Admin'/'Employee' maps to v3 role 'admin'/'employee'; deferred. v3 DEFAULT 'employee' — most profiles are employees." },
    { field: "🎎 Teams",                    reasoning: "Bubble multi-team array; v3 doesn't model team membership directly on profile (derived via shifts.team_id)." },
    { field: "Last logged in date?",        reasoning: "Bubble last login timestamp; v3 user_identity.last_login_at lives at the auth identity level, updated by Supabase auth on actual login (post-migration)." },
    { field: "🎎 notifyMe",                 reasoning: "Bubble notification preferences FK; v3 profile.notification_pref jsonb is intentionally defaulted to push-only at migration time." },
    { field: "_FirstOperation",             reasoning: "Bubble onboarding-step array; v3 onboarding flow uses engine_process model, not per-profile array." },
    { field: "🎎 Team",                     reasoning: "Bubble single team FK; v3 doesn't model primary team on profile (team membership inferred from shifts)." },
    { field: "_userRole's",                 reasoning: "Bubble multi-role array (with apostrophe); same as _userRole drop." },
    { field: "firstName",                   reasoning: "Covered by Profile Name composite. firstName + lastName live on user_identity for legal-name purposes; profile carries display_name only." },
    { field: "List of primeKeys",           reasoning: "Bubble internal key array; not v3." },
    { field: "Deactivated date?",           reasoning: "Bubble deactivation timestamp; v3 uses status='inactive' enum (deferred per Q4) and is_active boolean." },
    { field: "active🗓️shift",              reasoning: "Bubble realtime active-shift FK array; v3 derives from current schedule_shift query, not stored on profile." },
    { field: "🎎_level",                    reasoning: "Bubble gamification level; v3 gamification (if any) is separate." },
    { field: "Manager notes",               reasoning: "Bubble per-profile manager notes free text; v3 has no equivalent (HR notes belong in dedicated hr_note table, not migrated as Tier 1)." },
    { field: "profile🔑key",                reasoning: "Bubble internal access key; not v3." },
    { field: "Welcome text",                reasoning: "Bubble custom welcome message; v3 onboarding messages are templated, not per-profile custom text." },
    { field: "profil 📨 channel",           reasoning: "Bubble messaging channel FK; v3 messaging is a separate package (notification system + chat)." },
    { field: "list of assigned ⭐ flowLog", reasoning: "Bubble onboarding flow audit log; v3 flow audit is in engine_event telemetry, not stored on profile." },
  ],
  derived: {
    profile_code: { from: "_id", transform: "profile_code_from_id" },
  },
  constants: {
    company_id: WRIGHTEGAARDEN_COMPANY_UUID,
    source: "bubble_migration",
  },
  rawJsonTarget: null,
  requiredSourceFields: ["_id", "User", "🏰 Workspace", "Profile Name"],
  knownQuirks: [
    `company_id constant '${WRIGHTEGAARDEN_COMPANY_UUID}' is HARDCODED to Wrightegaarden's company. v3 profile.company_id is NOT NULL FK→company but Bubble has no per-profile company link (company is per-workspace). For multi-workspace tenants, a future ADR-0007 must add cross-entity lookup framework support; this script will fail-fast if STRIKE_WORKSPACE_SLUG != wrightegaarden.`,
    "profile_code derived via profile_code_from_id transform: 'EMP-' + first 8 chars of uuidv5('profile', _id). Q3 verdict 2026-04-16. Deterministic, readable, sortable, ~4.3B suffix space for ~135 profiles (collision-resistant).",
    "source constant 'bubble_migration' per ADR-0108 — overrides v3 DEFAULT 'operational'.",
    "role uses v3 DEFAULT 'employee' — Q4 enum coercion deferred. Bubble Admin users land as 'employee' and need post-migration role bump (only ~3-5 admins typically).",
    "status uses v3 DEFAULT 'trainee' — Q4 enum coercion deferred. All profiles initially flagged trainee; post-migration status backfill from Bubble _status values per ADR-0082.",
    "is_active uses v3 DEFAULT true — Bubble Deactivated date? value dropped; manual cleanup if specific profiles must land inactive.",
    "joined_at uses v3 DEFAULT now() — captures migration event, not original Bubble Created Date (which is preserved in created_at).",
    "departments array left as DEFAULT '{}' — single-department case covered via department_id; multi-dept array case (🏡 Department's) deferred per ADR-0007 framework.",
    "notification_pref uses v3 DEFAULT (push-only); Bubble 🎎 notifyMe preferences not migrated.",
    "Email + Phone are dropped from profile and live ONLY on user_identity (single source of truth). v3 derives via JOIN profile.user_id → user_identity.email/phone.",
    "external_employee_number stores Bubble kioskCode (4-digit shared-tablet login). Used for v3 kiosk auth flow; do not confuse with employee_number which is for HR records.",
    "Apply order strict: auth-bridge (creates auth.users) → user_identity (this requires those to exist) → profile (this requires user_identity + workspace + company + department to exist).",
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
    reasoning: `Day 4 council 2026-04-16 verdict + Q3 profile_code rule + tenant-specific company_id constant`,
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
    if (!(d.field in m.field_map)) { console.error(`SKIP[${spec.entity}]: not in field_map: ${JSON.stringify(d.field)}`); continue; }
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
  console.log(`${spec.entity}: ${approved} approved, ${dropped} dropped, ${Object.keys(m.field_map).length} field_map entries remain.`);
}

(async () => {
  await patch(PROFILES);
})().catch((e) => { console.error(e); process.exit(1); });
