---
title: Scrapling — Google Places API integration + Business Intelligence capability
status: in_progress
created: 2026-05-04
updated: 2026-05-04
module: onboarding
tags: [scrapling, google-places, onboarding, wizard, intelligence, business-intelligence, capability, lead-research]
---

# Scrapling — Google Places API integration

## Why

Serper Places API tier returns only `title + address + lat/lon + phone + website + cid` for Norwegian restaurants. `category`, `rating`, `priceLevel`, `type` all null. Verified against:

- Sushi & Wok Dattebayo Bø (small SMB)
- Olivia Aker Brygge (large chain)

Same null-payload pattern.

Result: `enrich_from_places` produces only address. `google_category` stays None → `category_cuisine_map` keyword-match never fires → LLM `/generate` prompt has no Google Maps signal → `cuisine_types`, `price_category`, `menu_description` fall back to web_search/scrape inference of variable quality. `/join` Step3 "Generer utkast" produces fattige drafts.

## What

Replace Serper Places with Google Places API (v1) inside `services/scrapling/intelligence.py:enrich_from_places`. Keep Serper for `_places_lookup` (BRREG fallback in wizard search) — different concern, different signal need.

New endpoint chain:
1. `POST https://places.googleapis.com/v1/places:searchText` → `{ places: [{id}] }` (Place Search, ~$0.005/call)
2. `GET https://places.googleapis.com/v1/places/{id}?fields=id,types,rating,userRatingCount,priceLevel,editorialSummary,primaryType,displayName,formattedAddress` (Place Details, ~$0.017/call)

Authoritative schema:
- `types[]` → 95+ keywords vs Serper's 10. Map to `cuisine_types` + `concept_clues`
- `priceLevel: PRICE_LEVEL_INEXPENSIVE | MODERATE | EXPENSIVE | VERY_EXPENSIVE` → map 1:1 to budget/moderate/premium/fine_dining
- `editorialSummary.text` → seed `menu_description`
- `rating + userRatingCount` → `google_rating + google_review_count`
- `primaryType` → `google_category` (canonical)

Cost: $200/mo Maps Platform free tier = ~10k Place Details calls/mo gratis. Sufficient for current onboarding volume + buffer.

Fallback: if Google quota exhausted (429) or 5xx, fall through to existing Serper `enrich_from_places` call. Wizard never blocks.

## Non-goals

- NOT replacing Serper Places in `_places_lookup` (BRREG fallback).
- NOT adding Google Maps live-tracking, opening hours sync, or review ingestion. Single one-shot enrichment per workspace, cached in `intelligence` JSON.
- NOT making this a workspace-runtime concern. Onboarding-only enrichment.

## Risks

- **Quota**: 10k/mo free tier sufficient now, but if onboarding spikes >1 restaurant/min sustained, billable. Add cost-cap telemetry + heartbeat alert.
- **Norwegian Places coverage**: smaller than Serper for unverified businesses. Test against 5–10 real prod workspaces before merge.
- **API key surface**: new secret in both vaults + Vercel + droplet. Follows established sync-script pattern.

## ADR

ADR-0270 (or next free slot) — external dependency switch + cost classification + fallback semantics.

## Capability tools (Phase 7 — ADR-0270)

Phase 7 exposes the scrapling pipeline as a godmode-only Botsson capability (`business_intelligence`) for `/platform-admin/*` surfaces. All 6 tools are proxies to scrapling — zero Smartout DB writes.

### Tool inventory

| Tool | Type | Scrapling endpoint | Cost |
|------|------|--------------------|------|
| `find_hospitality_businesses` | suggestTool | `POST /hospitality-search` (NEW) | ~$0.02/result |
| `enrich_company_intelligence` | readOnlyTool | `POST /enrich` | scrapling-internal |
| `generate_company_copy` | suggestTool | `POST /generate` | scrapling-internal |
| `search_brreg` | readOnlyTool | `POST /brreg-search` | free |
| `lookup_brreg` | readOnlyTool | `POST /brreg-lookup` | free |
| `scrape_website` | readOnlyTool | `POST /extract` or `/scrape-raw` | free |

### New scrapling endpoint: `/hospitality-search`

Implemented in `services/scrapling/lead_research.py`. Pipeline:
1. `POST places.googleapis.com/v1/places:searchText` — 1 call, paginates to 60 results
2. `GET places.googleapis.com/v1/places/{id}` per result — rich data with `internationalPhoneNumber`, `websiteUri`, `primaryType`, `priceLevel`
3. Email-scrape per `websiteUri` — best-effort, 8s timeout, placeholder-filtered

Requires `GOOGLE_PLACES_API_KEY` env var (deployed in Phase 6 or Phase 7 manual step).

### Telemetry

12 events registered in `packages/telemetry/src/registry.ts`:
- `business_intelligence.<tool>.called` (×6) → PostHog + Logger + activity_trail
- `business_intelligence.<tool>.cost` (×6) → PostHog + Logger + engine_event

Cost-events route to `engine_event` to enable future heartbeat-based cost-cap alerting.

### Authority posture

`toolAuthPattern: "direct_admin"` — godmode gate at BFF. `defaultAuthority: "read_only"`. Suggest tier required for `find_hospitality_businesses` and `generate_company_copy`.

See ADR-0270 for full decision record.

## See also

- `services/scrapling/intelligence.py:1160` — current `enrich_from_places`
- `services/scrapling/intelligence.py:1218` — `category_concept_map` (10 keywords today)
- `services/scrapling/intelligence.py:1237` — `category_cuisine_map` (10 keywords today)
- `services/scrapling/lead_research.py` — NEW Google Places v1 + email-scrape pipeline (Phase 7)
- `packages/ai/src/capabilities/business-intelligence/` — NEW capability (Phase 7)
- `docs/decisions/0270-business-intelligence-capability-godmode.md` — ADR-0270
- L-2026-04-28 — earlier scrapling fix-batch (BRREG smart, Skriv om, model bump)
