---
title: Payroll Phase 1 — Sortie Spec
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
sortie: payroll-phase-1-mvp
tags: [payroll, sortie, phase-1, mvp, calc-engine, manager-review, time-banks, dynamic-supplements, workspace-policies]
---

# Sortie Spec — Payroll Phase 1 MVP

> One sortie. One sonnet build-agent. 5–8 dev days. Builds calc engine + manager review UI + time-banks + dynamic supplements + workspace policy defaults — all on top of EXISTING Lønnsprofil + supplement-rules + timebank infra. Acceptance is falsifiable.

---

## 1. Goal

Manager opens `/dashboard/payroll`, ser én lukket periode, drill inn på en profil, acknowledge deviations, lås perioden. Calc-engine produserer korrekte tall mot hand-computed referanse. Tidskontoer akkumulerer. Workspace-spesifikke supplement-regler fyrer. Workspace-policies (OT-permission, time-rounding, GPS/QR, punch-without-shift) er konfigurerbare med defensive defaults.

**Non-goal:** Approve-period (Phase 1.5), CSV/PDF export (Phase 3+4), Tripletex sync (Phase 7), manual line-override (Phase 2). Mobile authoring forblir blokkert per ADR-0133.

---

## 2. Pre-Flight Blockers (resolve BEFORE kick-off)

Sortie kan ikke starte før alle disse er bekreftet:

| ID | Blocker | Owner | Resolution path | Estimate |
|---|---|---|---|---|
| O11 | Nattillegg kronetall (42.41/24.01/56.02) verifisert mot Riksavtalen-PDF | Pontus | Last ned PDF fra fellesforbundet.no satser 2025; bekreft 3 satser | 30 min |
| O18 | TOIL carry-over default (anbefalt 80h) | Pontus | Workspace-policy-beslutning; ingen lov-krav | 5 min |
| O22 | Overtime-mode toggle = ADMIN eller MATERIAL? | Lovsen + advokat (eller konservativ default) | Default ADMIN m/ audit-emit; flagg for review på første 3 toggles per workspace | 5 min |
| O5 | Four-eyes for approve_period (default ON/OFF/policy?) | Pontus | Beslutning: workspace-policy default OFF | 5 min |
| O6 | Period rollback semantics — corrective period vs unlock | Pontus + Lovsen | Beslutning: corrective period only (Bokf. §13 ufravikelig) | 5 min |
| O3 | Recalc trigger model (auto vs cron vs hybrid) | Pontus | Beslutning: hybrid per ARCHITECTURE.md §6.1 | 5 min |
| O16 | Nattillegg gruppe-klassifisering (per shift_type) | Pontus | Beslutning: `night_worker_category` på `payroll_shift_type` (3 enum-verdier) | inkludert i sortie |

**Pre-flight: ~1 time. Sortie kan starte når alle 7 er ✓.**

Ikke-blokkerende åpne spørsmål (kan kjøre i parallell): O7, O8, O17, O20.

---

## 3. Workspace Policies — Defaults (defensible)

Per Lovsen + WORKSPACE-POLICIES.md research. Alle ny-felt på `payroll.payroll_workspace_settings`:

