---
title: Workspace Intelligence — Enrich + Generate Pipeline for Join Wizard Step 3
status: draft
created: 2026-03-19
updated: 2026-03-19
module: join-wizard
tags: [workspace-intelligence, scraping, ai-content, brreg, serper, enrich, generate]
---

# Workspace Intelligence — Enrich + Generate Pipeline

## Problem

Step 3 of the join wizard ("Fortell om bedriften") generates about_us, our_history, and our_concept texts using AI. The current implementation is shallow:

- Dumps raw scraped JSON into a generic prompt
- Doesn't use BRREG founding date (`stiftelsesdato`)
- Doesn't search the web for articles, reviews, or mentions
- Produces generic filler text that provides no real value

The texts should be short, authentic, and immediately usable on Google Business, Facebook, or Instagram. To write good copy, the system needs rich structured data — not a raw JSON dump.

## Solution

Two new Scrapling endpoints + one Next.js orchestrator:

1. **`POST /enrich`** — Fetches data from three sources (BRREG, website scrape, web search), tracks what's been fetched, and fills gaps on each call
2. **`POST /generate`** — Takes the enriched intelligence JSON and writes three texts using a targeted LLM prompt
3. **`POST /api/workspace-intelligence`** — Next.js orchestrator that proxies to Scrapling

A "Skriv pa nytt" button on Step 3 lets the user re-enrich (new search queries) + regenerate as many times as they want.

## Architecture

```
Frontend (Step 3)
  |
  POST /api/workspace-intelligence { action: "enrich_and_generate" }
  |
  Next.js orchestrator
  |--- POST Scrapling /enrich  (BRREG + scrape parallel, then web search)
  |--- POST Scrapling /generate (intelligence JSON -> LLM -> 3 texts)
  |
  Response: { intelligence, content, sources_added, gaps_remaining }
```

## Infrastructure Requirements

**SERPER_API_KEY must be added to Scrapling's Docker environment.**

Currently only available in Supabase Edge Functions (`supabase/config.toml`). Changes needed:

1. `infra/docker-compose.yml` — add `SERPER_API_KEY` to scrapling service environment
2. `.env.template` — already has `SERPER_API_KEY` for Supabase, same value is reused for Scrapling

Without this, Phase 3 (web search) will silently return empty results.

## Workspace Intelligence JSON Schema

Core data structure. Every field nullable. `sources` tracks what has been fetched and prevents re-fetching.

```python
class WorkspaceIntelligence(BaseModel):
    # Identity (BRREG + user input)
    company_name: str | None = None
    org_number: str | None = None
    founding_date: str | None = None          # "2004-06-15" from BRREG stiftelsesdato
    years_in_business: int | None = None      # computed from founding_date
    industry: str | None = None               # NACE beskrivelse from BRREG
    city: str | None = None
    address: str | None = None

    # Web presence (scrape)
    website_url: str | None = None
    website_description: str | None = None    # meta description
    website_about_text: str | None = None     # scraped from /om-oss or /about page
    email: str | None = None
    phone: str | None = None
    logo_url: str | None = None
    social_links: dict[str, str] = {}         # {instagram: "...", facebook: "..."}
    menus: list[dict] = []                    # [{text: "Meny", href: "..."}]
    reservation_url: str | None = None

    # Web intelligence (Serper)
    google_rating: float | None = None
    google_review_count: int | None = None
    external_ratings: list[dict] = []         # [{source, rating, review_count, price_range, url}]
    news_articles: list[dict] = []            # [{title, url, snippet}]
    web_mentions: list[str] = []              # top Google snippets about the company
    seasonal_patterns: list[str] = []         # ["uteservering", "julebord"]

    # Derived intelligence
    cuisine_types: list[str] = []             # ["sjomat", "nordisk"]
    price_range: str | None = None            # from Google knowledge graph
    concept_clues: list[str] = []             # ["fine dining", "lokale ravarer", "uteservering"]

    # Source tracking
    sources: dict = {}
    # Structure:
    # {
    #   "scrape": {
    #     "fetched_at": "2026-03-19T14:30:00Z",
    #     "urls_scraped": ["https://solsiden.no", "https://solsiden.no/om-oss"]
    #   },
    #   "brreg": {
    #     "fetched_at": "2026-03-19T14:30:05Z"
    #   },
    #   "web_search": {
    #     "fetched_at": "2026-03-19T14:31:00Z",
    #     "urls_scraped": ["https://tripadvisor.com/solsiden"],
    #     "queries_used": ["Solsiden Restaurant Trondheim"]
    #   }
    # }
```

