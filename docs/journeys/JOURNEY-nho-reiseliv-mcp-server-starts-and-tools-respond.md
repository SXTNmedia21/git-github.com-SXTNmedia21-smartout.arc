---
title: "Journey — nho-reiseliv-mcp stdio server starts + 2 tools respond"
feature: nho-reiseliv-mcp
journey: server-starts-and-tools-respond
status: verified
verified_at: 2026-04-29T10:00:00+02:00
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, mcp, nho-reiseliv, riksavtalen, dev-acceptance, p1-s1d]
---

# Journey: nho-reiseliv-mcp stdio server starts + 2 tools respond

**Role:** developer (Lovsen capability author / future P1.S4 integrator)

**Precondition:**
- Python 3.10+ available
- `services/lovsen-nho-reiseliv-mcp/` package built per plan
- `LOVSEN_MCP_FIXTURE=1` set

## Happy Path

1. Developer runs `python -m services.lovsen_nho_reiseliv_mcp.server` → stdio server starts
2. Developer sends MCP `tools/list` → server returns 2 tools: `fetch_riksavtalen`, `lookup_tariff_supplement`
3. `fetch_riksavtalen(version="2024", paragraph="§6.1")` → returns Citation with kveldstillegg-2024 verbatim text
4. `fetch_riksavtalen(version="2025", paragraph="§6.1")` → returns Citation with kveldstillegg-2025 (different rate, different verbatim text)
5. `lookup_tariff_supplement(category="kveldstillegg", version="2024")` → returns Citation with structured rate+rule for 2024
6. Same call with `version="2025"` → returns Citation with 2025 rate (proves version-routing works)

**Postcondition:** 2 tools produce ADR-0256-compliant output; version-routing returns the right tariff for the asked-for year (critical per README §Versjons-bevissthet).

## Error Paths

- **Scenario:** Version not supported (e.g. `version="2023"`) → MCP error listing supported versions; never silently fall back to closest
- **Scenario:** Paragraph not in version → MCP error; never empty Citation
- **Scenario:** Malformed JSON-RPC → log to stderr, return MCP error, server stays alive

## Verification

- [x] Implementation matches the steps above
- [x] `pytest tests/test_fetch_riksavtalen.py tests/test_lookup_tariff_supplement.py -v` all pass
- [x] Manual stdio smoke test: `tools/list` returns 2 tool entries
- [x] Version-routing test passes (2024 call returns 2024 rate, 2025 call returns 2025 rate, mismatch detected)
- [x] Both tool outputs validate against `packages/lovsen-contract/src/citation.ts` Zod schema

**Mark `status: verified` when all five boxes ticked.**
