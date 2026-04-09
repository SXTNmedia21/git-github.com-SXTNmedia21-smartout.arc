# Finalize RPC Data Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the finalize_onboarding_workspace RPC that lost 5 critical sections through 7 successive CREATE OR REPLACE migrations, causing 14 data fields to be silently dropped during onboarding.

**Architecture:** Single new migration restores the complete RPC with all sections preserved + new address/logo/Google Places fields. One JS change sends address as separate fields instead of pre-joined string. One data-merger change captures daglig_leder.

**Tech Stack:** PostgreSQL (migration), TypeScript (useOnboardingState.ts, data-merger.ts)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/YYYYMMDDHHMMSS_restore_finalize_rpc_complete.sql` | CREATE | Complete RPC with all sections: company (full), company_details, social_media, workspace (full), season, departments, locations, procedures, professions, agent_profile |
| `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` | MODIFY (lines 769-801) | Send address as separate fields, add Google Places data, add ceo/dagligLeder |
| `apps/web/src/app/onboarding/lib/data-merger.ts` | MODIFY (line 103-110) | Add `ceo` field from Brreg dagligLeder |
| `apps/web/src/app/onboarding/types.ts` | MODIFY (line 52-86) | Add `ceo` to BusinessData interface |

---

### Task 1: Add `ceo` to BusinessData type and data-merger

**Files:**
- Modify: `apps/web/src/app/onboarding/types.ts:52-86`
- Modify: `apps/web/src/app/onboarding/lib/data-merger.ts:92-110`

- [ ] **Step 1: Add `ceo` to BusinessData interface**

In `apps/web/src/app/onboarding/types.ts`, add after line 58 (`phone: string;`):

```typescript
  ceo: string;
```

- [ ] **Step 2: Add `ceo` to EMPTY_BUSINESS_DATA**

Find `EMPTY_BUSINESS_DATA` in the same file (or in `types-v2.ts` if that's where defaults live) and add:

```typescript
ceo: "",
```

- [ ] **Step 3: Add `ceo` to mergeBusinessData return**

In `apps/web/src/app/onboarding/lib/data-merger.ts`, after line 93 (`const orgNumber = ...`), add:

```typescript
const ceo = coalesceString(b.dagligLeder, (b as Record<string, unknown>).daglig_leder as string);
```

And in the return object (around line 103-110), add:

```typescript
ceo,
```

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=web --force`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/types.ts apps/web/src/app/onboarding/lib/data-merger.ts
git commit -m "feat(onboarding): add ceo field from brreg daglig_leder to BusinessData"
```

---

### Task 2: Fix finalize payload to send separate address fields + all missing data

**Files:**
- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:769-801`

- [ ] **Step 1: Replace the workspacePayload construction**

In `useOnboardingState.ts`, replace lines 769-801 (the `workspacePayload` object) with:

```typescript
const workspacePayload = {
  // Core company fields
  name: business.name || "Min bedrift",
  legalName: business.legalName,
  orgNumber: business.orgNumber,
  email: business.email,
  phone: business.phone,
  website: business.website,
  ceo: business.ceo,

  // Address — separate fields for company + workspace columns
  addressLine1: business.address,
  postalCode: business.postalCode,
  city: business.city,

  // Industry
  industry: business.industry,
  industryCode: business.industryCode,
  employeeCount: business.employeeCount,

  // Description + branding
  summary: business.description,
  logoUrl: business.logoUrl,

  // Google Places data — workspace columns
  googleRating: business.googleRating,
  googleRatingCount: business.googleRatingCount,
  googleMapsUrl: business.googleMapsUrl,
  googlePlaceId: business.googlePlaceId,
  latitude: business.latitude,
  longitude: business.longitude,
  googlePriceLevel: business.priceLevel,

  // Structure
  departments: selectedDepts,
  locations: locationPayload,
  procedures: selectedProcs,
  seasonName: season.name || "Sesong 1",
  seasonType: "default",
  seasonStartDate: season.startDate,
  seasonEndDate: season.endDate,
  contractId: contract?.contractId ?? null,

  // Business narrative + menu data (company_details upsert)
  aboutUs: business.description,
  ourHistory: business.ourHistory,
  ourConcept: business.ourConcept,
  restaurantType: business.restaurantType,
  cuisineTypes: business.cuisineTypes,
  priceCategory: business.priceCategory,
  menuDescription: business.menuDescription,
  socialLinks: business.socialLinks,

  // Professions (if present in state)
  professions: (typeof professions !== "undefined" ? professions : undefined),
};
```