```sql
ALTER TABLE payroll.payroll_workspace_settings ADD COLUMN
  -- Time-banks
  toil_default_max_banked_hours       NUMERIC(5,2) NOT NULL DEFAULT 80,
  wellness_days_per_year_default      INT NOT NULL DEFAULT 0,

  -- Dynamic supplements
  supplement_stacking_policy          TEXT NOT NULL DEFAULT 'category_exclusive'
    CHECK (supplement_stacking_policy IN ('all_stack', 'highest_only', 'category_exclusive')),

  -- Delt vakt (O12)
  split_shift_threshold_minutes       INT NOT NULL DEFAULT 0,
  split_shift_allowance_amount        NUMERIC(8,2) NOT NULL DEFAULT 0,

  -- OT authorization
  overtime_requires_pre_approval      BOOLEAN NOT NULL DEFAULT false,  -- soft warn, never block punch-out
  overtime_warn_threshold_minutes     INT NOT NULL DEFAULT 30,         -- minutes past scheduled = warn

  -- Time rounding (Aml. §10-7 — actual time recording)
  punch_rounding_minutes              INT NOT NULL DEFAULT 0           -- 0 = no rounding (default)
    CHECK (punch_rounding_minutes IN (0, 5, 10, 15, 20, 30, 60)),
  punch_rounding_direction            TEXT NOT NULL DEFAULT 'toward_employee'
    CHECK (punch_rounding_direction IN ('toward_employee', 'snap_to_scheduled', 'half_up')),
  punch_rounding_snap_window_minutes  INT NOT NULL DEFAULT 10,         -- only for snap_to_scheduled

  -- Punch buffers
  punch_window_early_minutes          INT NOT NULL DEFAULT 15,         -- allow punch-in 15 min early
  punch_window_late_minutes           INT NOT NULL DEFAULT 30,         -- allow punch-out 30 min late
  punch_grace_after_scheduled_minutes INT NOT NULL DEFAULT 60,         -- forgotten punch-out cutoff

  -- Adhoc shifts (punch without shift)
  adhoc_default_position_id           UUID REFERENCES public.position(id),
  adhoc_default_department_id         UUID REFERENCES public.department(id),

  -- Forced break reminder
  forced_break_reminder_minutes       INT NOT NULL DEFAULT 300,        -- 5h (Aml. §10-9 = 5.5h breaks)

  -- Period approval
  requires_four_eyes_for_period_approval BOOLEAN NOT NULL DEFAULT false,

  -- Manager edit policy
  manager_punch_edit_requires_reason  BOOLEAN NOT NULL DEFAULT true,
  manager_punch_edit_notifies_employee BOOLEAN NOT NULL DEFAULT true,

  -- Employee dispute policy
  employee_can_dispute_punch          BOOLEAN NOT NULL DEFAULT true,
  employee_dispute_window_days        INT NOT NULL DEFAULT 7;
```

**Eksisterende felt som forblir (ikke duplikat):**
- `shift_clock_config.gps_required` + `gps_radius_meters` + `gps_reference_lat/lng` (lokasjon-restriksjon)
- `shift_clock_config.adhoc_shifts_enabled` + `adhoc_requires_approval`
- `shift_clock_config.punch_window_minutes` (legacy single-field — superseded by early/late split, men beholdes for bakovkompat)
- `payroll.break_rule.is_paid` per AML §10-9-bindings
- `payroll.payroll_workspace_settings.period_type` + `period_start_day`

**Defaults oppsummering:**
- GPS: AV (default ingen lokasjons-restriksjon)
- Tids-avrunding: AV (`punch_rounding_minutes=0`)
- OT pre-approval: AV (Aml. §10-6 forbyr blokk, soft-warn er nok)
- Adhoc shifts: PÅ med approval-gate (eksisterende default)
- Wellness days: 0 per år (opt-in)
- TOIL max: 80 timer
- Four-eyes period approval: AV
- Stacking policy: category_exclusive (Riksavtalen-trygd)

---

## 4. Schema Migrations (5 files)

```
supabase/migrations/
  <ts>_payroll_phase1_authority_seed.sql              -- capability_default_registry rows
  <ts>_payroll_phase1_time_banks.sql                  -- TIME-BANKS.md §8
  <ts>_payroll_phase1_workspace_policies.sql          -- §3 above
  <ts>_payroll_phase1_dynamic_supplements.sql         -- DYNAMIC-SUPPLEMENTS.md §9
  <ts>_payroll_phase1_night_worker_category.sql       -- O16 resolution
```

### 4.1 Authority seed
```sql
INSERT INTO public.capability_default_registry (
  capability, tool, level, min_role, allowed_channels
) VALUES
  ('payroll', 'lock_period',                'confirm',    'admin',    ARRAY['chat']),
  ('payroll', 'acknowledge_deviation',      'suggest',    'manager',  ARRAY['chat']),
  ('payroll', 'set_overtime_mode',          'confirm',    'admin',    ARRAY['chat']),
  ('payroll', 'adjust_timebank_balance',    'confirm',    'admin',    ARRAY['chat']),
  ('payroll', 'force_timebank_payout',      'confirm',    'admin',    ARRAY['chat']),
  ('payroll', 'query_timebank_balance',     'autonomous', 'employee', ARRAY['chat']),
  ('payroll', 'add_manual_supplement',      'confirm',    'manager',  ARRAY['chat']),
  ('payroll', 'recalculate_period',         'autonomous', NULL,       ARRAY['system']);
```