**Field semantics:**

- `None` = not yet fetched or not available from any source
- Empty list `[]` = fetched but nothing found
- Source key missing from `sources` = that source hasn't been called yet

## Enrich Function — `POST /enrich`

### Request / Response

```python
class EnrichRequest(BaseModel):
    intelligence: WorkspaceIntelligence | None = None  # None on first call
    company_name: str                                   # required
    city: str | None = None
    website_url: str | None = None
    org_number: str | None = None

class EnrichResponse(BaseModel):
    intelligence: WorkspaceIntelligence
    sources_added: list[str]          # ["scrape", "brreg"]
    gaps_remaining: list[str]         # ["web_search", "no_founding_date"]
```

### Enrich Logic

Three phases. Phase 1 + 2 run in parallel on first call. Phase 3 runs on second call (or sequentially after 1+2 if action is "enrich_and_generate").

```
Phase 1: BRREG (if "brreg" not in sources)
  - Call BRREG API: https://data.brreg.no/enhetsregisteret/api/enheter/{org_number}
    OR search by name + city if no org_number
  - Extract: stiftelsesdato -> founding_date, address, NACE industry
  - Compute: years_in_business = current_year - founding_year
  - Mark sources.brreg.fetched_at

Phase 2: Website scrape (if "scrape" not in sources)
  - Scrape website_url main page (reuse existing Scrapling /extract logic)
  - Find and scrape /om-oss or /about subpage
  - Extract: description, about_text, email, phone, social_links, menus, logo, reservation_url
  - Derive: cuisine_types from menu text and page keywords
  - Derive: concept_clues from about text, description, and page keywords
  - Mark sources.scrape with fetched_at + urls_scraped

Phase 3: Web search (if "web_search" not in sources, OR re-enrich with new queries)
  - Build queries excluding sources.web_search.queries_used:
    Default queries:
      1. "{company_name} {city}"
      2. "{company_name} anmeldelse"
    Re-enrich queries (when default already used):
      3. "{company_name} historie apnet"
      4. "{company_name} konsept mat"
      5. "{company_name} {city} restaurant"
  - Call Serper API directly (organic search + news)
  - Extract: google_rating, review_count, external_ratings, news_articles,
    web_mentions, seasonal_patterns, price_range
  - Enrich: concept_clues from web mentions (merge, don't overwrite)
  - Mark sources.web_search with fetched_at + queries_used + urls_scraped
```

### Parallel Execution — Safe Merge Pattern

Each enrichment function returns a **partial dict** of fields to merge — they never mutate
the shared `intel` object directly. This avoids race conditions from concurrent writes.

