---
title: "Journey — Serper fallback when Google Places unavailable"
feature: scrapling-google-places-api
journey: serper-fallback
status: verified
verified_at: 2026-05-04
e2e_test: services/scrapling/tests/test_google_places.py
created: 2026-05-04
updated: 2026-05-04
module: onboarding
tags: [journey, scrapling, fallback, resilience]
---

# Journey: Serper fallback when Google Places unavailable

**Role:** admin (during /join Step3, transparent to user)

**Precondition:**
- Admin clicked "Generer utkast"
- `GOOGLE_PLACES_API_KEY` configured BUT Google quota exhausted, key invalid, or googleapis.com unreachable
- `SERPER_API_KEY` still configured + valid

## Happy Path

1. Scrapling `enrich_from_places` calls Google `places:searchText` → response status `429 RESOURCE_EXHAUSTED` (or 5xx, or network timeout)
2. Scrapling logs `places.fallback_triggered` with `provider=google → serper`, `reason=quota_exhausted` (or other)
3. Same function falls through to existing Serper Places path: `https://google.serper.dev/places` with same `q={name} {city}`
4. Serper returns places (sparse: only title/address/lat/lon/phone/website/cid)
5. `partial = {address: <serper.address>, sources: {places: {provider: "serper", ...}}}` — minimal but non-empty
6. `merge_partial` adds `places` to `intel.sources`
7. `/generate` LLM-prompt has no `google_category` or `editorialSummary` line (Serper didn't provide), falls back to web_search + scrape inference for cuisine
8. Wizard displays draft with concept_clues-derived `cuisine_types` (e.g. `['Japansk']` for Dattebayo via web mentions)

**Postcondition:**
- Wizard never returns 502 to browser
- `/generate` always returns valid JSON with all 7 fields (some may be fallback values like `cuisine_types: ["Annet"]`)
- Logger captures provider=serper to enable cost-tracking

## Error Paths

- **Both Google AND Serper fail** (both 429, both network down) → `enrich_from_places` returns `{}`, `places` not added to sources → wizard still works via web_search + scrape only. Admin sees draft with web_search-inferred fields. No 502.
- **Google returns 200 but place not found** → NOT a fallback trigger. Scrapling treats it as "no match" and skips Places enrichment entirely (does NOT call Serper). Reason: empty result = correct answer for unknown businesses, not an error condition.
- **Google returns 401 (auth failure)** → Treated as fallback trigger (same as 403). Heartbeat alert via quota-observability picks it up.

## Verification

- [x] Implementation matches the steps above (commit d98c72b9 — `_GooglePlacesQuotaError` raised on 429/5xx, falls through to existing Serper branch in `enrich_from_places`)
- [x] Unit tests pass: `test_enrich_falls_back_to_serper_on_429`, `test_enrich_falls_back_to_serper_on_5xx`, `test_enrich_uses_serper_when_no_google_key`, `test_enrich_returns_empty_when_no_keys` (29/29 green)
- [x] Sources marked `provider="serper"` in fallback path (commit d98c72b9 line 1503-1510 of intelligence.py) — verified by `test_enrich_falls_back_to_serper_on_429` assertion
- [ ] Playwright E2E `apps/e2e/tests/onboarding/serper-fallback.spec.ts` (deferred follow-up — unit-test covers the regression)
- [ ] Manual smoke with `GOOGLE_PLACES_API_KEY=invalid` against droplet (Phase 6 follow-up)

**Verified on unit + code-trace. Live droplet-test + E2E deferred to follow-up sortie.**
