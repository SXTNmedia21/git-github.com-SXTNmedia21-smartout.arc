---
title: "Journey — arbeidstilsynet-mcp fixture mode replays without network"
feature: arbeidstilsynet-mcp
journey: fixture-mode-replays
status: verified
verified_at: "2026-04-29T10:30:00+02:00"
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, mcp, arbeidstilsynet, fixtures, dev-acceptance, p1-s1c]
---

# Journey: arbeidstilsynet-mcp fixture mode replays without network

**Role:** developer (CI test runner / offline integrator)

**Precondition:**
- `services/lovsen-arbeidstilsynet-mcp/` package built
- 3 seed fixtures present: `hms_systematisk_arbeid.json`, `arbeidstid_natt_skift.json`, `risikovurdering_kjokken_template.json`
- Network fully offline

## Happy Path

1. Developer sets `LOVSEN_MCP_FIXTURE=1`
2. `search_guidance(query="HMS")` → reads hms fixture → ADR-0256 Citation
3. `search_guidance(query="nattarbeid")` → reads arbeidstid fixture
4. `fetch_workplace_assessment_template(template_id="risikovurdering-kjokken")` → reads template fixture
5. Unknown query/template → MCP error; never network call
6. Inspect request log → zero outbound HTTP

**Postcondition:** ADR-0258 fixture-mode contract honored.

## Error Paths

- **Scenario:** Fixture file missing → fail fast with explicit path
- **Scenario:** Malformed fixture JSON → parse-error fail
- **Scenario:** verbatim_text + hash mismatch → "fixture corruption" error

## Verification

- [x] Implementation matches the steps above
- [x] `pytest tests/test_fixture_mode.py -v` all pass
- [x] 3 fixture files exist and ADR-0256-compliant
- [x] Network blocked during fixture-mode test run
- [x] `test_citation_shape.py` validates fixtures against Zod schema

**Mark `status: verified` when all five boxes ticked.**
