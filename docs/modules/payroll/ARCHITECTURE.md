---
title: Payroll Architecture
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, architecture, c3, derivation-pipeline, event-engine]
---

# Payroll Architecture

> System design. How data flows from `schedule_shift` to lønnsslipp PDF + Tripletex sync. Five layers, one driver (Event Engine), one capability gate.

## 1. System Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         WEB AUTHORING (apps/web)                          │
│   /dashboard/payroll/                                                     │
│   ├── page.tsx                  — period list                             │
│   ├── [periodId]/page.tsx       — line review + approve                   │
│   ├── [periodId]/[profileId]/   — drawer w/ shift breakdown               │
│   ├── _components/              — DeviationList, LineDrawer, ExportModal  │
│   ├── _hooks/                   — useCurrentPeriod, usePayrollLines, ...  │
│   └── _actions/                 — Server Actions (gated mutations)        │
└──────────────────────────────────────────────────────────────────────────┘
                  │ TanStack Query / Server Action
                  │ gateAction → gatedMutation → emit()
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  CAPABILITY LAYER (packages/ai/src/...)                   │
│   capabilities/payroll/                                                   │
│   ├── index.ts            — defaultAuthority=read_only,                   │
│   │                        allowedChannels=['chat'], emitPrefix='payroll' │
│   ├── tools.ts            — 6 stub + 7 new (lock/approve/...)             │
│   └── gate.ts             — channel guard, role-tier, four-eyes hooks     │
└──────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  CALCULATION ENGINE (packages/ai/src/payroll/)            │
│                  NEW PACKAGE — Phase 1 deliverable                        │
│                                                                           │
│   calculate.ts            — pure functions, deterministic, testable       │
│   ├── interpretShift(time_entry, framework_rules, holiday_calendar)       │
│   │     → { regular, overtime, night, holiday, weekend, breaks }          │
│   ├── snapshotCost(interpretation, tariff_snapshot, payroll_profile)      │
│   │     → { base, supplements, deductions, total }                        │
│   ├── aggregatePeriod(snapshots, manual_supplements, tip_distributions)   │
│   │     → payroll_calculation + lines                                     │
│   └── runDeviationChecks(calculation, framework_rules)                    │
│         → payroll_deviation rows (W01–W12)                                │
└──────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼ (RPC: derive_shift_hours, snapshot_shift_cost,
                  │  aggregate_period — wraps pure functions in atomic write)
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     STORAGE (Phase 0a — DONE)                             │
│   payroll.* schema (23 tables) + cross-cutting public.* tables            │
└──────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  EVENT ENGINE DRIVER (engine_process)                     │
│                                                                           │
│   blueprint: payroll_period_close                                         │
│   1. wait_for_event       — period_end_date passed                        │
│   2. start_process        — derive_shift_hours per shift                  │
│   3. start_process        — snapshot_shift_cost per interpretation        │
│   4. start_process        — aggregate_period per profile                  │
│   5. start_process        — runDeviationChecks                            │
│   6. assign_task          — manager review (acknowledge errors)           │
│   7. lock_checkout        — period.status=locked                          │
│   8. assign_task          — admin approve (four-eyes if configured)       │
│   9. update_entity        — period.status=approved                        │
│  10. start_process        — exporters (CSV / PDF / A-melding / Tripletex) │
└──────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    EXPORTERS (packages/payroll-export/)                   │
│                    NEW PACKAGE — Phases 3, 4, 6, 7                        │
│                                                                           │
│   csv.ts                 — papaparse.unparse, two formats (agg + audit)   │
│   pdf.ts                 — @react-pdf/renderer (ADR pending)              │
│   amelding.ts            — XML serializer (Phase 6)                       │
│   tripletex.ts           — REST client + auth chain (Phase 7)             │
└──────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      EDGE FUNCTIONS (Supabase)                            │
│   skatteetaten-fetch     — ADR-0250, cert auth, internal trigger          │
│   tripletex-sync         — Phase 7, push to Tripletex API                 │
│   amelding-export        — Phase 6, XML → Altinn (or via Tripletex)       │
└──────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  AUDIT (ADR-0251 immutable, 5-yr retention)               │
│                                                                           │
│   shift_pay_calculation_event                                             │
│     - one row per pay rule fired per shift                                │
│     - rate_value_applied snapshotted, immutable                           │
│     - supersession-chain via superseded_by_event_id                       │
│     - retention anchor: shift_period_end_date                             │
│                                                                           │
│   activity_trail                                                          │
│     - emit() destination 3                                                │
│     - records every payroll mutation (lock, approve, override, export)    │
└──────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  EMPLOYEE READ SURFACES                                   │
│                                                                           │
│   apps/mobile/app/(app)/(me)/payroll/                                     │
│     payslip-list.tsx     — list past payslips                             │
│     payslip-detail.tsx   — drawer w/ lines + revealable bank account      │
│                                                                           │
│   apps/web/src/app/dashboard/my-salary/                                   │
│     _hooks/use-payslip-lines.ts                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Calculation Engine — Pure Functions

