---
title: "Journey — lovdata-mcp fixture mode replays without network"
feature: lovdata-mcp
journey: fixture-mode-replays
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, mcp, lovdata, fixtures, dev-acceptance, p1-s1a]
---

# Journey: lovdata-mcp fixture mode replays without network

**Role:** developer (CI test runner / offline integrator)

**Precondition:**
- `services/lovsen-lovdata-mcp/` package built
- `src/fixtures/aml_14_6.json`, `aml_15_3.json`, `aml_15_6.json` present
- Network is fully offline (e.g. `pytest` running in CI sandbox)

## Happy Path

1. Developer sets `LOVSEN_MCP_FIXTURE=1`
2. Developer calls `fetch_paragraph(lov="aml", paragraph="14-6")` → server reads `src/fixtures/aml_14_6.json` → returns ADR-0242-compliant Citation with verbatim text + sha256 hash + ISO-8601 fetched_at + Lovdata source_url
3. Developer calls `fetch_paragraph(lov="aml", paragraph="15-3")` → returns aml_15_3 fixture
4. Developer calls `fetch_paragraph(lov="aml", paragraph="15-6")` → returns aml_15_6 fixture
5. Developer calls `fetch_paragraph(lov="aml", paragraph="999-99")` → fixture not found → returns MCP error (does NOT make network call to Lovdata)
6. Developer inspects request log → confirms zero outbound HTTP calls during the entire run

**Postcondition:** ADR-0244 fixture-mode contract is honored; downstream P1.S2 (knowledge base) + P1.S4 (capability layer) can rely on this for offline tests; CI pipelines can run without Lovdata network access.

## Error Paths

- **Scenario:** `LOVSEN_MCP_FIXTURE=1` set but fixture file missing → return clear "fixture not found at {path}" error; never silently fall back to network (CI safety)
- **Scenario:** Fixture file has malformed JSON → load fails fast with parse error (don't return half-broken Citation)
- **Scenario:** Fixture's `verbatim_text` and `hash` don't match → fail with explicit "fixture corruption detected: hash mismatch" (catches lazy fixture authoring)

## Verification

- [ ] Implementation matches the steps above
- [ ] `pytest tests/test_fixture_mode.py -v` all pass
- [ ] All 3 fixture files exist and contain ADR-0242-compliant Citation JSON
- [ ] Network is provably blocked during fixture-mode test run (assert via `httpx_mock` or socket-blocking)
- [ ] `test_citation_shape.py` validates the 3 fixtures against the Zod schema definition

**Mark `status: verified` in frontmatter when all five boxes are checked.**
