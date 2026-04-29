---
title: "Handoff — nho-reiseliv-mcp"
feature: nho-reiseliv-mcp
branch: feat/lovsen-nho-reiseliv-mcp
closed: 2026-04-29
module: MODULE_AGENT_SDK
tags: [handoff, lovsen, phase-1, p1-s1d, mcp, nho-reiseliv, riksavtalen]
---

# Handoff — nho-reiseliv-mcp (P1.S1d)

## Summary

Final of 4 MCP sub-sorties for the Lovsen agent campaign. Built Python stdio MCP server `services/lovsen-nho-reiseliv-mcp/` with 2 tools (`fetch_riksavtalen`, `lookup_tariff_supplement`) producing JSON conforming to ADR-0242 Citation shape. Version-aware lookup mandatory per ADR-0244 + Lovsen agent README §5: 2024 vs 2025 fixtures have distinct verbatim_text and distinct hash; tools require explicit version arg, no silent fallback. Fixture mode honored — `LOVSEN_MCP_FIXTURE=1` blocks all outbound HTTP at `nho_reiseliv_client.fetch_url()` entry. 52 pytest tests pass, zero network. All 4 Phase 1 MCPs now ship.

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| server-starts-and-tools-respond | verified | none — covered by 25+ pytest tests + manual stdio smoke |
| fixture-mode-replays | verified | none — covered by `test_fixture_mode.py` + 3 separate RuntimeError network guards |

## Decisions Made

No new ADRs. Implementation follows ADR-0242 (Citation Contract) + ADR-0244 (MCP Boundary). Version-routing enforcement is a tool-layer contract derived from agent README §Operasjonelle-prinsipper §5 ("Versjons-bevissthet").

## Learnings

| Learning | Context |
|----------|---------|
| Fixture filename `§` chars are non-portable across OSes | Plan listed `riksavtalen_2024_§6_kveldstillegg.json` but `§` (U+00A7) breaks on Windows volumes and confuses some tooling. Builder normalized to `(version, category)` tuple keys in the fixture loader and used ASCII-only filenames. Pattern: avoid Unicode in filesystem paths even when the underlying domain text is Norwegian. |
| `test_version_routing.py` is the load-bearing test for this MCP | 12 dedicated tests prove: 2024 hash ≠ 2025 hash per category, asking 2024 returns 25%/NOK 38 000, asking 2025 returns 27%/NOK 40 500, no silent fallback on unsupported version. This is the test that catches the highest-impact compliance bug class for Lovsen — telling an admin "2024 rates apply" when 2025 rates actually do. Future MCPs that gain version-aware semantics should adopt this test pattern. |
| Triple-coverage RuntimeError guard pattern is now canonical | `nho_reiseliv_client.fetch_url()` (direct), `test_fetch_riksavtalen_page_raises_in_fixture_mode` (page-level), `test_fetch_riksavtalen_no_network_in_fixture_mode` (tool-layer). Same triple seen in P1.S1c arbeidstilsynet. Apply to P1.S2 corpus expansion when adding new fetch paths. |

## Known Issues / Debt

- **Fixture rates are PLACEHOLDER** — taken from documented 2024/2025 agreement changes (kveldstillegg 25%→27%, garantilønn NOK 38000→40500), NOT live-fetched from nhoreiseliv.no. Live fetch is Phase 7. P1.S2 must verify these numbers against the actual published Riksavtalen 2024 + 2025 documents before downstream `validate-contract` or `draft-contract` journeys produce contract text from them
- **Hash differs but text content depth is shallow** — placeholder verbatim_text covers the rate change but not the surrounding paragraph context (full §6.1 covers definitions, scope, exceptions). P1.S2 should expand to full paragraph text, not just rate-line
- **Only 2 categories seeded (kveldstillegg + garantilønn)** — production needs helgetillegg, nattillegg, lærling-sats minimum. P1.S2 corpus expansion adds these
- **No real NHO Reiseliv HTTP path tested** — fixture mode covers all CI scenarios; first real network call happens in P1.S2 dev-time corpus seeding or Phase 7 live API auth

## Next Steps

1. **All 4 MCPs are now shipped.** Phase 1 sub-sortie cluster S1 complete.
2. **P1.S2 — Knowledge base** — replace ALL PLACEHOLDER fixtures across 4 MCPs with verbatim content; expand corpus; add 15-case test-corpus per agent README
3. **P1.S3 — Skills + Persona** — port `lovsen.md` to `.claude/agents/lovsen.md`; build aml-14-6-validator + amendment-classifier + contract-drafter skills
4. **P1.S4 — Botsson capability** — `industry_intelligence.lovsen_query` + C4 authority seed + intent routing + engine_event wiring
5. **Phase 1 closes** with 3 verifiable backend journeys (validate-contract, draft-contract, classify-amendment) end-to-end
