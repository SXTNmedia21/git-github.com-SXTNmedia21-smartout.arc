---
title: "Journey — lovdata-mcp stdio server starts + 3 tools respond"
feature: lovdata-mcp
journey: server-starts-and-tools-respond
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, mcp, lovdata, dev-acceptance, p1-s1a]
---

# Journey: lovdata-mcp stdio server starts + 3 tools respond

**Role:** developer (Lovsen capability author / future P1.S4 integrator)

**Precondition:**
- Python 3.10+ available
- `services/lovsen-lovdata-mcp/` package built per plan
- `LOVSEN_MCP_FIXTURE=1` set (no real network)

## Happy Path

1. Developer runs `python -m services.lovsen_lovdata_mcp.server` → stdio server starts, listens on stdin/stdout
2. Developer sends MCP `tools/list` JSON-RPC → server returns 3 tools: `fetch_paragraph`, `search_law`, `get_law_metadata` with input schemas
3. Developer calls `fetch_paragraph(lov="aml", paragraph="14-6")` → server returns Citation JSON conforming to ADR-0242
4. Developer calls `search_law(query="prøvetid", lov="aml", limit=5)` → server returns list of Citation rows
5. Developer calls `get_law_metadata(lov="aml")` → server returns `{name, version, last_updated, total_paragraphs, source_url}`

**Postcondition:** stdio server is consumable by any MCP client (Claude Code, capability layer in P1.S4); 3 tools produce ADR-0242-compliant output.

## Error Paths

- **Scenario:** stdio server crashes on malformed JSON-RPC → log error to stderr, return MCP error response, server stays alive
- **Scenario:** `fetch_paragraph` called with non-existent paragraph → return MCP error with code + message; do NOT return empty Citation
- **Scenario:** `search_law` called without `lov` argument → search across all laws (broader scope), but rate-limit applies harder

## Verification

- [ ] Implementation matches the steps above
- [ ] `pytest tests/test_fetch_paragraph.py tests/test_search_law.py tests/test_get_law_metadata.py -v` all pass
- [ ] Manual stdio smoke test: pipe a `tools/list` request and confirm 3 tool entries returned
- [ ] All 3 tool outputs validate against `packages/lovsen-contract/src/citation.ts` Zod schema (test_citation_shape.py)

**Mark `status: verified` in frontmatter when all four boxes are checked.**
