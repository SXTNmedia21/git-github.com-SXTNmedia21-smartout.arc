---
title: "Handoff — M3 Season Agent Capability"
status: complete
updated: 2026-04-23
created: 2026-04-23
module: year-wheel
feature: campaign/year-wheel M3 — season agent capability
tags: [handoff, m3, season, capability, agent, year-wheel]
---

# Handoff — M3 Season Agent Capability

> **Campaign:** campaign/year-wheel · **Milestone:** M3
> **ADR:** [ADR-0201](../decisions/0201-season-agent-capability.md)
> **Journey:** [JOURNEY-season-agent-capability.md](../journeys/JOURNEY-season-agent-capability.md)
> **Commits:** 699b1c95 (ADR) · 0b067401 (seed) · 0ac7e14f (capability+migrate) · c42f9576 (types delete)

## Summary

Registered 5 orphan season tools as first-class agent capabilities. Closed a CVE-class default-allow gap (ADR-0099 / L-0066 / L-0097) that affected 5 previously-unseeded capability keys. Migrated `SeasonToolContext` → `AgentToolContext` across all 5 tools; added `callGateAction` to the 3 mutating tools; kept the 2 read-only tools gate-free (per ADR-0196 Invariant 13 scope: mutations only, matching schedule + helpdesk_query precedent). `season.activate` (ADR-0200 Server Action surface) untouched. Intent classifier gained `"season"` enum member + disambiguation rule. `SeasonToolContext` type deleted after grep confirmed zero consumers.

## What was built

| File | Change |
|------|--------|
| `docs/decisions/0201-season-agent-capability.md` | ADR accepted with 12 falsifiable invariants |
| `supabase/migrations/20260518020000_season_agent_capability_authority_seed.sql` | 5 × workspace seed rows (30 total against 6 workspaces) |
| `packages/ai/src/capabilities/season/index.ts` | New `seasonCapability` umbrella CapabilityDefinition |
| `packages/ai/src/capabilities/season/gate.ts` | `callGateAction` helper (mirrors journey + shift-lifecycle) |
| `packages/ai/src/capabilities/registry.ts` | Register `season: seasonCapability` |
| `packages/ai/src/capabilities/types.ts` | `CapabilityName` extended with season + 5 dotted keys |
| `packages/ai/src/router/intent-classifier.ts` | `"season"` added to `z.enum` + disambiguation block in system prompt |
| `packages/ai/src/tools/season/{create,set-revenue,save-playbook,get-readiness,learn-factors}.ts` | Context migration + gateAction for mutators |
| `packages/ai/src/tools/season/types.ts` | **DELETED** |

## Decisions applied (from ADR-0201)

- **D1** 5 dotted keys with split authority (suggest/admin for 3 mutators, read_only/admin for 2 reads)
- **D2** Full context migration to `AgentToolContext` (Option A)
- **D3** Single `CapabilityDefinition{name: "season"}` umbrella (journey pattern)
- **D4** `gateAction` only on mutations (Invariant 13 scope)
- **D5** Voice bridges deferred (Option C — multi-turn voice wizard is M5)
- **D6** `emitPrefix: "season"` reserved
- **D7** Intent classifier enum + disambiguation text
- **D8** Authority seed migration before code (ordering per ADR-0176)
- **D9** `collectedData` migration safe (zero tools read it)

## Pre-acceptance resolutions (5 architect questions code-traced)

- **Q-A** Journey uses one `CapabilityDefinition{name: "journey"}`. Season mirrors.
- **Q-B** RLS policies exist on season tables; `supabaseAdmin` bypass safe because tools already explicit-filter `workspace_id`.
- **Q-C** Invariant 13 is mutation-only. Schedule + helpdesk_query read tools skip `gateAction`.
- **Q-D** `season.activate` orphan authority row is low-risk — tool-selector returns `[]` for unregistered capabilities.
- **Q-E** Zero season tools read `ctx.collectedData`. Migration safe.

## Learnings

- **Pre-acceptance code-trace can substitute for full council** when architect's open questions are all code-traceable (no philosophical disagreement, no contested priorities). Saved ~30 min vs. dispatching 4 reviewers for decisions that had single right answers in the codebase.
- **Invariant 13 scope is clearer than the wording suggests.** "gateAction on every mutation capability" reads like all-tools-every-time; reality is mutations only, as demonstrated by the schedule + helpdesk_query precedents (5 read tools each, zero gateAction). The ADR-0196 text should probably be reinforced with this clarification in a future amendment.
- **L-0114 continues to hold** for capability wiring: disjoint seed keys (season.activate vs season.create etc.) don't require cutover even when they share a namespace prefix.

## Known issues / debt

### Shipped in scope

- **Voice bridges deferred for mutation tools.** Documented in ADR-0201 D5. M5-class work (voice wizard UX).
- **Read-tool voice bridges deferred.** Candidate for M4 sub-sortie — `get_readiness` and `learn_factors` are single-shot queries.
- **`emitPrefix: "season"` reserved but no events registered.** M4 will wire per-tool emit sites; Phase 2.5 fact-check must grep telemetry registry before events are used.

### Pre-existing gaps (NOT introduced by M3)

- **Authority-seed-parity still fails** on `contract` (apps/web/api/employment-contracts/bulk/route.ts:133), `memory` (packages/ai/src/capabilities/memory/tools.ts:73), `x` (test fixture). These existed on development; M3 does not address.
- **`season.activate` orphan authority row.** Low-risk (tool-selector cannot route), but conceptually a phantom row until either a capability tool is registered (future) or the row is re-scoped (unlikely).

### Out of M3 scope (tracked for M4)

- `SeasonGoalsTab` + `SeasonProceduresTab` in `_deferred/` (L-0074 P1 deferrals).
- Activation checklist gate.
- Archive/Duplicate actions on Season page.
- Seeded pill state.

## Verification state at handoff

| Gate | Result |
|------|--------|
| `pnpm turbo typecheck` | 35/35 green |
| `pnpm tsx scripts/authority-seed-parity.ts` for `season.*` (5 capabilities) | All paired (literals ↔ seed rows) |
| SQL smoke test (seed rows) | 30 rows (5 capabilities × 6 workspaces) |
| I1–I12 invariants | All verified via grep / SQL / code-review |
| ADR-0201 status | accepted, registered in decision log |

## Next steps

### M4 — P1 deferrals (L-0074)

- Activate/Archive/Duplicate CTAs on Season page
- Activation checklist pre-gate
- Move Goals + Procedures tabs out of `_deferred/`
- Seeded pill on SeasonSidebar

### Optional M3.5 (if prioritized)

- Thin voice bridge for `season.get_readiness` + `season.learn_factors`
- Client-side bridge at `apps/web/src/app/dashboard/year-wheel/_components/season-voice-tools-bridge.tsx`
- Register via `useRegisterTools("season", kit)` on year-wheel page

### M4 telemetry

- Wire emit sites under reserved `"season"` prefix for mutator tools (per-tool events under `season created`, `season playbook_saved` etc.)
- Register in `packages/telemetry/src/registry.ts` + `EVENT_ROUTING` table (interface + routing, L-0083 same-commit rule)

## Credits

Architect: feature-dev:code-architect (single round, no redesign needed). Code-trace verification: Explore agent. Build: single build agent (3 commits, tightly coupled). Orchestrator: Pontus + Claude Opus 4.7.
