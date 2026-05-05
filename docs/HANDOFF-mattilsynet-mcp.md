---
title: "Handoff — mattilsynet-mcp"
feature: mattilsynet-mcp
branch: feat/lovsen-mattilsynet-mcp
closed: 2026-04-29
module: MODULE_AGENT_SDK
tags: [handoff, lovsen, phase-1, p1-s1b, mcp, mattilsynet]
---

# Handoff — mattilsynet-mcp (P1.S1b)

## Summary

Second of 4 MCP sub-sorties for the Lovsen agent campaign. Built Python stdio MCP server `services/lovsen-mattilsynet-mcp/` with 3 tools (`search_regulation`, `fetch_guidance`, `lookup_food_safety_requirement`) producing JSON conforming to ADR-0256 Citation shape. Fixture mode honored per ADR-0258 — `LOVSEN_MCP_FIXTURE=1` blocks all outbound HTTP at `mattilsynet_client.fetch_url()` entry. 61 pytest tests pass, zero network. Foundation complete for hospitality food-safety queries (alkoholservering, allergener, hygiene).

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| server-starts-and-tools-respond | verified | none — covered by 32 internal pytest tests + manual stdio smoke |
| fixture-mode-replays | verified | none — covered by `test_fixture_mode.py` (9 tests) + RuntimeError network guard |

## Decisions Made

No new ADRs. Implementation follows existing foundation ADRs:
- ADR-0256 (Citation Contract) — Pydantic Citation model mirrored verbatim from `services/lovsen-lovdata-mcp/src/citation.py`
- ADR-0258 (MCP Boundary) — fixture mode + 1 req/sec rate-limit + 24h cache at `~/.cache/lovsen-mcp/mattilsynet/`

## Learnings

| Learning | Context |
|----------|---------|
| Mattilsynet has no traditional paragraph numbers for guidance docs | Use `paragraph='guidance/{slug}'` or `paragraph='krav/{category}'` as canonical reference. Fixtures store the actual regulation slug (e.g. `"alkoholloven §1-5"`) since they reference back to law text. Tools in live mode use `krav/` prefix. Test assertions must distinguish fixture-mode (slug-as-stored) vs live-mode (`krav/`-prefixed). |
| Tool aliases boost LLM discoverability | `fetch_guidance` accepts 6 canonical topic slugs + 3 common aliases (e.g. `"alkohol-bevilling"` → `alkohol_servering_aldersgrense`). Reduces friction when downstream agent (Lovsen) doesn't know the exact slug. Pattern useful for remaining MCPs (P1.S1c/d). |
| Per-source fixture-mode RuntimeError guard is the cleanest CI block | Same as P1.S1a — `mattilsynet_client.fetch_url()` raises `RuntimeError` BEFORE httpx is opened when `LOVSEN_MCP_FIXTURE=1`. No mock library needed. 9 fixture-mode tests + 3 separate per-tool tests verify the guard fires at every entry point. |

## Known Issues / Debt

- **Fixtures are PLACEHOLDER text** — accurate Norwegian regulatory summaries written for the 3 hospitality scenarios (alkoholservering, allergener, hygiene), but NOT verbatim from Mattilsynet.no. Hash = sha256(placeholder text). Requires P1.S2 verbatim replacement before live `validate-contract` or `compliance-sjekk` flows touch this corpus
- **`paragraph` shape inconsistency between fixture and live modes** — fixtures store regulation slugs (`"alkoholloven §1-5"`), live mode uses `"krav/{category}"`. Tests pass in both modes but consumers of the Citation must accept either form. P1.S2 can normalize OR P1.S4 capability can post-process
- **No real Mattilsynet HTTP path tested** — fixture mode covers all CI scenarios; first real network call happens in P1.S2 dev-time corpus seeding or P1.S4 capability runtime
- **6 canonical topic slugs hardcoded in `fetch_guidance.py`** — drift risk if Mattilsynet site changes URL structure. P1.S2 should externalize to a YAML/JSON manifest

## Next Steps

1. **P1.S1c — arbeidstilsynet-mcp** (full re-dispatch from plan-only state at wt-3) — apply same pattern: copy `citation.py` from lovdata-mcp, mirror fixture-mode RuntimeError guard, add no-op package.json for turbo typecheck gate
2. **P1.S1d — nho-reiseliv-mcp** (full re-dispatch from plan-only state at wt-4) — same pattern + version-routing for Riksavtalen 2024+2025
3. After all 4 MCPs ship: **P1.S2 — Knowledge base** — replace PLACEHOLDER fixtures with verbatim content from each authority; expand corpus; add 15-case test-corpus
4. **P1.S3 — Skills + Persona** — port `lovsen.md` to `.claude/agents/lovsen.md`; build 3 core skills
5. **P1.S4 — Botsson capability** — `industry_intelligence.lovsen_query` + C4 authority seed + intent routing
