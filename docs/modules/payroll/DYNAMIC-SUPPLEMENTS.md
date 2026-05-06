---
title: Dynamic Supplements — Admin-Authored Tillegg Rules
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, supplements, tillegg, dynamic-rules, supplement-rule, evaluator]
---

# Dynamic Supplements

> Admin can create, edit, and activate custom supplement rules per workspace. Calc engine evaluates them deterministically against shifts. Built ON TOP of EXISTING `payroll.supplement_rule` table (6-type wide schema) and EXISTING `supplement-rules-settings.tsx` UI. No new tables. New: pure evaluator function + matching engine + per-rule audit.

---

## 1. What Already Exists (Phase 0a)

### 1.1 Schema — `payroll.supplement_rule` (one wide table, 6 types)

Per migration `20260422110100_payroll_config_tables.sql`:

```sql
CREATE TYPE payroll.supplement_type AS ENUM (
  'normal',         -- Type 1: time-window-based (kveld, helg, helligdag, natt)
  'week_based',     -- Type 2: weekly-threshold (e.g. >40h/week → OT)
  'day_based',      -- Type 3: daily-threshold (e.g. >9h/day → OT)
  'manual',         -- Type 4: admin-added per shift (tips, bonus)
  'holiday',        -- Type 5: linked to holiday_calendar
  'contract_rule'   -- Type 6: linked to specific contract clause
);

-- Wide table — 35 columns; type-specific groups:
CREATE TABLE payroll.supplement_rule (
  rule_id              UUID PK,
  workspace_id         UUID NOT NULL,
  supplement_type      payroll.supplement_type NOT NULL,
  name                 TEXT NOT NULL,
  salary_code          TEXT NOT NULL FK payroll.salary_code(code),
  rate_type            payroll.rate_type ('fixed_per_hour', 'percentage', 'fixed_per_shift'),
  rate_value           NUMERIC(10,2),
  is_active            BOOLEAN DEFAULT true,
  valid_from           DATE,
  valid_until          DATE,

  -- Type 1 (normal) fields:
  start_type           payroll.start_type ('time_of_day', 'after_shift_start'),
  time_window_start    TIME,
  time_window_end      TIME,
  after_minutes        INT,
  weekdays             INT[],            -- ISO 1-7
  consider_midnight    BOOLEAN,
  holiday_calendar_id  UUID,

  -- Type 2 (week_based) fields:
  weekly_threshold_hours  NUMERIC(5,2),
  weekly_max_hours        NUMERIC(5,2),

  -- Type 3 (day_based) fields:
  daily_threshold_hours   NUMERIC(5,2),
  daily_max_hours         NUMERIC(5,2),

  -- Type 4 (manual) fields:
  default_rate            NUMERIC(10,2),
  allow_rate_override     BOOLEAN,

  -- Type 6 (contract_rule) fields:
  contract_rule_id        UUID,
  evaluation_field        TEXT,
  threshold_value         NUMERIC,

  -- Filtering:
  employee_group_ids      UUID[],
  shift_type_ids          UUID[],
  affected_by_breaks      BOOLEAN,
  affects_salaried        BOOLEAN,
  enforced_payment        BOOLEAN
);
```

### 1.2 Admin UI — `supplement-rules-settings.tsx`

Path: `apps/web/src/app/dashboard/settings/_components/supplement-rules-settings.tsx`

Already implements:
- Type-tabs filter (Normal / Week / Day / Manual / Holiday / Contract-rule)
- Sheet to create/edit per type (conditional fields per type)
- `useSupplementRules`, `useCreateSupplementRule`, `useUpdateSupplementRule`, `useDeleteSupplementRule` hooks
- Validation via `supplementRuleSchema` (Zod) at `use-supplement-rules.ts:60`

### 1.3 What's MISSING

The infrastructure stores rules. **Nothing evaluates them yet.** That's the gap to close.

- No `evaluateSupplements(shift, interpretation, rules)` function
- No integration into Phase 1 calculation pipeline
- No audit-emit per rule firing (`shift_pay_calculation_event` provenance must reference `rule_id`)
- No "test rule" preview UI (admin creates rule, has no way to verify before saving)
- No conflict-resolver when multiple rules match same time-window

---

## 2. The Evaluator (Phase 1 NEW deliverable)

### 2.1 Pure function, deterministic

