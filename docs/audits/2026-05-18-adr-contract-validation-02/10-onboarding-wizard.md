---
title: "Audit Slice 10 — Onboarding Wizard"
status: done
created: 2026-05-18
updated: 2026-05-18
module: onboarding
tags: [audit, onboarding, adr-0041, adr-0238, i18n]
---

# Slice 10: Onboarding Wizard

**Surface:** `apps/web/src/app/onboarding/`
**ADRs in scope:** ADR-0041 (superseded), ADR-0238 (DomainChatOwnership)
**Verdict: 2 HIGH findings, 1 INFO**

---

## ADR-0041 — Status: SUPERSEDED, correctly reflected

ADR-0041 (STEP_COMPONENTS + OnboardingProvider) was formally superseded 2026-05-02. The migration to `AnimatedWizardShell` + `wizard-definition.ts` is complete and no legacy files remain (verified by cleanup sortie `feat/audit-fob10-onboarding-cleanup`, commit `20a23aeb0`). State persistence is handled by `useWizardState` via the `loadState()` async hook in `wizard-definition.ts`, which queries `workspace.intelligence_data` from Supabase on mount. The `_initialStepIndex` escape-hatch in `useWizardState.ts:31-39` supports resume-to-step. No `sessionStorage` or `localStorage` is used — persistence is DB-backed. **PASS.**

---

## ADR-0238 — DomainChatOwnership: PARTIAL PASS

`layout.tsx` mounts `<BotssonProvider>` directly (line 46), not via `BotssonHost`. This is intentional: the comment on line 43 notes that `BotssonProvider` is needed because `useSearchParams()` is called internally for session URL param sync.

Critically: `EmmaOverlay` / `BotssonShell` (the Orb) are **NOT mounted** anywhere in `apps/web/src/app/onboarding/`. The layout only wraps children in `BotssonProvider` context — no Orb is rendered. L-0178 requires `<DomainChatOwnership>` only when `BotssonShell` is present on a page that also hosts a domain chat surface. Since there is no Orb on this surface, the `DomainChatOwnership` declaration is not required and is correctly absent. **PASS on L-0178 / ADR-0238.**

However, steps do register tools via `useRegisterTools(...)` into the Botsson tool registry despite no visible Orb. This is architecturally safe (tool registration is a no-op without a consumer), but raises an open question: if `EmmaOverlay` is ever added to the onboarding layout in the future, the dual-surface trap (wizard textbox + Orb) would activate silently. No current defect, but the absence of a guard comment is a latent risk. **INFO.**

---

## FINDING 1 — HIGH: Hardcoded Norwegian text in `ConfirmBusiness.tsx`

**File:** `apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx:31-39`

The `FIELDS` array contains 9 hardcoded Norwegian label strings (`"Bedriftsnavn"`, `"Juridisk navn"`, `"Organisasjonsnummer"`, `"E-post"`, `"Telefon"`, `"Nettside"`, `"Adresse"`, `"By"`, `"Bransje"`) and 9 hardcoded Norwegian placeholder strings. The component does receive `t()` from `WizardStepProps` and uses it for heading/description, but the field labels/placeholders bypass `t()`.

**Rule violated:** CLAUDE.md — "Never hardcode Norwegian text — use i18n keys."

**Fix:** Replace each `label:` and `placeholder:` with `label: t("field.name_label")` etc., add keys to the `onboarding` i18n namespace. The `t()` function is already imported via destructuring from props.

---

## FINDING 2 — HIGH: Hardcoded Norwegian text in `TariffSection.tsx` and `ConfirmRoles.tsx`

**Files:**
- `TariffSection.tsx:64-65` — radio options `"Ja, vi er medlemmer"` / `"Nei, ikke relevant for oss"` hardcoded.
- `TariffSection.tsx:325, 357, 506, 508` — error messages and button labels: `"Uventet svar fra serveren. Prøv igjen."`, `"Nettverksfeil. Sjekk tilkoblingen og prøv igjen."`, `"Koble til tariff og fortsett"`, `"Fortsett"` — all hardcoded.
- `ConfirmRoles.tsx:20-83` — role suggestion names and descriptions (`"Daglig leder"`, `"Restaurantsjef"`, etc.) hardcoded in the ROLE_SUGGESTIONS constant.

Neither `TariffSection.tsx` nor `ConfirmRoles.tsx` imports `useTranslation` or receives `t()` from props. Unlike other steps (`ConfirmBusiness`, `ConfirmDepartments`), these two files have no i18n path at all.

**Rule violated:** CLAUDE.md — "Never hardcode Norwegian text — use i18n keys."

**Fix:** Both components should destructure `t` from `WizardStepProps` (it is passed by `WizardShell` to all step components). Add i18n keys for all visible labels.

---

## Telemetry

`useWizardTelemetry` in `AnimatedWizardShell` emits `emit()` for wizard lifecycle events (started, step_entered, step_completed, abandoned, completed). `workspace_id` and `actor_id` are resolved asynchronously in `AnimatedWizardShellWithAuth` (`page.tsx:28-66`) and passed down. Telemetry correctly applies `nonEmpty()` guard with `null`-tolerance for pre-auth state. **PASS.**

---

## Summary

| Check | Status |
|---|---|
| ADR-0041 supersession complete | PASS |
| AnimatedWizardShell migration, legacy files removed | PASS |
| ADR-0238 / L-0178 — no Orb, no DomainChatOwnership needed | PASS |
| i18n — `ConfirmBusiness.tsx` field labels/placeholders | HIGH |
| i18n — `TariffSection.tsx` and `ConfirmRoles.tsx` | HIGH |
| Tool registry with no Orb mounted (latent) | INFO |
| Telemetry emit coverage | PASS |