### 4.2 Night worker category (O16)
```sql
CREATE TYPE payroll.night_worker_category AS ENUM ('night_watch', 'manual', 'ordinary');
ALTER TABLE payroll.payroll_shift_type
  ADD COLUMN night_worker_category payroll.night_worker_category;

-- Seed Riksavtalen tariff_rate_table for three night categories
INSERT INTO public.tariff_rate_table (
  workspace_id, rate_type, source, amount, unit, effective_from, paragraf_ref
) VALUES
  (NULL, 'nattillegg_nattvakt',       'riksavtalen', 42.41, 'kr/t', '2025-04-01', 'Riksavtalen §6'),
  (NULL, 'nattillegg_manuelt_01_06',  'riksavtalen', 24.01, 'kr/t', '2025-04-01', 'Riksavtalen §6'),
  (NULL, 'nattillegg_ordinaer',       'riksavtalen', 56.02, 'kr/t', '2025-04-01', 'Riksavtalen §6')
ON CONFLICT DO NOTHING;
```

### 4.3 Time-banks — see TIME-BANKS.md §8 for full migration body.

### 4.4 Dynamic supplements — see DYNAMIC-SUPPLEMENTS.md §9.

---

## 5. Calculation Engine (NEW package)

```
packages/payroll-calculate/
├── package.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── interpret-shift.ts          -- Layer 3 pure fn
│   ├── snapshot-cost.ts            -- Layer 4 pure fn
│   ├── evaluate-supplements.ts     -- DYNAMIC-SUPPLEMENTS.md §2
│   ├── aggregate-period.ts         -- Layer 5 pure fn
│   ├── deviation-checks.ts         -- W01–W12
│   ├── overtime-resolver.ts        -- TIME-BANKS.md §2.1 (paid_out vs banked)
│   ├── timebank-emitter.ts         -- TIME-BANKS.md §5
│   ├── stacking.ts                 -- DYNAMIC-SUPPLEMENTS.md §3
│   └── oslo-time.ts                -- re-export from packages/ai/src/capabilities/schedule/
└── __tests__/
    ├── interpret-shift.test.ts
    ├── snapshot-cost.test.ts
    ├── evaluate-supplements.test.ts
    ├── aggregate-period.test.ts
    ├── deviation-checks.test.ts
    ├── overtime-mode-banked.test.ts
    ├── overtime-mode-paid-out.test.ts
    ├── stacking-category-exclusive.test.ts
    └── golden-month/                -- 12-employee 1-month reference data
        ├── input/  (shifts, time_entries, rules, tariff)
        └── expected/ (calculations, lines, deviations, timebank_entries)
```

All pure functions. Zero I/O. Deterministic. Same input = same output.

### 5.1 Determinism contracts

- Same `(shift, time_entry, rules, tariff_snapshot, workspace_settings)` → identical `payroll_calculation` row (all fields)
- Re-run with `derivation_version+1` produces NEW row, old preserved (append-only)
- Tariff snapshot frozen on `shift_cost_snapshot.tariff_rate_snapshot` JSONB at first calc
- Re-running on closed period uses frozen tariff → identical result

### 5.2 RPC wrappers (atomic write)

```sql
-- supabase/migrations/<ts>_payroll_phase1_rpcs.sql
CREATE FUNCTION payroll.derive_shift_hours(p_period_id UUID) RETURNS VOID;
CREATE FUNCTION payroll.snapshot_period_costs(p_period_id UUID) RETURNS VOID;
CREATE FUNCTION payroll.aggregate_period(p_period_id UUID) RETURNS VOID;
CREATE FUNCTION payroll.run_deviation_checks(p_period_id UUID) RETURNS TABLE (deviation_count INT, error_count INT);
CREATE FUNCTION payroll.recalculate_period(p_period_id UUID) RETURNS JSONB;  -- runs all four in sequence
```

Each RPC: SECURITY DEFINER, calls JS function via PL/pgSQL or proxies to Edge Function. Determines `derivation_version` from MAX existing + 1.

---

## 6. New Pages (`apps/web/src/app/dashboard/payroll/`)

