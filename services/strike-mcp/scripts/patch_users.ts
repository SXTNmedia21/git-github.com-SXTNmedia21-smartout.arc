#!/usr/bin/env tsx
/**
 * Day 3 patch — users → public.user_identity.
 *
 * Per ADR-0006: strike-mcp emits user_identity SQL with deterministic
 * uuidv5 IDs. A separate strike-auth-bridge tool (out of scope here) must
 * pre-create matching auth.users rows via supabase.auth.admin.createUser
 * BEFORE the user_identity SQL is applied. The deterministic UUID formula
 * (uuidv5("user_identity", bubble_user_id)) is shared between both steps.
 *
 * Email extraction: Bubble stores email at authentication.email.email
 * (the outer email is the auth method, the inner is the address). New
 * transform email_from_auth handles this nested path.
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_users.ts
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

const USERS: EntitySpec = {
  entity: "users",
  targetTable: "public.user_identity",
  approvals: [
    { field: "_id",            target: "user_id",     transform: "fk_uuid:user_identity",  reasoning: "Bubble _id → deterministic v5 UUID. Auth-bridge tool MUST use the same UUID when calling supabase.auth.admin.createUser per ADR-0006." },
    { field: "authentication", target: "email",       transform: "email_from_auth",        reasoning: "Bubble auth object stores email at authentication.email.email (outer = auth method, inner = address). New transform extracts the nested path. v3 user_identity.email is NOT NULL." },
    { field: "First name",     target: "first_name",  transform: "trim",                   reasoning: "Bubble First name → v3 first_name (NOT NULL). Examples: Anneli, Natalie, Erik." },
    { field: "Last Name",      target: "last_name",   transform: "trim",                   reasoning: "Bubble Last Name → v3 last_name (NOT NULL). Examples: Eilertsen Ødegård, Both Larsen Wille." },
    { field: "Mobile",         target: "phone",       transform: "trim",                   reasoning: "Bubble Mobile → v3 phone (nullable text). Some values include +47 prefix (E.164), some are local format. Normalization deferred per Q4 — apply-time post-fix can rewrite to E.164." },
    { field: "Created Date",   target: "created_at",  transform: "bubble_date_to_tstz",    reasoning: "Preserve Bubble creation timestamp" },
    { field: "Modified Date",  target: "updated_at",  transform: "bubble_date_to_tstz",    reasoning: "Preserve Bubble modification timestamp" },
  ],
  drops: [
    { field: "🎎 Profile",          reasoning: "Bubble Profile FK on user; v3 inverts (profile.user_id FKs to user_identity). The forward direction lives on profile, not user_identity." },
    { field: "🏰 Workspace",        reasoning: "Bubble Workspace FK on user; v3 user_identity is workspace-AGNOSTIC (one identity can belong to multiple workspaces via profile). Workspace association lives on profile." },
    { field: "Language",            reasoning: "Q4 verdict: enum coercion deferred. Bubble values 'Norwegian'/'English (UK)' would map to v3 preferred_language enum 'no'/'en' but enum_value_map transform not registered. v3 has DEFAULT 'no'." },
    { field: "Area Code txt",       reasoning: "Bubble area code (separated from Mobile in some records). Lossy to merge automatically — Mobile sometimes already includes the +47 prefix. Drop here; phone normalization is apply-time post-fix." },
    { field: "_userStatus",         reasoning: "Q4 verdict: enum coercion deferred. Bubble 'inActive'/'active' would map to v3 is_active boolean but coercion deferred. v3 is_active DEFAULT true — assumes active unless overridden." },
    { field: "user_signed_up",      reasoning: "Bubble auth-flow flag (whether user has completed signup). v3 has no equivalent — auth-bridge step recreates auth.users with email_confirm=true so all migrated users are 'signed up' by construction." },
    { field: "isRegistered",        reasoning: "Bubble auth-flow flag (whether user is registered in workspace). v3 derives from profile existence, not from user_identity." },
    { field: "validate_date",       reasoning: "Bubble email validation timestamp. v3 user_identity has no email_verified_at column (auth.users tracks this in a different shape). Auth-bridge sets email_confirm=true at create time." },
    { field: "PlayerID",            reasoning: "OneSignal push notification ID. v3 stores expo_push_token on profile (different vendor); not migrated as PlayerID is OneSignal-specific." },
    { field: "user🔑Access",        reasoning: "Bubble access-control reference; out of v3 user_identity scope (access lives on workspace_access table)." },
    { field: "user_Data",           reasoning: "Bubble cached user data object reference; not v3 (raw_json not used here — user_identity is intentionally lean)." },
    { field: "user_Info",           reasoning: "Bubble cached user info object reference; same — not migrated." },
    { field: "keyString",           reasoning: "Bubble internal key string (likely auth-related); not v3." },
    { field: "legalName",           reasoning: "Bubble denormalized 'firstname lastname' composite; v3 derives from first_name + last_name JOIN at display time." },
    { field: "data.json",           reasoning: "Bubble cached JSON snippet of user state (legacy debug field); not migrated." },
  ],
  derived: {},
  constants: {},
  rawJsonTarget: null,
  requiredSourceFields: ["_id", "authentication", "First name", "Last Name"],
  knownQuirks: [
    "user_id is a hard FK to auth.users(id). Apply order: auth-bridge step (out of strike-mcp scope) must pre-create auth.users entries with the SAME deterministic UUIDs before this SQL is applied. Per ADR-0006.",
    "email_from_auth transform extracts authentication.email.email (Bubble's nested auth shape). Returns null for any missing-key case — null email rows will fail user_identity NOT NULL constraint at apply time, surfacing as explicit failures the auth-bridge must triage.",
    "phone column carries Mobile as-is (no normalization). Some Wrightegaarden values include +47, some don't. Phone format normalization deferred to apply-time post-fix.",
    "preferred_language uses v3 DEFAULT 'no' — Q4 enum coercion deferred. Norwegian-language users map correctly by default; English users will need post-migration update.",
    "is_active uses v3 DEFAULT true — Q4 enum coercion of _userStatus deferred. Bubble 'inActive' users will land as is_active=true; manual cleanup required.",
    "auth_provider uses v3 DEFAULT 'supabase'. All migrated users go through the email auth provider; no SSO migration in Tier 1.",
    "timezone uses v3 DEFAULT 'Europe/Oslo'. All Wrightegaarden users are in Norway; no override needed.",
    "user_identity has NO source column (unlike profile + payroll_ledger_archive). No source='bubble_migration' constant needed — auth-bridge user_metadata.migrated_from_bubble carries the discriminator at the auth.users level.",
    "Bubble users without email are real edge cases (rare). They will surface as auth-bridge failures, not silently land as broken user_identity rows. Manual decision required per missing-email user (fabricate, drop, defer).",
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
    reasoning: "Day 3 council 2026-04-16 verdict + ADR-0006 auth-bridge orchestration",
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

  m.last_verified = new Date().toISOString();
  m.known_quirks = spec.knownQuirks;
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");
  console.log(`${spec.entity}: ${approved} approved, ${dropped} dropped, ${Object.keys(m.field_map).length} field_map entries remain.`);
}

(async () => {
  await patch(USERS);
})().catch((e) => { console.error(e); process.exit(1); });
