---
title: "BOTSSON-SYSTEM-MAP Staleness Cycle"
id: LEARNING_0150
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [docs, system-map, staleness, council-process, run-council, fact-check, botsson, l-0138, l-0083, audit-inflation]
occurrence_count: 4
occurrences:
  - 2026-04-25 (L-0138 first occurrence — system-map-drift-from-code)
  - 2026-04-28 /dashboard/help council (helpdesk_query 🔴 vs 🟢 inversion)
  - 2026-04-28 voice + tool perf council (B5 dispatcher 🔴 → all 3 handlers exist; LiveKit adapter path stale)
  - earlier: L-0083 audit-inflation pattern (grep-count claims inflated)
---

# Learning-0150: BOTSSON-SYSTEM-MAP Staleness Cycle

## Context

Council 2026-04-28 reviewing /dashboard/help. Phase 2.5 fact-check verified 25/26 briefing claims TRUE and flagged ONE FALSE: "`helpdesk_query` capability is NOT registered — 🔴 Phase B4." Source cited: `docs/architecture/BOTSSON-SYSTEM-MAP.md:216`.

In Phase 3, three independent code-tracers (system-steward, supervisor, system-agent-coordinator, botsson-harness-builder) all proved the OPPOSITE: helpdesk_query IS registered. Citations:

- `packages/ai/src/capabilities/registry.ts:18` — imports `helpdeskQueryCapability`.
- `packages/ai/src/capabilities/registry.ts:41` — registers `helpdesk_query: helpdeskQueryCapability`.
- `packages/ai/src/capabilities/types.ts:24` — listed in `CapabilityName` union.
- `packages/ai/src/capabilities/helpdesk_query/{index,tools}.ts` — full files exist with real bodies.

The map was stale. botsson-harness-builder reported additional stale rows: L5 `channel_event + channel_ai_policy` shown as 🟡 "Dead infra — ingen konsumenter" but ADR-0160-0163 wiring landed in helpdesk migration wave. Phase B4 listed as "designed but not built; .sql.draft" — but no .sql.draft files exist; real migrations shipped.

## Discovery

**Map-vs-code drift creates an inverted fact-check.** Phase 2.5 trusted the map as ground truth and surfaced the inverted claim as the FALSE one. Phase 3 code-tracers caught the inversion. The chain of trust:

1. Briefing says X.
2. Phase 2.5 verifies X against map.
3. Map disagrees with code (stale).
4. Phase 2.5 reports X as TRUE/FALSE based on map.
5. Phase 3 code-trace catches the truth.

When step 3 is silent (map doesn't carry a "verified against code on YYYY-MM-DD" header), step 4 inherits the staleness undetected. The inversion is invisible until step 5.

This is the second formal occurrence of map drift. L-0138 (system-map-drift-from-code, 2026-04-25) named the pattern after the first occurrence. This is the second — pattern is real, not a single instance.

Three contributing factors:

1. **Maps are easier to update than code, so they drift later.** Code changes in PR; map changes are deferred to "doc cleanup". Lag accumulates.
2. **Phase B/C/D campaign labels carry implicit dates.** "Phase B4 not built" implies "as of last campaign update". When campaign updates fall behind merges, the implication is wrong.
3. **No mechanical verification.** No CI check compares map status to grep evidence. Every map row is a hand-typed claim.

## Impact

Two layers of remediation.

### Layer 1 — Mechanical (preferred long-term)

Add a header to `BOTSSON-SYSTEM-MAP.md`: `Verified against code: YYYY-MM-DD`. CI script checks the date is within 7 days. Older = warn. Future hardening: compare map's 🟢/🟡/🔴 markers to grep evidence for capability registration, migration presence, BFF route existence. Mismatch = CI fail.

### Layer 2 — Council-process (immediate)

Update `run-council` SKILL.md Phase 2.5:

- **Map-verification gate** — any briefing citing a system map (BOTSSON-SYSTEM-MAP.md, JOURNEY-ENGINE-ARCH-MAP.md, etc.) MUST verify the map's "last verified" timestamp.
- **>7 days stale** — fact-checker re-verifies the cited map row against code, regardless of whether the briefing claim agrees with the map.
- **Map-cited claims are doubly weighted in Phase 3 code-trace mandate** — code-tracers default to confirming any map-cited claim with file:line citation, not deferring to the map.

Memory `reference_botsson_system_map.md` (if it exists) should be updated to flag staleness as a known cycle: every map citation in council briefings requires fresh code-trace.

The general lesson: **system maps are summary artifacts of code state, not sources of truth.** When summary and source disagree, source wins. Maps must declare their summary nature explicitly via "verified against code" headers.

## References

- Council 2026-04-28 — System Council on /dashboard/help
- Council 2026-04-28 — System Council on Botsson voice + tool perf (4th occurrence — see additions below)
- L-0138 — system-map-drift-from-code (first occurrence, 2026-04-25)
- L-0083 — audit-inflation pattern (grep-count vs code-trace)
- BOTSSON-SYSTEM-MAP.md — needs L4 helpdesk_query 🔴 → 🟢, L5 channel_event/channel_ai_policy 🟡 → trending 🟢, Phase B4 status correction
- system-steward + system-agent-coordinator + botsson-harness-builder Phase 3 reviews (three independent code-traces caught the inversion)
- Phase 2.5 fact-check report 2026-04-28 (the fact-check that inherited the staleness)
- Spec: `docs/superpowers/specs/2026-04-28-dashboard-help-design.md` (which calls out the map update as Phase 7 task)

## 4th Occurrence — Botsson Voice + Tool Perf Council 2026-04-28

Three independent code-traces (supervisor + agent-coord + botsson-harness-builder) falsified TWO SYSTEM-MAP claims that the briefing inherited:

1. **B5 EngineActionType handlers** — map said 🔴 "create_deviation, validate_settlement, lock_checkout missing — HACCP Phase 2c blocked". Code-trace verified all three handlers IMPLEMENTED at `supabase/functions/engine-dispatch/index.ts:800,910,995` with tests in `haccp_phase2c_test.ts`. Phase B5 should be 🟢, marked `[x]` in CAMPAIGN-botsson-arena.md.
2. **LiveKit adapter path** — map cited `services/stage-engine/src/adapters/livekit.ts`. Path does not exist. Real adapter is `packages/ai/src/adapters/livekit.ts` — 47 LOC pure converter, ZERO consumers, ZERO tests. "Hardening candidate" has no concrete surface.

Despite the map's `verified_against_code: 2026-04-28` header (same date as the council), two material errors slipped through. Layer-1 mechanical CI verification is now urgent — the human "I refreshed the map today" check is unreliable.

## Promotion to enforced rule

This is the 4th distinct council where SYSTEM-MAP staleness produced a falsified briefing claim. Promotion criteria (per `run-council` SKILL.md Phase 9 Step 4: 3+ occurrences across distinct sessions) MET.

**Enforced rule (proposed, see ADR-0227 SYSTEM-MAP refresh + verification protocol):**
- Every PR that closes a phase or ships a capability MUST update `BOTSSON-SYSTEM-MAP.md` in the SAME PR. Phase status bumps `[ ]` → `[x]` accompany code merges.
- `/close-feature.sh` gains a "system-map sync" check: if branch touches `packages/ai/src/capabilities/`, `services/stage-engine/`, or `supabase/functions/engine-dispatch/`, fail close until SYSTEM-MAP entry for the touched area is updated in same PR.
- Any council briefing citing SYSTEM-MAP MUST verify the cited row against code via grep BEFORE Phase 3 dispatch (Phase 2.5 fact-checker mandate).
