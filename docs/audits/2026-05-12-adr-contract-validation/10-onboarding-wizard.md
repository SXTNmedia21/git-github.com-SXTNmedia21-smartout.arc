---
title: Slice 10 — onboarding-wizard Audit
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, onboarding-wizard, adr]
---

## Summary

1. **HIGH** — `actor_id: "anonymous"` emitted to `activity_trail` on wizard mount before auth resolves; `nonEmpty()` does not reject the literal string "anonymous", so corrupt events reach production. `page.tsx:32`, `useWizardTelemetry.ts:26`.
2. **HIGH** — `emitWizardStarted` fires twice per session: once on initial render (actor=anonymous, workspace=null) and again when `authContext` resolves (dependency array `[telemetry.emitWizardStarted]` recreates callback on prop change). Duplicate `wizard started` events in `activity_trail`. `AnimatedWizardShell.tsx:102-104`.
3. **MEDIUM** — `sections/` directory (9 files: HeroSection, BusinessSection, DepartmentsSection, LocationsSection, ProceduresSection, SeasonSection, WelcomeSection, DoneSection, CustomerDocumentView) is dead code. All call `useOnboarding()` from `WizardContext.tsx`, which requires `OnboardingProvider` — never mounted in current `page.tsx`. Would throw at runtime if any section were imported. ADR-0041 (superseded) footnote confirms OnboardingProvider is not mounted, but the files remain.
4. **MEDIUM** — `WizardContext.tsx` (`OnboardingProvider`) and all its state machinery (scroll-based architecture) are orphaned. File is 364 lines. Not imported by page.tsx or wizard-definition.ts. CLAUDE.md spec still says "10 sections + 14 components + WizardContext + 3 hooks" — this description matches the old scroll implementation, not the current wizard. Spec drift is a maintenance trap.
5. **LOW** — Hardcoded Norwegian strings in 6 wizard step files without i18n keys: `placeholder="Avdelingsnavn"` (ConfirmDepartments:116), `placeholder="Stillingstittel"` (ConfirmPositions:185), `placeholder="Sone"` / `"Navn på lokasjon"` (ConfirmLocations:177, 241), `placeholder="Posisjonsnavn"` (ConfirmProfessions:165), `placeholder="Rollenavn"` (ConfirmRoles:251), `placeholder="Prosedyrenavn"` (ConfirmProcedures:179), `"Ingen valgt"` (ConfirmSummary:81), `"Roller"` heading (ConfirmRoles:164). Violates CLAUDE.md "never hardcode Norwegian text — use i18n keys".

---

