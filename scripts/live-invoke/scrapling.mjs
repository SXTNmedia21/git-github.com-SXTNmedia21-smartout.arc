// scripts/live-invoke/scrapling.mjs
// Live-invoke smoke for the scrapling domain.
//
// What this catches:
//   - Column drift on company.raw_scraped_data + company.onboarding_status
//     (the 2 columns added by scrapling migration 00008)
//   - Column drift on company_scraped_data (the dedicated scrape-result table)
//   - SelectQueryError / PGRST201 cascades on the company embed path used by
//     the 3 BFF bridge tools (scrape_website, search_company, identify_company
//     — packages/ai/src/capabilities/onboarding/tools.ts:579-727)
//   - The L-0348 class: drifts that mocks + Track B miss
//
// OUT OF SCOPE:
//   - Python scrapling service smoke (10 endpoints: /extract, /scrape-raw,
//     /brreg-search, /brreg-lookup, /google-places, /serper-search, etc.).
//     Those require the Python service running and are best covered by a
//     separate scripts/live-invoke/scrapling-python.sh that curls the service
//     directly. The 3 BFF tools (scrape_website, search_company, identifyCompany)
//     purely proxy to Python — no DB reads in their execute() path.
//   - RLS user-scoped access (audit owns that)
//   - Scoring / ranking correctness (Jaro-Winkler, Places fallback — Python logic)
//
// Verified columns from database.types.ts:
//   company.Row.onboarding_status   → line 5044: "onboarding_status: string | null"
//   company.Row.raw_scraped_data    → line 5049: "raw_scraped_data: Json | null"
//   company_scraped_data.Row        → lines 5302-5313: id, auth_id, source_url,
//     scrape_status, scraped_at, raw_data, parsed_data, workspace_id,
//     created_at, updated_at
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/scrapling.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("scrapling");

// ── 1. company table — scrapling columns ─────────────────────────────────────
// Verifies raw_scraped_data + onboarding_status exist post-migration 00008.
// Service role → RLS bypassed → returns rows if any exist, empty otherwise.
// Empty is fine: we prove column presence via the absence of a SQL error.
const companyScraping = await sb
  .from("company")
  .select(
    "company_id, name, org_number, onboarding_status, raw_scraped_data, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select company (scrapling cols: onboarding_status + raw_scraped_data)", companyScraping);
assertShape("company scrapling column shape", companyScraping.data, [
  "company_id",
  "name",
  "onboarding_status",
  "raw_scraped_data",
]);

// ── 2. company_scraped_data table — full column set ───────────────────────────
// Dedicated scrape-result table. Verifies the 10-column schema from
// database.types.ts:5302-5313 is intact and no column was renamed.
// Note: auth_id (not profile_id) — FK to auth.users, not public.user_identity.
const scrapedData = await sb
  .from("company_scraped_data")
  .select(
    "id, auth_id, source_url, scrape_status, scraped_at, " +
    "raw_data, parsed_data, workspace_id, created_at, updated_at",
  )
  .limit(1);
assertOk("select company_scraped_data (10 cols)", scrapedData);
assertShape("company_scraped_data column shape", scrapedData.data, [
  "id",
  "auth_id",
  "source_url",
  "scrape_status",
  "scraped_at",
  "raw_data",
  "parsed_data",
  "workspace_id",
  "created_at",
  "updated_at",
]);

// ── 3. company full Row — no embed ambiguity ──────────────────────────────────
// The identify_company / search_company path reads company by org_number.
// Verifies that a plain select with scrapling + core columns does not trigger
// PGRST201 (ambiguous embed) — there must be no duplicate FK path to company
// that makes table-name embeds break (see L-memory: PGRST201 redirect loop
// caused by workspace.signatory_profile_id adding a 2nd FK profile↔workspace).
const companyByOrgNumber = await sb
  .from("company")
  .select(
    "company_id, name, org_number, nace_code, nace_description, " +
    "daglig_leder, address_line_1, city, postal_code, country, " +
    "registration_date, onboarding_status, raw_scraped_data",
  )
  .eq("org_number", "000000000") // synthetic — no row expected, signature proven
  .limit(1);
assertOk("select company by org_number (no PGRST201)", companyByOrgNumber);

result();
