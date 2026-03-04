---
title: "Intelligence Pipeline V2 Implementation Plan"
status: draft
updated: 2026-03-14
created: 2026-03-14
module: onboarding
tags: [plan, onboarding, intelligence-pipeline, google-places, workspace-provisioning]
---

# Intelligence Pipeline V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the onboarding intelligence pipeline to create workspaces early (during scan), integrate Google Places data, and store all intelligence on the workspace rather than the legacy `onboarding_session` table.

**Architecture:** The pipeline shifts from "scan then create workspace at the end" to "provision a minimal workspace immediately, enrich it with intelligence data in parallel phases, then finalize it when onboarding completes." Three data sources merge: Scrapling (web scrape), Brreg (Norwegian business registry), and Google Places (ratings, photos, coordinates). The workspace table gains dedicated columns for Places data plus a `intelligence_data` JSONB catch-all.

**Tech Stack:** Supabase Edge Functions (Deno), PostgreSQL RPCs (plpgsql), Google Places API (New), Next.js middleware, React state management, Vitest for unit tests.

---

## Context

### Working directory

All work happens in **wt-3** (`~/dev/wt-3`) on branch `feat/intelligence-pipeline-v2`.

The worktree already has 11 uncommitted files with substantial code. This plan formalizes that work into atomic commits with proper tests and docs.

### Key files to understand

| File                                                              | Purpose                               |
| ----------------------------------------------------------------- | ------------------------------------- |
| `supabase/migrations/20260312000000_intelligence_pipeline_v2.sql` | New columns + 2 RPCs                  |
| `supabase/functions/google-places-intelligence/index.ts`          | NEW edge function                     |
| `supabase/functions/gather-workspace-intelligence/index.ts`       | Refactored pipeline                   |
| `supabase/functions/finalize-workspace/index.ts`                  | Rewritten finalizer                   |
| `apps/web/src/app/onboarding/types.ts`                            | New BusinessData fields               |
| `apps/web/src/app/onboarding/lib/data-merger.ts`                  | 3-way merge with PlacesData           |
| `apps/web/src/app/onboarding/hooks/useOnboardingState.ts`         | Workspace-based save/resume           |
| `apps/web/src/app/onboarding/sections/BusinessSection.tsx`        | Google Places card in review          |
| `apps/web/src/middleware.ts`                                      | "onboarding" contract_status redirect |

### Architecture change (before → after)

**Before (v1):**

```
User input → gather-workspace-intelligence → onboarding_session row → UI fills in
                                                            ↓ (at the end)
                                              activate-workspace → workspace created
```

**After (v2):**

```
User input → gather-workspace-intelligence → provision_onboarding_workspace → workspace row
                                           ↓ (parallel)
                                     [scrape + brreg + places + web search]
                                           ↓
                                     intelligence_data stored on workspace
                                           ↓ (user finishes onboarding)
                                     finalize_onboarding_workspace → full workspace
```

---

## Task 1: Apply the database migration

**Files:**

- Verify: `supabase/migrations/20260312000000_intelligence_pipeline_v2.sql`

**Step 1: Review the migration**

Read the migration file. It should contain:

- `ALTER TABLE workspace` adding 7 columns: `intelligence_data`, `latitude`, `longitude`, `google_maps_url`, `google_rating`, `google_rating_count`, `google_price_level`, `google_place_id`
- `provision_onboarding_workspace` RPC — creates company, workspace (status='onboarding'), company_member, profile
- `finalize_onboarding_workspace` RPC — updates company + workspace, creates season, departments, teams, procedures, agent_profile

**Step 2: Apply migration locally**

Run: `cd ~/dev/wt-3 && npx supabase db reset`
Expected: Migration applies without errors. All 2 RPCs created.

**Step 3: Regenerate types**

Run: `cd ~/dev/wt-3 && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

Verify the generated file includes:

- `intelligence_data`, `latitude`, `longitude`, `google_*` columns on workspace
- `provision_onboarding_workspace` and `finalize_onboarding_workspace` in Functions

**Step 4: Fix the stray "Connecting to db 5432" line**

The current `database.types.ts` in wt-3 has a stray first line `Connecting to db 5432` from the gen command output. After regenerating, verify line 1 is `export type Json =`. If the stray line appears, delete it.

**Step 5: Commit**

```bash
git add supabase/migrations/20260312000000_intelligence_pipeline_v2.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add intelligence pipeline v2 migration

