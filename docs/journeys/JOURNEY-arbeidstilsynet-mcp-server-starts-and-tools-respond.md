---
title: "Journey — arbeidstilsynet-mcp stdio server starts + 2 tools respond"
feature: arbeidstilsynet-mcp
journey: server-starts-and-tools-respond
status: verified
verified_at: "2026-04-29T10:30:00+02:00"
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, mcp, arbeidstilsynet, dev-acceptance, p1-s1c]
---

# Journey: arbeidstilsynet-mcp stdio server starts + 2 tools respond

**Role:** developer (Lovsen capability author / future P1.S4 integrator)

**Precondition:**
- Python 3.10+ available
- `services/lovsen-arbeidstilsynet-mcp/` package built per plan
- `LOVSEN_MCP_FIXTURE=1` set

## Happy Path

1. Developer runs `python -m services.lovsen_arbeidstilsynet_mcp.server` → stdio server starts
2. Developer sends MCP `tools/list` → server returns 2 tools: `search_guidance`, `fetch_workplace_assessment_template`
3. `search_guidance(query="HMS systematisk", scope="hms", limit=5)` → returns list of Citation rows
4. `fetch_workplace_assessment_template(template_id="risikovurdering-kjokken")` → returns Citation with template body

**Postcondition:** 2 tools produce ADR-0242-compliant output.

## Error Paths

- **Scenario:** Malformed JSON-RPC → log to stderr, return MCP error, server stays alive
- **Scenario:** Unknown template_id → MCP error with template-not-found code; list available templates in error message

## Verification

- [x] Implementation matches the steps above
- [x] `pytest tests/test_search_guidance.py tests/test_fetch_workplace_assessment_template.py -v` all pass
- [x] Manual stdio smoke test: `tools/list` returns 2 tool entries
- [x] Both tool outputs validate against `packages/lovsen-contract/src/citation.ts` Zod schema

**Mark `status: verified` when all four boxes ticked.**