```
dashboard/payroll/
├── page.tsx                              -- period list (default: end_date DESC)
├── _components/
│   ├── PeriodCard.tsx                    -- one row per period w/ status badge + totals
│   ├── PeriodFilters.tsx                 -- year/month picker
│   └── EmptyState.tsx
├── [periodId]/
│   ├── page.tsx                          -- header + tabs (Lines/Deviations/Manual/Tip/Export)
│   ├── _components/
│   │   ├── PeriodHeader.tsx
│   │   ├── LinesTable.tsx                -- per-profile rows
│   │   ├── LineDrawer.tsx                -- drill-down: Shifts/Lines/Audit tabs
│   │   ├── DeviationList.tsx
│   │   ├── DeviationDrawer.tsx
│   │   ├── ManualSupplementForm.tsx      -- add manual supplement (Phase 1 manager-driven)
│   │   ├── ShiftBreakdownTable.tsx       -- Layer 3 + Layer 4 visualization
│   │   ├── SupplementFireHistory.tsx     -- which rules fired on this shift
│   │   └── LockModal.tsx
│   └── _hooks/
│       ├── usePayrollPeriod.ts
│       ├── usePayrollLines.ts
│       ├── usePayrollDeviations.ts
│       ├── useShiftBreakdown.ts
│       ├── useAcknowledgeDeviation.ts
│       ├── useLockPeriod.ts
│       └── useAddManualSupplement.ts
└── _actions/
    ├── lock-period.ts                    -- Server Action via gateAction
    ├── acknowledge-deviation.ts
    └── add-manual-supplement.ts
```

UX-mønster matches Planday (per BENCHMARK-PLANDAY.md):
- Lines tabell med totals-row øverst (kopier Plandays revenue-vs-labor overlay)
- Drawer-pattern for drill-down (eksisterende Smartout-mønster)
- Stacking-policy-toggle synlig i header

---

## 7. Existing Surfaces — Extensions (no replacement)

### 7.1 `LonnsprofilSection.tsx`

Add fields:
- `overtime_mode` select (paid_out | banked) m/ default-helpertekst
- `toil_agreement_signed_at` read-only badge ("Avtale signert YYYY-MM-DD" eller "Ikke signert" w/ "Send avtale" CTA)
- `holiday_allowance_pct` input (10.20–20.00 validated)
- `toil_max_banked_hours_override` nullable input

Mount new sub-component:
- `<TimebankPanel profileId={...} />` (NEW) — viser feriekonto + TOIL + wellness saldo, [Vis ledger]/[Justér]/[Tving utbetaling]-aksjoner

### 7.2 `supplement-rules-settings.tsx`

Add to existing Sheet:
- "Test rule" panel — velg test-vakt fra dropdown → kaller `evaluateSupplements(testCtx, [draftRule])` → viser match-detaljer
- Stacking-policy-info banner (henter fra workspace_settings)

### 7.3 `payroll-general-settings.tsx`

Add new fields-section:
- Time-banks: `toil_default_max_banked_hours`, `wellness_days_per_year_default`
- Supplements: `supplement_stacking_policy`
- Delt vakt: `split_shift_threshold_minutes` + `split_shift_allowance_amount`
- OT: `overtime_requires_pre_approval`, `overtime_warn_threshold_minutes`
- Punch: `punch_rounding_minutes`, `punch_rounding_direction`, `punch_window_early_minutes`, `punch_window_late_minutes`, `punch_grace_after_scheduled_minutes`
- Adhoc: `adhoc_default_position_id`, `adhoc_default_department_id` (selectorer)
- Approve: `requires_four_eyes_for_period_approval`
- Edit: `manager_punch_edit_requires_reason`, `manager_punch_edit_notifies_employee`, `employee_can_dispute_punch`, `employee_dispute_window_days`
- Reminders: `forced_break_reminder_minutes`

### 7.4 Mobile `(me)/payroll/timebank.tsx`

Add account-type filter chips: `[Feriepenger] [Avspasering] [Velferdsdager]`. Default: alle vist.

### 7.5 Existing time-tracking write-paths (eksisterende `apps/mobile/src/lib/sync/`)

Apply punch-rounding på server-side ved time_entry-insert basert på workspace_settings. Ingen mobile-side rounding (klient kan jukse).

---

## 8. New Capability Tools

