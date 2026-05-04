---
title: "Journey — Serper fallback when Google Places unavailable"
feature: scrapling-google-places-api
journey: serper-fallback
status: draft
verified_at: null
e2e_test: null
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

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — `apps/e2e/tests/onboarding/serper-fallback.spec.ts` mocks Google 429, verifies Serper called, draft populated
- [ ] Unit test in `services/scrapling/tests/test_google_places.py::test_429_falls_back_to_serper`
- [ ] Manually tested by setting `GOOGLE_PLACES_API_KEY=invalid` in dev, verifying log shows `provider=serper`, draft renders

**Mark `status: verified` in frontmatter when all three boxes are checked.**