```typescript
// packages/payroll-calculate/src/supplements.ts (NEW Phase 1)

type ShiftContext = {
  shift_id: string;
  workspace_id: string;
  profile_id: string;
  employment_contract_id: string;
  employee_group_ids: string[];
  shift_type_id: string;
  shift_date: string;        // ISO date
  start_time: string;        // ISO timestamp Europe/Oslo
  end_time: string;
  break_minutes: number;
  is_holiday: boolean;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  hourly_rate: NumNok;
  monthly_salary: NumNok | null;
  interpreted_hours: ShiftHourInterpretation;  // from Layer 3
  weekly_hours_running_total: number;          // for week_based eval
  daily_hours_running_total: number;           // for day_based eval
};

type SupplementMatch = {
  rule_id: string;
  rule_name: string;
  salary_code: string;
  applied_to_minutes: number;       // resolved within shift
  applied_rate: NumNok | NumPct;
  rate_type: 'fixed_per_hour' | 'percentage' | 'fixed_per_shift';
  amount_nok: NumNok;
  provenance: SupplementProvenance;
};

type SupplementProvenance = {
  rule_id: string;
  rule_version: string;             // hash of rule values at eval time
  matched_predicates: string[];     // ['weekday=5', 'time_window=18:00-24:00', 'employee_group_in=[bar,kitchen]']
  applied_to_window: { from: string; to: string };
  source_text: string;              // human-readable: "Riksavtalen §6 kveldstillegg, kl 18-24, mandag-fredag"
};

export function evaluateSupplements(
  context: ShiftContext,
  rules: SupplementRule[],
): SupplementMatch[] {
  // 1. Filter rules by valid_from/until vs shift_date
  // 2. Filter rules by employee_group_ids (overlap)
  // 3. Filter rules by shift_type_ids (overlap or empty=all)
  // 4. Per type: dispatch to type-specific evaluator
  //    - normal:        intersectTimeWindow(shift, rule)
  //    - week_based:    if weekly_running > threshold: apply
  //    - day_based:     if daily_running > threshold: apply
  //    - manual:        not auto-evaluated (UI-driven only)
  //    - holiday:       if shift_date IN holiday_calendar: apply
  //    - contract_rule: read evaluation_field from contract, compare to threshold_value
  // 5. Resolve conflicts (see §3)
  // 6. Convert each match to amount_nok via rate_type
  // 7. Return matches with provenance
}
```

### 2.2 Per-type predicate logic

| Type | Match predicate (pseudocode) |
|---|---|
| normal | `weekday IN rule.weekdays AND intersect(shift.window, rule.time_window_[start..end]) > 0` |
| week_based | `running_weekly_hours_after_shift > rule.weekly_threshold_hours` (excess hours = applied_to_minutes) |
| day_based | `shift.duration > rule.daily_threshold_hours` (excess = applied_to_minutes) |
| manual | Skipped — only `payroll_manual_supplement` triggers these |
| holiday | `shift_date IN holiday_calendar_for_workspace AND not_excluded_by_contract` |
| contract_rule | Reads contract field referenced by `evaluation_field`, compares to `threshold_value` |

### 2.3 Rate-to-amount conversion

```typescript
function convertToAmount(rule: SupplementRule, applied_minutes: number, base_rate: NumNok): NumNok {
  switch (rule.rate_type) {
    case 'fixed_per_hour':
      return rule.rate_value * (applied_minutes / 60);
    case 'percentage':
      return base_rate * (applied_minutes / 60) * (rule.rate_value / 100);
    case 'fixed_per_shift':
      return rule.rate_value;  // applied once per matched shift
  }
}
```

---

## 3. Conflict Resolution

When multiple rules match the same time-window, behavior must be defined.

### 3.1 Default policy

- **Stack-able by default:** kveldstillegg + helgetillegg both apply if rule fires (e.g. lørdag kl 22).
- **Time-window-exclusive within a category:** kveldstillegg (18–24) and nattillegg (00–06) cannot both apply to same minute. Engine partitions the shift into intervals; assigns the most-specific match per interval.
- **Within same supplement_type, salary_code identical:** keep highest rate. Log both as `provenance.matched_predicates` for audit.

### 3.2 Workspace-policy override

`payroll_workspace_settings.supplement_stacking_policy enum('all_stack', 'highest_only', 'category_exclusive')` (NEW field, default `'category_exclusive'`).