```python
async def enrich(req: EnrichRequest) -> EnrichResponse:
    intel = req.intelligence or WorkspaceIntelligence()
    sources_added = []

    # Phase 1 + 2: parallel — each returns a partial dict, NOT a mutated intel
    tasks = []
    if "brreg" not in intel.sources:
        tasks.append(("brreg", enrich_from_brreg(req)))
    if "scrape" not in intel.sources and req.website_url:
        tasks.append(("scrape", enrich_from_scrape(req)))

    results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
    for (name, _), result in zip(tasks, results):
        if not isinstance(result, Exception):
            intel = merge_partial(intel, result)  # sequential merge after gather
            sources_added.append(name)

    # Phase 3: web search — always runs if new queries are available
    has_new_queries = _has_unused_queries(intel, req)
    if "web_search" not in intel.sources or has_new_queries:
        try:
            partial = await enrich_from_web_search(req, intel)
            intel = merge_partial(intel, partial)
            sources_added.append("web_search")
        except Exception:
            pass  # web search is best-effort

    gaps = compute_gaps(intel)
    return EnrichResponse(intelligence=intel, sources_added=sources_added, gaps_remaining=gaps)


def merge_partial(intel: WorkspaceIntelligence, partial: dict) -> WorkspaceIntelligence:
    """Merge a partial enrichment result into the intelligence model.
    List fields (concept_clues, cuisine_types, etc.) are merged, not overwritten.
    Scalar fields are set only if currently None."""
    update = {}
    for key, value in partial.items():
        current = getattr(intel, key, None)
        if isinstance(current, list) and isinstance(value, list):
            # Merge lists, deduplicate
            merged = list(dict.fromkeys(current + value))
            update[key] = merged
        elif isinstance(current, dict) and isinstance(value, dict):
            # Deep merge dicts (for sources)
            update[key] = {**current, **value}
        elif current is None and value is not None:
            update[key] = value
        # If current already has a value, don't overwrite with partial
    return intel.model_copy(update=update)


def _has_unused_queries(intel: WorkspaceIntelligence, req: EnrichRequest) -> bool:
    """Check if there are search queries we haven't tried yet."""
    ws = intel.sources.get("web_search", {})
    used = set(ws.get("queries_used", []))
    candidates = _build_query_candidates(req.company_name, req.city)
    return any(q not in used for q in candidates)


def _build_query_candidates(company_name: str, city: str | None) -> list[str]:
    """All possible search queries, ordered by priority."""
    queries = [
        f"{company_name} {city or ''}".strip(),
        f"{company_name} anmeldelse",
        f"{company_name} historie apnet",
        f"{company_name} konsept mat",
    ]
    if city:
        queries.append(f"{company_name} {city} restaurant")
    return queries
```

**Key design decisions:**

- `enrich_from_brreg()` and `enrich_from_scrape()` return `dict` partials, not mutated models
- `merge_partial()` handles list dedup (concept_clues, cuisine_types) and dict deep merge (sources)
- Scalar fields only set if currently `None` — first source wins, no overwrites
- Web search always runs if there are unused query candidates — enables "Skriv pa nytt" re-enrichment

### Gap Detection

```python
def compute_gaps(intel: WorkspaceIntelligence) -> list[str]:
    gaps = []
    if "web_search" not in intel.sources:
        gaps.append("web_search")
    if intel.founding_date is None:
        gaps.append("no_founding_date")
    if not intel.concept_clues:
        gaps.append("no_concept_clues")
    if not intel.cuisine_types:
        gaps.append("no_cuisine_types")
    if intel.google_rating is None:
        gaps.append("no_google_rating")
    return gaps
```

## Generate Function — `POST /generate`

### Request / Response

```python
class GenerateRequest(BaseModel):
    intelligence: WorkspaceIntelligence

class GenerateResponse(BaseModel):
    about_us: str
    our_history: str
    our_concept: str
```

### Prompt Strategy

One LLM call producing three texts. The model sees the full intelligence so the texts don't repeat each other.

**Model:** Claude 3.5 Sonnet via OpenRouter. Temperature 0.4.

**Prompt template:**

```
Du skal skrive tre korte tekster for bedriften "{company_name}".
Disse tekstene skal kunne brukes direkte pa Google Business, Facebook og Instagram.

FAKTA OM BEDRIFTEN:
{structured_context}

REGLER:
- Hver tekst: maks 300 tegn. 2-3 setninger.
- Skriv som eieren ville sagt det til naboen. Jordnaert, ekte, rett pa sak.
- ALDRI finn opp fakta som ikke star i konteksten over.
- Ingen superlativ: ikke "unike", "enestaaende", "lidenskapelige", "fantastiske".
- Hvis stiftelsesar finnes, bruk det naturlig ("Siden 2004...").
- Hvis du ikke har nok data for en seksjon, skriv det du kan og hold det kort.
- De tre tekstene skal ikke gjenta hverandre — hver tekst har sitt eget fokus.

TEKSTENE:
1. "Om oss" — Hvem er dere? Hva gjor dere? Hvor holder dere til?
2. "Var historie" — Nar startet dere? Hva har skjedd siden? Eventuelle milaepaeler.
3. "Vart konsept" — Hva gjor dere spesielt? Matfilosofi, stemning, malgruppe.

Returner KUN et JSON-objekt:
{"about_us": "...", "our_history": "...", "our_concept": "..."}
```

