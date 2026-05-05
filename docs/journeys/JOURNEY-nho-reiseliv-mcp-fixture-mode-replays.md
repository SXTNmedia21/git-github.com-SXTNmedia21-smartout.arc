---
title: "Journey — nho-reiseliv-mcp fixture mode replays without network"
feature: nho-reiseliv-mcp
journey: fixture-mode-replays
status: verified
verified_at: 2026-04-29T10:00:00+02:00
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, mcp, nho-reiseliv, fixtures, dev-acceptance, p1-s1d]
---

# Journey: nho-reiseliv-mcp fixture mode replays without network

**Role:** developer (CI test runner / offline integrator)

**Precondition:**
- `services/lovsen-nho-reiseliv-mcp/` package built
- 4 seed fixtures (versioned) present:
  - `riksavtalen_2024_§6_kveldstillegg.json`
  - `riksavtalen_2024_§5_garantilonn.json`
  - `riksavtalen_2025_§6_kveldstillegg.json`
  - `riksavtalen_2025_§5_garantilonn.json`
- Network fully offline

## Happy Path

1. Developer sets `LOVSEN_MCP_FIXTURE=1`
2. `fetch_riksavtalen(version="2024", paragraph="§6")` → reads 2024 kveldstillegg fixture → ADR-0256 Citation
3. `fetch_riksavtalen(version="2025", paragraph="§6")` → reads 2025 kveldstillegg fixture (different verbatim text + hash than 2024)
4. `lookup_tariff_supplement(category="garantilonn", version="2024")` → reads 2024 garantilønn fixture
5. Same call with `version="2025"` → reads 2025 garantilønn fixture
6. Asking for unsupported version → fixture-not-found error; never network
7. Inspect request log → zero outbound HTTP

**Postcondition:** ADR-0258 fixture-mode contract honored; version-routing works in fixture mode (critical because Lovsen agent needs to compare 2024 vs 2025 rates without network).

## Error Paths

- **Scenario:** Fixture file missing for asked version → fail fast with explicit path + list of available versions
- **Scenario:** Malformed fixture JSON → parse-error fail
- **Scenario:** verbatim_text + hash mismatch → "fixture corruption" error
- **Scenario:** 2024 fixture content accidentally identical to 2025 (lazy seeding) → fixture-corruption-style error in test_citation_shape.py via cross-check

## Verification

- [x] Implementation matches the steps above
- [x] `pytest tests/test_fixture_mode.py -v` all pass
- [x] 4 fixture files exist and ADR-0256-compliant
- [x] 2024 vs 2025 fixtures differ in verbatim_text AND hash (no copy-paste seeding)
- [x] Network blocked during fixture-mode test run
- [x] `test_citation_shape.py` validates all 4 fixtures against Zod schema

**Mark `status: verified` when all six boxes ticked.**
