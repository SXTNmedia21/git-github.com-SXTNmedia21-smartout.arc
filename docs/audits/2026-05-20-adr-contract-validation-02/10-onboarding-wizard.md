---
title: "Slice 10 — Onboarding Wizard Audit (post-PR #432)"
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, onboarding-wizard, adr-0041, adr-0238, i18n]
---

# Slice 10: Onboarding Wizard

**Surface:** `apps/web/src/app/onboarding/`
**ADRs in scope:** ADR-0041 (superseded), ADR-0238 (DomainChatOwnership)
**Baseline:** `2026-05-20-adr-contract-validation/10-onboarding-wizard.md` (same-day pre-PR #432)

---

## Summary

PR #432 commit `72a355733` closed all three baseline HIGHs (OW-01/OW-02/OW-03). `ConfirmPositions`, `ConfirmDepartments`, and `ConfirmProcedures` are now fully i18n-compliant. Two MEDIUM-severity gaps remain in `ConfirmLocations` and `ConfirmSummary` — these were not in scope for PR #432 and predate this audit cycle.

**Top 3 findings (post-PR):**

1. **MEDIUM OW-04** — `ConfirmLocations.tsx`: 5 `TYPE_LABELS` values, 3 `SUGGESTED_LOCATIONS` names, and 4 inline action strings (`"Soner"`, `"Sone"` placeholder, `"Legg til"`, `"Avbryt"`, `"Egendefinert lokasjon"`, `"Navn på lokasjon"`) are hardcoded Norwegian. Zero corresponding i18n keys exist under `confirm.locations_type_*` or `confirm.locations_suggested_*` — this requires both code changes and new key additions to both locale files.
2. **MEDIUM OW-05** — `ConfirmSummary.tsx`: 8 hardcoded strings across summary card titles (template literals with `"avdelinger"`, `"lokasjon(er)"`, `"prosedyrer"`), `"Ingen valgt"`, `"Endre"` button, `"Fag & posisjoner"` heading, `"Alt klart. Klikk nedenfor for a fullfare oppsettet."`, and loading state `"Aktiverer..."`. A fallback error string `"Noe gikk galt. Prov igjen."` is also hardcoded. Zero corresponding i18n keys exist for these.
3. **LOW OW-06/OW-07** — `transition-all duration-200` on toggle card buttons in `ConfirmDepartments.tsx:78,87` and `ConfirmProcedures.tsx:102,111`. Nordic Split §10.4 mandates `transition-colors`. Both files also use `bg-white/50` on unselected card backgrounds (lines 81 and 105 respectively) — hardcoded color; should use a CSS variable token (`bg-card/50` or `bg-background/50`).

---

## Findings table

| ID | Severity | File:line | ADR / Rule | Evidence |
|----|----------|-----------|------------|----------|
| OW-04 | MEDIUM | `steps/ConfirmLocations.tsx:20-24,28-30,145,177,241,257,267,277,288` | CLAUDE.md i18n | `TYPE_LABELS` const (5 values: "Hovedlokale","Uteservering","Kjøkken","Filial","Annet"); `SUGGESTED_LOCATIONS` names (3: "Uteservering","Lager","Personalrom"); `Soner` label L145; `placeholder="Sone"` L177; `placeholder="Navn på lokasjon"` L241; `TYPE_LABELS[type]` in type-picker L257; hardcoded `"Legg til"` L267; `"Avbryt"` L277; `"Egendefinert lokasjon"` L288. No `confirm.locations_type_*` or `confirm.locations_*_add/cancel` keys exist in locale files. |
| OW-05 | MEDIUM | `steps/ConfirmSummary.tsx:59,65,74,81,130,142,152,172` | CLAUDE.md i18n | Template literals: `` `${n} avdelinger` `` L59, `` `${n} lokasjon${…}er` `` L65, `` `${n} prosedyrer` `` L74; inline `"Ingen valgt"` L81; `"Endre"` button L130; `"Fag & posisjoner"` heading L142; ready-indicator prose L152; loading state `"Aktiverer..."` L172; catch-branch error string `"Noe gikk galt. Prov igjen."` L45. No `confirm.summary_departments`, `confirm.summary_edit_button`, or equivalent keys exist in locale files. |
| OW-06 | LOW | `steps/ConfirmDepartments.tsx:78,87` | Nordic Split §10.4 | `transition-all duration-200` on toggle card outer + checkbox indicator. Rule mandates `transition-colors`. |
| OW-07 | LOW | `steps/ConfirmProcedures.tsx:102,111` | Nordic Split §10.4 | Same `transition-all duration-200` pattern as OW-06; identical card + checkbox structure. |
| OW-08 | LOW | `steps/ConfirmDepartments.tsx:81`, `steps/ConfirmProcedures.tsx:105` | Nordic Split (CSS vars) | `bg-white/50` as unselected card background in both files. Should be `bg-card/50` or `bg-background/50` — hardcoded color violates ADR-0366. |

---

## Per-ADR rollup

| ADR | Scope | Verdict |
|-----|-------|---------|
| ADR-0041 (superseded) | `page.tsx`, `layout.tsx`, all step files | PASS — `AnimatedWizardShell` + `wizard-definition.ts` fully live. No legacy `OnboardingProvider` or `STEP_COMPONENTS` registry present. |
| ADR-0238 (DomainChatOwnership) | `layout.tsx`, all step files | PASS — `BotssonProvider` mounts in layout but `BotssonShell` and `EmmaOverlay` are not rendered on the onboarding surface. `<DomainChatOwnership>` not required (no dual-surface risk). See Verified Intentional below. |
| CLAUDE.md i18n rule | `ConfirmLocations.tsx` | FAIL — 14 hardcoded Norwegian strings; 0 corresponding locale keys |
| CLAUDE.md i18n rule | `ConfirmSummary.tsx` | FAIL — 9 hardcoded Norwegian strings; 0 corresponding locale keys |
| CLAUDE.md i18n rule | `ConfirmPositions.tsx` | PASS — all 8 visible strings use `t()`. Keys: `confirm.positions_title/description/custom/custom_placeholder`, `positions.selectedCount/noneSelected/addPosition/noDepartments` |
| CLAUDE.md i18n rule | `ConfirmDepartments.tsx` | PASS — PR #432 closed OW-02. All strings now use `t()`. |
| CLAUDE.md i18n rule | `ConfirmProcedures.tsx` | PASS — PR #432 closed OW-03. All strings now use `t()`. |
| CLAUDE.md i18n rule | `ConfirmBusiness.tsx`, `TariffSection.tsx`, `ConfirmRoles.tsx` | PASS — closed in prior cycles (H3 i18n sortie + PR #432 commit `a36b88db2`). |
| Nordic Split §10.4 | `ConfirmDepartments.tsx`, `ConfirmProcedures.tsx` | PARTIAL — `transition-all` not replaced with `transition-colors`; `bg-white/50` not replaced with CSS variable token (OW-06/07/08). |
| Telemetry (`emit()`) | `AnimatedWizardShell` / `useWizardTelemetry.ts` | PASS — `useWizardTelemetry` hook wires `emit()` for `wizard started`, `step_entered`, `step_completed`, `step_skipped`, `step_back`, `wizard completed`, `wizard validation_failed`. Shell passes all callbacks at mount. |

---

## Baseline closure verification (PR #432 commit 72a355733)

| Baseline finding | Status |
|-----------------|--------|
| HIGH OW-01 — `ConfirmPositions.tsx` zero `t()` | CLOSED — `t` now destructured in props; 8 call sites confirmed in code review |
| HIGH OW-02 — `ConfirmDepartments.tsx` partial | CLOSED — count badge, "Forslag" badge, placeholder, "Legg til", "Legg til egen avdeling" all migrated |
| HIGH OW-03 — `ConfirmProcedures.tsx` partial | CLOSED — "Anbefalt"/"Egendefinert"/"Forslag" badges, deselect-warning prose, "Ja, fjern"/"Behold" buttons, placeholder all migrated |
| HIGH — `ConfirmBusiness.tsx` / `TariffSection.tsx` / `ConfirmRoles.tsx` (prior cycle) | CLOSED — verified via prior audit cycle + code read |

---

## Verified intentional

**ADR-0238 absence:** `BotssonProvider` is mounted in `layout.tsx:46` but `BotssonShell` is never rendered anywhere in the onboarding surface tree. The `useRegisterTools` calls in step components (`ConfirmDepartments`, `ConfirmProcedures`, `ConfirmLocations`, `ConfirmSummary`) register tool stubs with the provider context for AI-guided wizard navigation, but no interactive chat Orb is presented to the user. This means no dual-surface ambiguity exists and `<DomainChatOwnership>` is correctly absent. If `BotssonShell` or `EmmaOverlay` is ever added to this layout, `<DomainChatOwnership reason="onboarding-wizard" />` must be declared per ADR-0238.

**`ConfirmBusiness.tsx` `bg-[var(--panel-deep)]`:** CSS variable token, not a hardcoded color. Compliant with ADR-0366.

**`ConfirmSummary.tsx` error catch fallback (`"Noe gikk galt. Prov igjen."`):** Classified as a MEDIUM-severity i18n miss, not a critical path violation. The finalization flow has a happy-path `t("confirm.finalize")` call; only the catch branch is missing i18n coverage.

**Telemetry hooks:** `useWizardTelemetry` (not `useOnboardingState`/`useScrollProgress` — those names appear to be from an earlier architecture not reflected in the current codebase). Telemetry is wired at the shell level, not per-step; step mutations do not individually call `emit()` because the shell intercepts `onStepComplete`/`onComplete`. This is the correct pattern for wizard surfaces (emit once at transition, not on every `updateState` call).

---

## In-progress / suppressed

No mid-campaign files on this surface. OW-04 and OW-05 are pre-existing gaps not targeted by PR #432.

---

## Remediation guidance (non-normative)

**OW-04 + OW-05** require two coordinated changes per finding:
1. Add missing keys to `packages/i18n/locales/nb/onboarding.json` and `packages/i18n/locales/en/onboarding.json` under `confirm.*`
2. Replace hardcoded strings with `t("confirm.<key>")` in the component

Estimated effort: ~45 min per file (OW-04 has 14 strings + constant extraction; OW-05 has 9 strings + template literal conversion to `t()` with interpolation params).

**OW-06/07/08** are mechanical one-line replacements: `transition-all` → `transition-colors`, `bg-white/50` → `bg-card/50`.
