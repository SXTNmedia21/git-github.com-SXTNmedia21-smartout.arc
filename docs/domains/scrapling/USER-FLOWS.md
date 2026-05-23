---
title: "Scrapling Domain — User Flows"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: scrapling
tags: [scrapling, user-flows, journeys, onboarding, wizard, lead-research]
mirror: verified
last_verified: 2026-05-23
---

# User Flows — Scrapling

> Scrapling is a backend service. User flows are defined by **upstream consumers** — the onboarding wizard and the godmode Botsson persona. The journeys below belong to those domains; scrapling is the execution layer.

## Journey Index

### Group: Company identification (Onboarding Wizard)

These flows occur during `/join` Step 3 ("Genererer utkast") and the company lookup step.

| Journey | File | Status |
|---|---|---|
| Wizard produces rich draft using Google Places types/priceLevel/editorialSummary | `docs/journeys/JOURNEY-scrapling-google-places-api-wizard-rich-draft.md` | verified |
| Google Places quota exhausted → Serper fallback → wizard never blocks | `docs/journeys/JOURNEY-scrapling-google-places-api-serper-fallback.md` | verified |

The company identification flow (search_company → identify_company → update_business) is owned by the onboarding-wizard domain. Scrapling provides the `/brreg-search` and `/brreg-lookup` endpoints.

### Group: Cost Observability (Platform Admin)

| Journey | File | Status |
|---|---|---|
| Daily Google Places cost visible via heartbeat / drift-check, alert at 80% free tier | `docs/journeys/JOURNEY-scrapling-google-places-api-quota-observability.md` | verified |

### Group: Lead Research (Godmode / Platform Admin)

No dedicated journey file exists. The flow is:

1. Pontus (in godmode Botsson chat) says "finn alle restauranter i Oslo"
2. `find_hospitality_businesses` tool → `POST /hospitality-search {city: "Oslo", types: ["restaurant"], limit: 20}`
3. Lead Research pipeline: Google Places searchText → per-place details → email scrape
4. Botsson returns structured list with name, address, phone, email, rating, price_level
5. Pontus exports or acts on the prospect list

This flow is godmode-only (`direct_admin`) per ADR-0270. No workspace user can trigger it.

---

## Consumer Contract Summary

| Consumer | Tools / Route | Scrapling endpoints |
|---|---|---|
| Onboarding wizard (Step 3) | `/api/workspace-intelligence` Next.js route | `/enrich`, `/generate` |
| Onboarding wizard (company ID) | `search_company`, `identify_company` BFF tools | `/brreg-search`, `/brreg-lookup` |
| Onboarding wizard (website scrape) | `scrape_website` BFF tool | `/extract`, `/scrape-raw` |
| Document analysis (Step 7+) | Edge Function `analyze-setup-documents` | `/extract/document` |
| Godmode Botsson | `business_intelligence` capability (6 tools) | `/hospitality-search`, `/enrich`, `/generate`, `/brreg-search`, `/brreg-lookup`, `/extract` |

---

## Out of Scope for This Domain

- The onboarding wizard UI itself (owned by onboarding-wizard domain)
- The Botsson persona / soul (owned by botsson domain)
- The agent-harness gate/router that dispatches to capability tools (owned by agent-harness domain)
- The document upload wizard step (consumes `/extract/document` but owned by onboarding-wizard)
