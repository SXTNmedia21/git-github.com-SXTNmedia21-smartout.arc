---
title: "Plan — scrapling-google-places-api"
feature: scrapling-google-places-api
spec: docs/superpowers/specs/2026-05-04-scrapling-google-places-api.md
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: onboarding
tags: [plan, scrapling, google-places, onboarding, business-intelligence, capability]
---

# Plan — scrapling-google-places-api

> Branch: `feat/scrapling-google-places-api` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-6` | Base: `development` | Module: onboarding | Started: 2026-05-04

**Spec:** [Scrapling — Google Places API integration](../superpowers/specs/2026-05-04-scrapling-google-places-api.md)

## Journeys (the contract)

- [JOURNEY-scrapling-google-places-api-wizard-rich-draft](../journeys/JOURNEY-scrapling-google-places-api-wizard-rich-draft.md) — /join Step3 "Generer utkast" produces rich draft using Google Places types/priceLevel/editorialSummary
- [JOURNEY-scrapling-google-places-api-serper-fallback](../journeys/JOURNEY-scrapling-google-places-api-serper-fallback.md) — When Google quota tom or 5xx, scrapling falls back to Serper Places, wizard never blocks
- [JOURNEY-scrapling-google-places-api-quota-observability](../journeys/JOURNEY-scrapling-google-places-api-quota-observability.md) — Daily cost + call-count visible via heartbeat / drift-check, alert at 80% of free tier

## Goal

Replace Serper Places with Google Places API v1 in `enrich_from_places` to unblock rich `/join` Step3 drafts (cuisine_types, price_category, menu_description sourced from authoritative Google data).

## Tasks

### Phase 1 — Vault + env

- [ ] Create item `Google-Places` in `smartout_ai` vault, field `api_key` (dev key, restricted to localhost referrers)
- [ ] Create item `Google-Places` in `smartout_ai_prod` vault, field `api_key` (prod key, restricted to scrape.smartout.ai referrers)
- [ ] Add to `.env.template`: `GOOGLE_PLACES_API_KEY="op://smartout_ai/Google-Places/api_key"`
- [ ] Add to `apps/web/src/env.ts` schema (optional, server-only)
- [ ] Add to `infra/docker-compose.yml` scrapling env passthrough
- [ ] Add to `infra/scripts/sync-env-to-droplet.sh` MANIFEST → prod vault

### Phase 2 — Code (services/scrapling/)

- [x] Add `GOOGLE_PLACES_API_KEY = os.environ.get(...)` near top of `intelligence.py`
- [x] New function `_google_places_enrich(session, name, city) -> dict` (single-shot search→details)
- [x] New function `_parse_google_places_details(details) -> dict` (canonical mapping)
- [x] Refactor `enrich_from_places`:
  - If `GOOGLE_PLACES_API_KEY` set: call Google chain, on 429/5xx → `_GooglePlacesQuotaError` → falls through to Serper
  - If only `SERPER_API_KEY` set: call Serper as today
  - Same return shape (`partial` dict)
- [x] `GOOGLE_TYPE_CUISINE_MAP` covers 26 Google `types[]` keywords (italian_, sushi_, ramen_, vietnamese_, korean_, mediterranean_, greek_, turkish_, lebanese_, steak_house, hamburger_, fast_food_, vegetarian_, vegan_, barbecue_, buffet_, breakfast_, brunch_, etc.)
- [x] `GOOGLE_PRICE_LEVEL_MAP` maps 5 priceLevel enums → 4-bucket `price_category` (FREE+INEXPENSIVE→budget, MODERATE→moderate, EXPENSIVE→premium, VERY_EXPENSIVE→fine_dining)
- [x] `menu_description` seed from `editorialSummary.text` (≥ 30 chars guard)
- [x] `apps/web/src/env.ts` — `GOOGLE_PLACES_API_KEY` schema entry (server-only, optional)
- [x] Serper branch annotated with `provider: "serper"` in sources for provenance

### Phase 3 — ADR

- [ ] Draft ADR-0270 (or next free): "External dependency switch — Google Places API for scrapling enrichment"
- [ ] Register in `docs/decisions/0000-decision-log.md`

### Phase 4 — Tests

- [x] Unit: `services/scrapling/tests/test_google_places.py` — 29 tests, mock `places:searchText` + `places/{id}` responses, verify mapping (29/29 passed in container)
- [x] Unit: priceLevel enum → price_category map covers all 5 values (FREE, INEXPENSIVE, MODERATE, EXPENSIVE, VERY_EXPENSIVE)
- [x] Unit: types[] mapping covers cuisine + concept_clues (italian, sushi, ramen, mexican, steak_house, vegan, cocktail_bar, etc.) + dedup
- [x] Unit: 429 + 5xx quota response triggers Serper fallback (verified via _GooglePlacesQuotaError path)
- [x] Unit: missing GOOGLE_PLACES_API_KEY falls through to Serper-only (single API call)
- [x] Unit: editorialSummary length guard (≥30 chars) tested
- [ ] Integration (manual): test against 5 real prod workspaces (Strøm Mat & Bar, Bårdshaug Vegkro, Yogurt Heaven, Olivia Aker Brygge, Dattebayo) — capture before/after diff (Phase 6 prereq)

### Phase 5 — Telemetry

- [ ] Add `places.api_call` event to scrapling logger with `provider=google|serper`, `status_code`, `place_id`, `cost_estimate`
- [ ] Daily aggregation script in `infra/scripts/google-places-cost-report.sh` reads scrapling logs → outputs cost/calls
- [ ] Heartbeat job `google-places-quota-check` cooldown 24h, alert via Telegram at 80% of free tier

### Phase 6 — Deploy

- [ ] Sync vault → Vercel (preview + production via `sync-env-to-vercel.sh`)
- [ ] Sync vault → droplet (`sync-env-to-droplet.sh --remote`)
- [ ] Build + recreate scrapling container on droplet
- [ ] Smoke `/enrich` against 3 workspaces, verify `google_category`, `priceLevel` populated
- [ ] Smoke `/generate` produces filled `cuisine_types`, `price_category`, `menu_description`

### Phase 7 — Business Intelligence capability (2026-05-04)

Goal: expose the scrapling pipeline as a godmode Botsson capability so Pontus can use AI-assisted lead-research and onboarding-helper flows from `/platform-admin/*`.

#### TypeScript (packages/ai/)

- [x] `packages/ai/src/capabilities/business-intelligence/types.ts` — 6 Zod schemas + TypeScript types
- [x] `packages/ai/src/capabilities/business-intelligence/tools.ts` — 6 tool implementations (find_hospitality_businesses, enrich_company_intelligence, generate_company_copy, search_brreg, lookup_brreg, scrape_website)
- [x] `packages/ai/src/capabilities/business-intelligence/index.ts` — CapabilityDefinition (godmode, chat-only, direct_admin)
- [x] `packages/ai/src/capabilities/business-intelligence/__tests__/tools.test.ts` — unit tests, mock scrapling
- [x] `packages/ai/src/capabilities/registry.ts` — registered `business_intelligence: businessIntelligenceCapability`
- [x] `packages/ai/src/capabilities/types.ts` — `"business_intelligence"` added to `CapabilityName` union
- [x] `packages/ai/src/router/intent-classifier.ts` — `"business_intelligence"` added to `z.enum()`

#### Telemetry (packages/telemetry/)

- [x] `packages/telemetry/src/registry.ts` — 12 event interfaces + union entries + EVENT_ROUTING:
  - 6× `business_intelligence.<tool>.called` → posthog + logger + activity_trail
  - 6× `business_intelligence.<tool>.cost` → posthog + logger + engine_event (cost monitoring)

#### Python (services/scrapling/)

- [x] `services/scrapling/lead_research.py` — NEW module: Google Places v1 search+details+email pipeline
- [x] `services/scrapling/main.py` — new `/hospitality-search` endpoint with Pydantic models + auth
- [x] `services/scrapling/tests/test_hospitality.py` — unit tests for helpers + endpoint

#### ADR + Docs

- [x] `docs/decisions/0270-business-intelligence-capability-godmode.md` — proposed
- [x] `docs/decisions/0000-decision-log.md` — ADR-0270 registered
- [x] `docs/plans/PLAN-scrapling-google-places-api.md` — Phase 7 section added
- [x] `docs/superpowers/specs/2026-05-04-scrapling-google-places-api.md` — spec extended

#### Phase 7 acceptance criteria

- [x] All 6 tools defined with Zod schemas + non-empty descriptions
- [x] Capability registered in registry.ts
- [x] 12 telemetry events registered (6 called + 6 cost) with correct routing
- [x] `/hospitality-search` endpoint in main.py with auth + Pydantic models
- [x] `lead_research.py` has search+details+email pipeline
- [x] Unit tests for all 6 tools mock scrapling + verify shape
- [x] ADR-0270 drafted + registered
- [ ] `pnpm turbo typecheck` passes (run after commit)

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated (ADR-0270 registered)
- [ ] At least one E2E test exists per journey (recommended)
- [ ] Cost observed during 2 weeks: < 5% of free tier under normal onboarding load
- [ ] Smoke /generate produces non-empty `cuisine_types` for 5/5 test workspaces
- [ ] Serper fallback verified by simulating 429 (env-var override or mock)
