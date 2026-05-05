---
title: "Audit Slice 10 — Onboarding Wizard vs ADR-0041"
status: done
created: 2026-05-02
updated: 2026-05-02
module: onboarding
tags: [audit, adr-0041, adr-0238, onboarding, wizard]
---

# Audit Slice 10: Onboarding Wizard vs ADR-0041

## Summary

ADR-0041 describes a **scroll-based** onboarding wizard: 10 sections, 14 UI components, WizardContext, and 3 hooks (useOnboardingState, useScrollProgress, useBotsson). What actually exists is a **bifurcated** implementation: the scroll-based architecture from ADR-0041 is still present (used via the `BotssonProvider` path in `layout.tsx`), but `page.tsx` bypasses it entirely, rendering a `WizardDefinition`-based confirmation wizard via `AnimatedWizardShell`. The two implementations share types and lib files but are otherwise independent code paths.

Critical findings:
1. ADR-0041's count claims (10 sections, 14 components) do not match reality (8 sections in types, 9 visible sections files; 10 components, not 14).
2. `page.tsx` references neither WizardContext nor OnboardingProvider — ADR-0041's stated architecture is not the runtime path.
3. ADR-0238 (`DomainChatOwnership`) is not implemented in the onboarding route. `BotssonProvider` is mounted in `layout.tsx`, and the scroll-based path hosts Botsson voice session via `useBotsson` — dual-surface UX risk applies.
4. Telemetry on `step_completed` allows `workspace_id: null` (early in flow before scrape), which violates ADR Mobile Telemetry Contract (ADR-0134) for non-mobile but is flagged in CLAUDE.md for all surfaces.

---

## Spec vs Reality Table

| Claimed Item (ADR-0041) | Found? | File:Line |
|---|---|---|
| 10 sections | Partial — 8 in `ONBOARDING_SECTIONS` const; 9 `.tsx` files in `sections/` (incl. `CustomerDocumentView`) | `types.ts:26` |
| 14 UI components | No — 10 files in `components/`: AgentControlPanel, AmbientBackground, BigBoard, BotssonAvatar, BusinessCardGrid, DataMaterializer, FinaleOverlay, KeyFactsPanel, SectionReveal, TypewriterText, VoiceSessionOverlay (11 files total) | `components/` dir |
| WizardContext | Yes — exists as `WizardContext.tsx` with `OnboardingProvider` + `useOnboarding` hook | `WizardContext.tsx:29` |
| `useOnboardingState` hook | Yes — signature matches; returns full `OnboardingState & OnboardingActions` | `hooks/useOnboardingState.ts:73` |
| `useScrollProgress` hook | Yes — scroll position + `IntersectionObserver` per spec | `hooks/useScrollProgress.ts:15` |
| `useBotsson` hook | Yes — Ultravox session management + 14 registered client tools | `hooks/useBotsson.ts:331` |
| `useOnboardingWizard` named export | No — ADR-0041 names `useOnboardingWizard`; actual export is `useOnboarding` from WizardContext | `WizardContext.tsx:359` |
| STEP_COMPONENTS map in page.tsx | No — page.tsx uses `AnimatedWizardShell` + `wizard-definition.ts` steps array, not a STEP_COMPONENTS map | `page.tsx:20`, `wizard-definition.ts:348` |
| 24 files total (ADR consequence) | No — actual file count is 53 files across sections/, steps/, components/, hooks/, lib/, __tests__/ | full dir listing |

**Architecture mismatch:** ADR-0041 describes `page.tsx` rendering step components via a `STEP_COMPONENTS` map, dispatching the active step from `WizardContext`. The actual `page.tsx` renders `AnimatedWizardShell` driven by `wizard-definition.ts` (6 `ConfirmXxx` steps). `WizardContext`/`OnboardingProvider` is **not mounted** anywhere in the current `page.tsx` or `layout.tsx`. The scroll-based sections (HeroSection, BusinessSection, etc.) appear to be a legacy parallel path.

---

## Mutation / Telemetry Table

