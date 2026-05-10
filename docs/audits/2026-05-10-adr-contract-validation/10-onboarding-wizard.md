---
title: "Audit Slice 10 — Onboarding Wizard"
status: done
created: 2026-05-10
updated: 2026-05-10
module: onboarding
tags: [audit, adr-0041, adr-0238, phase-e, livekit, onboarding-wizard]
---

# Audit Slice 10 — Onboarding Wizard

**Branch:** campaign/botsson-arena
**Surface:** `apps/web/src/app/onboarding/`
**ADR cluster:** ADR-0041, ADR-0238
**Phase E commit reference:** `6b82d14b6` (feat/botsson-arena-phase-e-cutover merged)

---

## Summary

Phase E voice-plane consolidation landed cleanly on the onboarding surface. `useBotsson.ts` is fully rewritten to LiveKit Room — zero Ultravox temporaryTool registrations remain. `/api/wizard/start` mints LiveKit tokens correctly. ADR-0238 dual-surface risk is structurally absent (BotssonShell is not mounted on `/onboarding`).

The primary findings are: (1) large volume of dead code from the scroll-based wizard that was superseded but not removed; (2) two Confirm step files orphaned from `wizard-definition.ts`; (3) `/api/emma/session` BFF endpoint has no consumer in the codebase; (4) CLAUDE.md architectural description is stale relative to actual runtime.

---

## Findings

### F-OB-01 — ADR-0041 superseded and runtime replaced; CLAUDE.md description stale

**Severity:** LOW (documentation drift, no runtime impact)

ADR-0041 was correctly marked `superseded` on 2026-05-02. The runtime has moved from the `OnboardingProvider` + `WizardContext` + scroll-section architecture (ADR-0041 pattern) to `AnimatedWizardShell` + `wizard-definition.ts` (6 confirmation steps, confirmation-wizard shape).

CLAUDE.md still describes the old architecture: `"10 sections + 14 UI components + WizardContext + 3 hooks"`. Actual live runtime:
- **Page:** `apps/web/src/app/onboarding/page.tsx` → `AnimatedWizardShellWithAuth` → `AnimatedWizardShell`
- **Wizard definition:** `wizard-definition.ts` — 6 steps (confirm-departments, confirm-roles, confirm-positions, confirm-locations, confirm-procedures, summary)
- **WizardContext / OnboardingProvider:** exists at `WizardContext.tsx` but is **not mounted anywhere** — dead code

The 3 hooks (`useBotsson`, `useOnboardingState`, `useScrollProgress`) still exist as files but are only referenced from `WizardContext.tsx`, which itself is not consumed.

**Files:**
- `apps/web/src/app/onboarding/WizardContext.tsx` — unmounted, dead
- `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` — referenced only from WizardContext (dead)
- `apps/web/src/app/onboarding/hooks/useScrollProgress.ts` — referenced only from WizardContext (dead)
- `docs/decisions/0041-onboarding-wizard-step-architecture.md` — correctly marked superseded

**Action:** Update CLAUDE.md to describe the active wizard architecture. Dead code cleanup is a separate sortie decision.

---

### F-OB-02 — Scroll-based sections (`sections/`) are dead code — not imported anywhere

**Severity:** LOW (dead code, no runtime impact)

All 9 files in `apps/web/src/app/onboarding/sections/` are unreachable from any active code path. `OnboardingProvider` is the only consumer of these sections, and `OnboardingProvider` is not mounted.

Files not imported anywhere outside `sections/` itself:
- `HeroSection.tsx`, `BusinessSection.tsx`, `DepartmentsSection.tsx`, `LocationsSection.tsx`
- `ProceduresSection.tsx`, `SeasonSection.tsx`, `CustomerDocumentView.tsx`
- `DoneSection.tsx`, `WelcomeSection.tsx`