| Tool | File | min_role | Channel | Body |
|---|---|---|---|---|
| `lock_period` | `packages/ai/src/capabilities/payroll/tools.ts` | admin | chat | Verify period in workspace → check no severity=error unack → set status=locked → merge tip_pool → emit |
| `acknowledge_deviation` | same | manager | chat | Verify deviation in workspace → set acknowledged_by/at + resolution → emit |
| `set_overtime_mode` | same | admin | chat | Verify profile in workspace → if banked: assert toil_agreement_signed_at NOT NULL → update profile → emit `overtime_mode_changed` |
| `adjust_timebank_balance` | same | admin | chat | Verify profile + account_type valid → insert entry_type='adjustment' row + reason → emit |
| `force_timebank_payout` | same | admin | chat | Verify balance > 0 → insert entry_type='payout' → trigger recalc → emit |
| `query_timebank_balance` | same | employee (own) / admin (all) | chat | Read-only, scope-checked |
| `add_manual_supplement` | same | manager | chat | Verify period status='open' → insert payroll_manual_supplement → trigger per-profile recalc → emit |

All tools:
1. Channel guard (chat-only, ADR-0078)
2. `gatedMutation` per ADR-0204
3. Workspace-scope verify server-side (ADR-0151 forgery defense)
4. `emit()` w/ full provenance

---

## 9. Telemetry Events (registry adds)

```typescript
// packages/telemetry/src/registry.ts — add to payroll.* namespace
export const PAYROLL_EVENTS = {
  ...existing,
  'payroll.period_locked':                  ['posthog', 'activity_trail', 'engine_event'],
  'payroll.deviation_acknowledged':         ['posthog', 'activity_trail'],
  'payroll.deviation_blocked_approval':     ['posthog', 'activity_trail'],
  'payroll.manual_supplement_added':        ['posthog', 'activity_trail'],
  'payroll.overtime_mode_changed':          ['posthog', 'activity_trail', 'engine_event'],
  'payroll.timebank_accrued':               ['activity_trail'],          // floods PostHog
  'payroll.timebank_withdrawn':             ['posthog', 'activity_trail'],
  'payroll.timebank_payout_forced':         ['posthog', 'activity_trail', 'engine_event'],
  'payroll.timebank_balance_adjusted':      ['posthog', 'activity_trail'],
  'payroll.supplement_rule_fired':          ['activity_trail'],          // floods PostHog
  'payroll.supplement_rule_test_run':       ['posthog'],
  'payroll.recalc_triggered':               ['posthog', 'activity_trail', 'engine_event'],
  'payroll.tariff_freeze_drift':            ['posthog', 'activity_trail'],
};
```

---

## 10. Acceptance Criteria (falsifiable)

### 10.1 Calc correctness — golden month

Test workspace: 12 employees, 1 calendar month (april 2026), mix:
- 4 fastlønn månedlig
- 6 timebasert
- 2 deltids m/ blandet tariff

Shifts: ~600 totalt. Inkluder:
- 5 vakter > 9t/dag (W02 OT-cap warning)
- 3 vakter < 11t hviletid mellom (W01 BLOCK)
- 12 vakter på lørdag/søndag (helgetillegg)
- 8 vakter med natt-timer (3 ulike night_worker_category)
- 2 helligdag-vakter (helligdagstillegg)
- 4 manual supplements (drikkepenger)

**Acceptance:**
- Hver av 12 ansatte: total_pay matcher hand-computed referanse innenfor ±0.01 NOK
- 9 deviations populert (5 W02 warning + 3 W01 error + 1 W09 warning)
- Lock-attempt med uack errors → BLOCK m/ klar UI-melding
- Etter ack alle 3 errors → lock succeeds

### 10.2 Time-banks

- Feriekonto NOK-accrual = `gross_eligible × 12.0 / 100` (Riksavtalen-default), synlig i TimebankPanel innen 5s av periode-close
- TOIL hours-accrual fyrer KUN ved `overtime_mode='banked'` AND `toil_agreement_signed_at IS NOT NULL`
- Tillegg (50%/100%) fortsatt synlig som `paid_out` line uavhengig av mode
- Wellness brukt: existing absence-flow med `absence_type='wellness'` decrementer `absence_quota.remaining_days`

### 10.3 Dynamic supplements

- 3 platform-seed Riksavtalen-regler + 2 admin-created (e.g. "Sen kveld helg") fyrer korrekt
- Test-rule preview returnerer match innen 500ms
- Hver firing produserer `shift_pay_calculation_event` med `rule_id` i provenance JSONB
- 2 overlappende `normal` rules → category_exclusive picks højeste rate

### 10.4 Mode toggle

