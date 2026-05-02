---
title: "Handoff — lovsen-foundation"
feature: lovsen-foundation
branch: feat/lovsen-lovsen-foundation
closed: 2026-04-29
module: MODULE_AGENT_SDK
tags: [handoff, lovsen, phase-1, p1-s0]
---

# Handoff — lovsen-foundation (P1.S0)

## Summary

Foundation sub-sortie for the Lovsen agent campaign. Built `@smartout/lovsen-contract` (5 Zod-backed types: Citation, Confidence, LovsenAnswer, ValidationResult, ClassificationResult), registered 9 telemetry events under `category: 'lovsen'`, and locked 4 foundation ADRs (0238-0241). Pure type/registration/decision boundary — no user-visible runtime. Unblocks P1.S1a-d (4 stdio MCPs), P1.S2 (knowledge base), P1.S3 (skills + persona), P1.S4 (Botsson capability).

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| contract-package-builds | verified | none — covered by 32 internal Zod parse tests |
| telemetry-events-registered | verified | none — covered by 48 new lovsen-events tests |
| foundation-adrs-locked | verified | n/a (docs-only journey) |

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| ADR-0256 — Lovsen Citation Contract | Legal-grade provenance: every Lovsen answer cites verbatim paragraph with sha256 hash + ISO-8601 fetched_at + source URL | Locks the JSON shape that downstream MCPs (P1.S1a-d) and capability layer (P1.S4) must produce; rules out hallucinated paragraph numbers |
| ADR-0257 — Lovsen Confidence Model | Persona uses HØY/MEDIUM/LAV labels; downstream code needs comparable numeric score | Dual representation locked into Confidence type — both fields required, derived from {citations.length, freshness, missing_data}, never written by hand |
| ADR-0258 — Lovsen MCP Boundary | Separation-of-concerns: 4 stdio MCPs own paragraph fetch; capability never scrapes. Fixture mode required for offline CI tests. Rate-limit 1 req/sec per source | P1.S1a-d implementations must support fixture replay; capability layer (P1.S4) never reaches outside its own process |
| ADR-0259 — Lovsen Capability Authority | "Confident ≠ authorized" — legal advice requires explicit C4 gate; voice channel forbidden (ADR-0078) | `industry_intelligence.lovsen_query` capability gets default-deny C4 authority seed in P1.S4; chat-only enforcement at capability + tool layers |

All 4 ADRs registered in `docs/decisions/0000-decision-log.md` (4 new top rows, count bumped to 100).

## Learnings

| Learning | Context |
|----------|---------|
| ADR slot allocation must be re-checked at write-time | Plan declared 0181-0184 but campaign/lovsen was 56 ADRs behind development (0181 already taken by contract-management-redesign). Builder agent caught the collision and renumbered to 0238-0241. Lesson: campaigns with low `vs origin/development` lag can use planned ADR slots; long-lived campaigns must re-verify free slots at sub-sortie close-time. |
| New packages need explicit `pnpm install` after package.json creation | Post-write typecheck hook fired `npx tsc` before node_modules was populated. Hook kept blocking new Writes until install ran. For future package scaffolds: run `pnpm install` from worktree root immediately after writing package.json, before any further file writes in that package. |
| Smoke-import tests across packages need explicit dep declaration | Tried to add `lovsen-import-smoke.ts` in `packages/ai/src/` to verify cross-package import works — failed because `@smartout/ai` doesn't list `@smartout/lovsen-contract` as a dep, and adding it would pollute the ai package permanently. Workspace-internal `__tests__/` parse tests are sufficient; cross-package import verification belongs in the consumer's own sub-sortie (P1.S4 in this case). |
| Telemetry registry has dual update sites | `EventName` union and `Record<EventName, EventMeta>` literal both need updating when adding events. Updating only one causes TS2740 "missing properties" error. The hook caught it; check both sites simultaneously. |

## Known Issues / Debt

- **No engine_event routing on lovsen events** — by design, P1.S0 routes only to `['posthog','log','activity_trail']`. P1.S4 (Botsson capability) adds `engine_event` routing for orchestration once the capability is wired.
- **No fixture data for MCPs yet** — ADR-0258 requires fixture mode but the fixture corpus lives in P1.S2. Each MCP sub-sortie (P1.S1a-d) must produce its own fixture seeds; merge corpus comes in P1.S2.
- **`industry_intelligence.lovsen_query` capability authority seed not in DB** — ADR-0259 specifies the seed but the migration to `engine_authority_config` lands in P1.S4.
- **Contract pkg has both `src/` and `dist/` test runs (64 total = 32 src + 32 dist)** — vitest picks both up after build. Not wrong but worth noting; future runs without `pnpm build` first will show 32 tests instead of 64.

## Next Steps

1. **Spawn P1.S1a-d in parallel** — 4 sub-sorties off updated `campaign/lovsen` (after this merges):
   - `feat/lovsen-lovdata-mcp` (Lovdata stdio MCP — fetch_paragraph, search_law, get_law_metadata)
   - `feat/lovsen-mattilsynet-mcp` (Mattilsynet — search_regulation, fetch_guidance, lookup_food_safety_requirement)
   - `feat/lovsen-arbeidstilsynet-mcp` (Arbeidstilsynet — search_guidance, fetch_workplace_assessment_template)
   - `feat/lovsen-nho-reiseliv-mcp` (NHO Reiseliv — fetch_riksavtalen, lookup_tariff_supplement)
   Each MCP implements ADR-0258 (boundary + fixture mode), produces JSON conforming to ADR-0256 Citation shape.
2. **P1.S2 — Knowledge base** sequential after MCPs (Aml + ferielov + OTP + folketrygd snapshots + Riksavtalen 2024+2025 + 15-case test-corpus).
3. **P1.S3 — Skills + Persona** sequential after KB (3 core skills + Lovsen persona file at `.claude/agents/lovsen.md`).
4. **P1.S4 — Botsson capability** sequential after Skills (`industry_intelligence.lovsen_query` capability + C4 authority seed + intent routing + engine_event wiring).
5. **Phase 1 closure: 3 verifiable backend journeys** — `validate-contract`, `draft-contract`, `classify-amendment` end-to-end.

Phase 1 ETA per faseplan: ~8-10 hours agent-time, 1-2 calendar days.