Similarly, `components/` files that are section-only (not used by wizard steps):
- `AgentControlPanel.tsx`, `AmbientBackground.tsx`, `BigBoard.tsx`, `BotssonAvatar.tsx`
- `BusinessCardGrid.tsx`, `DataMaterializer.tsx`, `KeyFactsPanel.tsx`
- `SectionReveal.tsx`, `TypewriterText.tsx`, `VoiceSessionOverlay.tsx`

`FinaleOverlay.tsx` is imported by `sections/WelcomeSection.tsx` (dead chain).

**Action:** Remove `sections/` and the above `components/` files in a cleanup sortie. Confirm via `grep -r "import.*sections/\|import.*AgentControlPanel\|import.*BotssonAvatar"` before deletion.

---

### F-OB-03 — `ConfirmBusiness.tsx` and `business-tools.ts` orphaned from `wizard-definition.ts`

**Severity:** MEDIUM (dead code, tooling noise, misleading intent-coverage)

`apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx` is not registered in any `wizard-definition.ts` step. It exists as a step file with `useRegisterTools("wizard-onboarding-business", tools)` and imports `useBusinessTools` from `steps/tools/business-tools.ts`. Neither file is consumed anywhere.

`steps/tools/business-tools.ts` defines 5 `temporaryTool` definitions for business field updates — these tools are registered in the Botsson tool registry but the step that registers them (`ConfirmBusiness`) is never mounted.

Similarly, `ConfirmProfessions.tsx` exists as a file but is not in `wizard-definition.ts` steps array. (Unlike `ConfirmBusiness`, it has no associated tools file.)

**Files:**
- `apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx` — dead
- `apps/web/src/app/onboarding/steps/tools/business-tools.ts` — dead
- `apps/web/src/app/onboarding/steps/ConfirmProfessions.tsx` — dead (though professions ARE loaded in `loadState()` and stored in wizard state; the display step was removed from `wizard-definition.ts`)

**Verification:** `grep -rn "ConfirmBusiness\|ConfirmProfessions" apps/web/src/` returns only self-references and `business-tools.ts` comment.

**Action:** Either add these steps back to `wizard-definition.ts` if the business and professions confirmation flow is intended, or delete the orphaned files. Given `loadState()` populates `professions` in state, a `ConfirmProfessions` step was likely removed intentionally post-council — verify intent and update `wizard-definition.ts` accordingly.

---

### F-OB-04 — `/api/emma/session` BFF endpoint has no consumer (Phase E E2 delivered but unused)

**Severity:** MEDIUM (functional gap — BFF route exists, nothing calls it)

`apps/web/src/app/api/emma/session/route.ts` was created per ADR-0282 Phase E E2 to replace the client-side `getOnboardingState` temporaryTool. The route queries `engine_sessions` for `mission_id = 'onboarding-interview'` and `mode = 'agent'`.

However, no code in `apps/web/src/` calls `GET /api/emma/session`. The only reference is the route file itself. The tool it was meant to replace (`getOnboardingState`) lives in `WizardContext.tsx` (dead code — OnboardingProvider not mounted). The new wizard (`AnimatedWizardShell` + `wizard-definition.ts`) does not call this endpoint.

**Schema note:** The `mode` column exists in `engine_sessions` (migration `20260302000200_engine_sessions_mode.sql`) with CHECK `('mission', 'agent')`. The BFF query is schema-correct. The `mode='agent'` filter is syntactically valid.

**Files:**
- `apps/web/src/app/api/emma/session/route.ts:36-39` — valid query, no consumer

**Action:** Either wire this endpoint to the new wizard's step context (so the voice-agent can call it server-side as a capability tool), or mark as ADR-0282 R4 #1 ("getOnboardingState → new BFF reads engine_sessions") pending and document in DASHBOARD. The route should not be deleted — it is the correct ADR-0282 target. It just needs to be consumed by the voice-agent capability or wizard step.

---

### F-OB-05 — Phase E: useBotsson LiveKit rewrite COMPLIANT — zero Ultravox temporaryTool registrations

**Severity:** PASS

`apps/web/src/app/onboarding/hooks/useBotsson.ts` (Phase E T2.3) is fully compliant with ADR-0282 R4:

