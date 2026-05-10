---
title: "Plan — Phase F0 Perimeter Closure"
status: draft
updated: 2026-05-10
created: 2026-05-10
module: MODULE_BOTSSON
campaign: botsson-arena
tags: [plan, phase-f, audit-remediation, voice-plane, promotion-blocker]
---

# Plan — Phase F0 Perimeter Closure

> Branch: `feat/botsson-arena-phase-f0-perimeter` (sub-sortie under campaign/botsson-arena)
> Base: `campaign/botsson-arena` (post-Phase-E)
> Driven by: `docs/audits/2026-05-10-adr-contract-validation/00-SYNTHESIS.md`
> Estimated: **2-3 dager** (1 P0 fix + 4 supporting)

## Goal

Lukk de 5 åpne perimeter-gapene fra Phase E så `campaign/botsson-arena` blir trygg å promotere til `development → preview → main`. Per audit-verdikt: campaign er **NOT SAFE TO PROMOTE AS-IS**. Phase F0 lukker promotion-blockers.

## Scope

**In scope (5 audit-findings):**
- F-AC-02 (CRITICAL) — Landing wizard voice broken i prod
- F-SE-01 (HIGH) — Voice multi-tenant workspace derivation broken
- F-OB-04 (MEDIUM) — `/api/emma/session` BFF har 0 consumers
- F-JR-01 (HIGH) — 5 voice journeys fortsatt `status: draft` post-Phase-E
- F-AC-01 (LOW) — ADR-0282 line 176 stale tracker

**Out of scope (separate sortier):**
- ADR-0204 SS-5 backlog (sortie 2)
- Capability gate parity sweep (sortie 3)
- Mission E2E coverage (sortie 4)
- ADR-0179 + EF auth (sortie 5)

## Tasks

### T1 — F-AC-02: Landing wizard voice fix [CRITICAL, 4-6t]

**File:** `apps/landing/src/app/api/wizard/engine-start/route.ts:47`

**Problem:** POSTer til `/adapters/ultravox/create-call` som ble slettet i Phase E commit `1dea96e1e`. Landing voice widget broken i prod nå.

**Decision needed:** A eller B?
- **A (anbefalt):** Migrér landing wizard voice til LiveKit (parity med web wizard). Reuse `livekit-token` Edge Function `purpose: "wizard"` branch (Phase E E5). Erstatt Ultravox-call-creation med LiveKit room-mint.
- **B:** Disable landing voice helt — fjern `UltravoxSession` import, vis "voice ikke tilgjengelig" feedback. Gjenopprett senere som egen sortie.

Acceptance:
- [ ] `apps/landing/src/app/api/wizard/engine-start/route.ts` ringer aldri lengre `/adapters/ultravox/*`
- [ ] `grep -r "ultravox\|UltravoxSession\|UltravoxSessionStatus" apps/landing/` = 0 hits (om A)
- [ ] Landing wizard voice fungerer end-to-end (manuell test) (om A)
- [ ] ADR-0282 AC#1 post-condition met

### T2 — F-SE-01: Voice multi-tenant workspace derivation [HIGH, 6-8t]

**Files:**
- `services/voice-agent/src/adapter.ts:76` — sender `BOTSSON_SERVICE_JWT`
- `services/stage-engine/src/routes/agent/chat.ts:97-120` — bruker `auth.workspaceId` i stedet for `body.workspace_context.workspace_id`

**Problem:** Voice-agent → stage-engine bruker service-account JWT. `effectiveWorkspaceId` resolves fra service-account workspace, ikke calling user's. Cross-tenant data leak i multi-tenant prod. Single-workspace lokal dev skjuler bug.

**Decision needed:** A eller B?
- **A (anbefalt):** Promotere `body.workspace_context.workspace_id` til `effectiveWorkspaceId` i `chat.ts:97-120` når BOTSSON_SERVICE_JWT er actor. Verify body.workspace_context.workspace_id matches what voice-agent received in `setSessionContext` (no forgery — server-derived ved token-mint).
- **B:** Voice-agent minter user-scoped JWT per session start (krever endring i livekit-token EF + adapter). Tyngre, men eliminerer service-account-coupling helt.

Anbefaler A — bruker eksisterende BFF-derived workspace_context (server-trusted), ingen ny token-mint flow. B er Phase F1.

Acceptance:
- [ ] `chat.ts` håndterer service-account JWT case eksplisitt: prefer body.workspace_context.workspace_id når present og auth.role = service-account
- [ ] Fail-closed når både JWT-derived og body.workspace_context er null
- [ ] gate_action receives correct workspace_id
- [ ] Telemetri events emitted med calling-user workspace_id, ikke service-account
- [ ] Unit test: cross-workspace voice call routes til correct workspace
- [ ] BOTSSON-SYSTEM-MAP.md L3 voice-agent row tilbake til 🟢

