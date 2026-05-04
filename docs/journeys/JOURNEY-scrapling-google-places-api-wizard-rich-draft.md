---
title: "Journey — Wizard rich draft via Google Places"
feature: scrapling-google-places-api
journey: wizard-rich-draft
status: verified
verified_at: 2026-05-04
e2e_test: services/scrapling/tests/test_google_places.py
created: 2026-05-04
updated: 2026-05-04
module: onboarding
tags: [journey, scrapling, google-places, wizard]
---

# Journey: Wizard rich draft via Google Places

**Role:** admin (workspace owner during /join Step3 onboarding)

**Precondition:**
- Admin completed Step1 (BRREG-confirmed company) + Step2 (city + website)
- Workspace exists with `company_name`, `city`, `website_url` set
- `scrape.smartout.ai` reachable, `GOOGLE_PLACES_API_KEY` configured in droplet env

## Happy Path

1. Admin lands on Step3 "Fortell om bedriften" → System renders form with empty draft fields
2. Admin clicks "Generer utkast" → Browser POST `/api/workspace-intelligence` with `{action:"enrich_and_generate"}` → Vercel routes to droplet `scrape.smartout.ai/enrich`
3. Scrapling enrich-pipeline runs Phase 1+2 (BRREG + scrape) + Phase 3 (web_search + Google Places)
4. `enrich_from_places` calls Google Places `places:searchText` → place_id → `places/{id}` with field mask → returns `{types, rating, userRatingCount, priceLevel, editorialSummary, primaryType, formattedAddress}`
5. Mapper converts `types[]` → `cuisine_types`, `priceLevel` → `price_category`, `editorialSummary.text` → seed for `menu_description`, `primaryType` → `google_category`
6. Scrapling continues to `/generate` step → LLM-prompt includes "Google Maps-kategori: {primaryType}" + "Google-beskrivelse: {editorialSummary}"
7. LLM returns `{about_us, our_history, our_concept, menu_description, restaurant_type, cuisine_types, price_category}` all filled with restaurant-specific content
8. Browser receives draft → Step3 form fields prefilled → Admin sees rich, accurate copy that reflects the actual restaurant

**Postcondition:**
- All 7 draft fields non-empty + non-fallback (`cuisine_types ≠ ["Annet"]`, `price_category ≠ default "moderate"` when Google priceLevel known)
- `intel.sources` includes `places` with provider=google
- `intel.google_category`, `intel.google_rating`, `intel.google_review_count` populated

## Error Paths

- **Google place not found** (Norwegian unverified business) → Scrapling logs `places.search_no_match`, falls through to Serper Places (existing behavior). Wizard still gets address + concept_clues from web_search/scrape; `cuisine_types` may be empty → LLM falls back to web-mention inference. Admin sees lower-quality but valid draft.
- **Google quota exhausted (429)** → See JOURNEY-serper-fallback.
- **Google API key invalid (403)** → Scrapling logs error, falls through to Serper (same path as quota). Heartbeat alert fires within 24h via quota-observability journey.
- **Place returned but `editorialSummary` missing** (common for SMBs) → `menu_description` seed empty, LLM generates from concept_clues + web mentions. Acceptable.
- **Network timeout to googleapis.com** (>10s) → AbortSignal throws → caught → falls through to Serper.

## Verification

- [x] Implementation matches the steps above (commits d98c72b9, c5a8a9e6)
- [x] Unit test exists and passes — `services/scrapling/tests/test_google_places.py` (29/29 green in container 2026-05-04)
- [x] Local smoke against Strøm Mat & Bar — Google call returned `google_rating=4.2`, `google_review_count=725`, `google_category=restaurant`, cost $0.022 logged via `[places.api_call]`, verified `/places-cost` aggregated correctly
- [ ] Manual smoke against 5 prod workspaces post-droplet-deploy (Phase 6 follow-up): Strøm Mat & Bar, Bårdshaug Vegkro, Yogurt Heaven, Olivia Aker Brygge, Dattebayo Bø — capture screenshot of populated Step3
- [ ] Playwright E2E spec `apps/e2e/tests/onboarding/wizard-rich-draft.spec.ts` (deferred follow-up sortie — unit + local smoke covered the regression risk)

**Verified on local + unit. Manual prod-smoke + E2E spec tracked as Phase 6 follow-up in HANDOFF.**
