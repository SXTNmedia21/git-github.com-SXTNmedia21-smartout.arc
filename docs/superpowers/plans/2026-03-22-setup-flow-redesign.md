# Setup Flow Redesign — Data Integrity, Source Tracking, Design Tokens, AI Pre-fill

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every piece of data collected across all three setup flows is saved, sourced, sorted, and available to every downstream consumer. No data is lost between steps. Every field tracks where it came from. Design tokens replace all hardcoded colors. Every wizard field is AI-assisted where possible.

**Architecture:** Three flows share one data pipeline with source tracking. Data flows through the canonical path:

```
/join (raw intake + scrape + brreg + AI generation)
  ↓ completeSignup() writes to:
  ↓   company, company_details, company_opening_hours, company_social_media
  ↓   workspace.intelligence_data (full context for /onboarding)
  ↓
/onboarding (enriches via gather-workspace-intelligence + user refinement)
  ↓ finalize_onboarding_workspace RPC writes to:
  ↓   company (update), department, location, zone, procedure, season
  ↓   company_details (UPSERT — NEW: preserves join data + adds onboarding edits)
  ↓   workspace (onboarding_completed=true)
  ↓
Dashboard Wizard (reads from DB tables, NEVER from intelligence_data)
  ↓ reads: company, company_details, company_opening_hours, company_social_media
  ↓         department, procedure, workspace (Google columns)
  ↓ writes: policy, protocol, procedure_step, handbook_chapter, schedule_template, etc.
```

**Source tracking principle:** Every piece of collected data carries a `source` classification:

- `scrape` — extracted from website by Scrapling
- `brreg` — from Brønnøysundregistrene API
- `places` — from Google Places API
- `web_search` — from Serper web search
- `ai_generated` — LLM-generated content (about us, history, concept, menu description)
- `user_input` — manually entered by user
- `user_confirmed` — AI-generated but confirmed/edited by user
- `document_extraction` — AI-extracted from uploaded documents
- `industry_default` — from industry package template

**Tech Stack:** Tailwind v4 CSS variables, shadcn/ui, Framer Motion (spring physics), design-tokens package, TanStack Query, Supabase

---

## Complete Data Inventory — 32 Fields, 3 Categories

### A. Scraped/External Data (16 fields)

| #   | Field          | Source API       | Join Storage                                          | Onboarding                     | Dashboard Wizard                      | Current Status                           |
| --- | -------------- | ---------------- | ----------------------------------------------------- | ------------------------------ | ------------------------------------- | ---------------------------------------- |
| 1   | companyName    | Scrapling        | intel.scraped + company.name                          | Restored via mergeBusinessData | Only workspace.name                   | PARTIAL — dashboard reads DB ✅          |
| 2   | email          | Scrapling        | intel.scraped + company.email                         | Restored ✅                    | ❌ Not read from company table        | GAP — in DB, not queried                 |
| 3   | phone          | Scrapling        | intel.scraped + company.phone                         | Restored ✅                    | ❌ Not read from company table        | GAP — in DB, not queried                 |
| 4   | socialLinks    | Scrapling        | intel.scraped + company_social_media                  | ❌ No field in BusinessData    | ❌ Never read                         | GAP — in DB, lost at onboarding          |
| 5   | openingHours   | Scrapling/Places | intel.scraped (string) + company_opening_hours (rows) | String only                    | ❌ Not read                           | GAP — structured data in DB, not queried |
| 6   | locations      | Scrapling        | intel.scraped.locations                               | Restored ✅                    | Written to DB by finalize ✅          | OK                                       |
| 7   | departments    | Scrapling        | intel.scraped.departments                             | From NACE (not scrape)         | From DB ✅                            | OK                                       |
| 8   | logoUrl        | Scrapling        | intel.scraped.logoUrl                                 | Into BusinessData              | ❌ Never persisted to DB              | GAP — lost after onboarding              |
| 9   | images         | Scrapling        | intel.scraped.images                                  | ❌ Not restored                | ❌                                    | GAP — never reaches DB                   |
| 10  | menus (links)  | Scrapling        | intel.scraped.menus                                   | ❌ Not restored                | ❌                                    | GAP — never reaches DB                   |
| 11  | reservationUrl | Scrapling        | intel.scraped.reservationUrl                          | ❌ Not restored                | ❌                                    | GAP — never reaches DB                   |
| 12  | googleRating   | Google Places    | workspace.google_rating                               | Into BusinessData              | ❌ Not in ScrapedIntelligence         | GAP — in DB, not queried                 |
| 13  | priceLevel     | Google Places    | workspace.google_price_level                          | Into BusinessData              | ❌                                    | GAP — in DB, not queried                 |
| 14  | photos         | Google Places    | intel.places.photos                                   | Into BusinessData              | ❌                                    | GAP — never persisted to own table       |
| 15  | googleMapsUri  | Google Places    | workspace.google_maps_url                             | Into BusinessData              | ❌                                    | GAP — in DB, not queried                 |
| 16  | naceCode       | BRREG            | ❌ MISSING from shell                                 | resolveNaceCode works but slow | ❌ Key mismatch in useIndustryPackage | TRIPLE FAILURE                           |

