---
title: "Slice 10 — Onboarding Wizard ADR/Contract Audit"
status: done
created: 2026-05-06
updated: 2026-05-06
module: onboarding
tags: [audit, adr-0041, adr-0238, onboarding, telemetry]
---

# Slice 10: Onboarding Wizard Audit

**ADRs in scope:** ADR-0041 (Onboarding Wizard Step Architecture), ADR-0238 (Botsson Surface Disambiguation)
**Surface:** `apps/web/src/app/onboarding/`

---

## Findings

### HIGH-1 — ADR-0041 superseded but architecture split is real and unmounted

**Severity:** HIGH
**Status:** Known — ADR marked superseded 2026-05-02. However, the architectural split is deeper and more hazardous than the supersession note implies.

**Reality:**
- `page.tsx` uses `AnimatedWizardShell` + `wizard-definition.ts` (the new confirmed path).
- `OnboardingProvider` / `WizardContext.tsx` is exported but **never mounted** anywhere in the onboarding tree. The old sections (`sections/`) and components (`components/`) — `BusinessSection`, `DepartmentsSection`, `KeyFactsPanel`, `VoiceSessionOverlay`, `AgentControlPanel`, `BigBoard`, `HeroSection`, etc. — all `import { useOnboarding }` from `WizardContext.tsx` and call it at runtime.
- The new steps path (`steps/ConfirmDepartments`, `ConfirmRoles`, etc.) does **not** use `useOnboarding` — correct.

**Risk:** The `sections/` and `components/` directories appear to be dead code from the old scroll-based implementation. If any route or feature still renders them without an `OnboardingProvider` ancestor, `useOnboarding()` will throw `"useOnboarding must be used within OnboardingProvider"` — a runtime crash. This is a latent runtime bomb if any of these components are still reachable.

**Action needed:** Verify that `sections/` and `components/` are entirely unreachable from the live routing tree, or delete them. Do not leave live-import dead code with a context guard that throws.

---

### HIGH-2 — ADR-0238 (`DomainChatOwnership`) not implemented for `/onboarding`

**Severity:** HIGH
**Status:** Not implemented.

**Reality:**
- `layout.tsx` mounts `BotssonProvider` wrapping all onboarding children.
- `BotssonProvider` exposes the global Botsson Orb.
- Neither `layout.tsx` nor `page.tsx` nor any step component declares `<DomainChatOwnership>`.
- `DomainChatOwnership` / `useDomainChatOwnership` does not exist anywhere in the codebase (confirmed via grep — zero matches).

**The /onboarding surface has its own voice chat surface** (`VoiceSessionOverlay` via `useBotsson` Ultravox, mounted via legacy `WizardContext` if `OnboardingProvider` is ever restored) AND the new wizard steps may surface Botsson via `BotssonProvider`. ADR-0238 mandates that any page with domain-specific chat must declare ownership so the Orb suppresses. This declaration does not exist.

**Note:** ADR-0238 itself has `status: proposed` — not `accepted`. The "Agent Impact" rule in the ADR states pages MUST declare ownership, but the implementation contract (the hook + component) has not shipped. This is a double gap: ADR not accepted + implementation absent.

**Action needed:** ADR-0238 must move to `accepted` and `<DomainChatOwnership>` must be implemented. Until then the `/onboarding` surface risks dual-surface confusion if the Orb is ever surfaced here.

---

### MEDIUM-1 — `workspace_id` is null at `wizard started` telemetry emit time

**Severity:** MEDIUM

**Reality:**
- `page.tsx` resolves `workspaceId` asynchronously via a `useEffect` → Supabase auth + profile query.
- `AnimatedWizardShell` emits `"wizard started"` on mount via `useEffect(() => { telemetry.emitWizardStarted(); }, [])`.
- The auth resolution `useEffect` races mount. On first render, `workspaceId` is `null` and `actorId` is `"anonymous"`.
- `useWizardTelemetry.onComplete` (at wizard finalization) also uses the same `workspaceId` prop — which may still be null if the auth resolution lost the race.

**Risk:** `"wizard started"` event and potentially `"wizard completed"` land in `activity_trail` / PostHog with `workspace_id = null` and `actor_id = "anonymous"`. These are corrupted telemetry records per ADR-0134 mobile telemetry contract (same class of bug, different surface). For `"wizard started"` this is cosmetically acceptable (pre-auth). For `"wizard completed"` it is a data loss event.