## Findings table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| OW-01 | HIGH | `apps/web/src/app/onboarding/page.tsx:32` | ADR-0134 | Initial `actorId: "anonymous"` state passed to `AnimatedWizardShell`; `nonEmpty("anonymous")` returns the sentinel string — corrupt actor logged to `activity_trail`. |
| OW-02 | HIGH | `apps/web/src/components/wizard/AnimatedWizardShell.tsx:102-104` | ADR-0134 | `useEffect([telemetry.emitWizardStarted])` re-fires when auth resolves → duplicate `wizard started` events; first event always has `actor_id="anonymous"`. |
| OW-03 | MEDIUM | `apps/web/src/app/onboarding/sections/*.tsx` (9 files) | ADR-0041 | Dead code: all sections call `useOnboarding()` which requires `OnboardingProvider` (never mounted); would throw `useOnboarding must be used within OnboardingProvider` at runtime if imported. |
| OW-04 | MEDIUM | `apps/web/src/app/onboarding/WizardContext.tsx` (364 lines) | ADR-0041 | `OnboardingProvider` and scroll-based state are orphaned — not referenced by `page.tsx` or `wizard-definition.ts`. CLAUDE.md still documents the old architecture. |
| OW-05 | LOW | `apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx:116` | CLAUDE.md i18n rule | `placeholder="Avdelingsnavn"` — hardcoded Norwegian, no i18n key. |
| OW-06 | LOW | `apps/web/src/app/onboarding/steps/ConfirmRoles.tsx:164,251` | CLAUDE.md i18n rule | `<h2>Roller</h2>` heading and `placeholder="Rollenavn"` — hardcoded Norwegian. |
| OW-07 | LOW | `apps/web/src/app/onboarding/steps/ConfirmPositions.tsx:143,185` | CLAUDE.md i18n rule | `"Ingen stillinger valgt"` and `placeholder="Stillingstittel"` — hardcoded Norwegian. |
| OW-08 | LOW | `apps/web/src/app/onboarding/steps/ConfirmLocations.tsx:177,241` | CLAUDE.md i18n rule | `placeholder="Sone"` and `placeholder="Navn på lokasjon"` — hardcoded Norwegian. |
| OW-09 | LOW | `apps/web/src/app/onboarding/steps/ConfirmProcedures.tsx:179` | CLAUDE.md i18n rule | `placeholder="Prosedyrenavn"` — hardcoded Norwegian. |
| OW-10 | LOW | `apps/web/src/app/onboarding/steps/ConfirmProfessions.tsx:86,165` | CLAUDE.md i18n rule | `defaultValue: "Bekreft hvilke posisjoner..."` and `placeholder="Posisjonsnavn"` — hardcoded Norwegian. |
| OW-11 | LOW | `apps/web/src/app/onboarding/steps/ConfirmSummary.tsx:81` | CLAUDE.md i18n rule | `"Ingen valgt"` — hardcoded Norwegian. |
| OW-12 | INFO | CLAUDE.md | ADR-0041 | CLAUDE.md onboarding spec ("10 sections + 14 components + WizardContext + 3 hooks") describes old scroll architecture; current implementation has 9 section files (dead), 11 components, 8 confirm-steps, 6 wizard steps defined. Stale but not a code violation. |

---

## Per-ADR rollup

| ADR | Files checked | Compliant | Partial | Violation |
|-----|--------------|-----------|---------|-----------|
| ADR-0041 (superseded) | page.tsx, WizardContext.tsx, wizard-definition.ts, sections/*, components/* | 2 | 1 | 0 |
| ADR-0238 | layout.tsx, page.tsx, Botsson/BotssonProvider.tsx | ✅ | — | — |
| ADR-0134 (telemetry) | page.tsx, AnimatedWizardShell.tsx, useWizardTelemetry.ts | — | — | 🔴 |

**ADR-0041 notes:** ADR is superseded; `page.tsx` correctly uses `AnimatedWizardShell` + `wizard-definition.ts` (as the supersession note describes). `sections/` dead code and orphaned `WizardContext.tsx` are cleanup debt, not violations of the supersession.

**ADR-0238 notes:** No dual-surface violation on `/onboarding`. `layout.tsx` mounts `BotssonProvider` (context only — does NOT render `BotssonShell`/Orb). `BotssonShell` is only mounted in `platform-admin/layout.tsx`. `AnimatedWizardShell` is not a Botsson chat surface. `DomainChatOwnership` declaration is not required here (no competing Orb). L-0178 trap does not apply.

**ADR-0134 notes:** `actor_id="anonymous"` is a non-empty string, so `nonEmpty()` passes it through without guard. Corrupt events reach `activity_trail` with a literal "anonymous" actor before auth resolves. This violates the ADR-0134 / ADR-0193 guarantee that `actor_id` resolves to a real identity before emit.

---

## Verified intentional

None from the known-false-positives list apply to this surface.

**New intentional pattern confirmed:**
- `BotssonProvider` on `/onboarding` is voice-only (LiveKit `useBotsson` hook): it provides context for the `VoiceSessionOverlay` and `AgentControlPanel` components. It does NOT render `BotssonShell` (the bottom-right Orb chat bubble). The ADR-0238 concern (dual chat surfaces) does not apply to this route.

---

## In-progress (mid-campaign)

None. `/onboarding` is described as legacy co-existing with `/join` (live). OW-03 and OW-04 are cleanup debt from the wizard-to-AnimatedWizardShell migration; they are drift, not mid-campaign violations.
