---
title: "Plan — mattilsynet-mcp"
feature: mattilsynet-mcp
spec: ../../../smartout.ai/docs/agents/lovsen-agent/README.md
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [plan, lovsen, phase-1, p1-s1b, mcp, mattilsynet]
---

# Plan — mattilsynet-mcp (P1.S1b)

> Branch: `feat/lovsen-mattilsynet-mcp` | Worktree: `~/dev/smartout.ai-lovsen-wt-2` | Module: MODULE_AGENT_SDK
> Phase 1, sub-sortie 1b (parallel with S1a/c/d, ~90 min). Stdio MCP for Mattilsynet.no — food safety regulations.

**Spec sources:**
- `~/dev/smartout.ai/docs/agents/lovsen-agent/README.md` — agent overview + MCP table
- `docs/decisions/0242-lovsen-citation-contract.md` — output JSON shape (Citation w/ verbatim text + hash + source URL)
- `docs/decisions/0244-lovsen-mcp-boundary.md` — fixture mode + rate-limit (1 req/sec) requirements
- `packages/lovsen-contract/src/citation.ts` — Zod schema MCP output must conform to

## Context

P1.S1b is one of 4 parallel MCP sub-sorties. Builds Python stdio MCP server exposing 3 tools against Mattilsynet.no (Norwegian Food Safety Authority — alkoholservering, allergener, hygiene, bevillingsregler).

## Journeys

- [JOURNEY-mattilsynet-mcp-server-starts-and-tools-respond](../journeys/JOURNEY-mattilsynet-mcp-server-starts-and-tools-respond.md) — stdio server boots, lists 3 tools, each tool returns structured JSON
- [JOURNEY-mattilsynet-mcp-fixture-mode-replays](../journeys/JOURNEY-mattilsynet-mcp-fixture-mode-replays.md) — `LOVSEN_MCP_FIXTURE=1` yields fixture data, zero network, output conforms to ADR-0256

## Goal

Ship Python stdio MCP server `services/lovsen-mattilsynet-mcp/` with 3 tools (`search_regulation`, `fetch_guidance`, `lookup_food_safety_requirement`) conforming to ADR-0256 + ADR-0258.

## Deliverables

### 1. Python stdio MCP server

Location: `services/lovsen-mattilsynet-mcp/`

Structure mirrors P1.S1a (lovdata-mcp). See PLAN-lovdata-mcp.md §Deliverables/1 for layout. Replace `lovdata_client.py` with `mattilsynet_client.py`. Tools dir contains 3 different tool files.

### 2. Tool contracts

- `search_regulation(query: str, scope: str | None = None, limit: int = 10) -> list[Citation]` — full-text search across regulations + circulars; scope filters to e.g. `'alkohol'` or `'hygiene'`
- `fetch_guidance(topic: str) -> Citation` — fetches a published guidance document (veiledning) by topic slug
- `lookup_food_safety_requirement(category: str) -> Citation` — fetches a specific food-safety requirement (allergener, kjølekjede, bevilling, etc.)

All return ADR-0256 `Citation` shape: `{lov, paragraph, verbatim_text, hash, fetched_at, source_url, ...}`. For Mattilsynet content where there's no `paragraph` (e.g. guidance docs), use `paragraph='guidance/{slug}'` or `paragraph='krav/{category}'` as canonical references.

### 3. Fixture mode

Per ADR-0258: `LOVSEN_MCP_FIXTURE=1` → all tools read from `src/fixtures/*.json`. 3 seed fixtures:
- `alkohol_servering_aldersgrense.json` (alkoholloven §1-5 — bevilling + aldersgrense)
- `allergener_pliktig_merking.json` (matinformasjonsforskriften §10 — 14 hovedallergener)
- `hygiene_temperatur_kjedge.json` (hygieneforskriften kjølekjede)

### 4. Rate limiting + caching

Same contract as P1.S1a (1 req/sec, 24h TTL, fs-cache fallback at `~/.cache/lovsen-mcp/mattilsynet/`).

## Tasks

- [ ] **T1.** Scaffold `services/lovsen-mattilsynet-mcp/` with pyproject.toml + requirements.txt + README.md
- [ ] **T2.** Implement `src/server.py` MCP stdio entrypoint — register 3 tools
- [ ] **T3.** Implement `src/mattilsynet_client.py` HTTP client with caching + rate-limit
- [ ] **T4.** Implement `src/parsers/` — Mattilsynet HTML/PDF → Citation JSON
- [ ] **T5.** Implement 3 tool files producing ADR-0256-compliant Citation JSON
- [ ] **T6.** Seed 3 fixture files (alkohol-aldersgrense, allergener-merking, hygiene-temperatur)
- [ ] **T7.** Implement `LOVSEN_MCP_FIXTURE=1` switch
- [ ] **T8.** Write 5 test files; all tests run in fixture mode
- [ ] **T9.** `pytest services/lovsen-mattilsynet-mcp/tests/ -v` — all pass
- [ ] **T10.** Verify stdio server boots: lists 3 tools
- [ ] **T11.** Mark both journeys verified, commit per logical unit

## Commit Plan

1. `feat(mattilsynet-mcp): scaffold services/lovsen-mattilsynet-mcp/ python pkg`
2. `feat(mattilsynet-mcp): stdio server + mattilsynet HTTP client + rate-limit`
3. `feat(mattilsynet-mcp): 3 tools (search_regulation, fetch_guidance, lookup_food_safety_requirement) per ADR-0256`
4. `feat(mattilsynet-mcp): fixture mode + 3 regulation seeds`
5. `test(mattilsynet-mcp): 5 test files exercising tools + fixture + Citation shape`
6. `docs(mattilsynet-mcp): mark P1.S1b journeys verified`

Co-author every commit:
```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Acceptance Criteria

- [ ] Both journeys `status: verified`
- [ ] `pytest` all pass with zero network calls
- [ ] Citation output conforms to ADR-0256 schema
- [ ] Fixture corpus covers alkohol + allergener + hygiene
- [ ] Rate limiter throttles to 1 req/sec
- [ ] No P1.S2+ scope leaks

## Out-of-Scope

- Full Mattilsynet corpus → P1.S2
- MCP registration in agent persona → P1.S3
- Botsson capability integration → P1.S4
- Live Mattilsynet API auth → Phase 7
