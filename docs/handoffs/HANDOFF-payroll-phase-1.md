---
title: "Handoff — Payroll Phase 1 MVP"
status: done
updated: 2026-05-07
created: 2026-05-06
module: payroll
tags: [payroll, phase-1, handoff]
---

# Handoff — Payroll Phase 1 MVP

Branch: `feat/payroll-payroll-phase-1`
Worktree: `/home/sxtnl/wsl/smartout.ai-payroll-wt-1`

---

## What was built

Full Phase 1 MVP for the Smartout Payroll Engine. 8-day sortie, ~20 commits.

### Engine (packages/payroll-calculate)

| Module | Status |
|--------|--------|
| `interpret-shift.ts` | Green — bucket classification, overtime detection, overnight splits |
| `evaluate-supplements.ts` | Green — DSL-driven firing, `match_predicate` JSONB eval |
| `stacking-policy.ts` | Green — sum_all / highest_wins / first_match |
| `snapshot-cost.ts` | Green — tariff snapshot freeze, `shift_cost_snapshot` shape |
| `aggregate-period.ts` | Green — per-profile aggregation, monthly salary override, tips |
| `deviation-checks.ts` | Green — W01-W14 (W13 minstelønn, W14 INFO-only advisory) |
| `timebank-emitter.ts` | Green — feriepenger accrual, TOIL banked-OT, wellness |
| Golden-month tests | 133/133 green — 12 profiles × 43 shifts |

### Database (supabase/migrations)

8 payroll-specific migrations:
- `20260422110000_payroll_enums.sql` — enums
- `20260422110100_payroll_config_tables.sql` — workspace_settings + supplement_rule
- `20260422110200_payroll_calculation_tables.sql` — period + calculation + calculation_line
- `20260422110300_payroll_alter_existing.sql` — employee_payroll_profile extensions
- `20260422110400_payroll_seed_holidays.sql` — Norwegian public holidays
- `20260422110500_payroll_absence_enums.sql` — absence_type enum
- `20260422110600_payroll_absence_tables.sql` — schedule_absence + absence_quota
- `20260519160000_payroll_capability_authority_seed.sql` — tool authority defaults
- `20260527101600_payroll_punch_rounding_trigger.sql` — server-side punch rounding

### Capability tools (packages/ai/src/capabilities/payroll)

7 tools registered with authority defaults:

| Tool | Authority | Gate |
|------|-----------|------|
| `lock_period` | confirm | gate_action |
| `acknowledge_deviation` | confirm | gate_action |
| `set_overtime_mode` | confirm | gate_action + ADR-0254 TOIL guard |
| `adjust_timebank_balance` | confirm | gate_action |
| `force_timebank_payout` | confirm | gate_action |
| `query_timebank_balance` | read_only | none |
| `add_manual_supplement` | confirm | gate_action |

All tools emit telemetry via `@smartout/telemetry`. No direct DB writes without gate_action.

### UI surfaces

| Surface | Location | What |
|---------|----------|------|
| Period list | `/dashboard/payroll` | PeriodListClient + PeriodCard |
| Period detail | `/dashboard/payroll/[periodId]` | PeriodDetailClient + LinesTable + LineDrawer |
| LineDrawer | `/dashboard/payroll/[periodId]/_components/LineDrawer.tsx` | Per-employee drill-down: Vakter + Linjer tabs |
| LonnsprofilSection | `/dashboard/people/[id]/_components/LonnsprofilSection.tsx` | Phase 1 fields: overtime_mode, holiday_allowance_pct, toil_max_banked_hours |
| TimebankPanel | `/dashboard/people/[id]/_components/TimebankPanel.tsx` | Per-account-type balance + last 3 entries |
| Payroll settings | `/dashboard/settings/_components/payroll-general-settings.tsx` | 28 fields across 8 cards |
| Supplement rules | `/dashboard/settings/_components/supplement-rules-settings.tsx` | Rule CRUD + T7.2 RulePreviewPanel |
| Mobile timebank | `apps/mobile/app/(app)/(me)/payroll/timebank.tsx` | Account-type chip filter |

### Server-side rounding

`timesheet.apply_punch_rounding()` trigger reads `payroll.workspace_settings` and rounds `punch_in` on INSERT, `punch_out` on UPDATE. `timesheet.round_timestamp()` helper is IMMUTABLE + reusable.

---

## Decisions made

### ADR-0250 — Dynamic Supplement Framework (pre-existing, promoted)
All supplement rules stored in `payroll.supplement_rule` as DSL rows. Engine reads + evaluates at calc time. No hardcoded rates.

### ADR-0251 — shift_pay_calculation_event audit (pre-existing, non-negotiable)
INSERT-only audit trail. Every supplement firing persisted with `rule_id`, `tariff_id`, `amount`, `provenance JSONB`.

### ADR-0254 — Timebank dual-currency + banked OT guard
`overtime_mode: "banked"` blocked at tool level if `toil_agreement_signed_at IS NULL`. Both NOK and hours tracked.

### ADR-0259 — workspace_settings policy defaults
28 fields with documented defaults per `docs/domains/payroll/WORKSPACE-POLICIES.md`. Engine reads every field at calc time.

### Punch rounding (no ADR — impl-level)
Server trigger pattern chosen over BFF pattern because: (1) offline-first punch queue writes directly to Supabase, no BFF in path; (2) trigger is atomic with the INSERT; (3) no client change needed. Trigger is idempotent and direction=none is always a no-op guard.

---

## Learnings

