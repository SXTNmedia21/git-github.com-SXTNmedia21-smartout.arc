---
title: "Plan — nho-reiseliv-mcp"
feature: nho-reiseliv-mcp
spec: ../../../smartout.ai/docs/agents/lovsen-agent/README.md
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [plan, lovsen, phase-1, p1-s1d, mcp, nho-reiseliv, riksavtalen]
---

# Plan — nho-reiseliv-mcp (P1.S1d)

> Branch: `feat/lovsen-nho-reiseliv-mcp` | Worktree: `~/dev/smartout.ai-lovsen-wt-4` | Module: MODULE_AGENT_SDK
> Phase 1, sub-sortie 1d (parallel with S1a/b/c, ~90 min). Stdio MCP for NHO Reiseliv — Riksavtalen tariff agreement.

**Spec sources:**
- `~/dev/smartout.ai/docs/agents/lovsen-agent/README.md` — agent overview + MCP table
- `docs/decisions/0242-lovsen-citation-contract.md` — Citation shape
- `docs/decisions/0244-lovsen-mcp-boundary.md` — fixture mode + rate-limit (1 req/sec)
- `packages/lovsen-contract/src/citation.ts` — Zod schema

## Context

P1.S1d is one of 4 parallel MCP sub-sorties. Builds Python stdio MCP server with 2 tools for Riksavtalen — the LO/NHO collective tariff agreement that governs hospitality wages, supplements, and working-hours rules in Norway.

## Journeys

- [JOURNEY-nho-reiseliv-mcp-server-starts-and-tools-respond](../journeys/JOURNEY-nho-reiseliv-mcp-server-starts-and-tools-respond.md) — stdio server boots, lists 2 tools, both return structured JSON
- [JOURNEY-nho-reiseliv-mcp-fixture-mode-replays](../journeys/JOURNEY-nho-reiseliv-mcp-fixture-mode-replays.md) — fixture mode yields tariff data, zero network, output conforms to ADR-0242

## Goal

Ship Python stdio MCP server `services/lovsen-nho-reiseliv-mcp/` with 2 tools (`fetch_riksavtalen`, `lookup_tariff_supplement`) conforming to ADR-0242 + ADR-0244.

## Deliverables

### 1. Python stdio MCP server

Location: `services/lovsen-nho-reiseliv-mcp/`. Structure mirrors P1.S1a — see PLAN-lovdata-mcp.md §Deliverables/1.

### 2. Tool contracts

- `fetch_riksavtalen(version: str, paragraph: str | None = None) -> Citation | dict` — fetches a specific Riksavtalen paragraph (e.g. `'§6.1'` for søndags-kveldstillegg) for a specific version (e.g. `'2024'` or `'2025'`); if `paragraph` is None, returns metadata only
- `lookup_tariff_supplement(category: str, version: str) -> Citation` — fetches a specific tariff supplement amount/rule (kveldstillegg, helgetillegg, nattillegg, garantilønn, lærling-sats) for the given version

Both return ADR-0242 `Citation` shape. For tariff supplements, `paragraph` field uses `riksavtalen_<version>/<category>` (e.g. `'riksavtalen_2024/kveldstillegg'`). Versioned: must support 2024 + 2025 since faseplan locks both.

### 3. Fixture mode

`LOVSEN_MCP_FIXTURE=1` → reads from `src/fixtures/*.json`. 4 seed fixtures (versioned):
- `riksavtalen_2024_§6_kveldstillegg.json`
- `riksavtalen_2024_§5_garantilonn.json`
- `riksavtalen_2025_§6_kveldstillegg.json`
- `riksavtalen_2025_§5_garantilonn.json`

The pair-per-version is required because tariff rates change between 2024 and 2025 — agent must be able to compare.

### 4. Rate limiting + caching

Same as P1.S1a (1 req/sec, 24h TTL, fs-cache at `~/.cache/lovsen-mcp/nho-reiseliv/`).

### 5. Version handling

Version-aware lookup is critical for this MCP (per README §Operasjonelle-prinsipper §5 "Versjons-bevissthet"). Default version = latest; explicit version arg required for historical lookup. Mismatched version errors surface explicitly (don't silently fall back).

## Tasks

- [x] **T1.** Scaffold `services/lovsen-nho-reiseliv-mcp/` (pyproject.toml + requirements.txt + README.md)
- [x] **T2.** `src/server.py` MCP stdio entrypoint — register 2 tools
- [x] **T3.** `src/nho_reiseliv_client.py` HTTP client with caching + rate-limit + version-routing
- [x] **T4.** `src/parsers/` — Riksavtalen content → Citation JSON
- [x] **T5.** Implement 2 tool files producing ADR-0242-compliant JSON; both must enforce explicit-version contract
- [x] **T6.** Seed 4 fixture files (2 paragraphs × 2 versions = 2024 + 2025)
- [x] **T7.** `LOVSEN_MCP_FIXTURE=1` switch
- [x] **T8.** 5 test files (2 tool tests + fixture + Citation shape + version-routing test)
- [x] **T9.** `pytest` all pass (52/52)
- [x] **T10.** Verify stdio server boots: lists 2 tools
- [x] **T11.** Mark both journeys verified, commit per logical unit

## Commit Plan

1. `feat(nho-reiseliv-mcp): scaffold services/lovsen-nho-reiseliv-mcp/`
2. `feat(nho-reiseliv-mcp): stdio server + nho-reiseliv HTTP client + version-routing`
3. `feat(nho-reiseliv-mcp): 2 tools (fetch_riksavtalen, lookup_tariff_supplement) per ADR-0242`
4. `feat(nho-reiseliv-mcp): fixture mode + 4 paragraph seeds (2024 + 2025)`
5. `test(nho-reiseliv-mcp): 5 test files exercising tools + fixture + version-routing + Citation shape`
6. `docs(nho-reiseliv-mcp): mark P1.S1d journeys verified`

Co-author every commit:
```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Acceptance Criteria

- [ ] Both journeys `status: verified`
- [ ] `pytest` all pass; zero network calls
- [ ] Citation output conforms to ADR-0242
- [ ] Fixture corpus covers 2024 + 2025 versions
- [ ] Version-routing test proves agent gets 2024 rates when asking for 2024, 2025 rates when asking for 2025
- [ ] Rate limiter at 1 req/sec
- [ ] No P1.S2+ scope leaks

## Out-of-Scope

- Full Riksavtalen corpus → P1.S2
- MCP registration in agent persona → P1.S3
- Capability integration → P1.S4
- Live NHO Reiseliv API auth → Phase 7
