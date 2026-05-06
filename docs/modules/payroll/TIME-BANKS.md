---
title: Payroll Time Banks — Engine Architecture
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, time-banks, tidskonto, toil, avspasering, feriekonto, velferdsdager, overtime-mode]
---

# Time Banks — Engine Architecture

> Three time-account types: **feriekonto** (NOK), **TOIL/avspasering** (hours), **velferdskonto** (days). All three sit on top of EXISTING `payroll.timebank_entry` + `payroll.absence_quota` infrastructure — no new core tables. Per-employee `overtime_mode` flag on `employee_payroll_profile`. Legal frame: see [TIME-BANKS-LEGAL.md](./TIME-BANKS-LEGAL.md).

---

## 1. Reuse Decision — Existing Tables Stay

The codebase already has the right infrastructure. Time-banks integrate INTO existing tables, not new ones.

| Account | Existing table | Discriminator | Value unit |
|---|---|---|---|
| Feriekonto | `payroll.timebank_entry` | `account_type='vacation_pay'` | NOK |
| TOIL / avspasering | `payroll.timebank_entry` | `account_type='toil'` | hours |
| Velferdskonto / wellness | `payroll.absence_quota` | `absence_type='wellness'` | days |

**Why reuse over Lovsen's new-tables proposal:**
- `payroll.timebank_entry` already has the exact event-sourced ledger pattern Lovsen recommended — entry_types: `accrual | carry_over | adjustment | withdrawal | expiry | payout`.
- `payroll.absence_quota` has `entitled_days, carried_over_days, used_days, adjusted_days, expired_days, paid_out_days` + generated `remaining_days`. Wellness is just another `absence_type`.
- Lovsen authored TIME-BANKS-LEGAL.md without code-context; integration architect (this file) overrides with reuse.

**Schema deltas required (Phase 1):**
- `payroll.timebank_entry.account_type` enum value: add `vacation_pay` and `toil` (existing values may already cover; verify migration).
- `payroll.timebank_entry.value_unit` enum: add `'NOK'` if not already present (column may currently be hours-only — check migration `20260422110600`).
- `payroll.absence_type` enum: add `wellness` value.
- `public.employee_payroll_profile`: add `overtime_mode enum('paid_out', 'banked')` default `'paid_out'`, and `toil_agreement_signed_at TIMESTAMPTZ`.

---

## 2. Per-Employee Overtime Mode

The user-facing toggle: should overtime hours pay out OR bank?

```sql
-- Migration delta (Phase 1)
ALTER TABLE public.employee_payroll_profile
  ADD COLUMN overtime_mode payroll_overtime_mode DEFAULT 'paid_out',
  ADD COLUMN toil_agreement_signed_at TIMESTAMPTZ,
  ADD COLUMN toil_max_banked_hours NUMERIC(5,2);  -- nullable; falls back to workspace_settings

CREATE TYPE payroll_overtime_mode AS ENUM ('paid_out', 'banked');
```

### 2.1 Mode resolution at calc time

```typescript
// packages/payroll-calculate/src/overtime.ts (Phase 1 — NEW)
function resolveOtMode(
  profile: EmployeePayrollProfile,
  workspaceSettings: PayrollWorkspaceSettings,
): { mode: 'paid_out' | 'banked'; tillegg_paid_out: true } {
  // Tillegg (50%/100%) ALWAYS paid out per Aml. §10-6 tolvte ledd.
  // Only the BASE overtime hours (the time itself) can be banked.

  if (profile.overtime_mode === 'banked' && !profile.toil_agreement_signed_at) {
    // Gate: TOIL needs signed agreement
    return { mode: 'paid_out', tillegg_paid_out: true };
  }

  return {
    mode: profile.overtime_mode,
    tillegg_paid_out: true,
  };
}
```

### 2.2 What gets banked vs paid

Per Lovsen TIME-BANKS-LEGAL.md §B (HØY confidence, Aml. §10-6 tolvte ledd):

