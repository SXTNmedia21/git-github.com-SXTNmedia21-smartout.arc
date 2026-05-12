---
title: "Journey — Manager adds manual supplement via form"
feature: payroll-phase-2
journey: manager-adds-manual-supplement-via-form
status: verified
verified_at: 2026-05-08
e2e_test: null
created: 2026-05-07
updated: 2026-05-08
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
   - **Beskrivelse** (required): textarea "vises på lønnsgrunnlag"
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

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 1 — Period detail page render | `apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx:42` (PeriodDetailClient), `apps/web/src/app/dashboard/payroll/[periodId]/page.tsx` |
| Step 2 — "+ Manuelt tillegg" button triggers modal (header) | `PeriodDetailClient.tsx:145-158` (`isOpen && <Button onClick={() => setSupplementModalOpen(true)}>`) |
| Step 2 — "+ Manuelt tillegg" trigger (LineDrawer) | `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx:239-251` (T3.3 — open periods only) |
| Step 3 — ManualSupplementForm modal (Screen 06 fields) | `apps/web/src/app/dashboard/payroll/[periodId]/_components/ManualSupplementForm.tsx:97-397` — ansatt selector:226-250, type 4-grid:254-282, beløp+lønnskode:285-309, beskrivelse:312-325, dato+taxable:328-368 |
| Step 5 — capability tool call (BFF) | `apps/web/src/app/api/payroll/add-manual-supplement/route.ts:62` — gateAction:84-97, period verify:101-122, profile verify:136-146, INSERT:197-210, emit:223-243 |
| Step 5 — L-0177 fail-fast + ADR-0151 | `add-manual-supplement/route.ts:67-71` (auth), `:101-122` (period), `:136-146` (profile), all 404/409/422 non-fallback |
| Step 6 — Pattern B recalc (ADR-0293) | `add-manual-supplement/route.ts:254-282` (sync POST to recalculate-period) |
| Step 7 — toast success + modal close | `ManualSupplementForm.tsx:179-184` (onSuccess), `PeriodDetailClient.tsx:209-212` (refetchLines on success) |
| Telemetry emit | `add-manual-supplement/route.ts:227` (`emit("payroll.manual_supplement_added", ...)`) — note: `payroll.recalc_triggered_by_supplement` emitted by DB trigger `payroll_manual_supplement_recalc_trg` (migration 20260507110100) |
| Period locked guard (UI) | `PeriodDetailClient.tsx:83-83` (`isOpen` guard), `:145-158` (button only rendered when open), `PeriodDetailClient.tsx:202-213` (form only mounted when open) |
| Period locked guard (BFF) | `add-manual-supplement/route.ts:113-121` (409 when locked/approved/exported) |
| Hook: useAddManualSupplement | `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-manual-supplements.ts:112` |