- No `UltravoxSession` import
- No `ultravox-client` import
- Zero `registerToolImplementation()` calls
- Zero `temporaryTool` definitions inside `useBotsson`
- `startSession()` calls `POST /api/wizard/start` (LiveKit token mint) — not Ultravox create-call
- `Room` from `livekit-client` is the session transport
- Only client-side tool retained: `advanceToNextSection` via LiveKit data channel topic `botsson-tool-call` — matches ADR-0282 R4 #11 (STAYS CLIENT)
- `BotssonActions` interface retains optional legacy fields (`getState?`, `updateBusiness?`, etc.) with explicit comment: "Legacy: kept in signature so WizardContext compiles without changes. These are no longer called by this hook."

The `useBotsson.test.ts` assertion file (`hooks/__tests__/useBotsson.test.ts`) verifies zero `registerToolImplementation` calls — this gate is active.

---

### F-OB-06 — Phase E: `/api/wizard/start` LiveKit token mint COMPLIANT

**Severity:** PASS

`apps/web/src/app/api/wizard/start/route.ts` correctly:
- Replaces the Ultravox create-call path (ADR-0282 Phase E E5)
- Invokes `supabase.functions.invoke("livekit-token")` with room-name pattern `{workspaceId}:wizard:{userId}`
- Enforces ADR-0151: `workspace_id` derived server-side from JWT-resolved profile; body `workspace_id` mismatch → 403 with telemetry emit
- Allows unauthenticated users for `mission_id = 'onboarding-interview'` (pre-account onboarding path)
- Returns `{ sessionId, roomUrl, token, requestId }` shape consumed by `useBotsson.startSession()`

---

### F-OB-07 — ADR-0238 / L-0178: NO dual-surface issue on /onboarding (structural compliance)

**Severity:** PASS (with advisory note on ADR-0238 implementation gap)

ADR-0238 mandates that pages with an embedded domain chat surface MUST declare `<DomainChatOwnership>` to suppress BotssonShell to passive mode. L-0178 is the same rule elevated from learning.

**On `/onboarding`:** `BotssonShell` is **not mounted**. `layout.tsx` wraps children in `BotssonProvider` (context + tool-registry) but does NOT render `BotssonShell`. The floating Orb does not appear on `/onboarding`. Therefore, no dual-surface UX confusion exists — the ADR-0238 scenario (two competing chat surfaces) cannot manifest.

**`DomainChatOwnership` implementation status:** The component and `useDomainChatOwnership()` hook described in ADR-0238 do NOT exist in the codebase. Only a TODO comment in `apps/web/src/app/dashboard/people/[id]/_components/LonnsprofilSection.tsx:24`. ADR-0238 remains `status: proposed`. This is a known implementation gap but does not affect the `/onboarding` surface where Shell is absent.

**Advisory:** If `BotssonShell` is ever added to the `/onboarding` layout (e.g. for wizard-context voice guidance), `<DomainChatOwnership reason="onboarding-wizard" />` MUST be declared before Shell renders. The wizard has an embedded voice surface (`VoiceSessionOverlay` — currently dead code, `useBotsson` in the scroll wizard) and the new `AnimatedWizardShell` has no visible chat, but future changes could re-introduce dual-surface risk.

---

### F-OB-08 — BotssonProvider mounted in /onboarding layout: intentional but undocumented purpose

**Severity:** INFO

`apps/web/src/app/onboarding/layout.tsx:43` mounts `BotssonProvider` wrapping children. `useAgent` in `BotssonProvider` defaults to `autoStart = false` — no agent connection is made on render. The tool-registry (`useRegisteredTools`) is initialized but empty until wizard steps mount and call `useRegisterTools`.

The wizard steps (`ConfirmDepartments`, `ConfirmRoles`, etc.) call `useRegisterTools("wizard-onboarding-*", tools)` — registering `temporaryTool` definitions in the BotssonProvider tool-registry. These definitions are consumed by `BotssonProvider.useAgent.botssonTools` when a voice session is started. Since no voice session is started from the new `AnimatedWizardShell` path, these registrations are currently inert on `/onboarding`.