Add workspace columns for Google Places data (rating, coords, place_id).
Add intelligence_data JSONB column for pipeline results.
Add provision_onboarding_workspace RPC (early workspace creation).
Add finalize_onboarding_workspace RPC (promote onboarding → full workspace)."
```

---

## Task 2: Add the Google Places edge function

**Files:**

- Create: `supabase/functions/google-places-intelligence/index.ts`
- Modify: `supabase/functions/config.toml` (if needed for verify_jwt)

**Step 1: Review the edge function**

The function already exists in wt-3 at `supabase/functions/google-places-intelligence/index.ts`. It:

- Takes `{ companyName, city }` as input
- Calls Google Places API (New) `searchText` endpoint
- Returns structured `PlacesResult` with rating, photos, opening hours, coordinates, etc.
- Gracefully degrades if `GOOGLE_PLACES_API_KEY` is missing (returns `null`)
- Always returns 200 (never errors to caller) — places data is nice-to-have

**Step 2: Check config.toml**

This function is called service-to-service (from `gather-workspace-intelligence` with service_role bearer token), so it needs `verify_jwt = false` in `supabase/functions/config.toml`. Check if entry exists, add if missing:

```toml
[google-places-intelligence]
verify_jwt = false
```

**Step 3: Test locally**

Run: `cd ~/dev/wt-3 && npx supabase functions serve google-places-intelligence --no-verify-jwt`

In another terminal:

```bash
curl -X POST http://localhost:54321/functions/v1/google-places-intelligence \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <service_role_key>" \
  -d '{"companyName":"Burger Bar","city":"Bergen"}'
```

Expected: `{"success":true,"data":null,"reason":"no_api_key"}` (unless GOOGLE_PLACES_API_KEY is configured)

**Step 4: Commit**

```bash
git add supabase/functions/google-places-intelligence/index.ts supabase/functions/config.toml
git commit -m "feat(edge-fn): add google-places-intelligence Edge Function

Text search via Google Places API (New). Returns rating, reviews, photos,
coordinates, opening hours, price level, and Maps URL. Graceful degradation
when API key is not configured."
```

---

## Task 3: Refactor the intelligence pipeline

**Files:**

- Modify: `supabase/functions/gather-workspace-intelligence/index.ts`

**Step 1: Review the refactored pipeline**

The diff in wt-3 restructures the pipeline from sequential to parallel phases:

- **Phase A** (parallel): Scrape website + Brreg direct lookup
- **Phase B**: Provision workspace via `provision_onboarding_workspace` RPC (requires company name from Phase A)
- **Phase C** (parallel): Google Places + Web Search (both need company name + city)
- **Phase D**: Store all intelligence on workspace, return `workspaceId` to client

Key changes:

- Uses `adminClient` (service role) for the RPC call
- Requires authenticated user (401 if not)
- Returns `workspaceId` alongside `scrapedData`, `brregData`, `placesData`, `webSearchData`
- Stores everything on `workspace.intelligence_data` instead of `onboarding_session`

**Step 2: Verify the diff is correct**

Read through the full diff carefully. Ensure:

- Phase A uses `Promise.allSettled` (not `Promise.all` — we don't want one failure to kill the other)
- Phase B has proper error handling for the RPC call
- Phase C uses `Promise.allSettled` for places + web search
- The response includes `placesData` in the return payload
- The `adminClient` is created with `SUPABASE_SERVICE_ROLE_KEY`

**Step 3: Commit**

```bash
git add supabase/functions/gather-workspace-intelligence/index.ts
git commit -m "refactor(edge-fn): restructure intelligence pipeline into parallel phases

Phase A: scrape + Brreg (parallel)
Phase B: provision workspace via RPC
Phase C: Google Places + web search (parallel)
Phase D: store intelligence on workspace

Now creates workspace early so intelligence data has a permanent home.
Returns workspaceId to client for workspace-based save/resume."
```

---

## Task 4: Rewrite finalize-workspace edge function

**Files:**

- Modify: `supabase/functions/finalize-workspace/index.ts`

**Step 1: Review the rewrite**

The new version:

- Takes `{ workspaceId, workspaceData }` instead of `{ companyName, locations, departments, policies }`
- Verifies the user owns the workspace via profile lookup
- Uses `adminClient` for the `finalize_onboarding_workspace` RPC call
- Returns `{ workspaceId, slug }` for client redirect

**Step 2: Ensure \_shared/cors.ts import works**

The rewrite imports `corsHeaders` from `../_shared/cors.ts`. Verify this file exists:

Run: `ls ~/dev/wt-3/supabase/functions/_shared/cors.ts`

If missing, create it:

```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

