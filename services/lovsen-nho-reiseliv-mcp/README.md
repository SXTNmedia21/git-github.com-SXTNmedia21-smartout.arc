---
title: "NHO Reiseliv MCP — Riksavtalen stdio server"
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [mcp, lovsen, nho-reiseliv, riksavtalen, p1-s1d]
---

# lovsen-nho-reiseliv-mcp

Python stdio MCP server exposing Riksavtalen (NHO Reiseliv / LO collective agreement) tariff data to the Lovsen AI agent.

Part of P1.S1d — one of 4 parallel MCP sub-sorties in Phase 1.

## Tools

### `fetch_riksavtalen`

Fetch a Riksavtalen paragraph for a specific agreement version.

```json
{
  "version": "2024",
  "paragraph": "§6.1"
}
```

- `version` — REQUIRED. `"2024"` or `"2025"`. Never defaults to latest.
- `paragraph` — Optional. If omitted returns metadata only.

Returns ADR-0242 Citation with verbatim text, SHA-256 hash, ISO-8601 `fetched_at`, source URL.

### `lookup_tariff_supplement`

Look up a specific tariff supplement (tillegg) for an explicit version.

```json
{
  "category": "kveldstillegg",
  "version": "2025"
}
```

- `category` — `"kveldstillegg"` or `"garantilonn"` (also `"garantilønn"`).
- `version` — REQUIRED. `"2024"` or `"2025"`. Never defaults to latest.

`paragraph` field in returned Citation: `riksavtalen_{version}/{category}`.

## Operasjonelle prinsipper

### §5 Versjons-bevissthet

Tariff rates change year-over-year. Returning 2025 kveldstillegg (27%) when 2024
was asked (25%) is a legal accuracy failure. Therefore:

- `version` is always a required argument — no default
- Mismatched or unsupported version → explicit error listing supported versions
- No silent fallback to closest or latest version

Supported versions: `2024`, `2025`.

## Fixture mode (CI + offline)

```bash
LOVSEN_MCP_FIXTURE=1 pytest tests/ -v
```

4 seed fixtures (2 categories × 2 versions):

| File                                  | Content                              |
| ------------------------------------- | ------------------------------------ |
| `riksavtalen_2024_kveldstillegg.json` | §6.1 — 25% evening supplement (2024) |
| `riksavtalen_2025_kveldstillegg.json` | §6.1 — 27% evening supplement (2025) |
| `riksavtalen_2024_garantilonn.json`   | §5 — NOK 38 000 minimum wage (2024)  |
| `riksavtalen_2025_garantilonn.json`   | §5 — NOK 40 500 minimum wage (2025)  |

All fixtures are PLACEHOLDER — real verbatim text not fetched from nhoreiseliv.no (Phase 7).
Satser in fixtures reflect documented agreement changes between 2024 and 2025.

## Development

```bash
cd services/lovsen-nho-reiseliv-mcp
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
LOVSEN_MCP_FIXTURE=1 pytest tests/ -v
```

## Rate limiting + caching

- 1 req/sec (ADR-0244)
- 24h TTL file-system cache at `~/.cache/lovsen-mcp/nho-reiseliv/`
- stderr-only logging (stdout reserved for MCP JSON-RPC)

## ADR references

- ADR-0242 — Citation Contract (verbatim text + SHA-256 hash)
- ADR-0244 — MCP Boundary (fixture mode, rate limit, stdio transport)
