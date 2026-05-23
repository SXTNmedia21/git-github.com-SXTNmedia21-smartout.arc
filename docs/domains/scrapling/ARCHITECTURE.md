---
title: "Scrapling Domain — Architecture"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: scrapling
tags: [scrapling, architecture, python, fastapi, bff, telemetry, google-places]
mirror: verified
last_verified: 2026-05-23
---

# Architecture — Scrapling

## Layer Map

```
L1  Python Service         services/scrapling/main.py (FastAPI, port 8000)
L2  BFF Bridge             packages/ai/src/capabilities/onboarding/tools.ts (lines 58–727)
                           packages/ai/src/capabilities/business-intelligence/tools.ts (lines 1–477)
L3  Capability Layer       packages/ai/src/capabilities/onboarding/  (wizard tools)
                           packages/ai/src/capabilities/business-intelligence/  (godmode tools)
L4  Data Persistence       public.company.raw_scraped_data (migration 00008)
                           scrapling.log (rotating file, max 10MB × 5)
L5  Telemetry              packages/telemetry/src/registry.ts:9889 (12 events)
```

---

## L1 — Python Service (`services/scrapling/`)

### File inventory

| File | Purpose |
|---|---|
| `main.py` | FastAPI app + all route definitions (lines 1–914) |
| `intelligence.py` | WorkspaceIntelligence model + enrichment pipeline + BRREG + LLM generate (lines 1–1870) |
| `lead_research.py` | Google Places v1 hospitality search pipeline (lines 1–421) |
| `extractors/__init__.py` | Entry point for file extraction dispatcher |
| `extractors/pdf.py` | PDF text + image extraction |
| `extractors/docx_ext.py` | DOCX text extraction |
| `extractors/xlsx.py` | XLSX to structured text |
| `extractors/csv_ext.py` | CSV parsing |
| `extractors/image.py` | Image OCR / description |
| `extractors/text.py` | Plain text passthrough |
| `extractors/jsonld.py` | JSON-LD structured data extraction |
| `extractors/ogtags.py` | OpenGraph tag extraction |
| `extractors/validation.py` | Shared validation helpers |
| `dashboard.html` | Embedded status dashboard (served at `GET /`) |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Container build |

### Endpoint inventory (verified vs `main.py`)

| Endpoint | Method | Line | Purpose |
|---|---|---|---|
| `/` | GET | :73 | HTML dashboard (no auth) |
| `/extract` | POST | :216 | Website scrape → structured company data. Returns `ExtractResponse` (companyName, locations, departments, email, phone, logo, menus, socialLinks, etc.) |
| `/scrape-raw` | POST | :454 | Website → raw text + images + file links (`RawScrapeResponse`) |
| `/tripadvisor` | POST | :508 | Stub — returns 501 (Apify not integrated) |
| `/extract/document` | POST | :525 | Single file upload → text + images. Supports PDF/DOCX/XLSX/CSV/image/text |
| `/extract/document/batch` | POST | :560 | Batch file upload → array of extraction results |
| `/hospitality-search` | POST | :626 | Google Places v1 search for hospitality businesses in a city. Pipeline: searchText → per-place details → email-scrape |
| `/enrich` | POST | :666 | Full enrichment orchestrator. Phase 1+2: BRREG + website scrape in parallel. Phase 3: web-search + Places in parallel. Returns `EnrichResponse` (intelligence, sources_added, gaps_remaining) |
| `/generate` | POST | :670 | LLM copywriting from `WorkspaceIntelligence`. Calls OpenRouter `anthropic/claude-sonnet-4.6`. Returns 7 fields (about_us, our_history, our_concept, menu_description, restaurant_type, cuisine_types, price_category) |
| `/brreg-search` | POST | :718 | Smart BRREG search: Jaro-Winkler scoring + city + industry relax-sequence + Serper Places parallel fallback. Returns candidates + needOrgNumber + placesMatch |
| `/brreg-lookup` | POST | :737 | Direct BRREG lookup by org-number (9 digits). Returns confirmed company data |
| `/logs` | GET | :746 | Tail scrapling.log (rotating). Query: `?lines=N&level=INFO\|WARNING\|ERROR` |
| `/logs/raw` | GET | :790 | Download raw log file |
| `/places-cost` | GET | :806 | Aggregate Google Places + Serper API cost from logs. Query: `?days=N` (1-90). Returns `{google, serper, total_cost_usd, free_tier_pct, alert_active}` |
| `/health` | GET | :902 | Health check. Returns status, version, supported extractor extensions |