### B. User Input + AI Generated (8 fields)

| #   | Field               | Source              | Join Storage                        | Onboarding                          | Dashboard Wizard                       | Current Status           |
| --- | ------------------- | ------------------- | ----------------------------------- | ----------------------------------- | -------------------------------------- | ------------------------ |
| 17  | aboutUs             | AI gen + user edit  | company_details.about_us ✅         | ❌ Only as description fallback     | ❌ Not in ScrapedIntelligence          | GAP — in DB, not queried |
| 18  | ourHistory          | AI gen + user edit  | company_details.our_history ✅      | ❌ Not restored from join_intake    | ❌                                     | GAP — in DB, not queried |
| 19  | ourConcept          | AI gen + user edit  | company_details.our_concept ✅      | ❌ Only as description fallback     | ❌                                     | GAP — in DB, not queried |
| 20  | restaurantType      | AI gen + user edit  | company_details.restaurant_type ✅  | ❌ join_intake.menu not read        | ❌                                     | GAP — in DB, not queried |
| 21  | cuisineTypes        | AI gen + user edit  | company_details.cuisine_types ✅    | ❌ join_intake.menu not read        | ❌                                     | GAP — in DB, not queried |
| 22  | priceCategory       | AI gen + user edit  | company_details.price_category ✅   | ❌                                  | ❌                                     | GAP — in DB, not queried |
| 23  | menuDescription     | AI gen + user edit  | company_details.menu_description ✅ | ❌                                  | ❌                                     | GAP — in DB, not queried |
| 24  | industry (naceCode) | BRREG + user select | company.industry ✅ (mapped)        | resolveNaceCode("restaurant") works | ❌ useIndustryPackage reads wrong keys | GAP — detection broken   |

### C. Document Extraction (8 fields, dashboard only)

| #   | Field                        | AI Source       | Consumer Step     | Current Status                                    |
| --- | ---------------------------- | --------------- | ----------------- | ------------------------------------------------- |
| 25  | policies[]                   | Claude Sonnet 4 | GovernanceStep    | ❌ RECEIVED BUT IGNORED (no-op useEffect)         |
| 26  | payroll.tariff               | Claude Sonnet 4 | PayrollStep       | ✅ Name matching works                            |
| 27  | payroll.supplements          | Claude Sonnet 4 | PayrollStep       | ❌ IGNORED (only tariff name used)                |
| 28  | employees[]                  | Claude Sonnet 4 | TeamStep          | ✅ Fully used with dept/position matching         |
| 29  | shiftPatterns[]              | Claude Sonnet 4 | ShiftTemplateStep | ✅ Fully used, overrides industry defaults        |
| 30  | employmentTerms.probation    | Claude Sonnet 4 | EmploymentStep    | ✅ Used                                           |
| 31  | employmentTerms.noticePeriod | Claude Sonnet 4 | EmploymentStep    | ❌ IGNORED                                        |
| 32  | handbookSections[]           | Claude Sonnet 4 | HandbookStep      | ❌ TYPED BUT NEVER READ by generateChapterContent |

---

## Source Tracking — New `data_source` Pattern

### Add source tracking to company_details

Every field that can be auto-populated should track its source. Extend `company_details` with a `field_sources` JSONB column:

```sql
ALTER TABLE company_details ADD COLUMN IF NOT EXISTS
  field_sources jsonb DEFAULT '{}';
-- Example value:
-- {
--   "about_us": "ai_generated",
--   "our_history": "ai_generated",
--   "restaurant_type": "user_confirmed",
--   "cuisine_types": "ai_generated",
--   "phone": "scrape",
--   "email": "scrape"
-- }
```

### Track sources in intelligence_data

The `buildOnboardingShellIntelligence` function should tag each field:

```typescript
scraped: {
  companyName: data.step1.companyName,
  _sources: {
    companyName: "user_input",
    email: "scrape",
    phone: "scrape",
    socialLinks: "scrape",
    openingHours: "scrape",  // or "places" if from Google
  }
},
join_intake: {
  businessNarrative: {
    aboutUs: data.step3.aboutUs,
    _sources: {
      aboutUs: state.intelligence ? "user_confirmed" : "user_input",
      ourHistory: state.intelligence ? "user_confirmed" : "user_input",
      ourConcept: state.intelligence ? "user_confirmed" : "user_input",
    }
  }
}
```