1. **`evaluateSupplements()` signature is not form-compatible.** Positional params, `bucket.from/to`, `match_predicate` JSONB — too complex for a BFF preview route. The `RulePreviewPanel` pure-formatting approach is the right abstraction for live preview.

2. **`timebank_entry` uses `value_amount`/`value_unit`, not `amount_nok`.** `amount_nok` does not exist. Always read from DB types, not assumption.

3. **LineDrawer PK names.** `payroll.calculation` PK is `id` (not `calculation_id`). `payroll.calculation_line` PK is `id` (not `line_id`). Generated types are authoritative.

4. **payroll-general-settings JSX grid discipline.** When adding N new Cards to an existing grid div, always track the grid close tag. The TS error "no closing tag on `<form>`" is a misleading diagnostic for broken JSX structure.

5. **Punch trigger needs SECURITY DEFINER + search_path.** The trigger function reads across schemas (timesheet + payroll). Without `SECURITY DEFINER` and explicit `SET search_path`, cross-schema reads fail under the anon role.

---

## Known issues / debt

| ID | Description | Phase |
|----|-------------|-------|
| C1 | Golden-month `expected/` fixture empty — no cents-exact match | Phase 2 |
| C2 | Only 43 fixture shifts (spec'd ~600) | Phase 2 |
| I3 | W14 minstelønn: INFO + advisory, not auto-apply | Phase 2 ADR |
| W11 | UTC/Oslo grouping edge for 22:00 UTC shifts | Phase 2 fix |
| W04 | 4-week W04 boundary test missing | Phase 2 |
| A1 | `contract_intake` still bypasses gate_action | Phase A1 (AI harness) |
| D1 | **Plan T4.5 over-specifies `payroll.tips_merged` event** — Plan listed it among 13 events, but spec §9 lists 13 different events without `tips_merged`. Implementation correctly followed the spec (no tips_merged registered or emitted). Tips are merged at `aggregate-period` time (before lock), not at lock-time. Resolution: drop from plan in next sortie OR add to spec §9 and emit at aggregate-period time. | Phase 2 |
| D2 | **Spec §8 lock_period wording says "merge tip_pool"** — Code merges tips earlier in the pipeline during aggregate-period (see `apps/web/src/app/api/payroll/aggregate-period/route.ts:139-157` and `packages/payroll-calculate/src/aggregate-period.ts:174-189`). lock-period code at `apps/web/src/app/api/payroll/lock-period/route.ts:144-158` only sets status=locked; no tip-merge at lock time. Phase 1 acceptance §10.1 does not include a tip-merge-specific assertion, and tips ARE in aggregated state before lock — defensible. Recommend revising spec §8 to say "verify tips already-aggregated" OR adding explicit lock-time tip-snapshot in Phase 2. | Phase 2 |
| D3 | **ManualSupplementForm UI not built** — Plan T6.4 listed it. Capability tool `add_manual_supplement` exists at `packages/ai/src/capabilities/payroll/tools.ts:1103` (chat-only per ADR-0078 Høy-PII). Spec §10.1 fixture includes "4 manual supplements (drikkepenger)" — managers can add via Botsson chat but no period-detail Sheet/Form exists. Acceptable as Phase 1 design (Høy-PII chat-only) but worth explicit acknowledgment as a UX gap. | Phase 2 |
| D4 | **`force_timebank_payout` + `add_manual_supplement` missing recalc trigger** — Both tools insert their respective rows but do not auto-trigger `recalculate_period`. Manager must manually click "Beregn på nytt" after these mutations to see updated totals in the period detail view. Phase 2 follow-up: add an internal recalc-trigger fetch call from these tool bodies after the insert, OR document in the BotssonShell tool-response that a "Recalc required" message appears after these actions. | Phase 2 |

---

## Next steps

1. **Phase 1.5 — Period approval flow** (four-eyes gate, `requires_four_eyes_for_period_approval`)
2. **Phase 2 — Fix C1/C2/I3/W11/W04** before production go-live
3. **Phase 3 — CSV/PDF/A-melding export**
4. **Phase 5 — Real Skatteetaten submission**
5. **Phase 7 — Riksavtalen real-fetch via lovsen-nho-reiseliv-mcp**
6. **Phase 8 — Period auto-close cron + recalc auto-trigger**

---

## Files changed (key)

```
packages/payroll-calculate/src/
  index.ts
  types.ts
  interpret-shift.ts
  evaluate-supplements.ts
  stacking-policy.ts
  snapshot-cost.ts
  aggregate-period.ts
  deviation-checks.ts
  timebank-emitter.ts

packages/payroll-calculate/__tests__/golden-month/
  golden-month.test.ts
  input/*.json

packages/ai/src/capabilities/payroll/
  index.ts
  tools.ts

apps/web/src/app/dashboard/payroll/
  page.tsx
  [periodId]/page.tsx
  [periodId]/_components/PeriodDetailClient.tsx
  [periodId]/_components/LinesTable.tsx
  [periodId]/_components/LineDrawer.tsx
  [periodId]/_hooks/use-payroll-lines.ts
  [periodId]/_hooks/use-payroll-period.ts

apps/web/src/app/dashboard/people/[id]/_components/
  LonnsprofilSection.tsx
  TimebankPanel.tsx

apps/web/src/app/dashboard/people/_actions/
  employment-contract-actions.ts

apps/web/src/app/dashboard/settings/_components/
  payroll-general-settings.tsx
  supplement-rules-settings.tsx

apps/web/src/app/dashboard/settings/_hooks/
  use-payroll-settings.ts

apps/mobile/app/(app)/(me)/payroll/timebank.tsx

supabase/migrations/20260527101600_payroll_punch_rounding_trigger.sql
```