| Component | When `paid_out` | When `banked` |
|---|---|---|
| Base hours (the time worked OT) | paid as base rate | added to TOIL bank as hours |
| OT-tillegg 50% (first 3h) | paid as 50% of base | **still paid out** (tillegg cannot be banked) |
| OT-tillegg 100% (after 3h) | paid as 100% of base | **still paid out** |

Concretely: an employee who works 4 OT hours with `banked` mode receives:
- 0 NOK base (4 hours added to TOIL bank)
- Tillegg: 50% × 3 base-hours + 100% × 1 base-hour, paid in NOK on the lønnsslipp

### 2.3 Mode change UX

`overtime_mode` is editable from `LonnsprofilSection.tsx`:
- New select field: "Overtid-håndtering": Utbetales i lønn / Avspaseres
- If user picks "Avspaseres": modal opens for TOIL agreement upload (PDF) → DocuSeal signing → on completion sets `toil_agreement_signed_at`
- Per Lovsen §E [MEDIUM]: TOIL agreement is NOT one of Aml. §14-6 16 fields — it is a separate written agreement under §10-6 tolvte ledd. Classification: ADMIN amendment (not MATERIAL).

**O22 (NEW):** Confirm with arbeidsrettsadvokat that mode-toggle WITHOUT pay reduction is genuinely ADMIN, not MATERIAL. Lovsen MEDIUM confidence.

---

## 3. Account-Specific Behavior

### 3.1 Feriekonto (vacation pay balance)

**Anchor:** Ferieloven §10 + §11. See LEGAL-FRAMEWORK §1.2.

**Accrual mechanism:**
```typescript
// At every payroll_calculation aggregation:
const vacationPayAccrued = grossEligible * profile.holiday_allowance_pct / 100;

// Insert ledger row:
await insertTimebankEntry({
  profile_id, workspace_id,
  account_type: 'vacation_pay',
  entry_type: 'accrual',
  value_amount: vacationPayAccrued,
  value_unit: 'NOK',
  source: { kind: 'payroll_calculation', calculation_id, period_id },
  occurred_at: period.end_date,
});
```

**Withdrawal mechanism (utbetaling):**
- Auto-trigger at last payroll-period BEFORE first day of approved vacation (Ferieloven §11 tredje ledd)
- Manual trigger via admin UI for sluttoppgjør (§11 fjerde ledd) — automatic on `employment_contract.end_date`
- Insert `entry_type='withdrawal'` row, generate `payroll_calculation_line` of category=worked_hours, salary_code='feriepenger_utbetaling'

**Carry-over (Ferieloven §7 tredje ledd, max 2 uker):**
- Annual cron 31. desember: any unused days × hourly rate equivalent → `entry_type='carry_over'` row, capped at 2-week-equivalent
- Excess: `entry_type='expiry'` row (loss to employee — REQUIRES warning notification first per §7)

### 3.2 TOIL (avspaseringskonto)

**Anchor:** Aml. §10-6 tolvte ledd. See LEGAL-FRAMEWORK §1.1 + TIME-BANKS-LEGAL §2.B.

**Accrual mechanism:**
```typescript
if (mode === 'banked') {
  await insertTimebankEntry({
    profile_id, workspace_id,
    account_type: 'toil',
    entry_type: 'accrual',
    value_amount: ot_base_hours,    // hours, not NOK
    value_unit: 'hours',
    source: { kind: 'shift_overtime', shift_id, calculation_id },
    occurred_at: shift_date,
  });
  // Tillegg STILL paid out — separate calculation_line for the 50%/100%
}
```

**Withdrawal (avspasering uttak):**
- Employee requests via existing `absence_request` flow with new `absence_type='toil_withdrawal'`
- On approval: shift planned without time_entry; `entry_type='withdrawal'` row inserted
- The avspaserte timer count as paid time off — no further calculation_line

