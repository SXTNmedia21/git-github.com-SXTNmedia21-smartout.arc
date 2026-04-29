---
title: "Journey — mattilsynet-mcp stdio server starts + 3 tools respond"
feature: mattilsynet-mcp
journey: server-starts-and-tools-respond
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, mcp, mattilsynet, dev-acceptance, p1-s1b]
---

# Journey: mattilsynet-mcp stdio server starts + 3 tools respond

**Role:** developer (Lovsen capability author / future P1.S4 integrator)

**Precondition:**
- Python 3.10+ available
- `services/lovsen-mattilsynet-mcp/` package built per plan
- `LOVSEN_MCP_FIXTURE=1` set

## Happy Path

1. Developer runs `python -m services.lovsen_mattilsynet_mcp.server` → stdio server starts on stdin/stdout
2. Developer sends MCP `tools/list` → server returns 3 tools: `search_regulation`, `fetch_guidance`, `lookup_food_safety_requirement`
3. Developer calls `search_regulation(query="alkohol", scope="alkohol", limit=5)` → server returns list of Citation rows
4. Developer calls `fetch_guidance(topic="allergener-merking")` → server returns Citation
5. Developer calls `lookup_food_safety_requirement(category="kjolekjede")` → server returns Citation

**Postcondition:** 3 tools produce ADR-0242-compliant output; consumable by capability layer in P1.S4.

## Error Paths

- **Scenario:** Malformed JSON-RPC → server logs to stderr, returns MCP error, stays alive
- **Scenario:** Unknown topic in `fetch_guidance` → MCP error with topic-not-found code; never empty Citation
- **Scenario:** Unknown category in `lookup_food_safety_requirement` → list known categories in error message

## Verification

- [ ] Implementation matches the steps above
- [ ] `pytest tests/test_search_regulation.py tests/test_fetch_guidance.py tests/test_lookup_food_safety_requirement.py -v` all pass
- [ ] Manual stdio smoke test: `tools/list` returns 3 tool entries
- [ ] All 3 tool outputs validate against `packages/lovsen-contract/src/citation.ts` Zod schema

**Mark `status: verified` when all four boxes ticked.**
