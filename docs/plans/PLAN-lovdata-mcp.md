---
title: "Plan — lovdata-mcp"
feature: lovdata-mcp
spec: ../../../smartout.ai/docs/agents/lovsen-agent/README.md
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [plan, lovsen, phase-1, p1-s1a, mcp, lovdata]
---

# Plan — lovdata-mcp (P1.S1a)

> Branch: `feat/lovsen-lovdata-mcp` | Worktree: `~/dev/smartout.ai-lovsen-wt-1` | Module: MODULE_AGENT_SDK
> Phase 1, sub-sortie 1a (parallel with S1b/c/d, ~90 min). Stdio MCP for Lovdata.no — Norwegian law text.

**Spec sources:**
- `~/dev/smartout.ai/docs/agents/lovsen-agent/README.md` — agent overview + MCP table
- `docs/decisions/0242-lovsen-citation-contract.md` — output JSON shape (Citation: lov, paragraph, ledd, verbatim_text, hash, fetched_at, source_url, law_version)
- `docs/decisions/0244-lovsen-mcp-boundary.md` — fixture mode + rate-limit (1 req/sec) requirements
- `packages/lovsen-contract/src/citation.ts` — Zod schema MCP output must conform to (validated by capability layer in P1.S4)

## Context

P1.S1a is one of 4 parallel MCP sub-sorties. Builds Python stdio MCP server exposing 3 tools against Lovdata.no (Norwegian law database). Output must conform to ADR-0256 `Citation` JSON shape so capability layer (P1.S4) can `Citation.parse()` MCP responses.

## Journeys (the contract — dev-acceptance scope)

- [JOURNEY-lovdata-mcp-server-starts-and-tools-respond](../journeys/JOURNEY-lovdata-mcp-server-starts-and-tools-respond.md) — stdio server boots, lists 3 tools, each tool returns structured JSON
- [JOURNEY-lovdata-mcp-fixture-mode-replays](../journeys/JOURNEY-lovdata-mcp-fixture-mode-replays.md) — `LOVSEN_MCP_FIXTURE=1` env yields fixture data, zero network calls, output conforms to ADR-0256 Citation shape

## Goal

Ship a Python stdio MCP server `services/lovsen-lovdata-mcp/` with 3 tools (`fetch_paragraph`, `search_law`, `get_law_metadata`) conforming to ADR-0256 + ADR-0258.

## Deliverables

### 1. Python stdio MCP server

Location: `services/lovsen-lovdata-mcp/`

Structure:
```
services/lovsen-lovdata-mcp/
├── README.md                        (purpose, install, fixture mode, rate-limit)
├── pyproject.toml                   (Python 3.10+, dependencies pinned)
├── requirements.txt                 (mcp, httpx, beautifulsoup4, pydantic, pytest)
├── src/
│   ├── __init__.py
│   ├── server.py                    (MCP entrypoint — stdio transport, tool registry)
│   ├── lovdata_client.py            (HTTP client + caching + rate-limit)
│   ├── parsers/
│   │   └── paragraph.py             (HTML → Citation JSON)
│   ├── fixtures/                    (small seed corpus for offline tests; full corpus comes in P1.S2)
│   │   ├── aml_14_6.json            (Aml. §14-6 fixture — drives validate-contract journey)
│   │   ├── aml_15_3.json            (Aml. §15-3 fixture — notice periods)
│   │   └── aml_15_6.json            (Aml. §15-6 fixture — trial periods)
│   └── tools/
│       ├── fetch_paragraph.py       (tool 1: fetch a specific paragraph by law+id)
│       ├── search_law.py            (tool 2: full-text search within a law)
│       └── get_law_metadata.py      (tool 3: law version + last updated date)
└── tests/
    ├── test_fetch_paragraph.py
    ├── test_search_law.py
    ├── test_get_law_metadata.py
    ├── test_fixture_mode.py
    └── test_citation_shape.py       (validates output against ADR-0256 contract)
```

### 2. Tool contracts

All tools return JSON conforming to ADR-0256 `Citation` schema. Required fields: `lov`, `paragraph`, `verbatim_text`, `hash` (sha256 of verbatim_text), `fetched_at` (ISO-8601), `source_url`. Optional: `ledd`, `bokstav`, `law_version`.