- `set_overtime_mode` chat-trigger eller LonnsprofilSection-toggle fyrer `payroll.overtime_mode_changed`
- Switch til `banked` uten `toil_agreement_signed_at` → blokkert m/ klar feilmelding
- Audit row i `activity_trail`

### 10.5 Workspace policies (sanity)

- `punch_rounding_minutes=0` → time_entry.punch_in lagres uavrundet (default)
- `punch_rounding_minutes=15`, `direction='toward_employee'` → 07:53 punch-in lagres som 07:45 (rounded down)
- `overtime_requires_pre_approval=true` → soft-warn på UI ved punch-out etter scheduled+30 min, IKKE blokk
- `adhoc_shifts_enabled=false` → punch uten vakt rejected m/ klar feilmelding

### 10.6 Tariff freeze

- Re-running `recalculate_period(period_id)` på closed periode produserer identiske rader
- Re-running etter tariff_rate_table change på OPEN period → ny version_hash, supersession-chain

### 10.7 No regression

- Eksisterende `/dashboard/my-salary` — leser uten feil
- Eksisterende `/dashboard/people/[id]` HR-tab — Lønnsprofil + Tipsregel-modal fortsatt funksjonelle
- Mobile `(me)/payroll/payslip*.tsx` — leser uten feil
- `dashboard/settings/_components/supplement-rules-settings.tsx` — eksisterende create/edit/delete fortsatt funksjonelt

### 10.8 Audit immutability

- INSERT på `shift_pay_calculation_event` → row written
- UPDATE/DELETE attempt → RLS rejects (HØY confidence Bokf. §13)
- Supersession-chain via `superseded_by_event_id` works

---

## 11. Out of Scope (Phase 2+)

- Approve period (Phase 1.5 — separate sortie hvis tid mangler)
- CSV/PDF/A-melding/Tripletex export (Phase 3–7)
- Manual line-override via change_proposal (Phase 2)
- Skatteetaten Edge Function real body (Phase 5)
- Period auto-close cron (Phase 8)
- Recalc auto-trigger på time_entry write (Phase 8 — Phase 1 = manuell trigger only)
- Multi-workspace company A-melding aggregation (O1, fremtidig ADR)
- Rollback flow (O6, fremtidig ADR — Phase 1 = ingen rollback, kun corrective period)
- Lærling-rules (Opplæringsloven kap. 4 — separate ADR)
- Mobile authoring av payroll (ADR-0133 — alltid web-only)

---

## 12. Sortie Sequencing (5–8 days, single sonnet build-agent)

| Day | Phase | Deliverable |
|---|---|---|
| 1 | Schema + auth seed | 5 migrations applied locally; database.types regenerated; capability_default_registry rows present |
| 2 | Calc engine pure functions | `interpret-shift.ts` + `snapshot-cost.ts` + `evaluate-supplements.ts` + tests; golden-month input fixture committed |
| 3 | Calc engine completion | `aggregate-period.ts` + `deviation-checks.ts` + `timebank-emitter.ts` + tests; expected golden-month output fixture |
| 4 | RPCs + capability tools | 5 RPCs + 7 capability tools wired; gateAction integration |
| 5 | Web pages — list + period detail | `dashboard/payroll/page.tsx` + `[periodId]/page.tsx` + Lines/Deviations tabs |
| 6 | Web pages — drill-down + lock + manual | LineDrawer + LockModal + ManualSupplementForm; LonnsprofilSection extension; TimebankPanel |
| 7 | Settings UI extensions | payroll-general-settings + supplement-rules-settings test-button; mobile timebank chip-filter |
| 8 | Acceptance + polish | Run golden-month test, hand-check vs expected, fix drift; smoke production-like data |

**Build-agent:** `botsson-harness-builder` (sonnet) for capability + RPC + page work. `frontend-designer` (sonnet) for UI components. `code-reviewer` (sonnet) day 4 + 8. `system-steward` (opus) day 8 final verification.

**No Opus during build-loop** — only synthesis at end.

---

