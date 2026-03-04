---
title: Progressive Intelligence Protocol
status: done
updated: 2026-03-04
created: 2026-03-04
module: onboarding
tags: [intelligence, brreg, voice, progressive, agent-tools]
---

# Progressive Intelligence Protocol

## Overview

Replaces the monolithic `gather-workspace-intelligence` Edge Function with 3 progressive agent tools that fire during the voice interview. The agent narrates findings in real-time instead of waiting 10+ seconds in silence.

**Before:** User finishes interview → `triggerScrape` fire-and-forget → 5-10s silence → system message with all data at once.

**After:**
```
Agent hears "Sjøbris"  →  searchCompany(<1s)  →  "Fant Sjøbris AS i Trondheim, stemmer det?"
User confirms          →  identifyCompany(~2s) →  "23 ansatte, Kongens gate 5, 4.2 på Google"
Website found          →  scrapeWebsite(~3s)   →  "Fant e-post og 2 lokasjoner på nettsiden"
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Voice Agent (Ultravox)                         │
│  ┌──────────────────────────────────────────┐   │
│  │  Client Tools (useBotsson.ts)            │   │
│  │  ┌─────────────┐ ┌──────────────────┐    │   │
│  │  │searchCompany│ │identifyCompany   │    │   │
│  │  │   (async)   │ │   (async)        │    │   │
│  │  └──────┬──────┘ └────────┬─────────┘    │   │
│  │         │                 │              │   │
│  │  ┌──────┴──────┐ ┌───────┴──────────┐   │   │
│  │  │search-brreg │ │identify-company  │   │   │
│  │  │Edge Function│ │Edge Function     │   │   │
│  │  └──────┬──────┘ └───┬──────┬───────┘   │   │
│  │         │             │      │           │   │
│  │    ┌────┴────┐  ┌────┴┐  ┌──┴───────┐   │   │
│  │    │ Brreg   │  │Brreg│  │Google    │   │   │
│  │    │ API     │  │ API │  │Places EF │   │   │
│  │    └─────────┘  └─────┘  └──────────┘   │   │
│  │                                          │   │
│  │  ┌─────────────┐                        │   │
│  │  │scrapeWebsite│                        │   │
│  │  │   (async)   │                        │   │
│  │  └──────┬──────┘                        │   │
│  │         │                                │   │
│  │  ┌──────┴──────┐                        │   │
│  │  │scrape-website│                       │   │
│  │  │Edge Function │                       │   │
│  │  └──────┬───────┘                       │   │
│  │         │                                │   │
│  │  ┌──────┴──────┐                        │   │
│  │  │ Scrapling   │                        │   │
│  │  │ Service     │                        │   │
│  │  └─────────────┘                        │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Edge Function API Specs

### 1. `search-brreg`

| Field | Value |
|-------|-------|
| Auth | JWT (default `verify_jwt = true`) |
| Method | POST |
| Latency | <1s |

**Input:**
```json
{ "name": "Sjøbris", "city": "Trondheim" }
```

**Output:**
```json
{
  "candidates": [
    {
      "orgNumber": "123456789",
      "name": "Sjøbris AS",
      "city": "TRONDHEIM",
      "industry": "Drift av restauranter og kafeer",
      "industryCode": "56.101",
      "employeeCount": 23,
      "score": 130,
      "address": "Kongens gate 5",
      "highConfidence": true
    }
  ],
  "matchCount": 1
}
```

### 2. `identify-company`

| Field | Value |
|-------|-------|
| Auth | JWT (default `verify_jwt = true`) |
| Method | POST |
| Latency | 1-3s (Brreg + Places parallel) |

**Input:**
```json
{ "orgNumber": "123456789" }
```

**Output:**
```json
{
  "company": {
    "orgNumber": "123456789",
    "legalName": "Sjøbris AS",
    "website": "sjobris.no",
    "address": "Kongens gate 5",
    "postalCode": "7013",
    "city": "TRONDHEIM",
    "industry": "Drift av restauranter og kafeer",
    "industryCode": "56.101",
    "employeeCount": 23,
    "dagligLeder": "Ole Nordmann",
    "vatRegistered": true,
    "foundingDate": "2015-03-15"
  },
  "places": { "rating": 4.2, "userRatingCount": 150, "..." : "..." },
  "workspaceId": "uuid-here"
}
```

### 3. `scrape-website`

| Field | Value |
|-------|-------|
| Auth | JWT (default `verify_jwt = true`) |
| Method | POST |
| Latency | 2-5s (depends on site) |

**Input:**
```json
{ "url": "https://sjobris.no" }
```

**Output:**
```json
{
  "scrapedData": {
    "companyName": "Sjøbris",
    "email": "post@sjobris.no",
    "phone": "+47 73 12 34 56",
    "summary": "Restaurant med sjømat...",
    "locations": [{ "name": "Sjøbris Restaurant", "type": "main" }],
    "departments": [],
    "images": [],
    "socialLinks": {}
  }
}
```

## Data Sources

| Source | Type | Auth | Latency |
|--------|------|------|---------|
| Brreg (enhetsregisteret) | Public API | None needed | <500ms |
| Google Places | Google API | API key (env) | 500ms-2s |
| Scrapling | Internal Docker service | None (internal) | 2-5s |

## Data Merge Priority

| Field | Priority |
|-------|----------|
| Legal name, org number, address | Brreg (authoritative) |
| Industry, NACE code | Brreg |
| Email | Scraped > Places |
| Phone | Scraped > Places |
| Website | Brreg > Places |
| Rating, coordinates, photos | Places only |
| Description, opening hours | Places > Scraped |
| Locations, departments | Scraped only |

## Agent Tool Specifications

### `searchCompany` (Ultravox client tool)

- **Params:** `name` (required), `city` (optional)
- **Returns to agent:** `{ found, count, candidates: [{orgNumber, name, city, industry, employeeCount, highConfidence}] }`
- **Agent behavior:** Narrate candidates. If 1 high-confidence, confirm with user. If multiple, ask user to choose.

### `identifyCompany` (Ultravox client tool)

- **Params:** `orgNumber` (required)
- **Returns to agent:** `{ success, company: {legalName, address, city, industry, employeeCount, dagligLeder, website}, google: {rating, ratingCount, priceLevel}, workspaceCreated }`
- **Agent behavior:** Narrate full details. If website found, call scrapeWebsite.

### `scrapeWebsite` (Ultravox client tool)

- **Params:** `url` (required)
- **Returns to agent:** `{ success, email, phone, locationCount, departmentCount }`
- **Agent behavior:** Mention additional findings (email, phone, locations).

## Stage Integration

| Stage | Tools Used |
|-------|-----------|
| greeting (1) | searchCompany → identifyCompany → scrapeWebsite |
| discovery (2) | getOnboardingState, scrapeWebsite (if not called yet) |
| confirm-business (3) | getOnboardingState, updateBusiness |
| season (4) | updateSeason |
| departments (5) | addDepartments |
| locations (6) | addLocations, addZones |
| procedures (7) | addProcedures |
| welcome (8) | finalizeOnboarding |

## Fallback Behavior

| Service | Failure | Agent Response |
|---------|---------|----------------|
| Brreg search | No matches | "Fant ikke bedriften. Har du org-nummer?" |
| Brreg details | 404/error | "Kunne ikke hente detaljer. La meg prøve med nettside." |
| Google Places | Timeout/error | Proceeds without rating data. Agent skips Google mentions. |
| Scrapling | Unavailable | Proceeds without scraped data. Agent asks for email/phone manually. |
| Workspace provisioning | Error | Continues conversation. Provisioning retried on finalize. |

## Backwards Compatibility

The monolithic `gather-workspace-intelligence` Edge Function is **kept** for the manual UI flow (BusinessSection's "Søk opp" button). It now imports from `_shared/brreg.ts` but is otherwise unchanged.

The `triggerScrape` action in `useOnboardingState` is also kept for the manual flow. Only the voice agent uses the 3 new progressive tools.

## Environment Variables

| Variable | Edge Functions | Required |
|----------|---------------|----------|
| `SUPABASE_URL` | All | Yes (auto-injected) |
| `SUPABASE_ANON_KEY` | identify-company | Yes (auto-injected) |
| `SUPABASE_SERVICE_ROLE_KEY` | identify-company | Yes (auto-injected) |
| `SCRAPLING_SERVICE_URL` | scrape-website | No (default: `http://host.docker.internal:8000`) |
| `GOOGLE_PLACES_API_KEY` | google-places-intelligence | Yes (for Places enrichment) |