**Carry-over policy:**
- Workspace setting `toil_max_banked_hours` (default 80, per O18 recommendation)
- Annual or quarterly cron checks balance > max → forced `entry_type='payout'` row + auto-generates `payroll_calculation_line` for the excess hours × current rate

**Sluttoppgjør (Lovsen LAV confidence O17):**
- On `employment_contract.end_date` reached: cron forces `entry_type='payout'` for full balance
- TOIL agreement template MUST include sluttoppgjørs-klausul per Lovsen recommendation
- Until O17 resolved by advokat: conservative default = always pay out at termination

### 3.3 Velferdskonto / wellness

**Anchor:** No norwegian legal mandate. Workspace policy. See LEGAL-FRAMEWORK + TIME-BANKS-LEGAL §2.C.

**Setup:**
- New row in `payroll.absence_type` table: `code='wellness'`, `is_paid=true`, `nav_reportable=false`, `affects_egenmelding_count=false`
- New `absence_quota` row per profile per year: `entitled_days = workspace.wellness_days_per_year` (default 0, opt-in per workspace)

**Usage:** Same flow as eksisterende `absence_request` UI. No new surface.

**Carry-over:** Workspace policy — workspace-default = no carry-over (use-it-or-lose-it).

---

## 4. UI Integration — NO New Profile Tab

### 4.1 Existing surface to extend

`apps/web/src/app/dashboard/people/[id]/_components/LonnsprofilSection.tsx` is the ONE place where payroll-profile data is edited. New fields go HERE — no new tab.

```
LonnsprofilSection.tsx existing fields:
  - payroll_tripletex_employee_id (editable)
  - pension_scheme_id (editable)
  - tax_table_number, tax_card_type, tax_percentage (read-only, Skatteetaten-derived)
  - bank_account, personal_number (RevealableField)

NEW fields (Phase 1):
  - overtime_mode: select(paid_out|banked), default paid_out
  - toil_agreement_signed_at: read-only badge (signed dato or "Ikke signert")
  - toil_max_banked_hours_override: nullable input (falls back to workspace setting)
  - holiday_allowance_pct: editable (already in profile schema, surface if not yet exposed)
```

### 4.2 Time-bank balance panel (NEW component, lives under LonnsprofilSection)

```
┌─────────────────────────────────────────────────────┐
│ Tidskontoer                                         │
├─────────────────────────────────────────────────────┤
│ Feriekonto                                          │
│   Saldo:                              kr 23 450,00  │
│   Opptjent denne måneden:             kr 1 234,00   │
│   Forrige utbetaling:                 2025-06-15    │
│   [Vis ledger] [Justér saldo]                       │
├─────────────────────────────────────────────────────┤
│ Avspaseringskonto (TOIL)                            │
│   Mode:                               Avspaseres ⚙  │
│   Saldo:                              42,5 timer    │
│   Maks tillatt:                       80 t (workspace)│
│   Avtale signert:                     2025-03-12    │
│   [Vis ledger] [Justér saldo] [Tving utbetaling]    │
├─────────────────────────────────────────────────────┤
│ Velferdsdager                                       │
│   Saldo:                              3 av 5 dager  │
│   Brukt 2026:                         2 dager       │
│   [Vis ledger]                                      │
└─────────────────────────────────────────────────────┘
```

Component path: `apps/web/src/app/dashboard/people/[id]/_components/TimebankPanel.tsx` (NEW, Phase 1).
Hooks reuse: `useTimebankBalance(profileId, accountType)` — already exists at packages/data/src/payroll for mobile read.

### 4.3 Mobile read (already exists)

`apps/mobile/app/(app)/(me)/payroll/timebank.tsx` shows balance + ledger for the employee. Already correct surface. Add account-type filter chips for the three types.

---

## 5. Calculation Engine Integration

### 5.1 Hooks into existing `payroll.calculation` flow

