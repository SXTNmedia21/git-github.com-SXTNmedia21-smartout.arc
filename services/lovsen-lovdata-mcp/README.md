---
title: lovsen-lovdata-mcp
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [lovsen, mcp, lovdata, p1-s1a]
---

# lovsen-lovdata-mcp

Python stdio MCP server for Lovdata.no — Norwegian law text database (Aml., ferielov, OTP).

Exposes 3 tools: `fetch_paragraph`, `search_law`, `get_law_metadata`.
Output conforms to ADR-0242 Citation schema. Rate-limited to 1 req/sec per ADR-0244.

## Install

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
# Normal mode (live Lovdata HTTP, 1 req/sec rate-limit, 24h cache)
PYTHONPATH=src python -m server

# Fixture mode — zero HTTP outbound, reads src/fixtures/*.json
LOVSEN_MCP_FIXTURE=1 PYTHONPATH=src python -m server
```

## Fixture mode

Set `LOVSEN_MCP_FIXTURE=1` to disable all outbound HTTP.
Tools read from `src/fixtures/aml_14_6.json`, `aml_15_3.json`, `aml_15_6.json`.
Missing fixture → explicit error; NEVER silently falls back to network (CI safety).

## Rate limiting

1 request/sec per source domain, enforced via asyncio token bucket.
Throttle events logged at WARN to stderr.

## References

- ADR-0242: `docs/decisions/0242-lovsen-citation-contract.md`
- ADR-0244: `docs/decisions/0244-lovsen-mcp-boundary.md`