- `fetch_paragraph(lov: str, paragraph: str, ledd: str | None = None) -> Citation` — fetches one paragraph; raises if not found
- `search_law(query: str, lov: str | None = None, limit: int = 10) -> list[Citation]` — full-text search; returns ranked Citations
- `get_law_metadata(lov: str) -> dict` — returns `{ name, version, last_updated, total_paragraphs, source_url }`

### 3. Fixture mode

Per ADR-0258: `LOVSEN_MCP_FIXTURE=1` env var → all tools read from `src/fixtures/*.json` instead of HTTP. Required for CI tests (no network). 3 fixture files seeded for journey-test coverage; P1.S2 expands to full corpus.

### 4. Rate limiting

Per ADR-0258: 1 req/sec per source domain. Use `httpx` + asyncio + token bucket. Logs throttle events at WARN.

### 5. Caching

24h TTL per paragraph (via in-memory dict + filesystem fallback to `~/.cache/lovsen-mcp/lovdata/`). Cache key = sha256(law + paragraph + ledd).

## Tasks

- [ ] **T1.** Scaffold `services/lovsen-lovdata-mcp/` with pyproject.toml + requirements.txt + README.md
- [ ] **T2.** Implement `src/server.py` MCP stdio entrypoint — register 3 tools, handle JSON-RPC via stdin/stdout
- [ ] **T3.** Implement `src/lovdata_client.py` HTTP client with caching + rate-limit
- [ ] **T4.** Implement `src/parsers/paragraph.py` — Lovdata HTML → Citation JSON
- [ ] **T5.** Implement 3 tool files; each must produce ADR-0256-compliant Citation JSON
- [ ] **T6.** Seed 3 fixture files (Aml. §14-6, §15-3, §15-6 — full verbatim text + hash + dummy fetched_at)
- [ ] **T7.** Implement `LOVSEN_MCP_FIXTURE=1` switch in client (no HTTP calls when set)
- [ ] **T8.** Write 5 test files; all tests run in fixture mode (CI-friendly)
- [ ] **T9.** Verify `python -m pytest services/lovsen-lovdata-mcp/tests/ -v` — all pass
- [ ] **T10.** Verify stdio server boots: `python -m services.lovsen_lovdata_mcp.server` reads JSON-RPC, lists 3 tools
- [ ] **T11.** Mark both journeys verified, commit per logical unit, commit-and-stop (no MCP registration in agent .mcp.json — that's P1.S4)

## Commit Plan

1. `feat(lovdata-mcp): scaffold services/lovsen-lovdata-mcp/ python pkg`
2. `feat(lovdata-mcp): stdio server + lovdata HTTP client + rate-limit`
3. `feat(lovdata-mcp): 3 tools (fetch_paragraph, search_law, get_law_metadata) per ADR-0256`
4. `feat(lovdata-mcp): fixture mode (LOVSEN_MCP_FIXTURE) + 3 paragraph seeds`
5. `test(lovdata-mcp): 5 test files exercising tools + fixture + Citation shape`
6. `docs(lovdata-mcp): mark P1.S1a journeys verified`

Co-author every commit:
```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Acceptance Criteria

- [ ] Both declared journeys have `status: verified` in frontmatter
- [ ] `pytest services/lovsen-lovdata-mcp/tests/ -v` all pass (zero network calls in CI)
- [ ] Citation JSON output validates against `packages/lovsen-contract/src/citation.ts` Zod schema (verified via test_citation_shape.py loading the schema definition or duplicating the shape contract)
- [ ] Fixture mode covers Aml. §14-6, §15-3, §15-6 — minimum corpus for downstream `validate-contract` journey
- [ ] Rate limiter throttles to 1 req/sec
- [ ] No real Lovdata HTTP calls in tests (use httpx_mock or fixture-mode-only)
- [ ] No P1.S2+ scope leaks (no full corpus, no MCP registration in agent .mcp.json, no capability runtime)

## Out-of-Scope (deferred to later sub-sorties)

- Full Aml + ferielov + OTP + folketrygd corpus → P1.S2
- 15-case test-corpus (regression) → P1.S2
- MCP registration in `.claude/agents/lovsen.md` `tools:` field → P1.S3
- Botsson capability `industry_intelligence.lovsen_query` integration → P1.S4
- Live Lovdata API auth → Phase 7
