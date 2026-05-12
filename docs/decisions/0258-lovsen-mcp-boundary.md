---
title: "Lovsen MCP Boundary — 4 stdio MCPs own paragraph fetch; capability never scrapes"
id: ADR_0258
status: accepted
accepted_at: 2026-04-29
layer: decision
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [lovsen, mcp, boundary, adr, p1-s0]
related_adrs: [ADR-0256, ADR-0257]
---

# ADR-0258: Lovsen MCP Boundary

## Context and Problem Statement

Lovsen must cite live paragraph text to satisfy ADR-0256 (Citation Contract). The question is: where does the fetch happen? The capability layer could scrape Lovdata directly, or use dedicated MCP servers as a controlled boundary. Norwegian law sources (Lovdata, Mattilsynet, Arbeidstilsynet, NHO Reiseliv) have terms of service, rate limits, and occasionally require authentication. Keeping scraping logic inside the capability means it travels with every deployed capability instance and is harder to cache, rate-limit, version, and swap. CI and offline tests also need a reliable way to run without hitting live sources.

## Decision Drivers

- Separation of concerns: law-text fetching is not a capability concern; it is a data-access concern
- Rate-limit respect: each source allows maximum 1 request/sec; centralized enforcement is safer than per-capability enforcement (per `docs/agents/lovsen-agent/README.md` §Hvorfor MCP-servere)
- Repeatable CI: tests must be runnable without network access; fixture mode required
- Cache coherence: 24h TTL per paragraph per MCP server — a single cache per server is simpler than per-capability caches
- Versioned lookup: law text changes over time; MCP servers handle version-aware fetching; capability layer never interprets version headers directly

## Considered Options

1. **Capability-level scraping** — capability layer fetches directly from Lovdata/Mattilsynet/etc.
2. **4 stdio MCPs as boundary** (chosen) — dedicated MCP servers per source handle all network I/O; capability layer calls MCP tools only
3. **Shared proxy service** — single HTTP service wrapping all 4 sources, capability calls internal API

## Decision Outcome

Chosen option: **4 stdio MCPs as boundary**, because it matches the Claude Code MCP model already in use for other data sources (telegram, bubble), provides per-source isolation, and is the architecture already described in the Lovsen agent spec.

The 4 MCP servers (implemented in P1.S1a-d) and their tools:

| MCP server | Source | Tools |
|---|---|---|
| `lovdata` | lovdata.no | `fetch_paragraph`, `search_law`, `get_law_metadata` |
| `mattilsynet` | mattilsynet.no | `search_regulation`, `fetch_guidance`, `lookup_food_safety_requirement` |
| `arbeidstilsynet` | arbeidstilsynet.no | `search_guidance`, `fetch_workplace_assessment_template` |
| `nho-reiseliv` | nhoreiseliv.no | `fetch_riksavtalen`, `lookup_tariff_supplement` |

**Fixture mode requirement:** Each MCP server MUST support a `LOVSEN_FIXTURE_MODE=true` env var that returns fixture data from `knowledge/laws/` and `knowledge/collective-agreements/` without network I/O. This is the mode used in CI and offline tests (P1.S2 knowledge base provides the fixtures).

## Rules & Consequences

- **Good, because** rate limiting (1 req/sec per source) is enforced at the MCP server level — capability tools call `mcp__lovdata__fetch_paragraph(...)` and do not need to track request rates themselves
- **Good, because** fixture mode enables deterministic CI; no network calls from `pnpm test`
- **Bad, because** adding a new law source requires a new MCP server (P1.S1x) — cannot hot-patch with a capability-level scraper as a quick fix
- **Agent Impact:** P1.S1a-d sub-sorties build the 4 MCP servers. The capability layer (P1.S4) calls MCP tools via `mcp__<server>__<tool>` syntax. Direct HTTP calls to Lovdata/Mattilsynet from capability code are FORBIDDEN. All MCP fetch attempts emit `lovsen.mcp.fetch` + `lovsen.mcp.fetch.completed` or `lovsen.mcp.fetch.failed` (registered in ADR-0256 telemetry).

---

> Registered in `docs/decisions/0000-decision-log.md`. Cross-reference: ADR-0256 (Lovsen Citation Contract), ADR-0257 (Lovsen Confidence Model).