### T3 — F-OB-04: Wire `/api/emma/session` consumer [MEDIUM, 2-3t]

**File:** `apps/web/src/app/api/emma/session/route.ts` (Phase E E2 endpoint)

**Problem:** BFF endpoint bygget men har **0 consumers** i codebase. Verify whether intended consumer (voice-agent? wizard?) was lost in Phase E refactor.

**Acceptance:**
- [ ] Identifiser intended consumer per Phase E plan (sannsynligvis Phase E E2 erstatter client `getOnboardingState`)
- [ ] Wire consumer eller dokumenter som deferred + flagg i HANDOFF
- [ ] Om wired: integration test verifies endpoint kalles fra wizard

### T4 — F-JR-01: Flip 5 voice journeys til verified [HIGH, 1-2t]

**Files:** `docs/journeys/JOURNEY-voice-plane-consolidation-*.md` (5 filer)

**Problem:** 5 journeys fortsatt `status: draft` + `verified_at: null` + `e2e_test: null` selv om Phase E er closed.

**Acceptance:**
- [ ] For hver journey: verifiser implementasjon mot dokumentert flyt
- [ ] Flip status: draft → verified (eller deferred for lise-interview hvis 5-item gate ikke møtt)
- [ ] Sett `verified_at: 2026-05-10`
- [ ] `e2e_test:` enten path til existing spec eller "deferred — see Phase F sortie 4"

### T5 — F-AC-01: ADR-0282 stale tracker fix [LOW, 5 min]

**File:** `docs/decisions/0282-voice-plane-consolidation-livekit-only.md:176`

**Problem:** Linje 176 viser `[ ] ADR-0276 — to write` men ADR-0276 ble skrevet og accepted 2026-05-10.

**Acceptance:**
- [ ] Linje 176 flippes til `[x] ADR-0276 — accepted 2026-05-10`

## Acceptance Criteria (overall)

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Docker compose build voice-agent + landing exit 0
- [ ] All 5 audit-findings closed (verifiable via re-running affected slices)
- [ ] ADR-0282 AC#1 post-condition met (no Ultravox in apps/)
- [ ] Decision log updated (no new ADR needed unless T2 chooses option B)
- [ ] User journeys written/verified (T4 covers)
- [ ] Handoff written (HANDOFF-phase-f0-perimeter-closure.md)
- [ ] BOTSSON-SYSTEM-MAP.md L3 voice-agent row 🟢
- [ ] Re-run /audit smoke (3 slices) shows F-AC-02 + F-SE-01 closed

## Risks

1. **T1 option A scope creep** — landing wizard parity med web wizard kan kreve workspace-context som landing ikke har (anonymous user pre-onboard). Mitigation: bruk samme `wsId='anon'` fallback som Phase E E5.
2. **T2 option A regression** — promoting body.workspace_context.workspace_id er trust-extension. Verify body.workspace_context er server-derived ved token-mint (BFF), ikke client-supplied. Audit body.workspace_context construction path.
3. **T3 may reveal Phase E gap** — om intended consumer aldri ble bygget, T3 vokser. Time-box til 2t investigasjon, defer real wiring til separat sortie om scope blir > 4t.

## Dependencies

- Phase E commits landed på campaign/botsson-arena (✓ done 2026-05-10 via `e524a966a` Dockerfile fix)
- Audit synthesis at `docs/audits/2026-05-10-adr-contract-validation/00-SYNTHESIS.md` (✓ done)
- Local docker stack rebuilt + voice-agent registered med LiveKit (✓ done denne sesjonen)

## Sequence

```
T5 (5 min) → T4 (1-2t) → T3 (2-3t) → T1 (4-6t) → T2 (6-8t)
                                       ↓             ↓
                                  parallel-able if separate files
```

T5 + T4 først for momentum + closing-cleanup-debt. T3 før T1/T2 om wiring-investigasjon avdekker dypere refactor. T1 og T2 kan parallelliseres (forskjellige filer/services).

## Closure

Etter alle 5 tasks:
1. Re-run `/audit smoke` (capability-tools + edge-functions + db-rls-telemetry) — F-AC-02 + F-SE-01 må vise CLOSED
2. Write HANDOFF-phase-f0-perimeter-closure.md
3. Tag campaign milestone "Phase F0 closed — promotion-ready"
4. Pontus decides: open milestone-PR campaign → development?
