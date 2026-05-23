---
title: "Lovsen — E2E Coverage"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: lovsen
mirror: verified
last_verified: 2026-05-23
tags: [lovsen, legal, e2e, tests, pytest, playwright, coverage]
---

# Lovsen — E2E Coverage

> mirror: verified — all test files confirmed by `ls` inspection. Counts are file counts, not test case counts.

---

## Python pytest — MCP services

Each Python MCP service has a `tests/` folder with `pytest` test files. All run under `LOVSEN_FIXTURE_MODE=true` for CI/offline.

### `services/lovsen-nho-reiseliv-mcp/tests/` — 6 files

| File | Covers |
|---|---|
| `test_citation_shape.py` | ADR-0256 Citation output shape (paragraph, verbatim_text, hash, fetched_at, source_url) |
| `test_fetch_riksavtalen.py` | `fetch_riksavtalen` tool — version routing (2024/2025), paragraph filter, error on unsupported version |
| `test_fixture_mode.py` | `LOVSEN_FIXTURE_MODE=true` zero-HTTP guarantee |
| `test_lookup_tariff_supplement.py` | `lookup_tariff_supplement` — kveldstillegg + garantilonn for both versions |
| `test_verify_citation_freshness.py` | ADR-0342 freshness tool — batch input validation, stale detection, `lovsen-shared` integration |
| `test_version_routing.py` | Version-aware routing — explicit version required, error on default/missing |

### `services/lovsen-arbeidstilsynet-mcp/tests/` — 4 files

| File | Covers |
|---|---|
| `test_citation_shape.py` | ADR-0256 Citation shape |
| `test_fetch_workplace_assessment_template.py` | Template fetch by ID |
| `test_fixture_mode.py` | Fixture mode zero-HTTP |
| `test_search_guidance.py` | `search_guidance` — scope filter (hms/risikovurdering/arbeidstid), full-text search |

### `services/lovsen-lovdata-mcp/tests/` — 7 files

| File | Covers |
|---|---|
| `test_citation_shape.py` | ADR-0256 Citation shape |
| `test_fetch_paragraph.py` | `fetch_paragraph` — lov + paragraph + optional ledd |
| `test_fetch_riksavtalen_paragraph.py` | `fetch_riksavtalen_paragraph` — Lovdata mirror of Riksavtalen (ADR-0347) |
| `test_fixture_mode.py` | Fixture mode zero-HTTP |
| `test_get_law_metadata.py` | `get_law_metadata` — law metadata, version, title |
| `test_search_law.py` | `search_law` — full-text search, optional lov filter |
| `test_verify_citation_freshness.py` | ADR-0342 freshness — Lovdata source, lovsen-shared integration |

### `services/lovsen-mattilsynet-mcp/tests/` — 5 files

| File | Covers |
|---|---|
| `test_citation_shape.py` | ADR-0256 Citation shape |
| `test_fetch_guidance.py` | `fetch_guidance` by topic slug |
| `test_fixture_mode.py` | Fixture mode zero-HTTP |
| `test_lookup_food_safety_requirement.py` | `lookup_food_safety_requirement` by category |
| `test_search_regulation.py` | `search_regulation` full-text search |

**Python pytest total: 22 test files across 4 services.**

---

## TypeScript unit tests — legal capability

### `packages/ai/src/capabilities/legal/__tests__/` — 2 files

| File | Covers |
|---|---|
| `tools.test.ts` | 6 unit tests — channel guards (voice excluded per ADR-0163), integration shape (CitationSchema/ValidationResultSchema), validate_aml_14_6 pass/fail shape, validate_aml_14_15 shape |
| `amendment-classifier.test.ts` | Amendment classifier rule coverage — 9 rules: no-op→UP, stilling change→ENDRINGSOPPSIGELSE, lønn reduction ≥15%→ENDRINGSOPPSIGELSE, tariff-bound→non-bound→ENDRINGSOPPSIGELSE, non-bound→tariff-bound→MATERIAL, union switch+rate drop→ENDRINGSOPPSIGELSE, union switch comparable→MATERIAL, same union new law_version→UP (Riksavtalen §4 carve-out), fallback→UP |

### `packages/lovsen-contract/src/__tests__/` — 1 file

| File | Covers |
|---|---|
| `validation-result.test.ts` | Zod schema validation for Citation + ValidationResult shapes. source_url + source_fetched_at structure. |

**TypeScript unit total: 3 test files.**

---

## Playwright E2E — apps/e2e/

### `apps/e2e/tests/legal-harness-e2e.spec.ts`

Playwright E2E spec covering lovsen capability through the stage-engine harness. Exercises `validate_aml_14_6` via the contract send route with chat channel. Confirms 422 response on missing §14-6 fields + `aml_errors[]` structure.

**1 Playwright spec file.**

Note: `apps/e2e/tests/contract-harness-e2e.spec.ts` also exercises the send route (which calls `validate_aml_14_6`) but is owned by the contracts domain.

---

## Coverage summary

| Layer | Test files | Status |
|---|---|---|
| Python MCP (4 services) | 22 pytest files | ✅ all fixture-mode CI green per cert-pass handoff |
| TypeScript capability | 3 test files | 🟡 unit tests pass; integration tests limited (Phase 0c stubs limit real integration) |
| Playwright E2E | 1 spec file | 🟡 covers §14-6 gate via send route; MCP-to-capability bridge (ADR-0350) not yet covered |
| `lovsen-shared` | — | No standalone pytest; covered transitively by nho-reiseliv + lovdata verify_citation_freshness tests |

---

## Gaps in coverage

| Gap | Impact |
|---|---|
| `cite_law` integration test | No test verifies real Lovdata MCP response (Phase 0c stub — real test deferred to Phase 0c+) |
| `classify_amendment` real body | No integration test covers real field_classification_metadata read. Stub returns "admin" always. |
| ADR-0350 bridge E2E | No test covers HTTP route proxying capability → Python MCP. Cannot build until bridge is implemented. |
| `lovsen.mcp.fetch*` telemetry emit-site coverage | 9 `lovsen.*` registry events, 0 emit call-site tests (no emitter exists yet for MCP-side events). |
| Arbeidstilsynet freshness tool | No `verify_citation_freshness` in arbeidstilsynet service → no freshness E2E for HMS guidance. |