**Step 3: Commit**

```bash
git add supabase/functions/finalize-workspace/index.ts
git commit -m "refactor(edge-fn): rewrite finalize-workspace for pipeline v2

Now finalizes an existing onboarding workspace instead of creating one from scratch.
Verifies user ownership, calls finalize_onboarding_workspace RPC to promote
workspace status, create season, departments, and teams."
```

---

## Task 5: Write tests for 3-way data merger

**Files:**

- Modify: `apps/web/src/app/onboarding/lib/data-merger.ts`
- Modify: `apps/web/src/app/onboarding/__tests__/data-merger.test.ts`

**Step 1: Review the data-merger changes**

The `mergeBusinessData` function now accepts a third argument `places?: PlacesData | null`. Priority:

- Legal fields: Brreg > Scraped > Places
- Phone: Scraped > Places
- Website: Places > (empty — Brreg website is on company, not returned here)
- Opening hours: Places > Scraped
- Rating/coords/photos: Places only

New `PlacesData` interface is exported from data-merger.

**Step 2: Write the failing tests**

Add tests to `apps/web/src/app/onboarding/__tests__/data-merger.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mergeBusinessData, type PlacesData } from "../lib/data-merger";

// ... keep existing tests ...

describe("mergeBusinessData with PlacesData", () => {
  const mockPlaces: PlacesData = {
    placeId: "ChIJ_test123",
    displayName: "Test Restaurant",
    rating: 4.5,
    userRatingCount: 230,
    openingHours: ["Mandag: 11:00–22:00", "Tirsdag: 11:00–22:00"],
    priceLevel: "PRICE_LEVEL_MODERATE",
    photos: ["https://places.googleapis.com/v1/photo1", "https://places.googleapis.com/v1/photo2"],
    websiteUri: "https://test-restaurant.no",
    phone: "+47 22 33 44 55",
    googleMapsUri: "https://maps.google.com/?cid=12345",
    location: { lat: 59.9139, lng: 10.7522 },
    primaryType: "restaurant",
  };

  it("merges Places data into empty business", () => {
    const result = mergeBusinessData(null, null, mockPlaces);
    expect(result.name).toBe("Test Restaurant");
    expect(result.googleRating).toBe(4.5);
    expect(result.googleRatingCount).toBe(230);
    expect(result.latitude).toBe(59.9139);
    expect(result.longitude).toBe(10.7522);
    expect(result.googlePlaceId).toBe("ChIJ_test123");
    expect(result.googleMapsUrl).toBe("https://maps.google.com/?cid=12345");
    expect(result.priceLevel).toBe("PRICE_LEVEL_MODERATE");
    expect(result.photos).toHaveLength(2);
    expect(result.website).toBe("https://test-restaurant.no");
    expect(result.phone).toBe("+47 22 33 44 55");
    expect(result.openingHours).toBe("Mandag: 11:00–22:00, Tirsdag: 11:00–22:00");
  });

  it("Brreg overrides Places for legal fields", () => {
    const brreg = {
      matched: true,
      legalName: "Test Restaurant AS",
      orgNumber: "123456789",
      address: { street: "Testgata 1", postalCode: "0123", city: "OSLO" },
    };
    const result = mergeBusinessData(null, brreg, mockPlaces);
    expect(result.name).toBe("Test Restaurant AS");
    expect(result.orgNumber).toBe("123456789");
    expect(result.address).toBe("Testgata 1");
    expect(result.googleRating).toBe(4.5);
  });

  it("Scraped phone overrides Places phone", () => {
    const scraped = { phone: "+47 99 88 77 66" };
    const result = mergeBusinessData(scraped, null, mockPlaces);
    expect(result.phone).toBe("+47 99 88 77 66");
  });

  it("Places opening hours override scraped", () => {
    const scraped = { openingHours: "Mon-Fri 9-5" };
    const result = mergeBusinessData(scraped, null, mockPlaces);
    expect(result.openingHours).toBe("Mandag: 11:00–22:00, Tirsdag: 11:00–22:00");
  });

  it("handles null Places gracefully", () => {
    const scraped = { companyName: "Foo Bar" };
    const result = mergeBusinessData(scraped, null, null);
    expect(result.name).toBe("Foo Bar");
    expect(result.googleRating).toBeNull();
    expect(result.photos).toEqual([]);
  });

  it("handles undefined Places (backwards compatible)", () => {
    const scraped = { companyName: "Foo Bar" };
    const result = mergeBusinessData(scraped, null);
    expect(result.name).toBe("Foo Bar");
    expect(result.googleRating).toBeNull();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd ~/dev/wt-3 && pnpm --filter web exec vitest run src/app/onboarding/__tests__/data-merger.test.ts`

