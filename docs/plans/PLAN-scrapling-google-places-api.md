---
title: "Plan — scrapling-google-places-api"
feature: scrapling-google-places-api
spec: docs/superpowers/specs/2026-05-04-scrapling-google-places-api.md
status: draft
updated: 2026-05-04
created: 2026-05-04
module: onboarding
tags: [plan, scrapling, google-places, onboarding]
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

- [ ] Add `GOOGLE_PLACES_API_KEY = os.environ.get(...)` near top of `intelligence.py`
- [ ] New function `_google_places_search(name, city) -> Optional[place_id]` calling `places:searchText`
- [ ] New function `_google_places_details(place_id) -> dict` calling `places/{id}` with field mask
- [ ] Refactor `enrich_from_places`:
  - If `GOOGLE_PLACES_API_KEY` set: call Google chain, on 429/5xx fall through to Serper
  - If only `SERPER_API_KEY` set: call Serper as today
  - Same return shape (`partial` dict)
- [ ] Expand `category_cuisine_map` to handle Google `types[]` keywords (e.g. `italian_restaurant`, `sushi_restaurant`, `cafe`, `bar`, `bakery`, `steakhouse`, `pub`, `seafood_restaurant`, `vegetarian_restaurant`, `vegan_restaurant`, `pizza_restaurant`, `burger_restaurant`, `mexican_restaurant`, `thai_restaurant`)
- [ ] Map `priceLevel` enum → `price_category` (1:1 four-bucket map)
- [ ] Set `menu_description` seed from `editorialSummary.text` if length > 30 chars

### Phase 3 — ADR

- [ ] Draft ADR-0270 (or next free): "External dependency switch — Google Places API for scrapling enrichment"
- [ ] Register in `docs/decisions/0000-decision-log.md`

### Phase 4 — Tests

- [ ] Unit: `services/scrapling/tests/test_google_places.py` — mock `places:searchText` + `places/{id}` responses, verify mapping
- [ ] Unit: priceLevel enum → price_category map covers all 4 values
- [ ] Unit: types[] mapping covers cuisine + concept_clues
- [ ] Unit: 429 quota response triggers Serper fallback
- [ ] Integration (manual): test against 5 real prod workspaces (Strøm Mat & Bar, Bårdshaug Vegkro, Yogurt Heaven, Olivia Aker Brygge, Dattebayo) — capture before/after diff

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

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated (ADR-0270 registered)
- [ ] At least one E2E test exists per journey (recommended)
- [ ] Cost observed during 2 weeks: < 5% of free tier under normal onboarding load
- [ ] Smoke /generate produces non-empty `cuisine_types` for 5/5 test workspaces
- [ ] Serper fallback verified by simulating 429 (env-var override or mock)
