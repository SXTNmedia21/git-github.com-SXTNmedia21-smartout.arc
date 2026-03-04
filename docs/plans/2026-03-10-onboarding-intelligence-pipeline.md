---
title: "Onboarding Intelligence Pipeline — Implementation Plan"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: onboarding
tags: [plan, onboarding, scrapling, brreg, intelligence, web-search, serper]
---

# Onboarding Intelligence Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `gather-workspace-intelligence` so a single URL input triggers a full sequential pipeline: scrape website → search Brreg by name → fetch Brreg details → web search → return all data.

**Architecture:** One Edge Function (`gather-workspace-intelligence`) runs 4 data sources sequentially. Scrapling scrapes the website, then the company name feeds a Brreg name search, the best match's org number fetches full details + roles, and the company name + city feed a Serper.dev web search. All results are stored in `onboarding_session` and returned to the browser. `web-search-intelligence` becomes a reusable Serper.dev helper called inline (not background).

**Tech Stack:** Supabase Edge Functions (Deno), Brreg public API, Serper.dev API, existing Scrapling Python microservice.

**Design doc:** `docs/plans/2026-03-10-onboarding-intelligence-pipeline-design.md`

---

## Task 1: Add SERPER_API_KEY to env validation

**Files:**

- Modify: `apps/web/src/env.ts:23` (after SCRAPLING_SERVICE_URL)

**Step 1: Add the env var**

In `apps/web/src/env.ts`, add after line 23 (`SCRAPLING_SERVICE_URL`):

```typescript
SERPER_API_KEY: z.string().min(1).optional(),
```

**Step 2: Verify typecheck passes**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/env.ts
git commit -m "feat(env): add SERPER_API_KEY server-side env var"
```

---

## Task 2: Rewrite web-search-intelligence with real Serper.dev calls

**Files:**

- Rewrite: `supabase/functions/web-search-intelligence/index.ts`

**Step 1: Write the Serper.dev integration**

Replace the entire file with a function that:

1. Accepts `{ companyName, city }` in the request body
2. Calls Serper.dev search endpoint: `POST https://google.serper.dev/search`
   - Headers: `X-API-KEY: ${SERPER_API_KEY}`, `Content-Type: application/json`
   - Body: `{ "q": "\"${companyName}\" ${city}", "gl": "no", "hl": "no", "num": 10 }`
3. Calls Serper.dev news endpoint: `POST https://google.serper.dev/news`
   - Same headers
   - Body: `{ "q": "\"${companyName}\" ${city}", "gl": "no", "hl": "no", "num": 5 }`
4. Extracts and returns structured data:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperNewsResult {
  title: string;
  link: string;
  snippet: string;
  date: string;
  source: string;
}

interface SerperKnowledgeGraph {
  title?: string;
  rating?: number;
  ratingCount?: number;
  type?: string;
  description?: string;
}

interface WebSearchResult {
  rating: number | null;
  reviewCount: number | null;
  newsArticles: { title: string; url: string; snippet: string }[];
  seasonalPatterns: string[];
  mentions: string[];
  jobListings: string[];
}

const SEASONAL_KEYWORDS = [
  "sommermeny",
  "julebord",
  "påske",
  "vinter",
  "sommer",
  "terrasse",
  "uteservering",
  "sesong",
  "julebord",
  "nyttår",
  "valentines",
  "17. mai",
  "sommersesong",
  "vintersesong",
];

const JOB_KEYWORDS = [
  "stilling",
  "ledig",
  "søker",
  "ansette",
  "bartender",
  "kokk",
  "servitør",
  "chef",
  "waiter",
  "sous chef",
  "kjøkkensjef",
  "hovmester",
  "sommelier",
];

function extractSeasonalPatterns(texts: string[]): string[] {
  const found = new Set<string>();
  const joined = texts.join(" ").toLowerCase();
  for (const keyword of SEASONAL_KEYWORDS) {
    if (joined.includes(keyword.toLowerCase())) {
      found.add(keyword);
    }
  }
  return [...found];
}

