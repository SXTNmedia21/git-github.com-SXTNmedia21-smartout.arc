---
title: "Scrapling Domain — E2E Coverage"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: scrapling
tags: [scrapling, e2e, testing, pytest, playwright]
mirror: verified
last_verified: 2026-05-23
---

# E2E Coverage — Scrapling

## Python Unit Tests (`services/scrapling/tests/`)

| Test file | Count | Coverage | Status |
|---|---|---|---|
| `test_google_places.py` | 29 tests | `_google_places_enrich`, `_parse_google_places_details`, priceLevel→price_category mapping (5 values), types[]→cuisine+concept dedup, 429/5xx→Serper fallback, missing GOOGLE_PLACES_API_KEY path, `editorialSummary` guard (≥30 chars) | Green (verified in container per handoff) |
| `test_intelligence.py` | unknown | `WorkspaceIntelligence`, `merge_partial`, `compute_gaps`, `build_context`, `normalize_company_name`, BRREG scoring | Present |
| `test_extract_integration.py` | unknown | Integration tests for the `/extract` pipeline | Present |
| `test_extraction_eval.py` | unknown | Evaluation tests for extraction quality | Present |
| `test_hospitality.py` | unknown | Hospitality scraping tests | Present |
| `test_jsonld.py` | unknown | JSON-LD extractor | Present |
| `test_live_snapshots.py` | unknown | Live snapshot tests (may require network) | Present |
| `test_ogtags.py` | unknown | OGtags extractor | Present |
| `test_validation_models.py` | unknown | Pydantic model validation | Present |
| `conftest.py` | — | Shared fixtures (including markdown fixture files in `tests/fixtures/`) | Present |

**Fixture files:** `tests/fixtures/` contains: `daily_routines.md`, `handbook_hospitality.md`, `hms_plan.md`, `menu_restaurant.md`, `mixed_document.md`, `tariff_agreement.md`. Expected outputs in `tests/fixtures/expected/` (JSON) enable snapshot comparison.

**pytest.ini** confirms test runner is pytest.

**Python coverage delta:**
- Strong: Google Places mapping (29 tests), extraction pipeline (integration tests), JSON-LD, OGtags, validation
- Unknown: Exact counts for `test_intelligence.py`, `test_hospitality.py`, `test_live_snapshots.py`
- Gap: `/hospitality-search` endpoint (lead_research.py) has no dedicated test file. The pipeline is tested indirectly via `test_hospitality.py` (name suggests it, but content unverified)
- Gap: `/enrich` orchestrator integration test across all 4 phases

---

## Playwright E2E (`apps/e2e/`)

| File | Coverage | Status |
|---|---|---|
| `apps/e2e/tests/scrapling-health.spec.ts` | Scrapling service health check | Present (first line: `import { test, expect } from "@playwright/test"`) |

**Report evidence:** `apps/e2e/reports/wizard-workspace-scrapling-2026-04-15.md` — E2E coverage addendum covering per-wizard regression specs, workspace control, and scrapling. Suggests scrapling integration was tested as part of wizard E2E on 2026-04-15.

---

## Coverage Delta (honest)

| Area | Python coverage | Playwright coverage | Gap severity |
|---|---|---|---|
| `/extract` website scrape | Integration test present | Via wizard E2E (2026-04-15) | Low — covered |
| `/brreg-search` smart-search | Via intelligence tests (indirect) | Via wizard E2E | Low |
| `/brreg-lookup` direct lookup | Via intelligence tests (indirect) | Via wizard E2E | Low |
| `/enrich` orchestrator | Partial (integration test exists) | Via wizard E2E | Medium — multi-phase not unit-tested |
| `/generate` LLM copywriting | Unknown | Via wizard E2E | Medium — LLM calls need mocking |
| `/hospitality-search` pipeline | Unknown (test_hospitality.py?) | None known | High — godmode-only, hard to E2E |
| `/places-cost` aggregation | Unknown | None known | Medium — heartbeat covers in prod |
| Google Places 429 fallback | 29-test suite covers (unit) | None | Low — unit coverage strong |
| Document extraction (PDF/DOCX etc.) | test_extract_integration.py, fixtures | None | Medium — Playwright can't upload docs |
| `business_intelligence` capability tools | `__tests__/tools.test.ts` (TS unit) | None | High — no Playwright for godmode tools |

**Overall:** Python unit coverage is strong for the critical Google Places + BRREG paths. Integration test exists for extraction. The main gap is `/hospitality-search` (lead research pipeline) and the `business_intelligence` godmode tools — both are hard to cover with standard Playwright specs because they require platform-admin auth. TS unit tests (`packages/ai/src/capabilities/business-intelligence/__tests__/tools.test.ts`) cover the tool layer.