### 2.1 `interpretShift(time_entry, framework_rules, holiday_calendar)` → `shift_hour_interpretation`

Inputs:
- `time_entry`: punch_in/out, breaks JSONB
- `framework_rules`: relevant W01–W12 rules + AML §10-* thresholds
- `holiday_calendar`: red days for the period

Output:
- `regular_hours`, `overtime_hours`, `night_hours`, `holiday_hours`, `weekend_hours`
- `break_deductions`
- `total_interpreted_hours`
- `derivation_version` (incremented per re-run)

Deterministic. Same input = same output. No I/O.

### 2.2 `snapshotCost(interpretation, tariff_snapshot, payroll_profile)` → `shift_cost_snapshot`

Inputs:
- `interpretation`: from 2.1
- `tariff_snapshot`: workspace + platform tariff rows valid at shift date (frozen as JSONB)
- `payroll_profile`: hourly_rate or monthly_salary, contract_hours, holiday%, otp%

Output:
- `tariff_rate_snapshot` (the JSONB freeze, repeated for audit)
- per-bucket cost: `regular_cost`, `night_cost`, `holiday_cost`, `weekend_cost`
- `total_supplements`, `total_deductions`
- `gross_cost`, `total_cost`
- `calculation_version`

### 2.3 `aggregatePeriod(snapshots[], manual_supplements[], tip_distributions[])` → `{calculation, lines}`

Inputs:
- All `shift_cost_snapshot` rows for `(period_id, profile_id)`
- All `payroll_manual_supplement` rows for the same
- `tip_distribution` rows joined on `payroll_period_id` after lock

Output:
- One `payroll_calculation` row (aggregate per profile per period)
- Multiple `payroll_calculation_line` rows (per salary_code)

### 2.4 `runDeviationChecks(calculation, framework_rules)` → `payroll_deviation[]`

Returns rows for any rule violations (W01–W12):
- `severity=error` blocks `period.approved` transition
- `severity=warning` shown in UI but does not block
- `severity=info` informational only

---

## 3. Audit Layer

Every pay rule firing creates a `shift_pay_calculation_event` row.

### 3.1 Provenance JSONB schema

```typescript
type Provenance = {
  tariff_rate_id: string;
  tariff_version: string;          // e.g. "Riksavtalen 2024-04-01"
  framework_rule_ids: string[];
  derivation_version: number;
  triggered_by_event: 'period_close' | 'recalc' | 'manual_override' | 'tariff_amendment';
  source_text_applied: string;     // human-readable, e.g. "Riksavtalen §6 (kveldstillegg)"
  preceding_event_id?: string;     // chain link
};
```

### 3.2 Supersession chain

When a calculation is re-run:
1. New `shift_pay_calculation_event` rows inserted with new `event_id`.
2. Old rows updated (service-role only, RLS-allowed for this op): `superseded_by_event_id = new_event_id`.
3. Read queries filter `WHERE superseded_by_event_id IS NULL` for current state.

### 3.3 Retention

- Anchor column: `shift_period_end_date` (NOT `created_at`).
- 5-year clock from regnskapsår-slutt: `WHERE shift_period_end_date < date_trunc('year', now()) - interval '5 years'`.
- Archival path: separate `shift_pay_calculation_archive` table (Phase 5+ migration before any deletion).
- DELETE blocked by RLS until archival migration runs.