### 3.3 Order of evaluation

For predictability, rules are evaluated in this order:
1. holiday rules (highest priority — overrides everything else)
2. normal rules (time-window)
3. day_based rules
4. week_based rules
5. contract_rule

Lower priority does NOT replace higher; they stack unless `category_exclusive` policy says otherwise.

---

## 4. Admin UI Extensions (Phase 1)

### 4.1 Existing UI gets a "Test rule" preview panel

In existing Sheet at `supplement-rules-settings.tsx` add:

```
┌─────────────────────────────────────────────┐
│ Tilleggsregel: "Sen kveld helg"             │
│ ─────────────────────────────────────────── │
│ Type: normal                                │
│ Sats: 25,00 kr/t                            │
│ Tidsvindu: 22:00 → 04:00                    │
│ Ukedager: lør, søn                          │
│ Lønnsart: 145 kveld_sen                     │
│                                             │
│ [Test rule på vakt:]                        │
│   Velg vakt: [▼ 2026-04-12 22:00–06:00 — Anna] │
│   ─────────────────────────────────────     │
│   Treff:        4 timer (22:00–04:00 søn)   │
│   Beløp:        kr 100,00                   │
│   Provenance:   weekday=7 + time_window     │
│                                             │
│ [Avbryt] [Lagre regel]                      │
└─────────────────────────────────────────────┘
```

Test-button calls `evaluateSupplements(testContext, [draftRule])` and shows match preview. Only when admin clicks "Lagre regel" does the rule persist.

### 4.2 New Activity panel — "Hvilke regler fyrte på denne vakten?"

In `LinesTab` drawer (USER-FLOWS Flow C), audit-tab shows per-shift firing-history:

```
Anna Andersen — Lørdag 12. april, 22:00–06:00 (8t)
─────────────────────────────────────────────────
✓ kveldstillegg (Riksavtalen §6) — 2t, 15,65 kr/t = 31,30
✓ helgetillegg (Riksavtalen §6) — 8t, 29,74 kr/t = 237,92
✓ nattillegg ordinaer (Riksavtalen §6) — 6t, 56,02 kr/t = 336,12
✓ Sen kveld helg (workspace-egenregel) — 4t (22-04), 25 kr/t = 100,00
─────────────────────────────────────────────────
Totale tillegg:                                 705,34
```

Each row links to `shift_pay_calculation_event.event_id` for full provenance.

---

## 5. Audit Integration (ADR-0251)

Each supplement match generates ONE `shift_pay_calculation_event`:

```sql
INSERT INTO public.shift_pay_calculation_event (
  workspace_id, profile_id, schedule_shift_id, shift_period_end_date,
  rule_type, rate_value_applied, quantity_value, subtotal,
  provenance, source_text_applied
) VALUES (
  $workspace, $profile, $shift, $period_end,
  'supplement_rule:' || rule_name,
  match.applied_rate,
  match.applied_to_minutes / 60,
  match.amount_nok,
  jsonb_build_object(
    'rule_id', match.rule_id,
    'rule_version', match.provenance.rule_version,
    'matched_predicates', match.provenance.matched_predicates,
    'triggered_by_event', 'period_close',
    'derivation_version', $derivation_version
  ),
  match.provenance.source_text
);
```

5-year retention from `shift_period_end_date`. Rule changes mid-period: NEW rule_version snapshot, supersession-chain on re-derivation.

---

## 6. Per-Workspace Custom Rules — Examples

What admins can build with the existing schema, once evaluator ships:

| Use case | Type | Configuration |
|---|---|---|
| "Stengt-vakt tillegg" — last person closing | manual | rate_type=fixed_per_shift, rate_value=200, applied via UI button |
| "Bonus etter 50t/uke" | week_based | weekly_threshold=50, rate_type=percentage, rate_value=200, salary_code=overtid_bonus |
| "Sen kveld helg" (workspace-egen) | normal | time_window=22-04, weekdays=[6,7], rate_type=fixed_per_hour, rate_value=25 |
| "Lærling-rabatt" | contract_rule | evaluation_field=is_lærling, threshold=true, rate_type=percentage, rate_value=-30 |
| "Helligdag dobbelt" | holiday | holiday_calendar_id=norway, rate_type=percentage, rate_value=100 |
| "Lukket julaften" | holiday | holiday_calendar_id=workspace_custom_calendar_with_julaften, rate_type=percentage, rate_value=200 |

