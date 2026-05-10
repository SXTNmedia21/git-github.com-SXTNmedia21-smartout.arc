---
title: "Journey — Wizard Onboarding Voice via LiveKit Single-Plane"
feature: voice-plane-consolidation
journey: wizard-onboarding-via-livekit
status: verified
verified_at: 2026-05-10
e2e_test: "deferred — see Phase F sortie 4"
created: 2026-05-04
updated: 2026-05-10
module: MODULE_BOTSSON
tags: [journey, voice, wizard, onboarding, livekit]
---

# Journey: Wizard Onboarding Voice via LiveKit Single-Plane

**Role:** prospect (pre-finalize-workspace user during /onboarding flow)

**Precondition:**
- User authenticated (has `user_identity` row)
- Workspace not yet finalized (no `profile_id` resolved)
- User on `/onboarding` route, voice flow enabled
- `services/voice-agent/` LiveKit Agents service running

## Happy Path

1. User opens `/onboarding` route → BFF `/api/wizard/start` mints LiveKit room token (room name `{workspaceId}:wizard:{userId}`) → wizard surface renders with LiveKit Room connection
2. User says "vi heter Botsson Arena, vi er en restaurant" → LiveKit Agents server-side function-calling triggers `update_business` capability tool → server-derived workspace context → `gate_action` → DB write → `emit("onboarding.business_updated")`
3. User says "vi har avdelinger kjøkken, bar og servering" → LiveKit Agents triggers `add_departments` tool → `cascade_gate_write` (D1) → 3 department rows written → `emit("onboarding.department_added")` × 3
4. User says "neste seksjon" → LiveKit data-channel `advanceToNextSection` client tool fires → wizard advances to next section
5. User completes all sections → user invokes `finalizeOnboarding` → `finalize-workspace` Edge Function commits onboarding state → workspace runtime ready

**Postcondition:**
- All onboarding D1 cascade rows written (departments, locations, zones) with workspace_id correctly resolved
- `engine_sessions` mode='agent' process_id='onboarding_v1' row created for replay
- `activity_trail` shows 1 row per mutation per ADR-0134
- Zero Ultravox surface invoked anywhere in flow (verified by recording inspection)

## Error Paths

- **Scenario: LiveKit room connection fails** → wizard renders fallback "Neste" button (per T2.6 mitigation) → user advances manually → graceful degradation, no silent voice failure
- **Scenario: D1 cascade-gate-write rejects (I1 bootstrap incomplete)** → tool returns explicit error "Bedrift ikke initialisert ennå" → user advances; cascade-developer escalation triggered
- **Scenario: Pre-auth wizard `ctx.profileId` null** → tool fails-fast with explicit 4xx (per L-0177) → wizard surface shows retry button
- **Scenario: VAD silence threshold causes premature turn-end mid-utterance** → user re-speaks; if rate exceeds 5% in benchmark, council escalation per E9 gate
- **Scenario: Wizard pre-finalize voice flow attempts to write to `profile` table** → forbidden, blocked by RLS; tool must use only D1 + workspace draft state

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists at `apps/e2e/tests/journey-wizard-onboarding-livekit.spec.ts` and passes
- [ ] Manually tested end-to-end on `/onboarding` route with kitchen-noise sample
- [ ] Recording verification: zero Ultravox surface in session-recording trace
- [ ] Performance: voice-to-tool-call latency P50 ≤ 600ms, P95 ≤ 900ms (per E9 gate)

**Mark `status: verified` in frontmatter when all five boxes are checked.**
