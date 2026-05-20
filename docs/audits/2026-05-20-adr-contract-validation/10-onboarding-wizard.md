---
title: Slice 10 — Onboarding Wizard Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, onboarding-wizard, adr-0041, adr-0238, i18n]
---

# Slice 10: Onboarding Wizard

**Surface:** `apps/web/src/app/onboarding/`
**ADRs in scope:** ADR-0041 (superseded), ADR-0238 (DomainChatOwnership)
**Baseline:** `2026-05-18-adr-contract-validation-02/10-onboarding-wizard.md`

---

## Summary

Top findings by severity:

1. **HIGH OW-01** — `ConfirmPositions.tsx` has zero `t()` usage; all visible text hardcoded in Norwegian (heading, description, counter, button labels, empty states, popover labels).
2. **HIGH OW-02** — `ConfirmDepartments.tsx` partially i18n-ised (heading/description use `t()`) but count badge, "Forslag" badge, button labels, and input placeholder are all hardcoded Norwegian.
3. **HIGH OW-03** — `ConfirmProcedures.tsx`: count badge, "Anbefalt"/"Egendefinert"/"Forslag" badges, deselect-warning prose, button labels, and input placeholder are all hardcoded Norwegian.
4. **MEDIUM OW-04** — `ConfirmLocations.tsx`: `TYPE_LABELS` map (5 Norwegian strings), `SUGGESTED_LOCATIONS` names (3 strings), "Soner" label, and all action button labels/placeholders hardcoded.
5. **MEDIUM OW-05** — `ConfirmSummary.tsx`: summary card titles ("avdelinger", "lokasjoner", "soner"), section heading "Fag & posisjoner", "Endre" button, "Ingen valgt", and ready-indicator prose are hardcoded Norwegian.

Baseline HIGHs for `ConfirmBusiness.tsx`, `TariffSection.tsx`, and `ConfirmRoles.tsx` **all resolved** since 2026-05-18.

---

## Findings table

| ID | Severity | File:line | ADR / Rule | Evidence |
|----|----------|-----------|------------|----------|
| OW-01 | HIGH | `steps/ConfirmPositions.tsx:99-106,143,155,200,218` | CLAUDE.md i18n | Component signature has `{ state, updateState }` — `t` not destructured; heading "Stillinger", description, counter, all button labels, empty-state strings are hardcoded Norwegian |
| OW-02 | HIGH | `steps/ConfirmDepartments.tsx:64,99,117,126,145` | CLAUDE.md i18n | Count: `` `${selectedCount} valgt av ${departments.length} forslag` `` hardcoded; "Forslag" badge L99; `placeholder="Avdelingsnavn"` L117; "Legg til" L126; "Legg til egen avdeling" L145 |
| OW-03 | HIGH | `steps/ConfirmProcedures.tsx:87,119,123,133,143,150,154,179,209` | CLAUDE.md i18n | Count string hardcoded L87; "Anbefalt" L119, "Egendefinert" L123, "Forslag" L133 badges; deselect-warning prose + "Ja, fjern"/"Behold" buttons L143-154; placeholder L179; "Legg til egen prosedyre" L209 |
| OW-04 | MEDIUM | `steps/ConfirmLocations.tsx:19-25,27-31,144,177,242,265,273,289` | CLAUDE.md i18n | `TYPE_LABELS` object (5 Norwegian values) and `SUGGESTED_LOCATIONS` names (3 strings) as module-level constants; inline labels "Soner", placeholder "Sone", "Navn på lokasjon", "Legg til", "Avbryt", "Egendefinert lokasjon" |
| OW-05 | MEDIUM | `steps/ConfirmSummary.tsx:59,63-64,74,88-89,131,135,152,169` | CLAUDE.md i18n | Summary card titles constructed with hardcoded Norwegian strings; "Fag & posisjoner" heading; "Ingen valgt"; "Endre" button; ready-indicator prose "Alt klart…"; loading state "Aktiverer…" |
| OW-06 | LOW | `steps/ConfirmDepartments.tsx:75,84` | Nordic Split §10.4 | `transition-all duration-200` used instead of `transition-colors` on toggle button and checkbox indicator |
| OW-07 | LOW | `steps/ConfirmProcedures.tsx:99,108` | Nordic Split §10.4 | Same `transition-all duration-200` pattern as OW-06 |
| OW-08 | LOW | `steps/ConfirmDepartments.tsx:78` `steps/ConfirmProcedures.tsx:102` | Nordic Split (CSS vars) | `bg-white/50` used as unselected card background — hardcoded color, should be `bg-card/50` or `bg-background/50` |

---

## Per-ADR rollup

| ADR | File | Verdict |
|-----|------|---------|
| ADR-0041 (superseded) | All onboarding files | ✅ supersession complete; AnimatedWizardShell + wizard-definition.ts; no legacy imports |
| ADR-0238 (DomainChatOwnership) | `layout.tsx`, all step files | ✅ no BotssonShell/EmmaOverlay mounted; `<DomainChatOwnership>` not required |
| CLAUDE.md i18n rule | `ConfirmPositions.tsx` | 🔴 violation — `t` not even destructured |
| CLAUDE.md i18n rule | `ConfirmDepartments.tsx`, `ConfirmProcedures.tsx` | 🔴 violation — partial coverage, bulk of UI strings hardcoded |
| CLAUDE.md i18n rule | `ConfirmLocations.tsx`, `ConfirmSummary.tsx` | ⚠️ partial — headings use `t()`, action/data strings hardcoded |
| CLAUDE.md i18n rule | `ConfirmBusiness.tsx`, `TariffSection.tsx`, `ConfirmRoles.tsx` | ✅ compliant — baseline findings resolved |
| Nordic Split §10.4 | `ConfirmDepartments.tsx`, `ConfirmProcedures.tsx` | ⚠️ partial — `transition-all` not replaced with `transition-colors`; `bg-white/50` not replaced with CSS var |

---

## Resolved since baseline (2026-05-18)

| Baseline Finding | Resolution |
|------------------|-----------|
| HIGH — `ConfirmBusiness.tsx` field labels/placeholders hardcoded | FIXED: FIELDS array now uses `labelKey`/`placeholderKey`; render calls `t(field.labelKey)` / `t(field.placeholderKey)` |
| HIGH — `TariffSection.tsx` + `ConfirmRoles.tsx` no i18n | FIXED: Both components now receive and use `t` from `WizardStepProps`; all visible strings use i18n keys |

---

## Verified intentional

- **ADR-0238 / L-0178 absence**: `BotssonProvider` is mounted in layout but `BotssonShell` / `EmmaOverlay` are not rendered anywhere in the onboarding surface. `<DomainChatOwnership>` is correctly absent. Tool registrations (`useRegisterTools`) in step components are no-ops without a consumer Orb — architecturally safe. Latent risk if `EmmaOverlay` is ever added remains an open INFO item from baseline (no current defect).

- **`ConfirmBusiness.tsx` `bg-[var(--panel-deep)]`**: used in the layout outer wrapper — this is a CSS variable token, not a hardcoded color. Compliant.

---

## In-progress (mid-campaign)

No mid-campaign files identified for this surface. All 8 active campaigns are on separate surfaces. No issues suppressed.
