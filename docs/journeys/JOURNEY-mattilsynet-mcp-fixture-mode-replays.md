---
title: "Journey — mattilsynet-mcp fixture mode replays without network"
feature: mattilsynet-mcp
journey: fixture-mode-replays
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, mcp, mattilsynet, fixtures, dev-acceptance, p1-s1b]
---

# Journey: mattilsynet-mcp fixture mode replays without network

**Role:** developer (CI test runner / offline integrator)

**Precondition:**
- `services/lovsen-mattilsynet-mcp/` package built
- `src/fixtures/alkohol_servering_aldersgrense.json`, `allergener_pliktig_merking.json`, `hygiene_temperatur_kjedge.json` present
- Network fully offline

## Happy Path

1. Developer sets `LOVSEN_MCP_FIXTURE=1`
2. `fetch_guidance(topic="alkohol-aldersgrense")` → reads alkohol fixture → ADR-0242 Citation with verbatim text + hash + fetched_at + Mattilsynet URL
3. `fetch_guidance(topic="allergener-merking")` → reads allergener fixture
4. `lookup_food_safety_requirement(category="kjolekjede")` → reads hygiene fixture
5. Unknown topic/category → MCP error; never network call
6. Inspect request log → zero outbound HTTP

**Postcondition:** ADR-0244 fixture-mode contract honored; CI runs offline.

## Error Paths

- **Scenario:** Fixture file missing → fail fast with explicit path; never network fallback
- **Scenario:** Malformed fixture JSON → parse-error fail
- **Scenario:** verbatim_text + hash mismatch → "fixture corruption" error

## Verification

- [ ] Implementation matches the steps above
- [ ] `pytest tests/test_fixture_mode.py -v` all pass
- [ ] All 3 fixture files exist and are ADR-0242-compliant
- [ ] Network blocked during fixture-mode test run
- [ ] `test_citation_shape.py` validates the 3 fixtures against Zod schema

**Mark `status: verified` when all five boxes ticked.**