**10 endpoints** (excluding the 501 TripAdvisor stub).

### Authentication (`main.py:66`)

Optional Bearer token (`SCRAPLING_AUTH_TOKEN` env var). When set, all routes except `GET /` require `Authorization: Bearer <token>`. When not set, internal Docker network is the only guard. Production always sets this token.

### Enrichment Pipeline (`intelligence.py:1562`)

```
handle_enrich(req):
  Phase 1+2 (parallel):
    enrich_from_brreg(org_number, company_name, city)  → fetches BRREG, maps to partial dict
    enrich_from_scrape(website_url)                    → asyncio.to_thread(_scrape_website_sync)
                                                          extracts meta, email, phone, logo, social,
                                                          menus, about text, concept_clues, cuisine_types
  Phase 3 (parallel, after 1+2):
    enrich_from_web_search(intel, name, city)          → Serper organic + news (max 2 queries)
    enrich_from_places(name, city)                     → Google Places v1 (primary) → Serper (fallback)
  merge_partial(intel, result) for each phase
  compute_gaps(intel) → list of missing fields
```

### BRREG Smart Search (`intelligence.py:629`)

Anchor: `async def smart_brreg_search`. Relax-sequence: most-specific → least-specific (name+city+nace → name+city → name+nace → name-only). Jaro-Winkler name scoring (rapidfuzz) + city match (+30) + industry prefix (+15) + non-commercial org-form penalty (-30). Parallel Google Places lookup for corrected-name fallback. Name-gate: core_tokens() must overlap between query and candidate.

### Google Places v1 (`intelligence.py:1249`)

Anchor: `async def _google_places_enrich`. Two-step: `POST places:searchText` ($0.005) → `GET places/{id}` ($0.017). Raises `_GooglePlacesQuotaError` on 429/5xx → caller falls through to Serper. Cost logged via `_log_places_call()` structured line: `[places.api_call] provider=X endpoint=Y status=Z cost=N`.

### Lead Research Pipeline (`lead_research.py:324`)

Anchor: `async def search_hospitality_businesses`. Paginates up to 60 place IDs (3×20). Per-place details via `asyncio.Semaphore(5)`. Per-place email scrape (8s timeout, 500KB limit). Cost: `$0.005 + ($0.017 × N)`.

---

## L2 — BFF Bridge

### Onboarding bridge (`packages/ai/src/capabilities/onboarding/tools.ts`)

Anchor: `function scraplingHeaders()` at :60. `async function scraplingPost()` at :69.

| Helper / Tool | Lines | Scrapling endpoint |
|---|---|---|
| `scraplingHeaders()` | :60–67 | — auth header builder |
| `scraplingPost()` | :69–91 | — generic POST wrapper with AbortSignal timeout |
| `scrapeWebsite` tool | :579–630 | `/extract` or `/scrape-raw` (30s timeout) |
| `searchCompany` tool | :640–685 | `/brreg-search` (20s timeout) |
| `identifyCompany` tool | :694–727 | `/brreg-lookup` (15s timeout) |

**Gate posture:** All 3 tools are `read_only` — no `callGateAction` required. All emit `onboarding.scrape_completed` (called + completed pattern). `scrape_website` emits the `onboarding.scrape_completed` event (not a `business_intelligence.*` event — different namespace).

**Auth pattern:** `SCRAPLING_SERVICE_URL` (env) defaults to `https://scrape.smartout.ai`. `SCRAPLING_AUTH_TOKEN` (env) sets Bearer header when present.

### Business intelligence bridge (`packages/ai/src/capabilities/business-intelligence/tools.ts`)