---

## 4. Capability Wiring

### 4.1 Authority seed (already in `20260519160000`)

```sql
INSERT INTO capability_default_registry (capability, level, min_role, allowed_channels, ...)
VALUES ('payroll', 'confirm', 'admin', ARRAY['chat'], ...);
```

### 4.2 Phase 1+ tools require new authority rows

For each new tool, seed migration adds:

```sql
INSERT INTO capability_default_registry (
  capability, tool, level, min_role, allowed_channels, requires_four_eyes
) VALUES
  ('payroll', 'lock_period',           'confirm', 'admin',   ARRAY['chat'], false),
  ('payroll', 'approve_period',        'confirm', 'admin',   ARRAY['chat'], false),  -- workspace-policy elevates
  ('payroll', 'add_manual_supplement', 'confirm', 'admin',   ARRAY['chat'], false),
  ('payroll', 'override_calculation_line', 'confirm', 'admin', ARRAY['chat'], false),
  ('payroll', 'acknowledge_deviation', 'suggest', 'manager', ARRAY['chat'], false),
  ('payroll', 'export_period',         'confirm', 'admin',   ARRAY['chat'], false),
  ('payroll', 'recalculate_period',    'autonomous', NULL,   ARRAY['system'], false);
```

### 4.3 Tool body pattern (ADR-0204 compliant)

```typescript
export const lockPeriod: SmartoutTool<LockPeriodInput, LockPeriodOutput> = {
  name: 'lock_period',
  capability: 'payroll',
  channelGuard: ['chat'],
  parameters: lockPeriodSchema,
  execute: async (input, ctx) => {
    if (ctx.channel !== 'chat') {
      throw new Error('payroll.lock_period: chat channel only');
    }

    return await gatedMutation({
      ctx,
      capability: 'payroll',
      tool: 'lock_period',
      action: 'mutation',
      entity: 'payroll_period',
      entityId: input.period_id,
      proposedChange: { status: 'locked' },
      handler: async ({ supabase, audit }) => {
        // 1. Verify period belongs to ctx.workspace.id (forgery defence)
        // 2. Verify no unacknowledged severity=error deviations
        // 3. Set period.status='locked', locked_by, locked_at
        // 4. Merge tip_distribution.payroll_period_id for any in pool
        // 5. audit({ event: 'payroll.period_locked', ... })
        // 6. emit('payroll.period_locked', { period_id, locked_by, ... })
      },
    });
  },
};
```

---

## 5. Telemetry Events

Registered in `packages/telemetry/src/registry.ts` under `payroll.*` prefix.

| Event | When | Destinations |
|---|---|---|
| `payroll.period_locked` | `lock_period` succeeds | posthog + activity_trail + engine_event |
| `payroll.period_approved` | `approve_period` succeeds | posthog + activity_trail + engine_event |
| `payroll.period_rejected` | approval denied (four-eyes) | posthog + activity_trail |
| `payroll.line_overridden` | `change_proposal applied` for wage line | posthog + activity_trail + engine_event |
| `payroll.manual_supplement_added` | `add_manual_supplement` succeeds | posthog + activity_trail |
| `payroll.deviation_acknowledged` | `acknowledge_deviation` succeeds | posthog + activity_trail |
| `payroll.deviation_blocked_approval` | approve attempted with errors | posthog + activity_trail |
| `payroll.export_initiated` | `export_period` starts | posthog + activity_trail + engine_event |
| `payroll.export_completed` | exporter finishes successfully | posthog + activity_trail + engine_event |
| `payroll.export_failed` | exporter errors | posthog + activity_trail |
| `payroll.recalc_triggered` | recalc starts (manual or auto) | posthog + activity_trail + engine_event |
| `payroll.tariff_freeze_drift` | snapshot tariff vs current diverges (informational) | posthog + activity_trail |
| `payroll.amelding_submitted` | A-melding XML accepted by Altinn | posthog + activity_trail + engine_event |
| `payroll.amelding_rejected` | A-melding XML rejected | posthog + activity_trail (alert) |
| `payroll.tripletex_synced` | Tripletex push successful | posthog + activity_trail |
| `payroll.tripletex_sync_failed` | Tripletex push errors | posthog + activity_trail |
| `payroll.bank_account_revealed` | RevealableField reveal on bankkonto | activity_trail (audit-only) |
| `payroll.personal_number_revealed` | RevealableField reveal on personnummer | activity_trail (audit-only) |
| `payroll.deduction_blocked` | W07 trigger | posthog + activity_trail (alert) |
| `payroll.constructive_dismissal_flagged` | MATERIAL ≥20% reduksjon | posthog + activity_trail (alert) |

