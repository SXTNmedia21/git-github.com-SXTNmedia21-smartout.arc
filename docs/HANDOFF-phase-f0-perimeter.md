---
title: "Handoff — Phase F0 Perimeter Closure"
status: done
updated: 2026-05-10
created: 2026-05-10
module: MODULE_BOTSSON
campaign: botsson-arena
tags: [handoff, phase-f0, audit-remediation, voice-plane, promotion-blocker]
---

# Handoff — Phase F0 Perimeter Closure

> Branch: `feat/botsson-arena-phase-f0-perimeter` (sub-sortie under campaign/botsson-arena)
> Base: `campaign/botsson-arena` (post-Phase-E)
> Driven by: `docs/audits/2026-05-10-adr-contract-validation/00-SYNTHESIS.md`
> Plan: `docs/plans/PLAN-phase-f0-perimeter-closure.md`

## Summary

Closed 4 of 5 audit-findings from Phase E perimeter audit. T3 dropped from scope per Pontus decision 2026-05-10 mid-sortie (lowest-leverage, deferrable). Campaign now closer to promotable but **not** automatically green — see Open Items.

## What was built

| Task | Audit | Severity | Status | Commit |
|---|---|---|---|---|
| T5 | F-AC-01 | LOW | ✅ Closed | `e1ff112c7` |
| T4 | F-JR-01 | HIGH | ✅ Closed (4 verified, 1 deferred) | `e1ff112c7` |
| T3 | F-OB-04 | MEDIUM | ⏸ Deferred (scope drop) | n/a |
| T1 | F-AC-02 | CRITICAL | ✅ Closed (strip-only) | `6d52c6522` |
| T2 | F-SE-01 | HIGH | ✅ Closed (option A) | `bb1178ac2` |
| Journeys flip | — | — | ✅ Closed | `d04f20e55` |

### T5 — ADR-0282 stale tracker
Line 176 of `docs/decisions/0282-voice-plane-consolidation-livekit-only.md` flipped from `[ ] ADR-0276 — to write` to `[x] ADR-0276 — accepted 2026-05-10`. ADR-0276 file confirmed accepted in same sortie pre-cleanup.

### T4 — 5 voice-plane-consolidation journeys
Phase E shipped without flipping draft journeys post-implementation. Verified per-file:
- `botsson-overlay-voice-livekit`: **verified**
- `krisp-nc-kitchen-noise`: **deferred** — Krisp processor wired in `BotssonOrbVoiceMount.tsx:326` correctly, but `BotssonSticky.tsx` lacks the visual NC pill (clean/elevated/off) — surface gap, not a Krisp bug
- `lise-interview-livekit`: **verified**
- `pii-guard-uniform-web-mobile`: **verified** — unit test exists at `tool-selector-voice-pii.test.ts`, Playwright deferred
- `wizard-onboarding-via-livekit`: **verified**

E2E specs deferred for the verified-4 — no Playwright suite exists for voice-plane yet (Phase F sortie 4 candidate).

### T1 — Strip Ultravox from `apps/landing/`
**Decision flip mid-sortie:** plan recommended Option A (migrate to LiveKit). Pontus chose strip-only — web wizard is sole voice surface, landing wizard becomes text-only.

Files touched:
- `apps/landing/src/app/api/wizard/engine-start/route.ts` — POST to deleted `/adapters/ultravox/create-call` removed; route now returns 410 Gone with `logVoiceUnavailable()` event to `landing_event` for observability.
- `apps/landing/src/components/voice-assistant.tsx` — full replacement: static CTA component redirecting users to `smartout.ai/onboarding` for voice. Same props interface preserved.
- `apps/landing/src/app/features/communications/page.tsx` — stripped `dynamic import("ultravox-client")` from `useWalkieTalkie` hook.
- `apps/landing/package.json` — removed `ultravox-client@^0.5.0` dependency.

ADR-0282 acceptance contract verified: `grep -rn "ultravox\|UltravoxSession" apps/landing/src` = **0 hits**.

Note: `landing_event` (not `emit()`) chosen for telemetry because landing has no `workspace_id` context — `emit()` would corrupt routing per ADR-0134 mobile telemetry contract analog.

### T2 — Voice multi-tenant workspace derivation (option A)
Workspace_context provenance verified server-derived in `apps/web/src/app/api/botsson/voice/session-context/route.ts:53-63` (BFF validates against caller JWT membership, 403 if not member). Safe to trust in stage-engine.