Anchor: `function scraplingHeaders()` at :45. `async function scraplingPost()` at :54.

| Tool | Lines | Scrapling endpoint | Authority |
|---|---|---|---|
| `findHospitalityBusinessesTool` | :94–165 | `POST /hospitality-search` (60s) | suggestTool |
| `enrichCompanyIntelligenceTool` | :171–242 | `POST /enrich` (45s) | readOnlyTool |
| `generateCompanyCopyTool` | :248–305 | `POST /generate` (35s) | suggestTool |
| `searchBrregTool` | :311–373 | `POST /brreg-search` (20s) | readOnlyTool |
| `lookupBrregTool` | :379–426 | `POST /brreg-lookup` (15s) | readOnlyTool |
| `scrapeWebsiteTool` | :432–477 | `/extract` or `/scrape-raw` (30s) | readOnlyTool |

**Gate posture:** All are `direct_admin` (godmode-only). Voice blocked (`ctx.channel === "voice"` → reject). All emit `called` + `cost` events per ADR-0134.

---

## L3 — Capability Layer

**onboarding** (`packages/ai/src/capabilities/onboarding/`): 10 tools total. 3 are scrapling bridges (tools 7–9). The other 7 are DB writes / in-memory state / memory alias. See onboarding-wizard domain for the full picture.

**business_intelligence** (`packages/ai/src/capabilities/business-intelligence/`): 6 tools, all scrapling proxies, all godmode-only. `index.ts` — capability registration. `tools.ts` — tool definitions. `types.ts` — Zod schemas. `__tests__/tools.test.ts` — unit tests.

---

## L4 — Data Persistence

### `company.raw_scraped_data` (migration `00008_company_scraped_data.sql`)

Added via `ALTER TABLE public.company ADD COLUMN raw_scraped_data JSONB`. Written during workspace creation by `create_workspace_transaction` RPC (`:31`), accepting `p_raw_scraped_data JSONB DEFAULT NULL` parameter. This is the ONLY DB persistence path for scrapling output — capability tools never write to DB.

Also adds `onboarding_status TEXT DEFAULT 'pending'` to `company`.

### Scrapling log (`scrapling.log`)

RotatingFileHandler at `/data/scrapling.log` (or `/tmp` fallback). MaxBytes 10MB, 5 backups = ~50MB total. Format: `%(asctime)s %(levelname)s %(name)s %(message)s`. Structured cost lines: `[places.api_call] provider=X endpoint=Y status=Z cost=N place_id=P`.

---

## L5 — Telemetry (`packages/telemetry/src/registry.ts:9889`)

12 events in `business_intelligence.*` namespace:

| Event | Destinations | Line (±hint) |
|---|---|---|
| `business_intelligence.find_hospitality_businesses.called` | posthog + logger + activity_trail | :9894 |
| `business_intelligence.find_hospitality_businesses.cost` | posthog + logger + engine_event | :9899 |
| `business_intelligence.enrich_company_intelligence.called` | posthog + logger + activity_trail | :9904 |
| `business_intelligence.enrich_company_intelligence.cost` | posthog + logger + engine_event | :9909 |
| `business_intelligence.generate_company_copy.called` | posthog + logger + activity_trail | :9914 |
| `business_intelligence.generate_company_copy.cost` | posthog + logger + engine_event | :9919 |
| `business_intelligence.search_brreg.called` | posthog + logger + activity_trail | :9924 |
| `business_intelligence.search_brreg.cost` | posthog + logger + engine_event | :9929 |
| `business_intelligence.lookup_brreg.called` | posthog + logger + activity_trail | :9934 |
| `business_intelligence.lookup_brreg.cost` | posthog + logger + engine_event | :9939 |
| `business_intelligence.scrape_website.called` | posthog + logger + activity_trail | :9944 |
| `business_intelligence.scrape_website.cost` | posthog + logger + engine_event | :9949 |

Routing confirmed at registry.ts:14444–14488.

Additional event in the onboarding namespace: `onboarding.scrape_completed` (emitted by onboarding `scrape_website` tool — not in the business_intelligence namespace). Registry ref: near :9981.