---

## Task Plan — 14 Tasks

### Phase 1: Data Foundation (Tasks 1-4)

Fix the data pipeline so every field flows through correctly.

### Phase 2: Dashboard Data Population (Tasks 5-8)

Wire the dashboard wizard to read ALL available data from DB tables.

### Phase 3: Document Extraction Gaps (Tasks 9-11)

Wire unused extraction fields to their consumer steps.

### Phase 4: Design Tokens (Tasks 12-14)

Replace hardcoded colors across all three flows.

---

## Task 1: Fix naceCode in Shell + Double Key Mismatch

**Why:** Industry detection is broken at three levels: (1) naceCode missing from shell, (2) useIndustryPackage reads `brregData` but shell writes `brreg`, (3) fallback reads `scrapedData` but shell writes `scraped`.

**Files:**

- Modify: `apps/web/src/app/join/_lib/onboarding-shell.ts`
- Modify: `apps/web/src/lib/industry/use-industry-package.ts` (correct path, NOT wizard-steps/)

- [ ] **Step 1: Read Step1Account.tsx — verify form values**

Confirm INDUSTRY_OPTIONS values: `restaurant`, `cafe`, `bar`, `hotel`, `catering`, `fast_food`, `retail`, `other`.

- [ ] **Step 2: Add naceCode + source tracking to shell**

```typescript
// onboarding-shell.ts — top of file
const INDUSTRY_NACE_MAP: Record<string, string> = {
  restaurant: "56.101",
  cafe: "56.102",
  bar: "56.301",
  hotel: "55.101",
  catering: "56.210",
  fast_food: "56.102",
  retail: "47.110",
  other: "",
};

function resolveNaceFromIndustry(industry: string): string {
  return INDUSTRY_NACE_MAP[industry] ?? "";
}
```

In `buildOnboardingShellIntelligence`, brreg block:

```typescript
brreg: {
  legalName: data.step1.companyName,
  orgNumber: data.step2.orgNumber,
  naceCode: resolveNaceFromIndustry(data.step1.industry),  // NEW
  naceDescription: data.step1.industry,
  address: { street: data.step2.street, postalCode: data.step2.postalCode, city: data.step2.city },
  employeeCount: parseEmployeeCount(data.step6.employeeCount),
},
```

- [ ] **Step 3: Fix DOUBLE key mismatch in useIndustryPackage**

Read `apps/web/src/lib/industry/use-industry-package.ts`. Fix lines 34 and 46:

```typescript
// Line 34 — support both keys
const brreg = (data.brregData ?? data.brreg) as Record<string, unknown> | undefined;

// Line 46 — support both keys
const scraped = (data.scrapedData ?? data.scraped) as Record<string, unknown> | undefined;
```

- [ ] **Step 4: Typecheck + Commit**

```bash
git add apps/web/src/app/join/_lib/onboarding-shell.ts apps/web/src/lib/industry/use-industry-package.ts
git commit -m "fix(data): add naceCode to shell, fix double key mismatch in useIndustryPackage

Industry detection was broken at three levels: naceCode missing from
shell output, useIndustryPackage read data.brregData but shell writes
data.brreg, fallback read data.scrapedData but shell writes data.scraped.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Fix Onboarding Resume — Restore All Join Data

**Why:** 7 fields from /join are silently dropped during /onboarding resume: ourHistory, ourConcept (as dedicated fields), restaurantType, cuisineTypes, priceCategory, menuDescription, socialLinks.

**IMPORTANT:** `joinIntake` is ALREADY declared at line 183 of useOnboardingState.ts. EXTEND the existing block — do NOT redeclare.

**Files:**

- Modify: `apps/web/src/app/onboarding/types.ts`
- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:183-206`

- [ ] **Step 1: Add missing fields to BusinessData in types.ts**

```typescript
// Add to BusinessData interface:
socialLinks?: Record<string, string>;
restaurantType?: string;
cuisineTypes?: string[];
menuDescription?: string;
priceCategory?: string;
ourHistory?: string;
ourConcept?: string;
logoUrl?: string; // already exists? Check first
reservationUrl?: string;
menuLinks?: Array<{ href: string; text: string }>;
```

Add same fields to `EMPTY_BUSINESS_DATA` with appropriate defaults.

- [ ] **Step 2: Extend resume() to restore all join_intake fields**

After the existing `merged.description` fallback (~line 197), ADD:

```typescript
// Restore join intake fields that mergeBusinessData doesn't handle
if (joinIntake) {
  const narrative = joinIntake.businessNarrative as {
    aboutUs?: string;
    ourHistory?: string;
    ourConcept?: string;
  } | null;
  if (narrative?.ourHistory) merged.ourHistory = narrative.ourHistory;
  if (narrative?.ourConcept) merged.ourConcept = narrative.ourConcept;

  const menu = joinIntake.menu as {
    restaurantType?: string;
    cuisineTypes?: string[];
    priceCategory?: string;
    menuDescription?: string;
  } | null;
  if (menu?.restaurantType) merged.restaurantType = menu.restaurantType;
  if (menu?.cuisineTypes?.length) merged.cuisineTypes = menu.cuisineTypes;
  if (menu?.priceCategory) merged.priceCategory = menu.priceCategory;
  if (menu?.menuDescription) merged.menuDescription = menu.menuDescription;
}

// Restore scraped fields not covered by mergeBusinessData
const scrapedRaw = scraped as Record<string, unknown> | null;
if (scrapedRaw) {
  const socialLinks = scrapedRaw.socialLinks as Record<string, string> | undefined;
  if (socialLinks && Object.keys(socialLinks).length > 0) merged.socialLinks = socialLinks;

  if (scrapedRaw.reservationUrl) merged.reservationUrl = scrapedRaw.reservationUrl as string;
  if (scrapedRaw.menus)
    merged.menuLinks = scrapedRaw.menus as Array<{ href: string; text: string }>;
  if (scrapedRaw.logoUrl) merged.logoUrl = scrapedRaw.logoUrl as string;
}
```

- [ ] **Step 3: Typecheck + Commit**

---

## Task 3: Extend Finalize RPC — Write ALL Business Data to DB

**Why:** The finalize RPC writes departments, procedures, seasons — but NOT business narrative, menu data, social links, or contact info to their proper tables. The dashboard wizard should read from DB, so finalize must write everything.

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_finalize_write_full_business_data.sql`
- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` (finalize payload)

- [ ] **Step 1: Read the current finalize_onboarding_workspace RPC**

Find the latest version in migrations. Understand what it writes.

- [ ] **Step 2: Add business narrative + menu + contact to finalize payload**

In `useOnboardingState.ts` finalize(), extend the payload sent to the RPC:

```typescript
// Add to workspacePayload:
aboutUs: business.description,
ourHistory: business.ourHistory,
ourConcept: business.ourConcept,
restaurantType: business.restaurantType,
cuisineTypes: business.cuisineTypes,
priceCategory: business.priceCategory,
menuDescription: business.menuDescription,
socialLinks: business.socialLinks,
logoUrl: business.logoUrl,
phone: business.phone,
email: business.email,
```

- [ ] **Step 3: Extend the RPC SQL to upsert company_details**

```sql
-- Inside finalize_onboarding_workspace, after company INSERT/UPDATE:

-- Upsert company_details with all business narrative + menu data
INSERT INTO company_details (
  workspace_id, about_us, our_history, our_concept,
  restaurant_type, cuisine_types, price_category, menu_description,
  employee_count, field_sources
) VALUES (
  v_workspace_id,
  (p_data->>'aboutUs'),
  (p_data->>'ourHistory'),
  (p_data->>'ourConcept'),
  (p_data->>'restaurantType'),
  COALESCE((SELECT array_agg(x::text) FROM jsonb_array_elements_text(p_data->'cuisineTypes') x), '{}'),
  (p_data->>'priceCategory'),
  (p_data->>'menuDescription'),
  (p_data->>'employeeCount'),
  COALESCE(p_data->'fieldSources', '{}')
)
ON CONFLICT (workspace_id) DO UPDATE SET
  about_us = COALESCE(EXCLUDED.about_us, company_details.about_us),
  our_history = COALESCE(EXCLUDED.our_history, company_details.our_history),
  our_concept = COALESCE(EXCLUDED.our_concept, company_details.our_concept),
  restaurant_type = COALESCE(EXCLUDED.restaurant_type, company_details.restaurant_type),
  cuisine_types = CASE WHEN array_length(EXCLUDED.cuisine_types, 1) > 0
                       THEN EXCLUDED.cuisine_types
                       ELSE company_details.cuisine_types END,
  price_category = COALESCE(EXCLUDED.price_category, company_details.price_category),
  menu_description = COALESCE(EXCLUDED.menu_description, company_details.menu_description),
  employee_count = COALESCE(EXCLUDED.employee_count, company_details.employee_count),
  field_sources = company_details.field_sources || COALESCE(EXCLUDED.field_sources, '{}'),
  updated_at = now();

-- Update company with contact info
UPDATE company SET
  phone = COALESCE((p_data->>'phone'), company.phone),
  email = COALESCE((p_data->>'email'), company.email)
WHERE company_id = v_company_id;

-- Upsert social media
INSERT INTO company_social_media (workspace_id, platform, url)
SELECT v_workspace_id, key, value
FROM jsonb_each_text(COALESCE(p_data->'socialLinks', '{}'))
WHERE value IS NOT NULL AND value != ''
ON CONFLICT (workspace_id, platform) DO UPDATE SET
  url = EXCLUDED.url, updated_at = now();
```