**`structured_context` builder:**

Not a raw JSON dump. A curated text block built from the intelligence JSON:

```python
def build_context(intel: WorkspaceIntelligence) -> str:
    lines = []
    if intel.company_name:
        lines.append(f"Navn: {intel.company_name}")
    if intel.city:
        lines.append(f"By: {intel.city}")
    if intel.founding_date:
        lines.append(f"Stiftet: {intel.founding_date} ({intel.years_in_business} ar)")
    if intel.industry:
        lines.append(f"Bransje: {intel.industry}")
    if intel.cuisine_types:
        lines.append(f"Kjokken: {', '.join(intel.cuisine_types)}")
    if intel.price_range:
        lines.append(f"Priskategori: {intel.price_range}")
    if intel.concept_clues:
        lines.append(f"Konseptord: {', '.join(intel.concept_clues)}")
    if intel.website_description:
        lines.append(f"Nettside-beskrivelse: {intel.website_description}")
    if intel.website_about_text:
        # Truncate to 500 chars to keep prompt focused
        about = intel.website_about_text[:500]
        lines.append(f"Fra 'Om oss'-siden: {about}")
    if intel.google_rating:
        rating_str = f"Google: {intel.google_rating}/5"
        if intel.google_review_count:
            rating_str += f" ({intel.google_review_count} anmeldelser)"
        lines.append(rating_str)
    if intel.external_ratings:
        for r in intel.external_ratings[:3]:
            lines.append(f"{r['source']}: {r['rating']}/5")
    if intel.news_articles:
        lines.append("Nevnt i media:")
        for a in intel.news_articles[:3]:
            lines.append(f"  - {a['title']}: {a['snippet'][:100]}")
    if intel.web_mentions:
        lines.append("Fra Google-resultater:")
        for m in intel.web_mentions[:3]:
            lines.append(f"  - {m[:150]}")
    if intel.seasonal_patterns:
        lines.append(f"Sesongaktiviteter: {', '.join(intel.seasonal_patterns)}")
    return "\n".join(lines)
```

## Next.js Orchestrator — `POST /api/workspace-intelligence`

### Request / Response

```typescript
// Request
interface WorkspaceIntelligenceRequest {
  action: "enrich" | "generate" | "enrich_and_generate";
  intelligence: WorkspaceIntelligence | null;
  company_name?: string;
  city?: string;
  website_url?: string;
  org_number?: string;
}

// Response
interface WorkspaceIntelligenceResponse {
  intelligence: WorkspaceIntelligence;
  content?: {
    about_us: string;
    our_history: string;
    our_concept: string;
  };
  sources_added: string[];
  gaps_remaining: string[];
}
```

### Orchestration Logic

```typescript
export async function POST(request: Request) {
  const body = RequestSchema.parse(await request.json());
  const scraplingUrl = env.SCRAPLING_SERVICE_URL;

  let intelligence = body.intelligence;
  let sourcesAdded: string[] = [];
  let gaps: string[] = [];

  // Step 1: Enrich (if action includes enrich)
  if (body.action === "enrich" || body.action === "enrich_and_generate") {
    const enrichRes = await fetch(`${scraplingUrl}/enrich`, {
      method: "POST",
      headers: scraplingHeaders(),
      body: JSON.stringify({
        intelligence,
        company_name: body.company_name,
        city: body.city,
        website_url: body.website_url,
        org_number: body.org_number,
      }),
      signal: AbortSignal.timeout(45_000), // 45s — covers parallel scrape + web search
    });

    if (!enrichRes.ok) {
      const errorText = await enrichRes.text().catch(() => "Unknown error");
      console.error("[workspace-intelligence] Enrich failed:", enrichRes.status, errorText);
      return NextResponse.json({ error: "Enrichment failed" }, { status: enrichRes.status });
    }

    const enrichData = await enrichRes.json();
    intelligence = enrichData.intelligence;
    sourcesAdded = enrichData.sources_added;
    gaps = enrichData.gaps_remaining;
  }

  // Step 2: Generate (if action includes generate)
  let content = undefined;
  if (body.action === "generate" || body.action === "enrich_and_generate") {
    const genRes = await fetch(`${scraplingUrl}/generate`, {
      method: "POST",
      headers: scraplingHeaders(),
      body: JSON.stringify({ intelligence }),
      signal: AbortSignal.timeout(35_000), // 35s — LLM call
    });

    if (!genRes.ok) {
      const errorText = await genRes.text().catch(() => "Unknown error");
      console.error("[workspace-intelligence] Generate failed:", genRes.status, errorText);
      // Return intelligence even if generate fails — data is still valuable
      return NextResponse.json(
        {
          intelligence,
          content: null,
          sources_added: sourcesAdded,
          gaps_remaining: gaps,
          error: "Content generation failed",
        },
        { status: 200 },
      );
    }

    content = await genRes.json();
  }

  return NextResponse.json({
    intelligence,
    content,
    sources_added: sourcesAdded,
    gaps_remaining: gaps,
  });
}
```

