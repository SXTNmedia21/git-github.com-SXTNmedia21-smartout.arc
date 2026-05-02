---
title: "Handoff — arbeidstilsynet-mcp"
feature: arbeidstilsynet-mcp
branch: feat/lovsen-arbeidstilsynet-mcp
closed: 2026-04-29
module: MODULE_AGENT_SDK
tags: [handoff, lovsen, phase-1, p1-s1c, mcp, arbeidstilsynet]
---

# Handoff — arbeidstilsynet-mcp (P1.S1c)

## Summary

Third of 4 MCP sub-sorties for the Lovsen agent campaign. Built Python stdio MCP server `services/lovsen-arbeidstilsynet-mcp/` with 2 tools (`search_guidance`, `fetch_workplace_assessment_template`) producing JSON conforming to ADR-0256 Citation shape. Fixture mode honored per ADR-0258 — `LOVSEN_MCP_FIXTURE=1` blocks all outbound HTTP at `arbeidstilsynet_client.fetch_url()` entry. 40 pytest tests pass, zero network. Foundation complete for HMS, arbeidstid, and risikovurdering queries.

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| server-starts-and-tools-respond | verified | none — covered by 20+ pytest tests + manual stdio smoke |
| fixture-mode-replays | verified | none — covered by `test_fixture_mode.py` + 3 separate RuntimeError network guards |

## Decisions Made

No new ADRs. Implementation follows ADR-0256 (Citation Contract) + ADR-0258 (MCP Boundary).

## Learnings

| Learning | Context |
|----------|---------|
| `fixtures.py` module + `fixtures/` subdir co-exist cleanly | Existing partial scaffold had `fixtures.py` as a module (loader/router) referencing `Path(__file__).parent / "fixtures"` for JSON files. Agent kept the module + created the subdirectory. Two-file naming co-existence works because Python imports `fixtures` (module) but file discovery walks `fixtures/` (subdir). Pattern usable for any MCP wanting explicit fixture-loader logic separate from raw JSON. |
| Per-source RuntimeError guard tested at 3 different call sites | `test_fetch_url_raises_in_fixture_mode` (direct call), `test_network_guard_in_fixture_mode` (tool→client path), `test_network_not_called_for_known_template` (tool happy path that should NOT trigger network). Triple-coverage catches both regressions in the guard AND tools that bypass the client. Apply pattern to remaining MCPs. |
| Arbeidstilsynet has 2 tools vs Lovdata/Mattilsynet's 3 | Per agent README, arbeidstilsynet exposes only `search_guidance` + `fetch_workplace_assessment_template`. No third "metadata" tool. Tests file count adjusts accordingly (4 files not 5). |

## Known Issues / Debt

- **Fixtures are PLACEHOLDER text** — accurate Norwegian regulatory framing for HMS, arbeidstid, and risikovurdering scenarios, but NOT verbatim from Arbeidstilsynet.no. Hash = sha256(placeholder text). Requires P1.S2 verbatim replacement before live `compliance-sjekk` or HMS-related flows touch this corpus
- **No real Arbeidstilsynet HTTP path tested** — fixture mode covers all CI scenarios; first real network call happens in P1.S2 dev-time corpus seeding or P1.S4 capability runtime
- **Template body retrieval is fixture-only** — `fetch_workplace_assessment_template` returns Citation with full template body in `verbatim_text`. Live mode would need a parser for Arbeidstilsynet's downloadable templates (PDF/DOCX). Live-mode parser deferred to P1.S2

## Next Steps

1. **P1.S1d — nho-reiseliv-mcp** (full re-dispatch from plan-only state at wt-4) — final MCP. Same pattern + version-routing for Riksavtalen 2024 vs 2025
2. After P1.S1d ships: **P1.S2 — Knowledge base** — replace ALL PLACEHOLDER fixtures (lovdata + mattilsynet + arbeidstilsynet + nho-reiseliv) with verbatim content; expand corpus; add 15-case test-corpus
3. **P1.S3 — Skills + Persona** — port `lovsen.md` to `.claude/agents/lovsen.md`; build 3 core skills
4. **P1.S4 — Botsson capability** — `industry_intelligence.lovsen_query` + C4 authority seed + intent routing