| Mutation | Emit Present? | workspace_id Resolved? | actor_id Resolved? | Notes |
|---|---|---|---|---|
| `completeSection` (step_completed) | Yes | Nullable — `null` until scrape sets `onboardingWorkspaceId` | `nonEmpty(userId)` — throws on empty | `useOnboardingState.ts:382`. Null `workspace_id` allowed early in flow. |
| `finalize` (wizard completed) | Yes | `nonEmpty(workspaceId)` — workspaceId sourced from EF response; throws on empty | `nonEmpty(userId)` | `useOnboardingState.ts:861`. Correct path. |
| `loadState` in `wizard-definition.ts` (DB read, no mutation) | N/A | Reads from `profile.workspace_id` | N/A | Read-only, no emit needed. |
| `onComplete` in `wizard-definition.ts` (finalization) | No emit | Passes `workspaceId` from `state` to EF | N/A | Telemetry emitted by `finalize()` in `useOnboardingState`, but `onComplete` in `wizard-definition.ts` is a **separate code path** — no emit here. |
| `save` (auto-save debounce) | No emit | `onboardingWorkspaceId` or legacy `onboarding_session` | N/A | Silent save, no telemetry. Acceptable for background persistence. |
| Botsson `finalizeOnboarding` tool → `finalizeOnboarding()` in WizardContext | Delegates to `state.finalize()` which emits | Through finalize chain | Through finalize chain | `WizardContext.tsx:118`. Correct delegation. |

**Gap:** `onComplete` in `wizard-definition.ts` (the active runtime path via `AnimatedWizardShell`) does not emit telemetry. It calls the EF directly and redirects. The emit in `useOnboardingState.finalize()` is only reached if `WizardContext` is mounted — which it is not in the current `page.tsx`. This means the `AnimatedWizardShell` path emits no telemetry on finalization.

---

## ADR-0238 DomainChatOwnership Check

ADR-0238 mandates: any page with an embedded domain-specific chat surface MUST declare `<DomainChatOwnership>` so `BotssonShell` suppresses to passive mode.

| Check | Result |
|---|---|
| `BotssonProvider` mounted on onboarding route? | Yes — `layout.tsx:43`. Orb is active on all `/onboarding/*` routes. |
| Embedded voice/chat surface present? | Yes — `useBotsson` hosts an Ultravox voice session; `VoiceSessionOverlay` and `AgentControlPanel` are the domain chat surface. |
| `<DomainChatOwnership>` declared? | **No** — zero occurrences in entire `apps/web/src/app/onboarding/` directory. |
| `DomainChatOwnership` implemented anywhere? | Partially — only a TODO comment in `LonnsprofilSection.tsx:24`. The component/hook does not exist in the codebase. |

ADR-0238 status is `proposed` (not yet `accepted`), but the implementation gap is real: the Botsson Orb and the onboarding voice session coexist with no disambiguation. A user could open the Orb during onboarding and route messages to the wrong AI surface.

---

## Critical Gaps

1. **ADR-0041 is stale** — it describes a STEP_COMPONENTS + WizardContext architecture that is not the runtime path. `page.tsx` uses `AnimatedWizardShell` + `wizard-definition.ts`. The WizardContext / OnboardingProvider are in the codebase but are not mounted by the current page entry point. The ADR should be updated to reflect the bifurcation or the scroll-based path should be removed as dead code.

2. **Finalization telemetry absent from active path** — `wizard-definition.ts:onComplete()` emits nothing. The emit in `useOnboardingState.finalize()` is only reachable if WizardContext is mounted, which it is not. The `AnimatedWizardShell` confirmation wizard path has zero telemetry on finalization. Patch: add `emit({ event: "wizard completed", ... })` inside `onComplete` in `wizard-definition.ts`.

3. **`workspace_id` nullable in `step_completed` emit** — `useOnboardingState.ts:384-387` passes `null` when `onboardingWorkspaceId` is not yet set. This is pre-scrape and by design, but it means early `step_completed` events land in PostHog / activity_trail with no workspace context. Low severity for web (no ADR-0134 mandate) but inconsistent with the rest of the telemetry contract.

4. **ADR-0238 not implemented** — `<DomainChatOwnership>` component does not exist. `BotssonProvider` is mounted in `layout.tsx` with no suppression mechanism. Dual-surface UX defect from ADR-0238 applies to the onboarding route. Since ADR-0238 is still `proposed`, this is not a regression, but the onboarding route should be listed explicitly in ADR-0238's page list when the ADR is accepted.

5. **Section count mismatch** — ADR-0041 claims 10 sections; `ONBOARDING_SECTIONS` defines 8 (`hero`, `business`, `departments`, `locations`, `procedures`, `season`, `contract`, `welcome`), with `contract` filtered out of `VISIBLE_SECTIONS`. The wizard-definition has 6 confirmation steps. Neither matches 10.

6. **Component count mismatch** — ADR-0041 claims 14 UI components. The `components/` directory has 11 files (10 usable components + VoiceSessionOverlay). The `sections/` directory adds 9 more. Even combined that is 20, not 14.