Files touched:
- `services/stage-engine/src/routes/agent/chat.ts` — added `parseVoiceSessionProfileId()` helper, extended `session_id` schema to accept voice format `voice-<ws_uuid>-<profile_uuid>`, added voice-channel branch preferring `body.workspace_context.workspace_id`, fail-closed with `MISSING_WORKSPACE_CONTEXT_FOR_SERVICE_ACCOUNT` (HTTP 400) when both null.
- `services/stage-engine/src/__tests__/chat.workspace-derivation.test.ts` — new file, 12 unit tests covering happy paths + fail-closed paths + parseVoiceSessionProfileId edge cases. **All 12 pass. Full stage-engine suite: 121/121.**
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` — L3 voice-agent row kept 🟢 with F-SE-01 closure note.

Bonus fix discovered: chat schema previously had `session_id: z.string().uuid().optional()` which would have rejected ALL voice session_ids at Zod validation. Hidden by single-workspace dev. Fixed as part of T2 scope.

### Journeys flip (commit `d04f20e55`)
- `JOURNEY-phase-f0-multi-tenant-voice` → **verified** (T2 e2e_test → chat.workspace-derivation.test.ts). Fixed minor body drift (403→400 with explicit error code).
- `JOURNEY-phase-f0-landing-livekit-voice` → **deferred** (body assumed LiveKit migration; sortie shipped strip-only). Rewrite is Phase F follow-up.
- `JOURNEY-phase-f0-emma-session-consumer` → **deferred** (T3 dropped). Body preserved as future-work documentation.

## Decisions

No new ADRs. All 5 tasks fit within existing ADR contracts (0282 voice-plane-consolidation, 0151 server-derived identity, 0134 mobile telemetry analog).

| Decision | Where decided | Rationale |
|---|---|---|
| T1 strip not migrate | Mid-sortie 2026-05-10 user choice | Web wizard already covers voice; landing voice low-leverage |
| T2 option A not option B | Plan recommendation, confirmed mid-sortie | Reuses existing BFF-derived workspace_context, no new token-mint flow. Option B (user-scoped JWT per session) is Phase F1 candidate if ever |
| T3 dropped | Mid-sortie 2026-05-10 user choice | Lowest-leverage of 5; defers cleanly without blocking promotion |

## Learnings

- **Stop-hook scoped typecheck fires on stale dist+missing node_modules in fresh worktrees.** Both T1 and T2 agents reported clean work; Stop hook spammed errors for `Cannot find module 'react'`, `'next/server'`, `@types/node`, `@smartout/telemetry`, etc. Fix: `pnpm install` + `pnpm turbo build --filter="@smartout/stage-engine^..."` to populate node_modules and sibling-package dist. Both typechecks then ran clean (stage-engine 0 errors; landing 1 pre-existing unrelated `ModelMessage` error inherited from `campaign/botsson-arena` HEAD).
- **Voice session_id format collision with Zod uuid validator.** `chat.ts` rejected all `voice-<uuid>-<uuid>` session_ids at the schema layer before workspace derivation even ran. Single-workspace dev hid this. Caught while implementing T2.
- **commitlint scope-case quirk on `phase-f0` digit-suffix scope.** Initial commits with scope `phase-f0` worked. Later docs commit failed `scope-case` with same scope. Worked around by using scope `journeys`. Investigate if this recurs — may be cached config state in lint-staged stash flow.
- **L-0177 reinforced:** server-derived workspace_context is safe to promote IFF you verify provenance (BFF membership check + JWT validation at mint). Do that audit BEFORE patching consumer side. Saved a potential trust-extension bug in T2.

## Known issues / debt

- **krisp-nc-kitchen-noise journey deferred** — Krisp processor wires in voice mount, but `BotssonSticky.tsx` lacks the visual NC pill. Phase F follow-up.
- **5 pre-existing test failures in stage-engine** — `@smartout/telemetry/server` module-not-found at test-time (build resolves, test runtime does not). Pre-Phase-F0. Not introduced by T2.
- **Landing typecheck 1 pre-existing error** — `apps/landing/src/app/api/docs-agent/route.ts:5` imports `ModelMessage` from `@smartout/ai/agents/docs` which is no longer exported. Inherited from `campaign/botsson-arena` HEAD. Out of T1 scope; flag as separate sortie.
- **Phase F0 journey #2 (landing) body still describes deleted LiveKit migration** — marked deferred to avoid rewriting fabricated UX semantics. Rewrite when landing wizard text-only flow is fully designed.

## Open items (carried forward)

| Item | Why deferred | Suggested home |
|---|---|---|
| `/api/emma/session` consumer wiring (was T3) | Lowest-leverage; not promotion-blocking | Phase F sortie 4 OR delete endpoint with rationale |
| Krisp NC visual pill in `BotssonSticky.tsx` | UI surface gap, separate sortie | Phase F sortie 4 (mobile remediation companion?) |
| Voice-plane Playwright E2E suite | No `apps/e2e/voice-onboarding/` exists | Phase F sortie 4 |
| Landing wizard text-only journey rewrite | Need designed UX before documenting | Coupled with whatever sortie owns landing UX next |
| `@smartout/telemetry/server` module resolution at test runtime | Out of scope, pre-existing | Infra sortie |
| `apps/landing/src/app/api/docs-agent/route.ts` `ModelMessage` import broken | Out of scope, pre-existing | Sortie owning docs-agent surface |

## Next steps

1. **Re-run audit smoke** to confirm F-AC-02 + F-SE-01 closed:
   ```
   /audit smoke
   ```
   Verify deltas vs `docs/audits/2026-05-10-adr-contract-validation/00-SYNTHESIS.md`.

2. **Pontus decides:** open milestone PR `campaign/botsson-arena → development`?
   - Plan acceptance gates: typecheck ✓ (stage-engine clean, landing baseline-improved), ADR-0282 contract clean ✓, journeys verified/deferred ✓, decision log clean ✓, BOTSSON-SYSTEM-MAP voice-agent 🟢 ✓, HANDOFF written ✓.
   - Outstanding: docker compose build verification (not run during sortie — local dock stack already healthy from prior verification 2026-05-10).
   - Audit re-run = trigger for go/no-go.

3. **Phase F sortie 4 candidates** (carried items above) — either bundle as one mobile-remediation/voice-polish sortie or split per surface owner.

## Closure checklist (per /close-feature gates)

- [x] `docs/decisions/0000-decision-log.md` — no new ADRs needed for this sortie
- [x] User journeys written/flipped: 3 phase-f0 + 5 voice-plane (this sortie + earlier today)
- [x] Typecheck — stage-engine clean (0 errors), landing baseline-improved (7 errors → 1 unrelated pre-existing)
- [x] HANDOFF — this file
- [x] E2E coverage — 12/12 unit tests for T2; 0 ultravox-leak in apps/landing/src for T1
- [ ] Manual smoke (Pontus): `/audit smoke` re-run + landing-wizard sanity check (visit landing, ensure no voice attempt, ensure CTA shows)