---

## 6. Recalc Strategy

### 6.1 Triggers (hybrid, recommended)

1. **Auto on `time_entry` write** — punch_out finalizes a shift; recalc that shift's interpretation + snapshot.
2. **Auto on `tariff_rate_table` change** — for periods with `status='open'`. Blocked for `locked|approved|exported` (period freeze invariant).
3. **Auto on `framework_rule` change** — same as 2.
4. **Manual via `recalculate_period` capability tool** — admin-triggered for full period.
5. **Auto on `payroll_manual_supplement` insert/update** — recalc the affected calculation only.
6. **Auto on `tip_distribution` change BEFORE period lock** — recalc tip-affected lines only.

### 6.2 Idempotency

`(schedule_shift_id, derivation_version)` is unique. Re-running with same inputs produces identical output, but `derivation_version + 1` row is created — old kept for audit.

### 6.3 Period freeze

Once `period.status >= locked`:
- `time_entry` for shifts in the period: RLS UPDATE blocked for non-admin.
- `tariff_rate_table` change does NOT auto-recalc the period.
- Admin can manually unlock to `open` (workspace-policy gated; emits `payroll.period_unlocked`).
- After `approved`: NEVER unlock. Use corrective period.

---

## 7. Error Modes + Handling

| Failure | Detection | Handling |
|---|---|---|
| Skatteetaten fetch returns 404 | `tax_card_year != CURRENT_YEAR` after fetch | W05 BLOCK; alert admin; do not block other employees |
| Skatteetaten 503 | Edge Function timeout or 5xx | retry up to 3× with backoff; if all fail, queue for cron retry |
| Tariff snapshot row missing for shift_date | `tariff_rate_snapshot` empty | severity=error deviation; period BLOCK approve |
| Time entry punch_out missing | `time_entry.punch_out IS NULL` for past shift | severity=warning; default to scheduled `end_time`; admin override |
| Manual supplement after lock | INSERT attempt rejected by RLS | UI shows error; admin must unlock or new period |
| Tripletex sync 4xx (per line) | `payroll_export_line.sync_status='failed'` | Show error in export modal; admin can retry per line |
| A-melding XML rejected | Altinn response 4xx | Block period.exported transition; alert admin |
| `change_proposal` for line override rejected | Status=rejected | Recalc not triggered; manager notified |

---

## 8. Tech Stack Decisions Pending (ADR Required)

| Decision | Phase | Why ADR |
|---|---|---|
| PDF library: `@react-pdf/renderer` vs `puppeteer` | Phase 4 | Cost/perf trade-off, dependency surface |
| A-melding submission path: Direct via Altinn API vs delegate to Tripletex | Phase 6 | Cert management, partner agreement |
| Recalc trigger: cron-driven vs DB trigger vs hybrid | Phase 8 | Performance, debug-ability |
| Period rollback semantics: corrective period vs unlock | Phase 1 | Bokføringsloven + GBS implications |
| Four-eyes default policy: per workspace setting vs always-on for approve_period | Phase 1 | Aml. compliance + UX |

---

## 9. Out-of-Scope for v1

- Multi-tariff per workspace (one workspace = one Riksavtalen binding)
- Lærling-rules (Opplæringsloven kap. 4) — separate ADR before opening
- Bonus / commission schemes outside Riksavtalen §6
- Severance / sluttvederlag calculations
- Foreign workers with non-Norwegian skattekort
- Non-NOK currency
- Manual period creation outside workspace settings (no ad-hoc periods)
- Ansatt selv-registrering av timer (mobil clock-in is the only reality source)