**Timeout budget:**

- Enrich: 45s total (BRREG 10s + scrape 15s parallel, then web search 10s sequential, plus overhead)
- Generate: 35s (LLM call via OpenRouter)
- Per-source timeouts inside Scrapling: BRREG 10s, scrape 15s, Serper 10s per call

**Error strategy:** If enrich fails, return error. If generate fails, still return the enriched intelligence — the data is valuable even without generated copy. Frontend can retry generate separately.

## Frontend Integration

### New Hook: `useWorkspaceIntelligence`

```typescript
type IntelligenceStatus = "idle" | "enriching" | "generating" | "done" | "failed";

interface UseWorkspaceIntelligence {
  intelligence: WorkspaceIntelligence | null;
  content: { about_us: string; our_history: string; our_concept: string } | null;
  status: IntelligenceStatus;
  gapsRemaining: string[];
  enrichAndGenerate: (params: {
    companyName: string;
    city?: string;
    websiteUrl?: string;
    orgNumber?: string;
  }) => Promise<void>;
  rewrite: () => Promise<void>; // "Skriv pa nytt" — enrich with new queries + regenerate
}
```

### Step 3 Changes

- Replace `useAiContent` with `useWorkspaceIntelligence`
- Replace `aiContent` / `aiStatus` references with `content` / `status`
- Add "Skriv pa nytt" button — always visible, calls `rewrite()`
- Typewriter animation stays — `useTypewriter` still works with the new content

### "Skriv pa nytt" Behavior

Each press:

1. Calls `/api/workspace-intelligence` with action `"enrich_and_generate"`
2. Enrich function sees existing `sources.web_search.queries_used` -> builds new queries
3. New web data enriches intelligence JSON
4. Generate function produces fresh copy from richer data
5. Typewriter animates the new text

Even if no gaps remain, new search queries can surface new angles.

### WizardProvider Changes

- Add `intelligence: WorkspaceIntelligence | null` to WizardState
- Persist intelligence JSON to localStorage (same debounced pattern)
- Remove `aiContent`, `aiStatus`, `generateContent` from context — replaced by the new hook
- Keep `scrapedData`, `scrapeStatus`, `triggerScrape` — Step 1 still uses scrape for immediate feedback

### Avoiding Duplicate Data Fetches

The existing flow already calls BRREG (via `/api/scrape/brreg`) and scrapes the website (via `/api/scrape/public`) in Steps 1-2. To avoid duplicate calls in the enrich pipeline:

**When building the initial intelligence JSON (Step 2 → 3 transition):**

```typescript
// In useWorkspaceIntelligence.enrichAndGenerate():
const initialIntelligence: Partial<WorkspaceIntelligence> = {
  company_name: state.step1.companyName,
  city: state.step1.city,
  website_url: state.step1.websiteUrl,
  org_number: state.step2.orgNumber,
  // Seed from existing BRREG data (already fetched in Step 1→2)
  ...(brregData && {
    founding_date: brregData.foundingDate ?? null,
    address: brregData.street,
    industry: brregData.industry ?? null,
    sources: {
      brreg: { fetched_at: new Date().toISOString() },
    },
  }),
  // Seed from existing scrape data (already fetched in Step 1)
  ...(scrapedData && {
    website_description: scrapedData.description ?? null,
    email: scrapedData.email ?? null,
    phone: scrapedData.phone ?? null,
    logo_url: scrapedData.logoUrl ?? null,
    social_links: scrapedData.socialLinks ?? {},
    sources: {
      ...(brregData ? { brreg: { fetched_at: new Date().toISOString() } } : {}),
      scrape: {
        fetched_at: new Date().toISOString(),
        urls_scraped: [state.step1.websiteUrl].filter(Boolean) as string[],
      },
    },
  }),
};
```

