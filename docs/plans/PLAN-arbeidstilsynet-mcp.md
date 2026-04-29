---
title: "Plan — arbeidstilsynet-mcp"
feature: arbeidstilsynet-mcp
spec: ../../../smartout.ai/docs/agents/lovsen-agent/README.md
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [plan, lovsen, phase-1, p1-s1c, mcp, arbeidstilsynet]
---

# Plan — arbeidstilsynet-mcp (P1.S1c)

> Branch: `feat/lovsen-arbeidstilsynet-mcp` | Worktree: `~/dev/smartout.ai-lovsen-wt-3` | Module: MODULE_AGENT_SDK
> Phase 1, sub-sortie 1c (parallel with S1a/b/d, ~90 min). Stdio MCP for Arbeidstilsynet.no — workplace safety / HMS.

**Spec sources:**
- `~/dev/smartout.ai/docs/agents/lovsen-agent/README.md` — agent overview + MCP table
- `docs/decisions/0242-lovsen-citation-contract.md` — Citation shape
- `docs/decisions/0244-lovsen-mcp-boundary.md` — fixture mode + rate-limit (1 req/sec)
- `packages/lovsen-contract/src/citation.ts` — Zod schema

## Context

P1.S1c is one of 4 parallel MCP sub-sorties. Builds Python stdio MCP server with 2 tools against Arbeidstilsynet.no (Norwegian Labour Inspection Authority — HMS, vernetjeneste, vakt-rutiner, risikovurdering).

## Journeys

- [JOURNEY-arbeidstilsynet-mcp-server-starts-and-tools-respond](../journeys/JOURNEY-arbeidstilsynet-mcp-server-starts-and-tools-respond.md) — stdio server boots, lists 2 tools, both return structured JSON
- [JOURNEY-arbeidstilsynet-mcp-fixture-mode-replays](../journeys/JOURNEY-arbeidstilsynet-mcp-fixture-mode-replays.md) — fixture mode yields data, zero network, output conforms to ADR-0242

## Goal

Ship Python stdio MCP server `services/lovsen-arbeidstilsynet-mcp/` with 2 tools (`search_guidance`, `fetch_workplace_assessment_template`) conforming to ADR-0242 + ADR-0244.

## Deliverables

### 1. Python stdio MCP server

Location: `services/lovsen-arbeidstilsynet-mcp/`. Structure mirrors P1.S1a — see PLAN-lovdata-mcp.md §Deliverables/1.

### 2. Tool contracts

- `search_guidance(query: str, scope: str | None = None, limit: int = 10) -> list[Citation]` — full-text search Arbeidstilsynet veiledninger; scope can filter to e.g. `'hms'` or `'risikovurdering'` or `'arbeidstid'`
- `fetch_workplace_assessment_template(template_id: str) -> Citation` — fetches a specific risk-assessment template (vernetjeneste, brann, glassflasker, kjøkken-ergonomi) — returns Citation with `verbatim_text` containing the template body + `paragraph='template/{id}'`

All return ADR-0242 `Citation` shape.

### 3. Fixture mode

`LOVSEN_MCP_FIXTURE=1` → reads from `src/fixtures/*.json`. 3 seed fixtures:
- `hms_systematisk_arbeid.json` (Internkontrollforskriften §5 — systematisk HMS)
- `arbeidstid_natt_skift.json` (Aml. §10-3 + Arbeidstilsynet veiledning om nattarbeid)
- `risikovurdering_kjokken_template.json` (template for restaurant-kitchen risk assessment)

### 4. Rate limiting + caching

Same as P1.S1a (1 req/sec, 24h TTL, fs-cache at `~/.cache/lovsen-mcp/arbeidstilsynet/`).

## Tasks

- [ ] **T1.** Scaffold `services/lovsen-arbeidstilsynet-mcp/` (pyproject.toml + requirements.txt + README.md)
- [ ] **T2.** `src/server.py` MCP stdio entrypoint — register 2 tools
- [ ] **T3.** `src/arbeidstilsynet_client.py` HTTP client with caching + rate-limit
- [ ] **T4.** `src/parsers/` — HTML → Citation JSON
- [ ] **T5.** Implement 2 tool files producing ADR-0242-compliant JSON
- [ ] **T6.** Seed 3 fixture files (hms-systematisk, arbeidstid-natt, risikovurdering-kjokken)
- [ ] **T7.** `LOVSEN_MCP_FIXTURE=1` switch
- [ ] **T8.** 4 test files; all run in fixture mode
- [ ] **T9.** `pytest` all pass
- [ ] **T10.** Verify stdio server boots: lists 2 tools
- [ ] **T11.** Mark both journeys verified, commit per logical unit

## Commit Plan

1. `feat(arbeidstilsynet-mcp): scaffold services/lovsen-arbeidstilsynet-mcp/`
2. `feat(arbeidstilsynet-mcp): stdio server + arbeidstilsynet HTTP client + rate-limit`
3. `feat(arbeidstilsynet-mcp): 2 tools (search_guidance, fetch_workplace_assessment_template) per ADR-0242`
4. `feat(arbeidstilsynet-mcp): fixture mode + 3 guidance seeds`
5. `test(arbeidstilsynet-mcp): 4 test files exercising tools + fixture + Citation shape`
6. `docs(arbeidstilsynet-mcp): mark P1.S1c journeys verified`

Co-author every commit:
```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Acceptance Criteria

- [ ] Both journeys `status: verified`
- [ ] `pytest` all pass; zero network calls
- [ ] Citation output conforms to ADR-0242
- [ ] Fixture corpus covers HMS + arbeidstid + risikovurdering
- [ ] Rate limiter at 1 req/sec
- [ ] No P1.S2+ scope leaks

## Out-of-Scope

- Full Arbeidstilsynet corpus → P1.S2
- MCP registration in agent persona → P1.S3
- Capability integration → P1.S4
- Live Arbeidstilsynet API → Phase 7