## 13. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Calc determinism breaks (rounding edge cases) | MEDIUM | HIGH | Golden-month fixture hand-computed by Pontus before sortie; CI compares fixture |
| Tariff lookup performance (per-shift JOIN) | LOW | MEDIUM | Snapshot tariff at shift_cost_snapshot creation; subsequent reads are JSON-path |
| Supplement evaluator exponential blow-up | LOW | MEDIUM | Cap at 50 active rules per workspace; profile + test |
| Workspace settings rollout breaks existing fields | MEDIUM | LOW | Migration adds columns w/ defaults — no breaking changes |
| LonnsprofilSection regression | MEDIUM | MEDIUM | Code-review + manual smoke before merge |
| TOIL agreement-signing flow ikke landed | HIGH | MEDIUM | Phase 1 ships m/ stub: admin can manually set `toil_agreement_signed_at` via SQL; full DocuSeal flow Phase 2 |
| Lovsen O17/O22 advokat-svar forsinker | HIGH | LOW | Conservative defaults shipped; advokat-svar oppdaterer policy senere uten kode-endring |
| Pre-flight blockers ikke løst | MEDIUM | HIGH | 1-time time-window bekreftet med Pontus før kick-off |

---

## 14. Definition of Done

Sortie kan close-feature kun når:

1. ✓ All 8 acceptance-kriterier (§10) passes
2. ✓ Golden-month test grønn i CI
3. ✓ Code-reviewer pass (sonnet) — no HIGH-priority issues
4. ✓ system-steward pass (opus) — plan-vs-code consistency verified
5. ✓ ADR-0204 audit (gateAction in every mutation tool) — ingen direkte writes
6. ✓ Telemetry events registrert i `packages/telemetry/src/registry.ts`
7. ✓ User journey doc `docs/journeys/JOURNEY-payroll-phase-1.md` skrevet
8. ✓ Handoff doc `docs/HANDOFF-payroll-phase-1.md` med decisions + læringer
9. ✓ `pnpm turbo typecheck` passes med 0 errors
10. ✓ `pnpm turbo test --filter=@smartout/payroll-calculate` passes 100%

Ikke-blokkerende men anbefalt:
- E2E test ved Playwright på golden-month workflow
- Manual test på en ekte test-workspace med Pontus

---

## 15. Linear-tasks (foreslått)

```
EPIC: SMA-XXXX Payroll Phase 1 MVP — Calc Engine + Manager Review + Time-Banks
├── SMA-XXXX1 Pre-flight blocker resolution (O11/O18/O22/O5/O6/O3/O16)
├── SMA-XXXX2 Schema migrations (5 files)
├── SMA-XXXX3 Calc engine pure functions + golden-month fixture
├── SMA-XXXX4 RPCs + capability tools (7 tools)
├── SMA-XXXX5 Web pages — period list + detail
├── SMA-XXXX6 LonnsprofilSection extension + TimebankPanel
├── SMA-XXXX7 Settings UI extensions + mobile chip-filter
├── SMA-XXXX8 Acceptance run + handoff
└── SMA-XXXX9 (parallel, ikke-blokkerende) Lovsen advokat-spørsmål O7/O17/O22
```

Stack: `payroll`, `phase-1`, `mvp`. Path-stack: `packages/payroll-calculate/`, `apps/web/src/app/dashboard/payroll/`, `supabase/migrations/`.

---

## 16. Cross-References

- [README.md](./README.md) — module index
- [MODULE_PAYROLL.md](./MODULE_PAYROLL.md) — main module doc
- [DATA-MODEL.md](./DATA-MODEL.md) — schema reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) — engine architecture
- [TIME-BANKS.md](./TIME-BANKS.md) — feriekonto + TOIL + wellness
- [DYNAMIC-SUPPLEMENTS.md](./DYNAMIC-SUPPLEMENTS.md) — admin-authored rules
- [WORKSPACE-POLICIES.md](./WORKSPACE-POLICIES.md) — policy options + GDPR
- [BENCHMARK-PLANDAY.md](./BENCHMARK-PLANDAY.md) — feature-benchmark
- [LEGAL-FRAMEWORK.md](./LEGAL-FRAMEWORK.md) — Lovsen-authored legal
- [TIME-BANKS-LEGAL.md](./TIME-BANKS-LEGAL.md) — Lovsen tidskonto-legal
- [USER-FLOWS.md](./USER-FLOWS.md) — manager flows
- [PHASES.md](./PHASES.md) — full phase 1–8 roadmap
- [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) — O1–O24
- ADR-0057, ADR-0110, ADR-0204, ADR-0242, ADR-0250, ADR-0251, ADR-0252, ADR-0254, ADR-0259