```
Phase 1 calculation pipeline (DATA-MODEL §5):
  Layer 3 (interpretShift)  — outputs regular/OT/night/holiday/weekend hours
       ↓
  Layer 4 (snapshotCost)    — applies tariff, produces base + supplement costs
       ↓
  Layer 5 (aggregatePeriod) — builds payroll_calculation + lines
       ↓
  NEW: time-bank ledger emission
       — for each profile aggregate:
           emit accrual to timebank_entry (vacation_pay)
           emit accrual to timebank_entry (toil) — IF overtime_mode=banked
           NO emit for wellness (it's withdrawal-driven, not accrual-driven)
       ↓
  payroll_calculation_line generation
       — feriepenger_oppt_påløp: line_type=info (informational, not paid)
       — overtid_50/100: tillegg always paid_out
       — overtid_base: paid_out IF mode=paid_out, ELSE 0 NOK + bank entry
```

### 5.2 Withdrawal-driven calculation lines

Time-bank withdrawals (vacation pay-out, TOIL pay-out, wellness day used) generate `payroll_calculation_line` rows automatically:

```sql
-- Pseudocode trigger on timebank_entry insert
IF NEW.entry_type IN ('withdrawal', 'payout') AND NEW.account_type = 'vacation_pay' THEN
  INSERT INTO payroll_calculation_line (
    calculation_id, salary_code, line_type, amount, description
  ) VALUES (
    current_open_calc_for_profile_period(NEW.profile_id),
    'feriepenger_utbetaling',
    'worked_hours',  -- A-melding-mapped via salary_code
    NEW.value_amount,
    'Feriepenger utbetalt for ' || NEW.metadata->>'period_label'
  );
```

### 5.3 Audit (ADR-0251 retention)

Every `timebank_entry` row is itself an audit row. 5-year retention from `occurred_at`-derived `period_end_date`. RLS UPDATE/DELETE blocked. Same pattern as `shift_pay_calculation_event`.

---

## 6. Capability Tools (Phase 1+)

New chat-driven tools added to `packages/ai/src/capabilities/payroll/tools.ts`:

| Tool | Channel | Level | min_role | Purpose |
|---|---|---|---|---|
| `set_overtime_mode` | chat | confirm | admin | Update profile.overtime_mode |
| `adjust_timebank_balance` | chat | confirm | admin | Insert entry_type='adjustment' row |
| `force_timebank_payout` | chat | confirm | admin | Insert entry_type='payout' for excess |
| `query_timebank_balance` | chat | autonomous | employee (own) / manager (team) / admin (all) | Read-only |

All gate via `gatedMutation` (ADR-0204). Audit-emit on every mutation.

---

## 7. Botsson Chat Examples

```
User: "Sett Anna på avspasering for OT"
Botsson: capability.set_overtime_mode(profile_id, mode='banked')
       → confirm-gate, asks user to confirm
       → asserts toil_agreement_signed_at IS NOT NULL
       → if not signed: blocks, asks user to send TOIL-avtale via DocuSeal first

User: "Hvor mye TOIL har Anna?"
Botsson: capability.query_timebank_balance(profile_id, account_type='toil')
       → returns balance + max + last 5 entries summary

User: "Tving ut 20 timer fra Annas avspaseringskonto"
Botsson: capability.force_timebank_payout(profile_id, account_type='toil', amount=20)
       → confirm-gate
       → inserts entry_type='payout' row with reason
       → next payroll calc auto-includes the line
```

---

## 8. Phase 1 Schema Migration Checklist

