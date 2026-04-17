#!/usr/bin/env tsx
/**
 * One-shot patch for mappings/company.json.
 *
 * Council 2026-04-16 — same pattern as workspace mapping (Option B):
 * - 12 fields approved using ONLY registered transforms
 * - 24 fields dropped (Bubble-internal, FK refs, garbage data, enum coercion deferred)
 * - Each decision logged to history/decisions.jsonl (ADR-0003 audit)
 *
 * Drops with explicit reasoning:
 * - Adresse: Country, os-country/language → v3 has enum DEFAULTs (no enum_coerce
 *   transform yet); using DEFAULT is safe.
 * - Company : Webpager → sample value "123" is garbage; Brønnøysund scraper
 *   populates website later.
 * - legalAgent: Contact email → "legalAgent" is legal/document contact, not
 *   billing; use Accounting : Contact email for billing_email instead.
 * - Company : Manager / legalAgent (UUIDs) → defer until profiles migrated;
 *   v3 daglig_leder is text not UUID, would need name lookup.
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_company_mapping.ts
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
const MAPPING_PATH = join(REPO, "mappings", "company.json");
const HISTORY_DIR = process.env.STRIKE_HISTORY_DIR ?? join(REPO, "history");

type FieldPatch = {
  field: string;
  target: string;
  transform: string | null;
  reasoning: string;
};

const APPROVALS: FieldPatch[] = [
  { field: "_id",                        target: "company_id",     transform: "fk_uuid:company",   reasoning: "Bubble _id → deterministic v5 UUID keyed on entity=company; FK target for workspace.company_id" },
  { field: "Company : Name",             target: "name",           transform: "trim",              reasoning: "Bubble Company:Name is the company display name. NOT NULL in v3. Wrightegaarden value: 'Wrightegaarden Langesund AS'" },
  { field: "Company : VAT",              target: "org_number",     transform: "trim",              reasoning: "Norwegian organisasjonsnummer (9 digits). NOT NULL in v3. Wrightegaarden value: '929024354'" },
  { field: "Company : Email",            target: "email",          transform: "trim",              reasoning: "Primary contact email" },
  { field: "Company : Round Logo",       target: "logo_url",       transform: null,                reasoning: "Bubble round_logo URL → v3 logo_url; rectangle_logo dropped (sparse, secondary)" },
  { field: "Company | Phone",            target: "phone",          transform: "trim",              reasoning: "Company main phone (note Bubble field name uses pipe separator)" },
  { field: "Adresse: Street",            target: "address_line_1", transform: "trim",              reasoning: "Street address from Adresse compound field" },
  { field: "Adresse: City",              target: "city",           transform: "trim",              reasoning: "City from Adresse compound field" },
  { field: "Adresse: Zip",               target: "postal_code",    transform: "trim",              reasoning: "Postal code from Adresse compound field" },
  { field: "Accounting : Contact email", target: "billing_email",  transform: "trim",              reasoning: "Accounting contact = billing recipient (NOT legalAgent which is legal/document contact)" },
  { field: "legalAgent: Legal name",     target: "legal_name",     transform: "trim",              reasoning: "Legal entity name (may differ from display Name); optional in v3" },
  { field: "Created Date",               target: "created_at",     transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble creation timestamp" },
  { field: "Modified Date",              target: "updated_at",     transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble modification timestamp" },
];

const DROPS_KEEP: { field: string; reasoning: string }[] = [
  { field: "Adresse: Country",           reasoning: "v3 country is ENUM with DEFAULT 'NO'; enum_coerce transform not registered. Safe to use default." },
  { field: "os-country/language",        reasoning: "v3 default_language is ENUM with DEFAULT 'no'; enum_coerce not registered. Safe to use default." },
  { field: "Company : Webpager",         reasoning: "Sample value '123' is garbage data. Brønnøysund scraper populates v3 website later from registry." },
  { field: "legalAgent: Contact email",  reasoning: "Semantic: legalAgent = legal/document contact, not billing. v3 has no 'legal contact' column; use Accounting:Contact email for billing_email." },
  { field: "legalAgent: Phone number",   reasoning: "Duplicate of Company|Phone for most companies; ambiguous semantic." },
  { field: "Company : 🎎Manager",        reasoning: "UUID FK to Bubble profile; v3 daglig_leder is text. Defer until profiles migrated, then derive via lookup if needed." },
  { field: "Company : 🎎legalAgent",     reasoning: "UUID FK to Bubble profile; no v3 column. Brønnøysund scraper populates daglig_leder text later." },
  { field: "Accounting : Firme Name",    reasoning: "No v3 column; accounting integration goes via Tripletex direct, not stored on company." },
  { field: "Accounting : Contant name",  reasoning: "No v3 column; accounting integration goes via Tripletex direct." },
  { field: "Enable strip?",              reasoning: "Bubble feature flag for Stripe integration toggle; v3 derives from subscription_status." },
  { field: "Enable_contract?",           reasoning: "Bubble feature flag; v3 has dedicated contract workflow not gated by company flag." },
  { field: "contract signed",            reasoning: "Bubble boolean; v3 has employment_contract table with status enum." },
  { field: "contracts",                  reasoning: "Bubble array of contract refs; v3 employment_contract is the canonical source." },
  { field: "payment_details_confirmed",  reasoning: "Bubble flag; v3 derives from Stripe webhook events." },
  { field: "stripe_customer",            reasoning: "Stripe customer ID is not stored on company in v3; resolved via Stripe sync." },
  { field: "🎎 Member's",                reasoning: "Bubble array of profile UUIDs; v3 models membership via profile.workspace_id and company_member table." },
  { field: "🏠 Department`s",            reasoning: "Bubble array of department UUIDs; v3 models via department.workspace_id (handled by departments migration)." },
  { field: "🏰 Inventory",               reasoning: "Bubble inventory FK; out of scope for Tier 1 migration." },
  { field: "🏰 Workspace",               reasoning: "Reverse FK from company → workspace; v3 models on workspace.company_id side only." },
  { field: "🏰workspaces",               reasoning: "Bubble array of workspace UUIDs; reverse FK, handled by workspace migration." },
  { field: "Adresse",                    reasoning: "Parent compound record; sub-fields (Street/City/Zip) mapped separately." },
  { field: "Created By",                 reasoning: "Bubble user ID for record author; not v3 created_by (which is timestamp)." },
  { field: "ID",                         reasoning: "Bubble-internal sequential counter (e.g. '8'); _id UUID is the identity source." },
];

async function main(): Promise<void> {
  const raw = await readFile(MAPPING_PATH, "utf-8");
  const mapping = JSON.parse(raw) as Mapping;

  mapping.target_table = "public.company";

  await appendDecision(HISTORY_DIR, {
    scope: "schema",
    workspace: WORKSPACE!,
    entity: "company",
    action: "target_table_set",
    target: "public.company",
    by: "pontus",
    reasoning: "Council 2026-04-16 reviewed; same Option B pattern as workspace",
  });

  let approved = 0;
  for (const p of APPROVALS) {
    const entry = mapping.field_map[p.field];
    if (!entry) { console.error(`WARN: field not found: ${p.field}`); continue; }
    entry.target = p.target;
    entry.transform = p.transform;
    entry.needs_review = false;
    await appendDecision(HISTORY_DIR, {
      scope: "schema",
      workspace: WORKSPACE!,
      entity: "company",
      action: "field_approved",
      field: p.field,
      target: p.target,
      transform: p.transform,
      by: "pontus",
      reasoning: p.reasoning,
    });
    approved++;
  }

  let dropped = 0;
  for (const d of DROPS_KEEP) {
    if (!(d.field in mapping.field_map)) { console.error(`WARN: not in field_map: ${d.field}`); continue; }
    delete mapping.field_map[d.field];
    await appendDecision(HISTORY_DIR, {
      scope: "schema",
      workspace: WORKSPACE!,
      entity: "company",
      action: "field_dropped",
      field: d.field,
      by: "pontus",
      reasoning: d.reasoning,
    });
    dropped++;
  }

  mapping.last_verified = new Date().toISOString();
  mapping.known_quirks = [
    "source column has DEFAULT 'operational' in M7; engine MUST override to 'bubble_migration' (ADR-0108).",
    "v3 enum columns (country, industry, default_language, default_currency) use safe DEFAULTs ('NO', 'restaurant', 'no', 'NOK'); Bubble values dropped pending enum_coerce transform.",
    "legal_name optional in v3; mapped from legalAgent:Legal name when present, else null.",
    "website populated by Brønnøysund scraper post-migration; Bubble Webpager sample data was garbage.",
    "subscription_*, trial_ends_at, stripe_customer fields driven by Stripe webhooks in v3, not migrated from Bubble.",
  ];

  await writeFile(MAPPING_PATH, JSON.stringify(mapping, null, 2) + "\n", "utf-8");
  console.log(`Patched company mapping: ${approved} approved, ${dropped} dropped, ${Object.keys(mapping.field_map).length} fields remain.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