**Result:** When the enrich endpoint receives this pre-seeded intelligence, it sees `sources.brreg` and `sources.scrape` already populated and skips straight to web search. First enrich call = web search only. No duplicate API calls.

## BRREG Founding Date Extraction

### Changes to `/api/scrape/brreg` route

Add to `mapEntity()`:

```typescript
foundingDate: (e.stiftelsesdato as string) || null,
```

Add to `mapCandidate()`:

```typescript
foundingDate: (e.stiftelsesdato as string) || null,
```

### Changes to `useScrapedData.ts`

Add to `BrregData` interface:

```typescript
export interface BrregData {
  orgNumber: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  industry?: string;
  foundingDate?: string; // "2004-06-15" — from BRREG stiftelsesdato
}
```

This makes the founding date available in the frontend for seeding the initial intelligence JSON (see "Avoiding Duplicate Data Fetches" above).

### Scrapling BRREG Enrichment

Scrapling calls BRREG API directly in `enrich_from_brreg()`:

```python
async def enrich_from_brreg(intel: WorkspaceIntelligence, req: EnrichRequest):
    # Call BRREG directly
    url = f"https://data.brreg.no/enhetsregisteret/api/enheter/{req.org_number}"
    # OR search by name: /enheter?navn={company_name}&size=5
    # Extract stiftelsesdato, address, NACE
    # Compute years_in_business
```

## What Gets Removed

| Current                                     | Replacement                                            |
| ------------------------------------------- | ------------------------------------------------------ |
| `useAiContent` hook                         | `useWorkspaceIntelligence` hook                        |
| `/api/generate-content` route               | `/api/workspace-intelligence` route                    |
| `_build_content_prompt()` in Scrapling      | New `build_context()` + prompt template in `/generate` |
| `POST /generate-content` Scrapling endpoint | `POST /enrich` + `POST /generate` endpoints            |

The old `/api/generate-content` route and `useAiContent` hook can be deleted once the new pipeline is live.

## Execution Order

1. BRREG: extract `stiftelsesdato` in existing `/api/scrape/brreg` route
2. Define `WorkspaceIntelligence` Pydantic model in Scrapling
3. Build `POST /enrich` in Scrapling — parallel BRREG + scrape, then web search
4. Build `POST /generate` in Scrapling — new prompt with `build_context()`
5. Build `POST /api/workspace-intelligence` Next.js orchestrator route
6. Build `useWorkspaceIntelligence` React hook
7. Update Step3About.tsx — use new hook, add "Skriv pa nytt" button
8. Update WizardProvider — add intelligence to state, remove old AI content
9. Clean up — remove `useAiContent`, `/api/generate-content`

## Timeouts (Scrapling-side)

Each external call inside Scrapling has its own timeout:

| Call                        | Timeout | Rationale                                   |
| --------------------------- | ------- | ------------------------------------------- |
| BRREG API                   | 10s     | Simple REST lookup, usually <1s             |
| Website scrape (main page)  | 15s     | Some sites are slow, SSL fallback adds time |
| Website scrape (about page) | 10s     | Secondary page, best-effort                 |
| Serper organic search       | 10s     | API SLA is fast, but network can vary       |
| Serper news search          | 10s     | Same as organic                             |
| OpenRouter LLM call         | 30s     | Token generation takes time                 |

All external calls use `aiohttp.ClientTimeout(total=N)`. If a source times out, it's logged and skipped — the enrich pipeline continues with whatever data it has.

## Non-Goals

- TripAdvisor scraping (blocked by JS rendering, needs Apify)
- `key_people` from BRREG roller/styremedlemmer — not relevant for Step 3
- Multi-language support — Norwegian bokmal only for now
- Persisting intelligence to database — localStorage only during signup flow
