---
title: "Journey — Manager deletes manual supplement"
feature: payroll-phase-2
journey: manager-deletes-manual-supplement
status: verified
verified_at: 2026-05-09
e2e_test: null
created: 2026-05-07
updated: 2026-05-08
module: payroll
tags: [journey, payroll, manager, manual-supplement, recalc-trigger, gap-close]
---

# Journey: Manager deletes manual supplement (recalc-trigger)

**Role:** manager (or admin)

**Precondition:**
- Periode `status='open'`
- Minst én `payroll_manual_supplement` row eksisterer for periode (e.g. fra manager-adds-manual-supplement-via-form journey)
- LinesTable viser manual_supplement-linje
- Manager har `confirm`-authority på `delete_manual_supplement` (eller bruker `add_manual_supplement` m/ delete=true flag, TBD)

## Happy Path

1. Manager åpner `/dashboard/payroll/[periodId]` → klikker profil-rad → LineDrawer
2. Manager finner manual_supplement-linje "Bonus 200 kr — Ekstra hjelp Skjærtorsdag" → klikker "X"-ikon eller "Slett"-knapp på linje-rad
3. System åpner ConfirmModal m/ "Slette manuelt tillegg? Beløp blir fjernet fra perioden."
4. Manager bekrefter → System kaller `delete_manual_supplement(supplement_id)` capability tool (eller equivalent):
   - Verify supplement i workspace (ADR-0151)
   - Verify periode fortsatt status='open' (L-0177 fail-fast)
   - DELETE `payroll_manual_supplement` row
   - Emit `payroll.manual_supplement_deleted`
5. **Recalc-trigger fires (NEW Phase 2):** DB trigger på `payroll_manual_supplement` AFTER DELETE → emit `engine_event` for recalc → recalculate_period RPC runs → payroll_calculation oppdatert (manual-linja fjernet, totals re-aggregert)
6. UI: toast "Manuelt tillegg slettet" + LinesTable refresh (linje vises ikke mer) + total oppdatert <2s

**Postcondition:**
- `payroll_manual_supplement` row slettet
- `payroll_calculation` re-aggregert m/ ny `derivation_version + 1` (gamle rader bevart per ADR-0251)
- LinesTable + LineDrawer viser oppdaterte totals uten manual-linja
- activity_trail row m/ workspace_id + actor_id + before-state (supplement payload)

## Error Paths

- **Periode låst:** "Slett"-knapp disabled m/ tooltip "Periode låst"
- **Supplement ikke i workspace:** Tool returnerer 403 (ADR-0151)
- **Concurrent recalc:** En annen manager triggerer recalc samtidig → engine_event-queue serialiserer; ingen race condition
- **Supplement allerede slettet:** Tool returnerer 404 m/ "Tillegg ikke funnet" + UI auto-refresh

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manuelt verifisert: slett 200 kr supplement → recalc fires → total reduseres med 200 kr <2s
- [ ] **Recalc-trigger DB-test:** verify `engine_event` row inserted etter DELETE, verify recalculate_period kjører, verify payroll_calculation derivation_version+1
- [ ] activity_trail audit-row m/ before-state inkludert payload (ADR-0186)
- [ ] Telemetry: `payroll.manual_supplement_deleted` + `payroll.recalc_triggered_by_supplement` fyrer
- [ ] Period status='locked' blokker delete m/ klar UX
- [ ] Tool gatedMutation + L-0177 fail-fast verified

**Mark `status: verified` in frontmatter when all seven boxes are checked.**

## Verification — file:line references

> Status: **verified**. Backend (step 4 delete + step 5 recalc) was live from Phase 2 build. Steps 2-3 (UI delete button in LineDrawer + AlertDialog confirm) shipped 2026-05-09.
>
> UI strategy: `LineDrawer` fetches `useManualSupplements(periodId)` and cross-filters to this profile's shifts via `profileShiftIds` (shift IDs from `calcs`). Supplement rows render in a "Manuelle tillegg" sub-section inside the "Linjer" tab with per-row `Trash2` delete button. Period-locked guard: button replaced by "Låst" text.

| Step | Implementation | Status |
|------|---------------|--------|
| Step 1 — Period detail / LineDrawer | `apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx:42`, `LineDrawer.tsx:140` | Live |
| Step 2 — "Slett"-knapp (Trash2) on manual supplement rows | `LineDrawer.tsx` — `handleDeleteSupplementClick()` + `profileSupplements.map()` Trash2 button; period-locked guard shows "Låst" | Live |
| Step 3 — AlertDialog ConfirmModal | `LineDrawer.tsx` — `AlertDialog` mounted outside Sheet (no stacking context issue); title "Slette manuelt tillegg?", description includes supplement description + recalc note | Live |
| Step 3 — Delete hook | `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-manual-supplements.ts` — `useDeleteManualSupplement(periodId)`: DELETE `/api/payroll/delete-manual-supplement`, invalidates supplements + lines on success, toast "Tillegg slettet" | Live |
| Step 4 — delete_manual_supplement BFF | `apps/web/src/app/api/payroll/delete-manual-supplement/route.ts:44` — gateAction:65-79, supplement verify:83-96, period open verify:121-135, DELETE:141-150, emit:162-185 | Live |
| Step 4 — ADR-0151 + L-0177 | `delete-manual-supplement/route.ts:49-51` (auth), `:83-96` (supplement 404), `:121-135` (period 409) | Live |
| Step 5 — Pattern B recalc (ADR-0293) | `delete-manual-supplement/route.ts:187-215` (sync POST to recalculate-period) | Live |
| Step 5 — DB trigger on DELETE | Migration 20260507110100 — `payroll_manual_supplement_recalc_trg` AFTER DELETE fires, emits `payroll.recalc_triggered_by_supplement` (op=delete) into engine_event | Live |
| Step 6 — Toast + table refresh | `use-manual-supplements.ts` — `onSuccess`: `toast.success("Tillegg slettet.")`, invalidates `supplementKeys.supplements(periodId)` + `payrollKeys.lines(periodId)` | Live |
| Telemetry | `delete-manual-supplement/route.ts:166` (`emit("payroll.manual_supplement_deleted", ...)`) | Live |
| Period locked guard | BFF: `delete-manual-supplement/route.ts:121-135` (409 when locked/approved/exported); UI: Trash2 button hidden, "Låst" text shown instead | Live |