- [ ] **Step 4: Add field_sources column to company_details**

```sql
ALTER TABLE company_details ADD COLUMN IF NOT EXISTS
  field_sources jsonb DEFAULT '{}';
COMMENT ON COLUMN company_details.field_sources IS
  'Source tracking per field: scrape, brreg, ai_generated, user_input, user_confirmed, document_extraction';
```

- [ ] **Step 5: Run migration locally + Typecheck + Commit**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<fil>.sql
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
pnpm --filter web typecheck
```

---

## Task 4: Source Tracking in Join Shell

**Why:** Every field should carry its source so downstream consumers know if data is from scrape, AI, or user input.

**Files:**

- Modify: `apps/web/src/app/join/_lib/onboarding-shell.ts`
- Modify: `apps/web/src/app/join/_lib/setupActions.ts` (pass field_sources to company_details insert)
- Modify: `apps/web/src/app/join/_hooks/useSignupWizard.tsx` (track which fields were AI-generated)

- [ ] **Step 1: Add \_sources to shell intelligence**

In `buildOnboardingShellIntelligence`, add source metadata:

```typescript
join_intake: {
  // ... existing fields ...
  fieldSources: {
    aboutUs: data.intelligence ? "user_confirmed" : "user_input",
    ourHistory: data.intelligence ? "user_confirmed" : "user_input",
    ourConcept: data.intelligence ? "user_confirmed" : "user_input",
    restaurantType: data.intelligence ? "ai_generated" : "user_input",
    cuisineTypes: data.intelligence ? "ai_generated" : "user_input",
    priceCategory: data.intelligence ? "ai_generated" : "user_input",
    menuDescription: data.intelligence ? "ai_generated" : "user_input",
    phone: "user_input",  // even if pre-filled from scrape, user confirmed
    email: "user_input",
  },
},
```

- [ ] **Step 2: Pass field_sources to company_details in setupActions**

In `completeSignup()`, when inserting into `company_details`, add:

```typescript
field_sources: data.intelligence
  ? shellIntelligence.join_intake.fieldSources
  : {},
```

- [ ] **Step 3: Typecheck + Commit**

---

## Task 5: Dashboard Wizard — Read ALL Data from DB

**Why:** WelcomeStep shows almost nothing because ScrapedIntelligence only has `companyName`. All the data is in DB tables but never queried.

**IMPORTANT:** `intelligence_data` is NOT on the workspace context type. Read from DB tables directly.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/wizard-state.ts` (extend ScrapedIntelligence)
- Modify: `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx` (add DB queries)

- [ ] **Step 1: Extend ScrapedIntelligence type**

```typescript
interface ScrapedIntelligence {
  // Existing:
  companyName?: string;
  orgNumber?: string;
  industryType?: string;
  openingHours?: string;
  departments?: string[];
  address?: string;
  website?: string;
  email?: string;
  phone?: string;
  googleRating?: number;
  menuItemCount?: number;
  // NEW — business narrative:
  aboutUs?: string;
  ourHistory?: string;
  ourConcept?: string;
  restaurantType?: string;
  cuisineTypes?: string[];
  priceCategory?: string;
  menuDescription?: string;
  // NEW — external:
  socialLinks?: Record<string, string>;
  logoUrl?: string;
  googleMapsUrl?: string;
  googlePriceLevel?: string;
  // NEW — source tracking:
  fieldSources?: Record<string, string>;
}
```

- [ ] **Step 2: Add DB queries to WorkspaceSetupWizard**

Replace the empty `scrapedData` useMemo with actual DB queries:

```typescript
// Query company
const { data: company } = useQuery({
  queryKey: ["wizard-company", workspaceId],
  queryFn: async () => {
    const { data } = await supabase
      .from("company")
      .select("*")
      .eq("company_id", ctx?.workspace.company_id!)
      .single();
    return data;
  },
  enabled: !!ctx?.workspace.company_id,
});

// Query company_details
const { data: companyDetails } = useQuery({
  queryKey: ["wizard-company-details", workspaceId],
  queryFn: async () => {
    const { data } = await supabase
      .from("company_details")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();
    return data;
  },
  enabled: !!workspaceId,
});

// Query company_opening_hours
const { data: openingHours } = useQuery({
  queryKey: ["wizard-opening-hours", workspaceId],
  queryFn: async () => {
    const { data } = await supabase
      .from("company_opening_hours")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("day_of_week");
    return data ?? [];
  },
  enabled: !!workspaceId,
});

// Query company_social_media
const { data: socialMedia } = useQuery({
  queryKey: ["wizard-social-media", workspaceId],
  queryFn: async () => {
    const { data } = await supabase
      .from("company_social_media")
      .select("*")
      .eq("workspace_id", workspaceId);
    return data ?? [];
  },
  enabled: !!workspaceId,
});

// Build ScrapedIntelligence from DB
const scrapedData = useMemo<ScrapedIntelligence>(
  () => ({
    companyName: ctx?.workspace.name,
    orgNumber: company?.org_number ?? undefined,
    industryType: company?.industry ?? undefined,
    address:
      [company?.address_line_1, company?.postal_code, company?.city].filter(Boolean).join(", ") ||
      undefined,
    website: company?.website ?? undefined,
    email: company?.email ?? undefined,
    phone: company?.phone ?? undefined,
    openingHours:
      openingHours
        ?.filter((h) => !h.is_closed)
        .map(
          (h) =>
            `${["Man", "Tir", "Ons", "Tor", "Fre", "Lor", "Son"][h.day_of_week]}: ${h.open_time}-${h.close_time}`,
        )
        .join(", ") || undefined,
    googleRating: (ctx?.workspace as Record<string, unknown>)?.google_rating as number | undefined,
    googleMapsUrl: (ctx?.workspace as Record<string, unknown>)?.google_maps_url as
      | string
      | undefined,
    googlePriceLevel: (ctx?.workspace as Record<string, unknown>)?.google_price_level as
      | string
      | undefined,
    // Business narrative from company_details:
    aboutUs: companyDetails?.about_us ?? undefined,
    ourHistory: companyDetails?.our_history ?? undefined,
    ourConcept: companyDetails?.our_concept ?? undefined,
    restaurantType: companyDetails?.restaurant_type ?? undefined,
    cuisineTypes: companyDetails?.cuisine_types ?? undefined,
    priceCategory: companyDetails?.price_category ?? undefined,
    menuDescription: companyDetails?.menu_description ?? undefined,
    // Social media:
    socialLinks:
      socialMedia?.reduce((acc, sm) => ({ ...acc, [sm.platform]: sm.url }), {}) ?? undefined,
    // Source tracking:
    fieldSources: (companyDetails?.field_sources as Record<string, string>) ?? undefined,
  }),
  [ctx, company, companyDetails, openingHours, socialMedia],
);
```

- [ ] **Step 3: Typecheck + Commit**

---

## Task 6: Handbook Generation — Use ALL Available Data

**Why:** 6/10 chapters are static boilerplate. Now that ScrapedIntelligence has full data from DB (Task 5), chapters can be richly generated.

**CRITICAL:** Helper functions are `para()` and `h()`, NOT `paragraph()` and `heading()`.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/HandbookSetupStep.tsx`

- [ ] **Step 1: Read HandbookSetupStep fully — find helpers + static chapters**

- [ ] **Step 2: Wire handbookSections from document extraction**

The `extractedData.handbookSections` field is typed but never read. In `generateChapterContent()`, add at the TOP of each chapter case:

```typescript
// Check if document extraction produced content for this chapter
const extracted = state.extractedData?.handbookSections?.find((s) => s.chapterKey === chapterKey);
if (extracted) {
  return [h(2, title), para(extracted.content), para(`Kilde: ${extracted.source}`)];
}
```

- [ ] **Step 3: Enrich each chapter with real data**

For each chapter, use data from `scrapedData` (which now has all DB fields):

| Chapter               | Data to inject                                                          |
| --------------------- | ----------------------------------------------------------------------- |
| `identity-mission`    | aboutUs, ourHistory, ourConcept, cuisineTypes, menuDescription, website |
| `organization-model`  | departments (already used), ALSO add positions per dept                 |
| `daily-operations`    | openingHours (structured), shiftPatterns (already used)                 |
| `safety-compliance`   | extracted policies (already used), address, phone                       |
| `communication`       | socialLinks, phone, email, website                                      |
| `onboarding-training` | aboutUs, ourConcept, departments                                        |
| `scheduling`          | openingHours, seasonCreated (already used)                              |
| `quality-service`     | cuisineTypes, restaurantType, priceCategory                             |
| `incident-response`   | address, phone                                                          |
| `kpi-review`          | openingHours, employee count, seasonCreated                             |

- [ ] **Step 4: Add source badges to generated content**

For AI-generated content, add a small note: `para("Kilde: AI-generert fra bedriftsprofil")`.
For document-extracted content: `para("Kilde: " + extracted.source)`.

- [ ] **Step 5: Typecheck + Commit**

---

## Task 7: GovernanceStep — Wire Extracted Policies

**Why:** Extracted policies from uploaded documents are received but ignored (no-op useEffect).

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/GovernanceSetupStep.tsx`