All without code changes. Admin builds in UI.

---

## 7. Tariff-Snapshot Integration

When `evaluateSupplements()` resolves `applied_rate` for a `percentage` rule, the BASE rate comes from the FROZEN `tariff_rate_snapshot` on `shift_cost_snapshot`. Re-running the rule produces same answer because tariff is frozen. New tariff version → new snapshot → new evaluation = new shift_pay_calculation_event row, supersession-chain.

This means: rule changes do NOT retroactively apply to closed periods. Only `period.status='open'` re-evaluates. Locked/approved periods stay frozen.

---

## 8. Telemetry

Registered in `packages/telemetry/src/registry.ts` under `payroll.*`:

| Event | When | Destinations |
|---|---|---|
| `payroll.supplement_rule_created` | admin saves new rule | posthog + activity_trail |
| `payroll.supplement_rule_updated` | admin edits rule | posthog + activity_trail |
| `payroll.supplement_rule_activated` | toggle is_active=true | posthog + activity_trail |
| `payroll.supplement_rule_deactivated` | toggle is_active=false | posthog + activity_trail |
| `payroll.supplement_rule_fired` | rule matched a shift during calc | activity_trail (audit-only — would flood posthog) |
| `payroll.supplement_rule_test_run` | admin uses Test-button before saving | posthog (UX metric) |

---

## 9. Schema Migration (Phase 1 add-on)

```sql
-- One migration: <timestamp>_payroll_phase1_dynamic_supplements.sql

-- 1. Workspace-policy for stacking
ALTER TABLE payroll.workspace_settings
  ADD COLUMN supplement_stacking_policy TEXT
    NOT NULL DEFAULT 'category_exclusive'
    CHECK (supplement_stacking_policy IN ('all_stack', 'highest_only', 'category_exclusive'));

-- 2. Rule version snapshot (helps audit when rule changes)
ALTER TABLE payroll.supplement_rule
  ADD COLUMN version_hash TEXT
    GENERATED ALWAYS AS (
      md5(coalesce(name,'') || coalesce(rate_type::text,'') || coalesce(rate_value::text,'') || ...)
    ) STORED;
-- (Either GENERATED column or trigger-maintained)

-- 3. Authority seed for new evaluator-related tools
-- (no new capability tools — supplement_rule CRUD via existing settings UI;
--  evaluator runs server-side as part of capability.recalculate_period)
```

No new tables.

---

## 10. Phase 1 Acceptance for Dynamic Supplements

1. **Existing rules continue to work:** `salary-codes-settings` + `supplement-rules-settings` UIs continue to load + edit without regression.
2. **Test-rule preview:** Admin creating a new rule sees "Test on shift" preview that returns correct match data within 500ms.
3. **Calc integration:** A workspace with 3 platform-seed rules + 2 admin-created rules computes correct payroll for a 12-employee 1-month period; total matches hand-computed reference.
4. **Audit trail:** Every rule firing produces a `shift_pay_calculation_event` row with `rule_id` in provenance.
5. **Rule deactivation:** Setting `is_active=false` mid-period stops the rule from applying to future calculation_versions; old versions stay.
6. **Conflict-resolution:** Two overlapping `normal` rules (e.g. kveldstillegg vs workspace-custom-late-evening): default policy `category_exclusive` picks the more-specific (matches Riksavtalen §6 since both have salary_code; highest rate wins per default).
7. **Tariff freeze:** Re-running calc on a closed period returns identical results (tariff_rate_snapshot frozen, rule version_hash frozen).

---

## 11. Cross-References

- Schema: [DATA-MODEL.md](./DATA-MODEL.md) §4.* (`payroll.supplement_rule`)
- Engine: [ARCHITECTURE.md](./ARCHITECTURE.md) §2.* (calculation engine pure functions)
- UX: [USER-FLOWS.md](./USER-FLOWS.md) — supplement-rules-settings already in §3 admin surfaces
- Phase plan: [PHASES.md](./PHASES.md) — extend Phase 1 deliverables list
- Tripletex mapping: [TRIPLETEX-INTEGRATION.md](./TRIPLETEX-INTEGRATION.md) §8 — `salary_code.external_code` per rule's salary_code resolution
