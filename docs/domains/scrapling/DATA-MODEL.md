---
title: "Scrapling Domain — Data Model"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: scrapling
tags: [scrapling, data-model, database, telemetry, company, brreg]
mirror: verified
last_verified: 2026-05-23
---

# Data Model — Scrapling

## DB Tables (scrapling-owned or scrapling-written)

### `public.company` — `raw_scraped_data` + `onboarding_status`

**Migration:** `supabase/migrations/00008_company_scraped_data.sql`

```sql
ALTER TABLE public.company
  ADD COLUMN raw_scraped_data JSONB,
  ADD COLUMN onboarding_status TEXT DEFAULT 'pending';
```

These columns are scrapling's only DB footprint. They live on the `company` table (owned by core-structure domain). Scrapling enriches `raw_scraped_data` via the `create_workspace_transaction` RPC, which accepts `p_raw_scraped_data JSONB DEFAULT NULL` (migration :12).

**Scrapling's write path:** `create_workspace_transaction` RPC (:30 in migration) → `INSERT INTO public.company ... raw_scraped_data` on workspace creation. No capability tool ever writes to this column directly — it is populated from the finalize-workspace Edge Function.

**company table ownership:** core-structure domain (owns the table structure). Scrapling domain owns the two added columns.

**Overlap edge:** See GAPS-AND-DEBT.md §Overlap.

---

## In-Memory Data Model (Python)

### `WorkspaceIntelligence` (`intelligence.py:38`)

The central enrichment object. All fields nullable. Assembled by `merge_partial()` across enrichment phases. Never persisted to DB from capability tools.

```
Identity (BRREG + user input):
  company_name, org_number, founding_date, years_in_business, industry, city, address

Web presence (scrape):
  website_url, website_description, website_about_text, email, phone, logo_url,
  social_links, menus, reservation_url

Web intelligence (Serper / Google):
  google_rating, google_review_count, google_description, google_category,
  external_ratings, news_articles, web_mentions, seasonal_patterns

Derived:
  cuisine_types, price_range, concept_clues

Source tracking:
  sources: dict  (keys: "brreg", "scrape", "web_search", "places")
```

### `ExtractResponse` (`main.py:174`)

Output of `POST /extract`. Structured company data from a single website scrape.

```
companyName, locations[], departments[], email, phone, summary, description,
logoUrl, pageDictionary, images[], menus[], socialLinks{}, reservationUrl
```

### `BrregSearchResponse` (`main.py:708`)

Output of `POST /brreg-search`.

```
candidates[]: [{orgNumber, name, street, postalCode, city, foundingDate, industry, score}]
needOrgNumber: bool  (True = no confident candidate found; prompt user for manual entry)
placesMatch: PlacesMatch | None  (Google Maps confirmation when BRREG empty)
```

### `HospitalitySearchResponse` (`main.py:619`)

Output of `POST /hospitality-search`.

```
city: str
results[]: [{name, address, phone, email, website, primary_type, price_level, rating, reviews}]
total: int
estimated_cost_usd: float
```

---

## BRREG Scoring Model (`intelligence.py:403`)

Anchor: `def score_brreg_candidate`. Scoring components:

| Component | Points |
|---|---|
| Name similarity (Jaro-Winkler, after legal-form strip) | 0–50 |
| City match (forretningsadresse or postadresse) | +30 |
| Industry NACE prefix match | +15 |
| Non-commercial org-form penalty (FLI/KIRK/etc.) | -30 |
| Konkurs/underAvvikling penalty | -100 |

Threshold: 35.0 to appear in results (`:479`).

INDUSTRY_NACE_MAP (`:306`): maps wizard industry keys (restaurant, cafe, bar, hotel, catering, fast_food, retail) to BRREG næringskode prefixes.

---

## Google Places Mappings (`intelligence.py`)

### `GOOGLE_PRICE_LEVEL_MAP` (`:240`)

| Google enum | Smartout bucket |
|---|---|
| PRICE_LEVEL_FREE | budget |
| PRICE_LEVEL_INEXPENSIVE | budget |
| PRICE_LEVEL_MODERATE | moderate |
| PRICE_LEVEL_EXPENSIVE | premium |
| PRICE_LEVEL_VERY_EXPENSIVE | fine_dining |

### `GOOGLE_TYPE_CUISINE_MAP` (`:250`)

25+ Google `types[]` keywords mapped to cuisine labels (Italiensk, Japansk, Asiatisk, Indisk, Meksikansk, Spansk, Fransk, Amerikansk, Middelhav, Gresk, Tyrkisk, Libanesisk, Sjømat, Steak, Burger, Hurtigmat, Vegetar, Vegansk, BBQ, Buffet, and more).

### `GOOGLE_TYPE_CONCEPT_MAP` (`:279`)

Maps Google types to concept clues (restaurant, fine dining, fast food, bar, vinbar, cocktailbar, kafé, bakeri, iskrem, brunch, frokost).

---

## Telemetry Events (verified vs `packages/telemetry/src/registry.ts`)

12 events registered at :9889. Comment: `// 6 called-events + 6 cost-events for the godmode-only scrapling toolkit.`

| Event | Registry line | Routing |
|---|---|---|
| `business_intelligence.find_hospitality_businesses.called` | :9894 | posthog + logger + activity_trail |
| `business_intelligence.find_hospitality_businesses.cost` | :9899 | posthog + logger + engine_event |
| `business_intelligence.enrich_company_intelligence.called` | :9904 | posthog + logger + activity_trail |
| `business_intelligence.enrich_company_intelligence.cost` | :9909 | posthog + logger + engine_event |
| `business_intelligence.generate_company_copy.called` | :9914 | posthog + logger + activity_trail |
| `business_intelligence.generate_company_copy.cost` | :9919 | posthog + logger + engine_event |
| `business_intelligence.search_brreg.called` | :9924 | posthog + logger + activity_trail |
| `business_intelligence.search_brreg.cost` | :9929 | posthog + logger + engine_event |
| `business_intelligence.lookup_brreg.called` | :9934 | posthog + logger + activity_trail |
| `business_intelligence.lookup_brreg.cost` | :9939 | posthog + logger + engine_event |
| `business_intelligence.scrape_website.called` | :9944 | posthog + logger + activity_trail |
| `business_intelligence.scrape_website.cost` | :9949 | posthog + logger + engine_event |

Routing config at :14444–14488 (key–destination mapping in registry).

**Additional onboarding event:** `onboarding.scrape_completed` (:9981 area) — routed posthog + logger (not activity_trail). Emitted by `scrape_website` tool in `onboarding/tools.ts:602,619`.

---

## External APIs (not Smartout-owned)

| API | Auth | Cost | Used in |
|---|---|---|---|
| BRREG (data.brreg.no) | None | Free | `enrich_from_brreg`, `smart_brreg_search`, `lookup_brreg_by_org` |
| Google Places v1 (places.googleapis.com) | `GOOGLE_PLACES_API_KEY` | $0.005/search + $0.017/detail | `_google_places_enrich`, `search_hospitality_businesses` |
| Serper (google.serper.dev) | `SERPER_API_KEY` | Per credit (see Serper dashboard) | `enrich_from_web_search`, `_places_lookup` |
| OpenRouter (openrouter.ai) | `OPENROUTER_API_KEY` | Per token | `handle_generate` |