**Mitigant:** `useOnboardingState.ts:861` has a second `"wizard completed"` emit with the resolved `workspaceId` from the finalization response — so the EF-path is covered. But the shell-level `useWizardTelemetry.onComplete` fires before that, with potentially stale auth context.

**Action needed:** Gate `emitWizardStarted` until `workspaceId` is non-null, or defer to post-auth-resolution tick. Confirm `"wizard completed"` from shell always fires with resolved IDs.

---

### MEDIUM-2 — `workspaceId` null path in `onComplete` silently falls through to `activate-workspace`

**Severity:** MEDIUM

**Reality:**
- `wizard-definition.ts:onComplete()` calls `buildWorkspaceFinalizationRequest(state.workspaceId, ...)`.
- `buildWorkspaceFinalizationRequest` in `finalization.ts:47`: if `onboardingWorkspaceId` is null/falsy, it falls back to `activate-workspace` (no `workspaceId` in body).
- `state.workspaceId` is loaded from the profile query in `loadState()`. If `loadState()` returns `{}` (no workspace in onboarding), `workspaceId` defaults to `defaultOnboardingConfirmState.workspaceId` — which is `undefined` (not validated).
- There is no guard that throws or blocks finalization when `state.workspaceId` is missing. Per L-0177: resolving workspace_id from a body-supplied row reference without fail-fast on row-not-found = bug.

**Action needed:** Add a guard at the top of `onComplete`: if `!state.workspaceId`, throw a user-visible error instead of silently routing to `activate-workspace`.

---

### LOW-1 — `OnboardingProvider` / `WizardContext.tsx` — dead Ultravox voice integration

**Severity:** LOW (dead code, not a runtime risk if unreachable)

**Reality:**
- `WizardContext.tsx` imports `useBotsson` from `./hooks/useBotsson` which connects to Ultravox via `POST /api/wizard/start`.
- `useBotsson.ts` has Ultravox `UltravoxSession` client code with 14 tool implementations.
- The active wizard path (`AnimatedWizardShell` + `wizard-definition.ts`) does NOT use any of this — it uses `BotssonProvider` via layout.
- If this code is indeed dead, it should be deleted. If it is in-flight for `campaign/botsson-arena-voice-plane-consolidation`, it should be tracked as that campaign's pending activation.

**Action needed:** Confirm dead vs in-flight. If dead, delete. If active campaign work, document in campaign handoff.

---

## Delta from 2026-05-02 Baseline

The baseline noted:
1. ADR-0041 describes `STEP_COMPONENTS + WizardContext + OnboardingProvider`. Reality is `AnimatedWizardShell + wizard-definition.ts`. **Confirmed — ADR now marked superseded.**
2. `OnboardingProvider` not mounted. **Confirmed — still not mounted. Sections/ still import useOnboarding, potential crash if ever re-rendered.**
3. Zero finalization telemetry emit at `wizard-definition.ts:onComplete()`. **CLOSED — `useWizardTelemetry.onComplete` fires at shell level. `useOnboardingState.ts:861` emits a second resolved event. Coverage exists, but workspace_id null-race risk on shell-level emit (MEDIUM-1).**
4. ADR-0238 not implemented for `/onboarding`. **Confirmed — still not implemented. ADR still proposed.**

**New finding vs baseline:** MEDIUM-2 (workspaceId null → silent activate-workspace fallback) was not in the 2026-05-02 baseline.

---

## Summary

| ID | Severity | Title |
|----|----------|-------|
| HIGH-1 | HIGH | `sections/` + `components/` import `useOnboarding` but `OnboardingProvider` is never mounted — latent crash |
| HIGH-2 | HIGH | ADR-0238 `DomainChatOwnership` not implemented (ADR proposed, hook absent, no declaration) |
| MEDIUM-1 | MEDIUM | `workspace_id = null` / `actor_id = "anonymous"` at `wizard started` emit; race condition |
| MEDIUM-2 | MEDIUM | `onComplete` null `workspaceId` silently falls through to `activate-workspace` — no fail-fast |
| LOW-1 | LOW | `WizardContext.tsx` + `useBotsson` Ultravox code dead or campaign-in-flight — unresolved |