Note: The old `address` key (pre-joined string) is replaced by three separate keys: `addressLine1`, `postalCode`, `city`.

- [ ] **Step 2: Check professions variable exists in scope**

Search for `professions` in the finalize function scope. If it's passed from the onboarding confirm state, it should be available. If not, check the wizard definition's `onComplete` handler to see how professions are passed. The RPC already handles `p_data->'professions'` — we just need to ensure the payload includes them.

- [ ] **Step 3: Typecheck**

Run: `pnpm turbo typecheck --filter=web --force`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/hooks/useOnboardingState.ts
git commit -m "fix(onboarding): send all business fields to finalize including separate address, google places, ceo"
```

---

### Task 3: Write the complete restored finalize RPC migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_restore_finalize_rpc_complete.sql`

This is the critical task. The migration must be a complete `CREATE OR REPLACE` that includes EVERY section from the current version (20260421) PLUS the lost sections from (20260327).

- [ ] **Step 1: Generate the migration timestamp**

```bash
date -u +%Y%m%d%H%M%S
```

Use this as the filename prefix.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/{timestamp}_restore_finalize_rpc_complete.sql` with the complete function. The function must include all of the following sections:

**Section 1: Company INSERT/UPDATE** (from 20260421, EXTENDED)
- Existing fields: name, legal_name, org_number, industry, website, daglig_leder, nace_description, nace_code
- RESTORE from 20260327: `phone`, `email`
- ADD NEW: `address_line_1`, `postal_code`, `city`, `logo_url`
- Both INSERT and UPDATE paths must include all fields

Company INSERT new columns:
```sql
NULLIF(p_data->>'addressLine1', ''),
NULLIF(p_data->>'postalCode', ''),
NULLIF(p_data->>'city', ''),
NULLIF(p_data->>'phone', ''),
NULLIF(p_data->>'email', ''),
NULLIF(p_data->>'logoUrl', '')
```

Company UPDATE new columns:
```sql
address_line_1 = COALESCE(NULLIF(p_data->>'addressLine1', ''), address_line_1),
postal_code = COALESCE(NULLIF(p_data->>'postalCode', ''), postal_code),
city = COALESCE(NULLIF(p_data->>'city', ''), city),
phone = COALESCE(NULLIF(p_data->>'phone', ''), phone),
email = COALESCE(NULLIF(p_data->>'email', ''), email),
logo_url = COALESCE(NULLIF(p_data->>'logoUrl', ''), logo_url)
```

**Section 2: company_details upsert** (RESTORE from 20260327 lines 107-136 verbatim)

**Section 3: company_social_media upsert** (RESTORE from 20260327 lines 138-146 verbatim)

**Section 4: Workspace UPDATE** (from 20260421, EXTENDED)
- Existing: name, contract_status, short_description, brand_color, communication_tone
- RESTORE from 20260327: `onboarding_completed = true`
- ADD NEW: `address_line_1`, `postal_code`, `city`, `logo_url`, `phone`, `email`
- ADD NEW (Google Places): `google_rating`, `google_rating_count`, `google_maps_url`, `google_place_id`, `latitude`, `longitude`, `google_price_level`

```sql
UPDATE public.workspace SET
  name = COALESCE(v_company_name, name),
  contract_status = 'none',
  onboarding_completed = true,
  short_description = COALESCE(p_data->>'summary', short_description),
  brand_color = COALESCE(p_data->>'brandColor', brand_color),
  communication_tone = COALESCE(p_data->>'communicationTone', communication_tone),
  -- Address (new)
  address_line_1 = COALESCE(NULLIF(p_data->>'addressLine1', ''), address_line_1),
  postal_code = COALESCE(NULLIF(p_data->>'postalCode', ''), postal_code),
  city = COALESCE(NULLIF(p_data->>'city', ''), city),
  -- Contact + branding (new)
  logo_url = COALESCE(NULLIF(p_data->>'logoUrl', ''), logo_url),
  phone = COALESCE(NULLIF(p_data->>'phone', ''), phone),
  email = COALESCE(NULLIF(p_data->>'email', ''), email),
  -- Google Places (new — may already be set by gather-workspace-intelligence)
  google_rating = COALESCE((p_data->>'googleRating')::numeric, google_rating),
  google_rating_count = COALESCE((p_data->>'googleRatingCount')::integer, google_rating_count),
  google_maps_url = COALESCE(NULLIF(p_data->>'googleMapsUrl', ''), google_maps_url),
  google_place_id = COALESCE(NULLIF(p_data->>'googlePlaceId', ''), google_place_id),
  latitude = COALESCE((p_data->>'latitude')::double precision, latitude),
  longitude = COALESCE((p_data->>'longitude')::double precision, longitude),
  google_price_level = COALESCE(NULLIF(p_data->>'googlePriceLevel', ''), google_price_level)