**Question for Pontus:** Is the BotssonProvider on `/onboarding` intentional for a future use case where the wizard steps communicate back to a voice agent? If the new wizard flow does not use the Botsson voice agent (it uses `useBotsson` from the scroll-wizard, which is dead code), the `BotssonProvider` wrapping may be a legacy artifact that can be removed.

---

### F-OB-09 — WizardContext.tsx `getOnboardingState` is client-side implementation — never migrated to BFF

**Severity:** LOW (dead code, but clarifies E2 completion status)

ADR-0282 R4 #1 specifies `getOnboardingState` → new `/api/emma/session` BFF (E2). The BFF route exists (F-OB-04). However, the client-side `getOnboardingState` in `WizardContext.tsx:37-70` was never deleted — it is dead code (OnboardingProvider not mounted).

The ADR says the tool moves server-side as a voice-agent capability that can call the BFF. This server-side capability is not yet implemented in `packages/ai/src/capabilities/onboarding/` (Track 1 PR #342, referenced in `useBotsson.ts` docstring). The BFF route exists as the target, but the capability tool that calls it is missing.

**Files:**
- `apps/web/src/app/onboarding/hooks/useBotsson.ts:6-9` — docstring references "onboarding capability tools in packages/ai/src/capabilities/onboarding/ (Track 1, PR #342)"
- `apps/web/src/app/api/emma/session/route.ts` — exists, no consumer

**Action:** Verify PR #342 (onboarding capability tools) landed or is still open. If landed, wire up the BFF consumer. If not landed, this is a known gap in E1/E2 completion.

---

## Compliance Matrix

| Check | Status | Notes |
|---|---|---|
| ADR-0041 onboarding wizard structure | SUPERSEDED / COMPLIANT | ADR correctly marked superseded. Runtime uses AnimatedWizardShell + wizard-definition.ts. |
| ADR-0238 dual-surface / DomainChatOwnership | COMPLIANT (structural) | BotssonShell not mounted on /onboarding. Dual-surface risk absent. ADR-0238 itself still proposed. |
| L-0178 DomainChatOwnership gate | COMPLIANT | No embedded domain chat + no Shell = no gate needed. |
| Phase E: useBotsson LiveKit rewrite | PASS | Zero Ultravox refs. advanceToNextSection stays client via data-channel. |
| Phase E E5: /api/wizard/start LiveKit token | PASS | Correctly mints LiveKit token via livekit-token EF. ADR-0151 workspace_id guard in place. |
| Phase E E2: /api/emma/session BFF | PARTIAL | Route exists, no consumer. Capability tool (Track 1) not verified. |
| Dead code: scroll-based wizard tree | IDENTIFIED | OnboardingProvider, sections/, 8+ components, WizardContext, 2 hooks — all dead. |
| Dead code: ConfirmBusiness + business-tools | IDENTIFIED | Orphaned from wizard-definition.ts. |
| BotssonProvider in /onboarding layout | INFO | Intentional or legacy — purpose unclear post-Phase-E. |

---

## Recommended Actions (priority order)

1. **[MEDIUM]** Clarify `ConfirmBusiness` + `ConfirmProfessions` intent — either add them to `wizard-definition.ts` or delete them. The `loadState()` function loads `professions` into state but no step displays them.
2. **[MEDIUM]** Verify ADR-0282 Track 1 (onboarding capability tools, PR #342) status and wire `/api/emma/session` consumer.
3. **[LOW]** Plan cleanup sortie for dead code: `sections/`, `components/` (scroll-wizard only), `WizardContext.tsx`, `hooks/useOnboardingState.ts`, `hooks/useScrollProgress.ts`.
4. **[LOW]** Update CLAUDE.md onboarding description to reflect AnimatedWizardShell + 6-step wizard architecture.
5. **[INFO]** Decide whether `BotssonProvider` in `/onboarding` layout is intentional or can be removed post-Phase-E.
