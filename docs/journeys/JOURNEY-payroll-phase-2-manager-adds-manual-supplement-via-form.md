---
title: "Journey — Manager adds manual supplement via form"
feature: payroll-phase-2
journey: manager-adds-manual-supplement-via-form
status: draft
verified_at: null
e2e_test: null
created: 2026-05-07
updated: 2026-05-07
module: payroll
tags: [journey, payroll, manager, manual-supplement, ui-mockup, screen-06]
---

# Journey: Manager adds manual supplement via Screen 06 form

**Role:** manager (or admin)

**Precondition:**
- Periode-detalj-side åpnet (`/dashboard/payroll/[periodId]`)
- Periode `status='open'`
- `add_manual_supplement` capability tool er shipped (P1 backend)
- Workspace har minst én ansatt m/ aktiv `employee_payroll_profile`

## Happy Path

1. Manager står på `/dashboard/payroll/[periodId]` → ser PeriodHeader m/ tabs (Linjer/Avvik/...)
2. Manager klikker "+ Manuelt tillegg"-knappen i header (eller i LineDrawer på en ansatt-rad) → System åpner ManualSupplementForm-modal (Screen 06 mockup)
3. **Modal-felt (per Sofia Screen 06 mockup):**
   - **Ansatt** (required): selector m/ Avatar + navn + dept + lønnstype
   - **Type** (required): 4-grid radio (Bonus / Forskudd / Trekk / Annet) — Bonus default selected
   - **Beløp** (required): kr-input m/ Geist Mono font, default tom
   - **Lønnskode** (optional): selector "5210 · Bonus skattepliktig" m/ A-melding-hint
   - **Beskrivelse** (required): textarea "vises på lønnsslipp"
   - **Skattepliktig** (toggle, default ON): "Alminnelig" vs "Trekkfri"
   - **Dato** (required): date-picker, default today
4. Manager fyller ut: Anna Kvist, Bonus, 200 kr, lønnskode 5210, "Ekstra hjelp Skjærtorsdag", taxable=ON, dato=2026-04-15
5. Manager klikker "Lagre" → System kaller `add_manual_supplement(profile_id, period_id, type, amount_cents, description, paycode, is_taxable, supplement_date)` capability tool:
   - Verify periode i workspace + status='open' (ADR-0151, L-0177 fail-fast)
   - Verify profile i workspace
   - Insert `payroll_manual_supplement` row
   - Emit `payroll.manual_supplement_added`
6. **Recalc-trigger fires (NEW Phase 2):** DB trigger på `payroll_manual_supplement` AFTER INSERT → emit `engine_event` for recalc → recalculate_period RPC runs → payroll_calculation oppdatert m/ ny line type='manual_supplement'
7. UI: toast "Manuelt tillegg lagt til (200 kr)" + modal lukker + LinesTable viser ny rad m/ animation + total oppdatert <2s

## Error Paths

- **Periode låst:** Manager prøver å åpne form på `status='locked'` periode → "+ Manuelt tillegg"-knapp disabled m/ tooltip "Periode låst — corrective period i neste periode"
- **Validation feil:** Beløp 0 eller negativ → form-validering rejecter m/ feilmelding under feltet
- **Ansatt ikke i workspace:** Manager velger profile som hører til annen workspace → tool returnerer 403 m/ "Ansatt ikke i denne workspace" (ADR-0151)
- **Concurrent recalc:** En annen manager låser perioden samtidig → toast "Periode låst av X — kan ikke legge til" + form lukker auto
- **Channel violation:** Tool kalt fra voice-channel → ADR-0078 PII-block (manuelt tillegg = PII) → "Lønnsdata kun via chat/web"

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manuelt verifisert: 200 kr Bonus → recalc fires → total oppdatert <2s
- [ ] **UI matches Sofia Screen 06 mockup pixel-equivalent** (modal width 640, Avatar+Field components fra `shared.jsx`, Nordic Split tokens, Geist Mono på beløp)
- [ ] activity_trail audit-row finnes m/ workspace_id + actor_id (manager) + payload (amount + description) (ADR-0186)
- [ ] Period status='locked' blokker form-åpning m/ klar UX
- [ ] Telemetry: `payroll.manual_supplement_added` + `payroll.recalc_triggered_by_supplement` fyrer
- [ ] Tool gatedMutation + L-0177 fail-fast verified

**Mark `status: verified` in frontmatter when all seven boxes are checked.**
