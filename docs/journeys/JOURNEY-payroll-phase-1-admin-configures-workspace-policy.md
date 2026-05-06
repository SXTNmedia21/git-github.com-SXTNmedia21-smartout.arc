---
title: "Journey — Admin configures workspace policy defaults"
feature: payroll-phase-1
journey: admin-configures-workspace-policy
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: payroll
tags: [journey, payroll, admin, workspace-policy, settings, tariff-binding]
---

# Journey: Admin configures workspace-policy defaults

**Role:** admin (only)

**Precondition:**
- Workspace eksisterer m/ I1 hospitality-bootstrap kjørt → `payroll.workspace_settings` har defaults
- Admin har authority `confirm` for settings-mutations

## Happy Path

### Initial config (post-bootstrap defaults)

1. Admin åpner `/dashboard/settings/operations/payroll-general-settings` → ser sectioned form:
   - **Tariff-binding:** `is_tariff_bound` toggle (default OFF) + helpertekst "Aktiver hvis bedriften er bundet av Riksavtalen via NHO Reiseliv-medlemskap. Når PÅ: calc-engine auto-håndhever §6 nattillegg, §3 minstelønn. Når AV: brukes som default som admin kan justere."
   - **Time-banks:** `toil_default_max_banked_hours` (default 80), `wellness_days_per_year_default` (default 0)
   - **Supplements:** `supplement_stacking_policy` enum (default 'category_exclusive')
   - **Delt vakt:** `split_shift_threshold_minutes` + `split_shift_allowance_amount`
   - **OT:** `overtime_requires_pre_approval` (default OFF, soft-warn only), `overtime_warn_threshold_minutes` (30 min)
   - **Tids-avrunding:** `punch_rounding_minutes` enum (default 0 = AV), `punch_rounding_direction` (default 'toward_employee'), `punch_rounding_snap_window_minutes`
   - **Punch-vinduer:** `punch_window_early_minutes` (15), `punch_window_late_minutes` (30), `punch_grace_after_scheduled_minutes` (60)
   - **Adhoc:** `adhoc_default_position_id` + `adhoc_default_department_id` (selectorer)
   - **Forced break:** `forced_break_reminder_minutes` (300 = 5h)
   - **Periode-godkjenning:** `requires_four_eyes_for_period_approval` (default OFF)
   - **Manager edit:** `manager_punch_edit_requires_reason` (default ON), `manager_punch_edit_notifies_employee` (default ON)
   - **Employee dispute:** `employee_can_dispute_punch` (default ON), `employee_dispute_window_days` (default 7)

2. Admin endrer flere felt (e.g. `is_tariff_bound=true`, `punch_rounding_minutes=15`, `punch_rounding_direction='toward_employee'`) → klikker "Lagre"
3. Server Action UPSERT `payroll.workspace_settings` row → emit `payroll.workspace_settings_updated`
4. UI: toast "Innstillinger lagret" + form re-render m/ saved-state

### Tariff-binding effekter (live)

5. Admin sjekker en eksisterende åpen periode → calc-engine på neste recalc fyrer Riksavtalen-rules (kveldstillegg 16.01 kr/t, nattillegg 42.41 kr/t, etc.) auto
6. Admin slår AV `is_tariff_bound` → recalc → samme rules brukes som *default values*, men admin kan override per-rule i `supplement-rules-settings.tsx`

### Time-rounding effekt (server-side)

7. Ansatt punch-in 07:53 (scheduled 08:00) → server-side rounding (`punch_rounding_minutes=15`, `direction='toward_employee'`) → time_entry.punch_in lagret som **07:45** (rounded down for employee benefit)
8. Mobile UI viser samme tid (07:45) → ansatt ser ikke "rå" 07:53 verdi
9. Manager edit lookup viser audit-row m/ original_punch_in=07:53 + applied_rounding=15min + final=07:45

## Error Paths

- **Tariff-binding cycle:** Admin slår på `is_tariff_bound` → eksisterende workspace har eldre tariff-version → System advarer "Tariff-rate-table mangler 2026-versjon. Calc bruker 2025-satser inntil 2026 lander" → Admin kan accepte eller avbryte
- **Adhoc default missing:** `adhoc_default_position_id` eller `adhoc_default_department_id` peker på slettet rad → form-validering 400 → admin må velge ny
- **Conflicting rounding values:** `punch_rounding_minutes=0` men `direction='snap_to_scheduled'` → form validation rejecter (snap krever rounding>0)

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manuelt: alle 19 nye felter render i settings-form m/ defaults fra I1 bootstrap
- [ ] Server-side rounding apply på time_entry insert (NOT client-side, ADR-pending)
- [ ] `is_tariff_bound=false` → supplement-rules brukes som default, admin kan override
- [ ] `is_tariff_bound=true` → Riksavtalen-rules auto-håndheves
- [ ] activity_trail row på hver settings-mutation
- [ ] Mobile (me)/payroll views respekterer policy (e.g. break-reminder fyrer etter 5h)

**Mark `status: verified` in frontmatter when all eight boxes are checked.**