Expected: Tests fail because the new PlacesData types/fields don't exist in production code yet (or are already in the uncommitted diff — in which case they may pass).

**Step 4: Commit types + data-merger + tests**

```bash
git add apps/web/src/app/onboarding/types.ts apps/web/src/app/onboarding/lib/data-merger.ts apps/web/src/app/onboarding/__tests__/data-merger.test.ts
git commit -m "feat(onboarding): add Google Places to 3-way data merger

BusinessData gains Google Places fields: rating, coordinates, photos, placeId.
mergeBusinessData now accepts PlacesData as third arg.
Priority: Brreg > Scraped > Places for legal, Places > Scraped for hours.
Tests cover all merge scenarios and backwards compatibility."
```

---

## Task 6: Update the onboarding state hook

**Files:**

- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts`

**Step 1: Review the state hook changes**

Key changes:

- New state: `onboardingWorkspaceId`
- Resume: First checks for a profile → workspace with `contract_status = 'onboarding'`, restores from `intelligence_data`. Falls back to legacy `onboarding_session`.
- Save: If `onboardingWorkspaceId` exists, saves to `workspace.intelligence_data`. Else legacy path.
- triggerScrape: Now receives `workspaceId` from edge function response, stores it.
- Reset: Deletes onboarding workspace (if still in onboarding state) before clearing local state.
- Finalize: If `onboardingWorkspaceId` exists, calls `finalize-workspace`. Else legacy `activate-workspace`.

**Step 2: Verify WizardContext doesn't need changes**

The WizardContext spreads `...state` into the context value. Since `onboardingWorkspaceId` is part of `OnboardingState`, it's automatically available. No WizardContext changes needed.

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/hooks/useOnboardingState.ts
git commit -m "feat(onboarding): workspace-based save/resume in state hook

Resume: check for onboarding workspace before legacy onboarding_session.
Save: write to workspace.intelligence_data when workspace exists.
Scrape: store workspaceId from pipeline response.
Reset: delete onboarding workspace if still in onboarding state.
Finalize: call finalize-workspace for v2, activate-workspace for legacy."
```

---

## Task 7: Update BusinessSection with Google Places card

**Files:**

- Modify: `apps/web/src/app/onboarding/sections/BusinessSection.tsx`

**Step 1: Review the changes**

A new section appears in the review state (scrapeStatus === "done") showing:

- Star rating with filled/empty stars
- Review count
- Price level
- Google Maps link

Only shown when `business.googleRating != null || business.googleMapsUrl` is truthy.

**Step 2: Commit**

```bash
git add apps/web/src/app/onboarding/sections/BusinessSection.tsx
git commit -m "feat(onboarding): show Google Places card in business review

Display star rating, review count, price level, and Google Maps link
when Places data is available. Card sits below the business review fields."
```

---

## Task 8: Update middleware for onboarding contract status

**Files:**

- Modify: `apps/web/src/middleware.ts`

**Step 1: Review the change**

One line: `status === "setup"` → `status === "setup" || status === "onboarding"`. This ensures users with a provisioned-but-not-finalized workspace get redirected back to `/onboarding` when they visit the dashboard.

**Step 2: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "fix(middleware): redirect onboarding contract status to /onboarding