function extractJobListings(results: SerperOrganicResult[]): string[] {
  const jobs: string[] = [];
  for (const r of results) {
    const text = `${r.title} ${r.snippet}`.toLowerCase();
    for (const keyword of JOB_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        jobs.push(r.title);
        break;
      }
    }
  }
  return jobs.slice(0, 5);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { companyName, city } = await req.json();

    if (!companyName) {
      return new Response(JSON.stringify({ error: "companyName is required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const apiKey = Deno.env.get("SERPER_API_KEY");
    if (!apiKey) {
      console.warn("SERPER_API_KEY not configured, returning empty results");
      const empty: WebSearchResult = {
        rating: null,
        reviewCount: null,
        newsArticles: [],
        seasonalPatterns: [],
        mentions: [],
        jobListings: [],
      };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const searchQuery = `"${companyName}" ${city || ""}`.trim();
    const headers = {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    };

    // Run search + news in parallel
    const [searchRes, newsRes] = await Promise.all([
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ q: searchQuery, gl: "no", hl: "no", num: 10 }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("https://google.serper.dev/news", {
        method: "POST",
        headers,
        body: JSON.stringify({ q: searchQuery, gl: "no", hl: "no", num: 5 }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const organic: SerperOrganicResult[] = searchRes?.organic || [];
    const kg: SerperKnowledgeGraph | null = searchRes?.knowledgeGraph || null;
    const news: SerperNewsResult[] = newsRes?.news || [];

    const allSnippets = [...organic.map((r) => r.snippet), ...news.map((r) => r.snippet)];

    const result: WebSearchResult = {
      rating: kg?.rating || null,
      reviewCount: kg?.ratingCount || null,
      newsArticles: news.map((n) => ({
        title: n.title,
        url: n.link,
        snippet: n.snippet,
      })),
      seasonalPatterns: extractSeasonalPatterns(allSnippets),
      mentions: organic.slice(0, 5).map((r) => r.snippet),
      jobListings: extractJobListings(organic),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Web search error:", error);
    // Return empty results on error — web search is nice-to-have
    return new Response(
      JSON.stringify({
        rating: null,
        reviewCount: null,
        newsArticles: [],
        seasonalPatterns: [],
        mentions: [],
        jobListings: [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});
```

**Step 2: Test locally with Supabase CLI**

Run: `npx supabase functions serve web-search-intelligence --env-file supabase/.env.local`
Test: `curl -X POST http://localhost:54321/functions/v1/web-search-intelligence -H "Content-Type: application/json" -H "Authorization: Bearer <anon-key>" -d '{"companyName":"Maaemo","city":"Oslo"}'`
Expected: JSON with rating, newsArticles, seasonalPatterns (or empty arrays if no SERPER_API_KEY)

**Step 3: Commit**

```bash
git add supabase/functions/web-search-intelligence/index.ts
git commit -m "feat(edge-fn): replace mock web-search-intelligence with real Serper.dev calls"
```

---

## Task 3: Rewrite gather-workspace-intelligence with full pipeline

**Files:**

- Rewrite: `supabase/functions/gather-workspace-intelligence/index.ts`

**Context needed:**

- Current file is 164 lines. Read it before modifying.
- The existing `fetchScraplingWithRetry` function is good — keep it.
- The Brreg search API: `GET https://data.brreg.no/enhetsregisteret/api/enheter?navn={name}` returns `{ _embedded: { enheter: [...] } }`
- The Brreg details API: `GET https://data.brreg.no/enhetsregisteret/api/enheter/{orgNumber}` returns full entity
- The Brreg roles API: `GET https://data.brreg.no/enhetsregisteret/api/enheter/{orgNumber}/roller` returns `{ rollegrupper: [{ type: { kode }, roller: [{ person: { navn: { fornavn, etternavn } } }] }] }`

**Step 1: Write the full pipeline**

Replace the entire file:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Brreg helpers ---

interface BrregEntity {
  organisasjonsnummer: string;
  navn: string;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    kommune?: string;
  };
  naeringskode1?: { kode: string; beskrivelse: string };
  antallAnsatte?: number;
  organisasjonsform?: { kode: string; beskrivelse: string };
  registreringsdatoEnhetsregisteret?: string;
  underAvvikling?: boolean;
  konkurs?: boolean;
}

interface BrregMatch {
  entity: BrregEntity;
  score: number;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(as|ans|da|asa|sa|enk)\b/gi, "")
    .replace(/[^a-zæøå0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreBrregMatch(
  entity: BrregEntity,
  scrapedName: string,
  scrapedCity: string | null,
): number {
  let score = 0;
  const normalEntity = normalizeName(entity.navn);
  const normalScraped = normalizeName(scrapedName);

  // Exact match
  if (normalEntity === normalScraped) {
    score += 100;
  } else if (normalEntity.includes(normalScraped) || normalScraped.includes(normalEntity)) {
    score += 50;
  }

  // City match
  if (
    scrapedCity &&
    entity.forretningsadresse?.poststed?.toLowerCase() === scrapedCity.toLowerCase()
  ) {
    score += 30;
  }

  // Has employees
  if (entity.antallAnsatte && entity.antallAnsatte > 0) {
    score += 10;
  }

  // Not under liquidation
  if (!entity.underAvvikling && !entity.konkurs) {
    score += 10;
  }

  return score;
}

async function searchBrregByName(
  companyName: string,
  scrapedCity: string | null,
): Promise<BrregEntity | null> {
  try {
    const encoded = encodeURIComponent(companyName);
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encoded}&size=5`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    const entities: BrregEntity[] = data?._embedded?.enheter || [];

    if (entities.length === 0) return null;

    // Score and rank
    const scored: BrregMatch[] = entities.map((entity) => ({
      entity,
      score: scoreBrregMatch(entity, companyName, scrapedCity),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Only return if confidence is high enough
    if (scored[0].score >= 50) {
      return scored[0].entity;
    }

    return null;
  } catch (e) {
    console.warn("Brreg name search failed:", e);
    return null;
  }
}

async function fetchBrregDetails(orgNumber: string): Promise<BrregEntity | null> {
  try {
    const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function fetchDagligLeder(orgNumber: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}/roller`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    const groups = data?.rollegrupper || [];

    for (const group of groups) {
      if (group.type?.kode === "DAGL") {
        const roller = group.roller || [];
        if (roller.length > 0 && roller[0].person?.navn) {
          const n = roller[0].person.navn;
          return [n.fornavn, n.mellomnavn, n.etternavn].filter(Boolean).join(" ");
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// --- Scrapling helper (kept from original) ---

async function fetchScraplingWithRetry(scraplingBase: string, url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${scraplingBase}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          config: {
            include_company_info: true,
            include_locations: true,
            include_departments: true,
          },
        }),
      });
      if (res.ok) return await res.json();
      console.warn(`Scrapling attempt ${i + 1} failed: ${res.status}`);
    } catch (e: unknown) {
      console.warn(`Scrapling attempt ${i + 1} threw:`, e instanceof Error ? e.message : String(e));
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Scrapling service unavailable after ${retries} attempts.`);
}

// --- Web search helper ---

async function fetchWebSearch(
  companyName: string,
  city: string,
): Promise<Record<string, unknown> | null> {
  try {
    const edgeFunctionUrl = Deno.env.get("SUPABASE_URL")
      ? `${Deno.env.get("SUPABASE_URL")}/functions/v1`
      : "http://host.docker.internal:54321/functions/v1";

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const res = await fetch(`${edgeFunctionUrl}/web-search-intelligence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ companyName, city }),
    });

    return res.ok ? await res.json() : null;
  } catch (e) {
    console.warn("Web search failed:", e);
    return null;
  }
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    const userId = user?.id || null;

    const { url } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`[intelligence] Starting pipeline for: ${url}`);

    // ── STEP 1: Scrape website ──
    const scraplingBase =
      Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";

    console.log("[intelligence] Step 1: Scraping...");
    const scrapedData = await fetchScraplingWithRetry(scraplingBase, url);
    const companyName = scrapedData?.companyName;
    console.log(`[intelligence] Scraped company: ${companyName || "unknown"}`);

    // ── STEP 2: Search Brreg by name ──
    let brregEntity: BrregEntity | null = null;
    let dagligLeder: string | null = null;
    let brregMatched = false;

    if (companyName) {
      // Try to extract city from scraped data (address text or similar)
      const scrapedCity: string | null = null; // Scrapling doesn't return city directly

      console.log(`[intelligence] Step 2: Searching Brreg for "${companyName}"...`);
      brregEntity = await searchBrregByName(companyName, scrapedCity);

      // ── STEP 3: Fetch full Brreg details + roles ──
      if (brregEntity) {
        brregMatched = true;
        const orgNumber = brregEntity.organisasjonsnummer;
        console.log(`[intelligence] Step 3: Brreg match found: ${orgNumber} (${brregEntity.navn})`);

        // Fetch details + roles in parallel
        const [fullDetails, leader] = await Promise.all([
          fetchBrregDetails(orgNumber),
          fetchDagligLeder(orgNumber),
        ]);

        if (fullDetails) brregEntity = fullDetails;
        dagligLeder = leader;
        console.log(`[intelligence] Daglig leder: ${dagligLeder || "not found"}`);
      } else {
        console.log("[intelligence] No confident Brreg match found");
      }
    }

    // ── STEP 4: Web search (parallel with step 3 when possible) ──
    const city = brregEntity?.forretningsadresse?.poststed || "";

    console.log(`[intelligence] Step 4: Web search for "${companyName}" in "${city}"...`);
    const webSearchData = companyName ? await fetchWebSearch(companyName, city) : null;

    // ── STEP 5: Build structured Brreg response ──
    const brregResponse = {
      matched: brregMatched,
      orgNumber: brregEntity?.organisasjonsnummer || null,
      legalName: brregEntity?.navn || null,
      naceCode: brregEntity?.naeringskode1?.kode || null,
      naceDescription: brregEntity?.naeringskode1?.beskrivelse || null,
      address: brregEntity?.forretningsadresse
        ? {
            street: brregEntity.forretningsadresse.adresse?.[0] || "",
            postalCode: brregEntity.forretningsadresse.postnummer || "",
            city: brregEntity.forretningsadresse.poststed || "",
          }
        : null,
      dagligLeder,
      employeeCount: brregEntity?.antallAnsatte || null,
      companyType: brregEntity?.organisasjonsform?.beskrivelse || null,
      registrationDate: brregEntity?.registreringsdatoEnhetsregisteret || null,
    };

    // ── STEP 6: Store in onboarding_session ──
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from("onboarding_session")
      .insert({
        user_id: userId,
        source_url: url,
        current_step: 1,
        scraped_data: scrapedData,
        brreg_data: brregResponse,
        web_search_data: webSearchData,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Failed to create onboarding session:", sessionError);
    }

    console.log(`[intelligence] Pipeline complete. Session: ${sessionData?.id || "none"}`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: sessionData?.id || null,
        scrapedData,
        brregData: brregResponse,
        webSearchData: webSearchData || {
          rating: null,
          reviewCount: null,
          newsArticles: [],
          seasonalPatterns: [],
          mentions: [],
          jobListings: [],
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error("Pipeline error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
```

**Key changes from original:**

- Removed: `orgNumber` from input — we auto-detect it now
- Added: `searchBrregByName()` with scoring algorithm
- Added: `fetchBrregDetails()` and `fetchDagligLeder()` helpers
- Added: Inline call to `web-search-intelligence` (was fire-and-forget background, now synchronous)
- Changed: Returns structured `brregData` with `matched` flag instead of raw Brreg API response
- Changed: Returns `webSearchData` inline instead of storing in background

**Step 2: Test locally**

Run: `npx supabase functions serve gather-workspace-intelligence --env-file supabase/.env.local`
Test: `curl -X POST http://localhost:54321/functions/v1/gather-workspace-intelligence -H "Content-Type: application/json" -H "Authorization: Bearer <anon-key>" -d '{"url":"https://maaemo.no"}'`
Expected: JSON with `scrapedData` (company name, images, etc.), `brregData` (orgNumber, NACE, address), `webSearchData` (news, mentions)

**Step 3: Commit**

```bash
git add supabase/functions/gather-workspace-intelligence/index.ts
git commit -m "feat(edge-fn): rewrite gather-workspace-intelligence with full sequential pipeline

Scrape → Brreg name search → Brreg details + roles → Web search.
User only provides URL, everything else is auto-detected."
```

---

## Task 4: Update InitStep to use new brregData shape

**Files:**

- Modify: `apps/web/src/app/onboarding/steps/InitStep.tsx:45-85`

**Context:** The `InitStep` currently reads `brregData` as raw Brreg API response (e.g. `brregData?.forretningsadresse?.postnummer`). The new pipeline returns a structured `brregData` with `matched`, `orgNumber`, `legalName`, `address.city`, etc. Also, `webSearchData` is now returned inline.

**Step 1: Update the data mapping**

In `InitStep.tsx`, find the response handler (around line 45) and update the data mapping:

```typescript
const { scrapedData, brregData, webSearchData, sessionId } = data;

const newData: Partial<WorkspaceData> = {
  name: brregData?.legalName || scrapedData?.companyName || "",
  website: url,
  email: scrapedData?.email || "",
  phone: scrapedData?.phone || "",
  address: brregData?.address
    ? `${brregData.address.street}, ${brregData.address.postalCode} ${brregData.address.city}`.trim()
    : "",
  ceo: brregData?.dagligLeder || "",
  employeeCount: brregData?.employeeCount ? brregData.employeeCount.toString() : "",
  industry: brregData?.naceDescription || "",
  concept: "",
  summary: scrapedData?.summary || "",
  slogan: "",
  orgNumber: brregData?.orgNumber || "",
  naceCode: brregData?.naceCode || "",
  locations: scrapedData?.locations || [],
  departments: scrapedData?.departments || [],
  multiDepartmentTeams: [],
  procedures: [],
  policies: generatedPolicies,
  pageDictionary: scrapedData?.pageDictionary || {},
  images: scrapedData?.images || [],
  menus: scrapedData?.menus || [],
  socialLinks: scrapedData?.socialLinks || {},
  reservationUrl: scrapedData?.reservationUrl || null,
};
```

**Note:** If `WorkspaceData` type doesn't have `orgNumber` or `naceCode` fields yet, add them to `apps/web/src/app/onboarding/types.ts`.

**Step 2: Check if OrgVerificationStep should pre-fill**

If `brregData.matched === true`, the org verification step should show the auto-detected org number instead of asking the user to type it. Check `OrgVerificationStep.tsx` and pre-fill from `wizard.data.orgNumber`.

**Step 3: Verify typecheck passes**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/steps/InitStep.tsx apps/web/src/app/onboarding/types.ts
git commit -m "feat(onboarding): update InitStep to use structured brregData from pipeline"
```

---

## Task 5: Update OrgVerificationStep to show auto-detected org number

**Files:**

- Modify: `apps/web/src/app/onboarding/steps/OrgVerificationStep.tsx`

**Context:** Currently this step always asks the user to type their org number. With the new pipeline, we may already have it from Brreg name search. If `wizard.data.orgNumber` is set, show it pre-filled with a "Verified" badge. If not, show the manual input form.

**Step 1: Add pre-fill logic**

At the top of the component, check if org number is already set:

```typescript
const hasAutoDetected = !!wizard.data.orgNumber;
```

If `hasAutoDetected`:

- Show the org number, company name, address, and CEO as read-only confirmed fields
- Show a "This was auto-detected — confirm or change" message
- User can override by clicking "Enter different org number"

If not:

- Show the existing manual input form (no changes)

**Step 2: Test manually**

1. Enter a URL for a known Norwegian company (e.g. `maaemo.no`)
2. After scan completes, should jump to org verification with org number pre-filled
3. User confirms or overrides

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/steps/OrgVerificationStep.tsx
git commit -m "feat(onboarding): pre-fill org number from auto-detection in OrgVerificationStep"
```

---

## Task 6: End-to-end test

**Step 1: Start local services**

```bash
# Terminal 1: Start Supabase
npx supabase start

# Terminal 2: Start Scrapling (if running locally)
cd services/scrapling && python -m uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 3: Start Next.js
pnpm --filter web dev
```

**Step 2: Test the full flow**

1. Open `http://localhost:3050/onboarding` (or 3099 if custom port)
2. Enter URL: `maaemo.no`
3. Click "Scan & Generate"
4. Verify loading state appears (~6-10 seconds)
5. Verify returned data:
   - Company name: should be from Brreg (legal name)
   - Org number: auto-detected
   - Industry/NACE: from Brreg
   - Address: from Brreg
   - CEO: from Brreg roles API
   - Images, menus, social links: from scraping
   - News articles: from web search (if SERPER_API_KEY set)
6. Verify OrgVerificationStep shows pre-filled data

**Step 3: Test fallback**

1. Enter a URL for a non-Norwegian company (e.g. `google.com`)
2. Should still scrape successfully
3. Brreg should return `matched: false`
4. OrgVerificationStep should show manual input form

**Step 4: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: All packages pass

**Step 5: Commit**

```bash
git add -A
git commit -m "test(onboarding): verify full intelligence pipeline e2e"
```