- [ ] **Step 1: Read GovernanceSetupStep — find the no-op useEffect**

Line 197-201 — the `extractedPolicies` effect does nothing.

- [ ] **Step 2: Auto-create policies from extracted data**

When `extractedPolicies` has entries, for each:

1. Find if a matching template exists (name matching)
2. If yes: pre-select that template
3. If no: show the extracted policy as a "custom policy" suggestion the user can accept

- [ ] **Step 3: Pre-select existing procedures from DB**

Query `procedure` table and mark any matching procedures as already-created.

- [ ] **Step 4: Typecheck + Commit**

---

## Task 8: Wire Remaining Extraction Gaps

**Why:** Three extraction fields are received but ignored: payroll.supplements, employmentTerms.noticePeriod, handbookSections.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/PayrollSetupStep.tsx`
- Modify: `apps/web/src/components/dashboard/wizard-steps/EmploymentSetupStep.tsx`

- [ ] **Step 1: PayrollStep — use extracted supplements**

Read PayrollSetupStep. When `extractedPayroll.supplements` has values, pre-fill the supplement fields (kveldstillegg, helgetillegg, etc.) instead of only matching tariff name.

- [ ] **Step 2: EmploymentStep — use noticePeriod**

Read EmploymentSetupStep. When `extractedTerms.noticePeriod` is set, parse it and pre-fill the notice period field.

- [ ] **Step 3: Typecheck + Commit**

---

## Task 9: Team Step — Template Positions per Department

**Why:** User wants template positions (Kokk, Servitor, Daglig leder) pre-suggested per department.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx`

- [ ] **Step 1: Read TeamSetupStep — how does department/position selection work?**

- [ ] **Step 2: Import POSITION_MAP or query position table**

The `position` table may already have rows from payroll step. Query those. If not, use industry defaults from `apps/web/src/app/onboarding/lib/industry-defaults.ts` POSITION_MAP.

- [ ] **Step 3: When user selects department, suggest matching positions**

Show positions as dropdown options populated from DB or POSITION_MAP.

- [ ] **Step 4: Typecheck + Commit**

---

## Task 10: WelcomeStep — Persist Inline Edits

