---
title: "Journey — Manager proposes line override"
feature: payroll-phase-2
journey: manager-proposes-line-override
status: draft
verified_at: null
e2e_test: null
created: 2026-05-07
updated: 2026-05-07
module: payroll
tags: [journey, payroll, manager, line-override, change-proposal]
---

# Journey: Manager proposes line override

**Role:** manager (or admin)

**Precondition:**
- Periode-detalj åpnet (`/dashboard/payroll/[periodId]`)
- Periode `status='open'`
- LinesTable viser minst én derivert linje (source='derived', ikke manual)
- Manager har `confirm`-authority på `override_calculation_line` (ADR-0204)

## Happy Path

1. Manager klikker profil-rad i LinesTable → System åpner LineDrawer
2. Manager klikker linje-rad i Linjer-tab (e.g. "Kveldstillegg 64.04 kr") → linje ekspanderer m/ trace-viz fra P1
3. Manager ser ny "Overstyr linje"-knapp på derived-linjer (ikke vises på manual_supplement-linjer eller pending-override)
4. Manager klikker "Overstyr linje" → System åpner OverrideLineModal m/:
   - **Original verdi**: 64.04 kr (read-only, fra payroll_calculation)
   - **Foreslått ny verdi** (required): kr-input
   - **Grunn** (required): textarea (min 10 chars)
   - **Kategori** (optional): "Manuell justering / Tariff-tolkning / Vakt-data feil / Annet"
   - Hint: "Forslag sendes til admin for godkjenning"
5. Manager fyller ut: ny verdi 80.00 kr, grunn "Tariff-tolkning §6 — kveldstillegg gjelder hele vakt iht. lokal avtale", kategori="Tariff-tolkning"
6. Manager klikker "Send forslag" → System kaller `override_calculation_line(period_id, calculation_id, new_amount_cents, reason, category)` capability tool:
   - Verify periode i workspace + status='open' (ADR-0151, L-0177 fail-fast)
   - Verify calculation_id eksisterer i periode + source='derived' (kan ikke override manual)
   - Insert `change_proposal` row m/ kind='wage_line_override', status='pending', payload JSONB (original_amount, proposed_amount, reason, category, calculation_id)
   - Emit `payroll.line_override_proposed`
7. UI: toast "Forslag sendt til admin" + linje får "Venter godkjenning"-badge (orange pill) + Overstyr-knapp disabled
8. LinesTable viser badge på linja: "⏳ Venter godkjenning" m/ tooltip "Forslag fra Manager X kl. HH:MM"

**Postcondition:**
- `change_proposal` row eksisterer m/ status='pending', kind='wage_line_override'
- `payroll_calculation` row UENDRET (override applies kun ved status='applied')
- LineDrawer + LinesTable viser pending-state badge
- Manager kan ikke sende ny override på samme linje før admin avgjør
- activity_trail audit-row m/ before-state (null = ingen override) + after-state (proposal payload)

## Error Paths

- **Periode låst:** "Overstyr linje"-knapp disabled m/ tooltip "Periode låst"
- **Linje er manual_supplement:** Knapp ikke vises (manual rader edites/slettes via egen flow)
- **Linje har pending override:** Knapp disabled m/ "Venter godkjenning"-badge
- **Validation feil:** Grunn < 10 chars eller new_amount = original_amount → form-validering rejecter
- **Concurrent edit:** Annen manager sender override på samme linje samtidig → andre manager får 409 m/ "Forslag finnes allerede"
- **Channel violation:** Tool fra voice-channel → ADR-0078 PII-block

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manuelt verifisert: override-flow fra LineDrawer → change_proposal row inserted
- [ ] OverrideLineModal følger Nordic Split design-tokens + Sofia kanoniske komponenter
- [ ] activity_trail row finnes m/ workspace_id + actor_id + payload (ADR-0186)
- [ ] Telemetry: `payroll.line_override_proposed` fyrer
- [ ] Tool gatedMutation + L-0177 fail-fast verified
- [ ] "Venter godkjenning"-badge visible på pending-linje i LinesTable + LineDrawer
- [ ] Period status='locked' blokker tool m/ klar UX

**Mark `status: verified` in frontmatter when all seven boxes are checked.**