WHERE workspace_id = p_workspace_id;
```

**Section 5-10: Preserve EXACTLY from 20260421** (season, departments, locations, procedures, professions, agent_profile — no changes)

**Guard comment at function top:**
```sql
-- =====================================================================
-- CRITICAL: This function is replaced by CREATE OR REPLACE.
-- When editing, you MUST preserve ALL sections below.
-- Lost sections cause silent data loss during onboarding.
-- Sections: company, company_details, company_social_media, workspace,
-- season, departments, locations, procedures, professions, agent_profile.
-- See docs/decisions/0000-decision-log.md for history.
-- =====================================================================
```

- [ ] **Step 3: Verify migration syntax**

```bash
npx supabase db reset 2>&1 | tail -20
```

Expected: migrations apply successfully, no SQL errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_restore_finalize_rpc_complete.sql
git commit -m "fix(onboarding): restore complete finalize RPC — address, phone, email, logo, company_details, social_media, onboarding_completed, google places"
```

---

### Task 4: Verify end-to-end placeholder resolution

**Files:**
- Modify: `packages/utils/src/employee-contract-placeholders.ts` (if needed)

- [ ] **Step 1: Verify contract placeholder resolver reads from correct tables**

The `buildEmployeePlaceholderMap` function in `packages/utils/src/employee-contract-placeholders.ts` reads:
- `company.org_number` (already fixed from `organization_number`)
- `workspace.address_line_1`, `workspace.postal_code`, `workspace.city` (for employer address)

After the migration fix, these columns will be populated. Verify the query in the function matches the actual column names. No code changes should be needed — the fix was done earlier in this session.

- [ ] **Step 2: Run typecheck**

```bash
pnpm turbo typecheck --filter=web --force
```

Expected: PASS

- [ ] **Step 3: Test locally**

1. `npx supabase db reset` to apply the new migration
2. Start the app: `pnpm --filter web dev`
3. Run through the onboarding wizard (or use seed data)
4. Go to `/dashboard/people` → "Send kontrakt" → verify employer fields are populated

- [ ] **Step 4: Final commit (if any adjustments needed)**

```bash
git commit -m "fix(onboarding): verify placeholder resolution with restored finalize data"
```

---

## Risk Notes

1. **`npx supabase db reset` required** — the new migration replaces the RPC function. Existing local databases need a reset to pick it up.

2. **Google Places columns may already be populated** by `gather-workspace-intelligence` Edge Function. The COALESCE in the workspace UPDATE ensures we don't overwrite existing values with nulls.

3. **The `address` key (old joined string) is no longer sent.** If any other code reads `p_data->>'address'` from the finalize payload, it will get null. Grep for this to confirm nothing else depends on it.

4. **`onboarding_completed = true` being restored** means the wizard resume logic will correctly stop trying to re-enter completed workspaces. This fixes a session bug where users would loop back into onboarding.