```sql
-- One migration: <timestamp>_payroll_phase1_time_banks.sql

-- 1. Profile fields
ALTER TYPE payroll_overtime_mode AS ENUM ('paid_out', 'banked');
ALTER TABLE public.employee_payroll_profile
  ADD COLUMN overtime_mode payroll_overtime_mode DEFAULT 'paid_out',
  ADD COLUMN toil_agreement_signed_at TIMESTAMPTZ,
  ADD COLUMN toil_max_banked_hours_override NUMERIC(5,2);

-- 2. Workspace settings
ALTER TABLE payroll.workspace_settings
  ADD COLUMN toil_default_max_banked_hours NUMERIC(5,2) DEFAULT 80,
  ADD COLUMN wellness_days_per_year_default INT DEFAULT 0,
  ADD COLUMN split_shift_threshold_minutes INT DEFAULT 0,        -- O12 default
  ADD COLUMN split_shift_allowance_amount NUMERIC(8,2) DEFAULT 0; -- O12 default

-- 3. timebank_entry account_type extension (verify existing enum first)
ALTER TYPE payroll.timebank_account_type ADD VALUE IF NOT EXISTS 'vacation_pay';
ALTER TYPE payroll.timebank_account_type ADD VALUE IF NOT EXISTS 'toil';
-- 'wellness' NOT added here — wellness uses absence_quota, not timebank

-- 4. timebank_entry value_unit (verify column exists or add)
ALTER TABLE payroll.timebank_entry
  ADD COLUMN IF NOT EXISTS value_unit TEXT NOT NULL DEFAULT 'hours'
    CHECK (value_unit IN ('hours', 'NOK', 'days'));

-- 5. wellness absence_type seed
INSERT INTO payroll.absence_type (workspace_id, code, name, is_paid, nav_reportable, affects_egenmelding_count)
SELECT id, 'wellness', 'Velferdsdag', true, false, false
FROM public.workspace
WHERE NOT EXISTS (
  SELECT 1 FROM payroll.absence_type at WHERE at.workspace_id = workspace.id AND at.code = 'wellness'
);

-- 6. Authority seed for new tools
INSERT INTO public.capability_default_registry (
  capability, tool, level, min_role, allowed_channels
) VALUES
  ('payroll', 'set_overtime_mode',         'confirm', 'admin', ARRAY['chat']),
  ('payroll', 'adjust_timebank_balance',   'confirm', 'admin', ARRAY['chat']),
  ('payroll', 'force_timebank_payout',     'confirm', 'admin', ARRAY['chat']),
  ('payroll', 'query_timebank_balance',    'autonomous', 'employee', ARRAY['chat']);
```

---

## 9. Tripletex Field Mapping (forward-look to Phase 7)

| Smartout time-bank | Tripletex equivalent |
|---|---|
| `account_type='vacation_pay' accrual` | Tripletex computes feriepenger automatically from holidayPayProrate; Smartout reports gross only |
| `account_type='vacation_pay' withdrawal` | `salaryTransaction` with salaryType.id=feriepenger-utbetaling |
| `account_type='toil' accrual` | No native Tripletex support; tracked Smartout-side only. Tripletex sees only the tillegg-utbetaling. |
| `account_type='toil' withdrawal` | Maps to "fri" / paid time off — no salaryTransaction needed |
| `account_type='toil' payout` | `salaryTransaction` with salaryType=overtidstillegg + count=hours, generateTaxDeduction=true |
| Wellness used | No Tripletex sync; absence is internal |

See [TRIPLETEX-INTEGRATION.md](./TRIPLETEX-INTEGRATION.md) §8 for Smartout→Tripletex field mapping detail.

---

## 10. Open Questions (cross-link)

See [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md):
- O11 (nattillegg-sats) — verify before Phase 1
- O12 (delt vakt) — implement as workspace-config, default 0
- O16 (nattillegg gruppe-klassifisering) — `night_worker_category` on `payroll_shift_type`
- O17 (TOIL sluttoppgjør hjemmel) — advokat-eskalering
- O18 (TOIL carry-over max) — workspace-policy default 80h
- O19 (Hotelloverenskomsten nattillegg) — separate tariff seed
- O20 (wellness days NAV-grensesnitt) — workspace policy
- O21 (feriekonto multi-workspace) — defer to O1 ADR
- **O22 (NEW)** — overtime_mode toggle: ADMIN or MATERIAL amendment? Lovsen MEDIUM. Need advokat.

Add O22 to OPEN-QUESTIONS.md.
