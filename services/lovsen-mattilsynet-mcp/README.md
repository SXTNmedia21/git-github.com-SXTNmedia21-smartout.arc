---
title: lovsen-mattilsynet-mcp
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [lovsen, mcp, mattilsynet, python, stdio]
---

# lovsen-mattilsynet-mcp

Python stdio MCP server for Mattilsynet.no (Norwegian Food Safety Authority).
Part of the Lovsen campaign — P1.S1b.

## Tools

| Tool                             | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| `search_regulation`              | Full-text search across regulations and circulars    |
| `fetch_guidance`                 | Fetch a guidance document (veiledning) by topic slug |
| `lookup_food_safety_requirement` | Fetch a food-safety requirement by category          |

All tools return ADR-0256-compliant `Citation` JSON.

## Fixture Mode

Set `LOVSEN_MCP_FIXTURE=1` to return fixture data without network I/O.
Used in CI and offline tests.

## Usage

```bash
cd services/lovsen-mattilsynet-mcp
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Fixture mode (offline / CI)
LOVSEN_MCP_FIXTURE=1 python -m server

# Test
LOVSEN_MCP_FIXTURE=1 pytest tests/ -v
```

## Architecture

```
src/
  server.py            — stdio MCP entrypoint, registers 3 tools
  mattilsynet_client.py — HTTP client with rate-limit + 24h cache
  parsers/
    citation_parser.py — HTML/text → Citation JSON (ADR-0256)
  tools/
    search_regulation.py
    fetch_guidance.py
    lookup_food_safety_requirement.py
  fixtures/
    alkohol_servering_aldersgrense.json
    allergener_pliktig_merking.json
    hygiene_temperatur_kjedge.json
tests/
  test_search_regulation.py
  test_fetch_guidance.py
  test_lookup_food_safety_requirement.py
  test_fixture_mode.py
  test_citation_shape.py
```

## ADRs

- ADR-0256: Lovsen Citation Contract — verbatim text + SHA-256 + fetched_at
- ADR-0258: Lovsen MCP Boundary — 4 stdio MCPs, fixture mode required
