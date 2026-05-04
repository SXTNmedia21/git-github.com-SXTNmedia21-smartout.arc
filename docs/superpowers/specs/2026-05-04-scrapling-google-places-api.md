---
title: Scrapling — Google Places API integration
status: draft
created: 2026-05-04
updated: 2026-05-04
module: onboarding
tags: [scrapling, google-places, onboarding, wizard, intelligence]
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

## See also

- `services/scrapling/intelligence.py:1160` — current `enrich_from_places`
- `services/scrapling/intelligence.py:1218` — `category_concept_map` (10 keywords today)
- `services/scrapling/intelligence.py:1237` — `category_cuisine_map` (10 keywords today)
- L-2026-04-28 — earlier scrapling fix-batch (BRREG smart, Skriv om, model bump)