Workspaces in 'onboarding' state (provisioned but not finalized) now redirect
to /onboarding alongside 'setup' status."
```

---

## Task 9: Add env documentation + config.toml

**Files:**

- Modify: `.env.example`
- Verify: `supabase/functions/config.toml`

**Step 1: Add GOOGLE_PLACES_API_KEY to .env.example**

Add to `.env.example`:

```
# Google Places API (New) — used by google-places-intelligence Edge Function
# Get from: https://console.cloud.google.com/apis/credentials
# Enable: Places API (New)
GOOGLE_PLACES_API_KEY=
```

**Step 2: Verify config.toml has the new function**

Ensure `supabase/functions/config.toml` contains:

```toml
[google-places-intelligence]
verify_jwt = false
```

**Step 3: Commit**

```bash
git add .env.example supabase/functions/config.toml
git commit -m "docs: add GOOGLE_PLACES_API_KEY to .env.example and config.toml"
```

---

## Task 10: Clean up decision + learning logs

**Files:**

- Modify: `docs/decisions/0000-decision-log.md`
- Modify: `docs/learnings/0000-learning-log.md`

**Step 1: Check the current diffs**

The wt-3 branch has diffs to both logs. Review them — they may be unrelated cleanup from a previous session. If the diffs just remove stale entries or fix formatting, include them. If they look wrong, revert.

**Step 2: Write ADR for the architecture change**

Create `docs/decisions/ADR-0046-intelligence-pipeline-v2.md`:

```markdown
---
title: "ADR-0046: Intelligence Pipeline V2 — Early Workspace Provisioning"
status: accepted
updated: 2026-03-14
created: 2026-03-14
module: onboarding
tags: [adr, onboarding, intelligence-pipeline, workspace]
---

# ADR-0046: Intelligence Pipeline V2 — Early Workspace Provisioning

## Context

The v1 intelligence pipeline stored scan results in `onboarding_session` (a temporary table) and only created the workspace at the very end via `activate-workspace`. This caused:

- Data loss if the user abandoned onboarding after scanning
- No permanent home for Google Places data, web search results
- Two different creation paths (activate vs finalize)

## Decision

Create the workspace **during** the scan (Phase B), before enrichment is complete. The workspace starts in `contract_status = 'onboarding'` and is finalized when onboarding completes. Intelligence data is stored directly on the workspace in `intelligence_data` JSONB + promoted columns.

## Consequences

- **Positive:** Intelligence data persists even if onboarding is abandoned. Resume from workspace, not legacy session table. Google Places enrichment stored permanently.
- **Negative:** Orphaned workspaces if users scan but never finish. Need cleanup job eventually.
- **Migration:** Legacy `onboarding_session` path preserved as fallback. New path checked first on resume.
```

Register in `docs/decisions/0000-decision-log.md`.

**Step 3: Commit**

```bash
git add docs/decisions/ADR-0046-intelligence-pipeline-v2.md docs/decisions/0000-decision-log.md docs/learnings/0000-learning-log.md
git commit -m "docs: add ADR-0046 intelligence pipeline v2, update logs"
```

---

## Task 11: Typecheck + final verification

**Step 1: Run typecheck**

Run: `cd ~/dev/wt-3 && pnpm turbo typecheck`
Expected: 0 errors

**Step 2: Run tests**

Run: `cd ~/dev/wt-3 && pnpm --filter web exec vitest run src/app/onboarding/__tests__/`
Expected: All tests pass (data-merger, industry-defaults, season-suggestions)

**Step 3: Run lint**

Run: `cd ~/dev/wt-3 && pnpm lint`
Expected: No new errors

**Step 4: Verify git log**

Run: `cd ~/dev/wt-3 && git log --oneline development..HEAD`
Expected: ~9 commits, all with conventional commit format

---

## Summary

| Task | What                        | Commit message prefix |
| ---- | --------------------------- | --------------------- |
| 1    | DB migration + types        | `feat(db):`           |
| 2    | Google Places edge function | `feat(edge-fn):`      |
| 3    | Pipeline refactor           | `refactor(edge-fn):`  |
| 4    | Finalize-workspace rewrite  | `refactor(edge-fn):`  |
| 5    | Data merger + tests         | `feat(onboarding):`   |
| 6    | State hook (save/resume)    | `feat(onboarding):`   |
| 7    | BusinessSection Places card | `feat(onboarding):`   |
| 8    | Middleware redirect         | `fix(middleware):`    |
| 9    | Env docs + config           | `docs:`               |
| 10   | ADR + logs                  | `docs:`               |
| 11   | Typecheck + verify          | (no commit)           |
