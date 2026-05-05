---
title: "lovsen-arbeidstilsynet-mcp — Python stdio MCP server for Arbeidstilsynet.no"
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [lovsen, mcp, arbeidstilsynet, hms, p1-s1c]
---

# lovsen-arbeidstilsynet-mcp

Python stdio MCP server for Arbeidstilsynet.no — Norwegian Labour Inspection Authority.
Part of the Lovsen agent campaign (P1.S1c).

## Tools

| Tool                                  | Description                                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `search_guidance`                     | Full-text search Arbeidstilsynet veiledninger. Optional `scope` filter: `hms`, `risikovurdering`, `arbeidstid`. |
| `fetch_workplace_assessment_template` | Fetch a specific risk-assessment template by ID. Returns Citation with template body.                           |

All tools return ADR-0256-compliant `Citation` JSON.

## Fixture Mode

Set `LOVSEN_MCP_FIXTURE=1` to run without any network I/O. Reads from `src/fixtures/`.

```bash
LOVSEN_MCP_FIXTURE=1 python -m src.server
```

## Running Tests

```bash
cd services/lovsen-arbeidstilsynet-mcp
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
LOVSEN_MCP_FIXTURE=1 pytest tests/ -v
```

## Cache

24h TTL file-system cache at `~/.cache/lovsen-mcp/arbeidstilsynet/`.
Rate limit: 1 req/sec per Arbeidstilsynet domain (ADR-0258).

## Fixtures

| File                                    | Source                                             |
| --------------------------------------- | -------------------------------------------------- |
| `hms_systematisk_arbeid.json`           | Internkontrollforskriften §5                       |
| `arbeidstid_natt_skift.json`            | Aml. §10-3 + Arbeidstilsynet nattarbeid veiledning |
| `risikovurdering_kjokken_template.json` | Restaurant-kjøkken risk-assessment template        |
