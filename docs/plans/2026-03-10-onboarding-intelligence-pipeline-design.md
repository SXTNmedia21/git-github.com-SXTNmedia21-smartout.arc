---
title: "Onboarding Intelligence Pipeline — Design"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: onboarding
tags: [design, onboarding, scrapling, brreg, intelligence, web-search]
---

# Onboarding Intelligence Pipeline

## Problem

Today the onboarding flow asks the user to do too much manually. They enter a URL, we scrape it, then later ask them to type in their org number, verify their company, and fill in details. The scraping and Brreg lookup happen in separate steps with no connection between them. Web search intelligence is mock data.

The user should enter **one URL** and we figure out everything else.

## Design

### User Experience

1. User enters a URL (e.g. `https://restaurant-x.no`)
2. Hits "Scan"
3. Sees a loading state (~8-10 seconds)
4. Gets back a pre-filled form with: company name, org number, industry, address, description, CEO name, images, and local context

### Sequential Pipeline

One enhanced `gather-workspace-intelligence` Edge Function runs the full pipeline:

```
INPUT: { url: "https://restaurant-x.no" }

Step 1: SCRAPE
  → Call scrapling:8000/extract
  → Get: companyName, email, phone, images, menus, locations,
         departments, socialLinks, reservationUrl, summary

Step 2: BRREG SEARCH (by name)
  → GET data.brreg.no/enhetsregisteret/api/enheter?navn={companyName}
  → Returns list of matches with org numbers
  → Pick best match using: fuzzy name match + city from scraped address
  → If no match found, skip Brreg enrichment (user enters org number later)

Step 3: BRREG DETAILS (by org number)
  → GET data.brreg.no/enhetsregisteret/api/enheter/{orgNumber}
  → Get: legal name, NACE code, industry description, address,
         employee count, company type, registration date
  → GET data.brreg.no/enhetsregisteret/api/enheter/{orgNumber}/roller
  → Get: daglig leder (CEO) name

Step 4: WEB SEARCH
  → Call Serper.dev API: "{companyName} {city}"
  → Call Serper.dev News: "{companyName} {city}"
  → Extract: news articles, review snippets, seasonal mentions,
             job listings, rating if found

Step 5: STORE + RETURN
  → Create onboarding_session with all data
  → Return combined response to browser
```

### Brreg Name Search — Matching Strategy

The Brreg API returns paginated results for name searches. We need to pick the best match:

1. Normalize both names (lowercase, strip AS/ANS/DA suffixes, remove punctuation)
2. Score each result:
   - **Exact name match** → 100 points
   - **Name contains scraped name** → 50 points
   - **Same city as scraped address** → 30 points
   - **Same postal code** → 20 points
   - **Has employees (antallAnsatte > 0)** → 10 points
   - **Not under liquidation (underAvvikling = false)** → 10 points
3. Pick highest score. If score < 50, return null (no confident match).

### Web Search — Serper.dev

Serper.dev provides Google search results via API. Free tier: 2,500 queries/month.

**Search queries:**

1. `"{companyName}" {city} restaurant` → general results
2. `"{companyName}" {city} nyheter` → Norwegian news

**Extract from results:**

- `knowledgeGraph.rating` → Google rating
- `knowledgeGraph.reviewCount` → review count
- `organic[].title` + `organic[].snippet` → mentions, context
- `news[].title` + `news[].link` → local news articles
- Look for seasonal keywords: sommermeny, julebord, påske, vinter, terrasse, uteservering

**Environment variable:** `SERPER_API_KEY`

### Response Shape

```typescript
interface IntelligenceResponse {
  sessionId: string;
  scraped: {
    companyName: string;
    email: string | null;
    phone: string | null;
    summary: string | null;
    images: { src: string; alt: string }[];
    menus: { href: string; text: string }[];
    socialLinks: Record<string, string>;
    reservationUrl: string | null;
    locations: { id: string; name: string; type: string }[];
    departments: { id: string; name: string; roles: string[] }[];
  };
  brreg: {
    matched: boolean;
    orgNumber: string | null;
    legalName: string | null;
    naceCode: string | null;
    naceDescription: string | null;
    address: {
      street: string;
      postalCode: string;
      city: string;
    } | null;
    dagligLeder: string | null;
    employeeCount: number | null;
    companyType: string | null;
    registrationDate: string | null;
  };
  webSearch: {
    rating: number | null;
    reviewCount: number | null;
    newsArticles: { title: string; url: string; snippet: string }[];
    seasonalPatterns: string[];
    mentions: string[];
    jobListings: string[];
  };
}
```

### Files Changed

| File                                                        | Change                                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `supabase/functions/gather-workspace-intelligence/index.ts` | Rewrite: add Brreg name search, Brreg details fetch, web search call |
| `supabase/functions/web-search-intelligence/index.ts`       | Replace mock data with real Serper.dev API call                      |
| `apps/web/src/env.ts`                                       | Add `SERPER_API_KEY` server-side env var                             |

### Files NOT Changed

- `services/scrapling/main.py` — no changes needed
- `onboarding_session` table — already has `scraped_data`, `brreg_data`, `web_search_data` JSONB columns
- `activate-workspace` Edge Function — unchanged

### Error Handling

Each source is independent. If one fails, we still return what we have:

| Source        | On failure                                                      |
| ------------- | --------------------------------------------------------------- |
| Scrapling     | Throw — this is required, without scrape data we have nothing   |
| Brreg search  | Return `brreg.matched: false` — user enters org number manually |
| Brreg details | Return `brreg.matched: false` — same fallback                   |
| Web search    | Return empty webSearch object — nice-to-have, not critical      |

### Security

- Scrapling: internal Docker network, no secrets needed
- Brreg: public API, no auth needed
- Serper.dev: API key in `SERPER_API_KEY` env var, server-side only (Edge Function)
- No user data sent to search APIs — only company name + city (public info)

### Performance Budget

| Step                  | Expected time                                |
| --------------------- | -------------------------------------------- |
| Scrapling extract     | 3-5s (includes page load + about page crawl) |
| Brreg name search     | 0.5-1s                                       |
| Brreg details + roles | 0.5-1s (parallel)                            |
| Serper.dev search     | 1-2s                                         |
| **Total**             | **5-9s**                                     |

Steps 2+3 are sequential (need scraped name first, then org number). Step 4 can run in parallel with step 3 (both only need company name + city).

```
Timeline:
  [1. Scrape ~~~~~~~~]
                      [2. Brreg search ~~]
                                          [3. Brreg details ~] ← parallel
                      [4. Web search ~~~~~]                    ← parallel with 2+3
```

Optimized total: ~6-7s.