**Why:** WelcomeStep allows inline editing of facts (company name, address, etc.) but edits are local state only — not persisted.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/WelcomeStep.tsx`

- [ ] **Step 1: Read WelcomeStep — find the override state**

- [ ] **Step 2: Persist edits to DB on blur/save**

When user edits a fact, write the change to the appropriate DB table (company, company_details) and update the `field_sources` to `"user_input"`.

- [ ] **Step 3: Typecheck + Commit**

---

## Task 11: Design Tokens — Join Flow (43 violations)

**Files:** All 11 join component files

- [ ] **Step 1: Apply token mapping**

| Hardcoded                     | Replace With                                       |
| ----------------------------- | -------------------------------------------------- |
| `bg-orange-500`               | `bg-[var(--brand-orange)]`                         |
| `hover:bg-orange-600`         | `hover:bg-[var(--brand-orange-dark)]`              |
| `text-orange-500`             | `text-[var(--brand-orange)]`                       |
| `bg-emerald-500`              | `bg-[var(--success)]`                              |
| `text-emerald-*`              | `text-[var(--success)]`                            |
| `bg-amber-*` / `text-amber-*` | `bg-[var(--warning)]/10` / `text-[var(--warning)]` |
| `text-gray-700`               | `text-foreground`                                  |
| `bg-white` (dropdowns)        | `bg-card`                                          |
| `text-red-*` / `bg-red-*`     | `text-destructive` / `bg-destructive/10`           |

- [ ] **Step 2: Fix SignupWizard.tsx oklch → CSS vars**

Add in `globals.css` inside `@theme inline { }` (NOT `:root`):

```css
--color-join-bg: oklch(0.99 0.004 60);
--color-join-panel: oklch(0.18 0.03 50);
```

- [ ] **Step 3: Fix Step4Hours inline oklch → CSS vars**
- [ ] **Step 4: Add `font-heading` to all step `<h2>` elements**
- [ ] **Step 5: Typecheck + visual verification + Commit**

---

## Task 12: Design Tokens — Onboarding Flow (18 violations)

**Files:** 7 section files

- [ ] **Step 1: Replace semantic colors**

`text-red-*` → `text-destructive`, `bg-emerald-*` → `bg-[var(--success)]`, `text-amber-*` → `text-[var(--warning)]`, `bg-blue-*` → `bg-[var(--info)]`.

Do NOT change `text-white`, `bg-white/[0.05]` — intentional for dark theme.

- [ ] **Step 2: Typecheck + visual verification + Commit**

---

## Task 13: Design Tokens — Dashboard Wizard (299 isDark, 12 files)

**Largest task.** Remove `isDark` anti-pattern from shell + all 11 step files.

**Files:** WorkspaceSetupWizard.tsx + all 11 wizard-steps/ files

- [ ] **Step 1: Remove isDark from WorkspaceSetupWizard shell**
- [ ] **Step 2: Fix each step component (11 files, largest first)**

PayrollSetupStep(50) → EmploymentSetupStep(41) → DocumentDropStep(41) → SeasonSetupStep(36) → GovernanceSetupStep(27) → TeamSetupStep(26) → HandbookSetupStep(24) → WelcomeStep(19) → csv-column-mapper(19) → ShiftTemplateSetupStep(11) → BotsTip(5)

Token mapping:
| Pattern | Replace |
|---------|---------|
| `border-zinc-*` | `border-border` |
| `bg-zinc-*` | `bg-muted` |
| `text-zinc-400/500/600` | `text-muted-foreground` |
| `text-zinc-300/900` | `text-foreground` |
| `hover:bg-zinc-*` | `hover:bg-accent` |
| `bg-orange-*` | `bg-[var(--brand-orange)]*` |
| `text-orange-*` | `text-[var(--brand-orange)]` |
| `bg-emerald-*` | `bg-[var(--success)]*` |
| `text-emerald-*` | `text-[var(--success)]` |

- [ ] **Step 3: Add font-heading to wizard `<h1>`**
- [ ] **Step 4: Typecheck + visual verification + Commit**

---

## Task 14: Integration Test

- [ ] **Step 1: Full flow walkthrough** (`/join` → `/onboarding` → dashboard wizard)

Verify:

1. All 6 join steps — design tokens correct, data persisted
2. Step 4 auto-populates opening hours from scrape
3. Step 6 password autofill doesn't navigate backwards
4. Redirect to `/onboarding?ws=...`
5. Onboarding — all data pre-filled (industry, address, phone, socialLinks, menu data)
6. Departments + procedures pre-selected from NACE code
7. Finalize → all data written to company, company_details, company_social_media
8. Dashboard wizard — WelcomeStep shows ALL data (address, phone, industry, Google rating, about us)
9. GovernanceStep — procedures from onboarding pre-selected, extracted policies used
10. PayrollStep — extracted tariff + supplements pre-filled
11. TeamStep — template positions suggested per department
12. HandbookStep — chapters contain real business content + document extractions
13. Source tracking — `company_details.field_sources` populated

- [ ] **Step 2: `pnpm turbo typecheck` — 0 errors**
- [ ] **Step 3: Commit final fixes**

---

## Execution Order

```
Phase 1 — Data Foundation (sequential):
  Task 1 (naceCode + key mismatch)
  → Task 2 (onboarding resume gaps)
  → Task 3 (finalize RPC extension + source tracking migration)
  → Task 4 (source tracking in join shell)

Phase 2 — Dashboard Data (sequential, depends on Phase 1):
  Task 5 (ScrapedIntelligence from DB)
  → Task 6 (handbook enrichment)
  → Task 7 (governance + extracted policies)
  → Task 8 (payroll supplements + noticePeriod)
  → Task 9 (team template positions)
  → Task 10 (WelcomeStep edit persistence)

Phase 3 — Design Tokens (independent, can run parallel with Phase 1+2):
  Task 11 (join tokens) — independent
  Task 12 (onboarding tokens) — independent
  Task 13 (wizard tokens) — after Task 5 (same file)

Phase 4 — Verification:
  Task 14 (integration test) — last
```

**Recommended parallel groups:**

- **Group A:** Tasks 1→2→3→4→5→6→7→8→9→10 (data pipeline, sequential)
- **Group B:** Task 11 (join tokens, independent)
- **Group C:** Task 12 (onboarding tokens, independent)
- **Then:** Task 13 (wizard tokens, after Task 5 — shares WorkspaceSetupWizard.tsx)
- **Finally:** Task 14 (integration test)
