---
title: Module — Payroll Engine
status: archived
updated: 2026-05-23
created: 2026-05-06
module: payroll
tags: [module, payroll, lønn, c3-commercial, adr-0057, adr-0110, adr-0242, adr-0250, adr-0251, adr-0252, adr-0254]
superseded_by: docs/domains/payroll/
---
> Archived 2026-05-23 — see [payroll domain](../../domains/payroll/).


# Module — Payroll Engine

## 1. Overview

The Payroll Engine derives Norwegian wage data from operational reality (`schedule_shift` planned + `timesheet.time_entry` actual), applies Riksavtalen + AML rules, and produces auditable per-period payroll lines that flow to Tripletex (sync), A-melding (Skatteetaten reporting), CSV (admin export), and PDF (employee lønnsgrunnlag).

The engine is a **C3 Commercial Control Plane consumer** following the same placement logic as the Billing Engine (ADR-0118): it reads from D1 (department), D2 (profile, employment_contract, schedule_absence), D3 (regulatory_framework, tariff_rate_table), D6 (schedule_shift, time_entry), and produces decisions (`payroll_calculation`, `payroll_period.status`) but does not write back into the cascade dimensions.

Every mutation emits to `@smartout/telemetry`, every audit row is immutable per Bokføringsloven §13 (5-year retention), and every PII access goes through the `payroll` capability gate (ADR-0242 Høy-PII isolation).

**Primary entry points:**
- Route: `/dashboard/payroll` (workspace-admin) — period list, line review, approve, export. **(Phase 1 deliverable — does not yet exist.)**
- Mobile read: `apps/mobile/app/(app)/(me)/payroll/payslip*.tsx` — employee payslip view.
- AI capability: `payroll` — `update_payroll_profile`, `query_tax_card`, `set_pension_scheme`, `view_personal_number`, `view_bank_account`, `salary_query`. Chat-only, admin-gated.
- Cron: `engine_process` blueprint `payroll_period_close` (Phase 8 deliverable).
- Edge Functions: `skatteetaten-fetch` (ADR-0250), `tripletex-sync` (Phase 7 deliverable).

**Schema locations:**
- Config: `supabase/migrations/20260422110100_*.sql`
- Calculation/period/export: `supabase/migrations/20260422110200_*.sql`
- Absence: `supabase/migrations/20260422110600_*.sql`
- Schema-move (public → payroll): `supabase/migrations/20260422110700_*.sql`
- Bubble archive: `supabase/migrations/20260515100500_payroll_ledger_archive.sql`
- Tips/drikkepenger: `supabase/migrations/20260428220004_tips_distribution_table.sql`
- Capability authority seed: `supabase/migrations/20260519160000_payroll_capability_authority_seed.sql`
- Riksavtalen + framework_rule seed: `supabase/migrations/20260424100000_seed_hospitality_framework.sql`

---

## 2. Placement — Why C3 Commercial, Not D6 Production

C3 answers **"what value, what cost?"** — payroll is precisely that question for the labour side. The alternative placements are wrong:

| Placement | Why Rejected |
|---|---|
| D6 Production | D6 owns live operational state (sessions, shifts, time entries). Payroll calculations are ex-post settlement of D6 reality through D3 rules + tariff. Putting closed-period audit data in a live-mutation table breaks the immutability guarantee Bokføringsloven §13 demands. |
| D2 Resource | D2 owns capacity (who is available). Payroll is the cost outcome of D2 utilization, not D2 itself. |
| K1a Industry Knowledge | Riksavtalen rates **templates** live in K1a (`tariff_rate_table` with NULL workspace_id). Per-employee per-period calculation is workspace-derived, not knowledge. |
| Standalone domain outside cascade | The engine reads cascade-derived inputs (`schedule_shift`, `time_entry`, `framework_rule`, `tariff_rate_table`). External placement would force duplicating those reads. |

C3 invariants that follow:

- The engine reads but never writes `schedule_shift`, `time_entry`, `framework_rule`, `tariff_rate_table`, `employment_contract`, `employee_payroll_profile` — these are cascade-owned.
- The engine writes `shift_hour_interpretation`, `shift_cost_snapshot`, `payroll_calculation`, `payroll_calculation_line`, `payroll_deviation`, `payroll_period.status` (transitions only), `payroll_export_event`, `payroll_export_line`, `shift_pay_calculation_event` (audit).
- C3 never produces cascade coefficients. If payroll ever needs to drive scheduling (e.g. "stop assigning this employee, OT cap reached") that is a new control plane contract, not a C3 extension — see `framework_rule`-trigger pattern in `overtime_cap_policy` (ADR-0254).
- The engine emits events; C2 (Botsson) consumes them for narration. No inverse coupling.

---

## 3. Scoping Rules — Universal `workspace_id` Holds

Unlike billing (which is company-scoped per ADR), payroll is **workspace-scoped**. Reasoning:

- A profile may have employment in multiple workspaces (chain ownership). Each employment has its own `employee_payroll_profile`, its own tariff binding, its own A-melding-rapportering per `virksomhetsnummer`.
- A-melding is filed per arbeidsgiver (legal entity = company), but Smartout structurally maps **company → workspace** as the operational unit. If a company runs multiple workspaces under one orgnr, a separate ADR is required (open question — see [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) §1).
- Period closing, deviation acknowledgment, and approval are workspace-level admin actions.

Every payroll table carries `workspace_id` (except `payroll_ledger_archive` which has it as well — Bubble archive structure).

`tariff_rate_table` is the documented exception inside cascade: NULL workspace_id = platform-level Riksavtalen seed, non-NULL = workspace override. Engine resolves: workspace-specific row first, fall back to platform NULL row.

---

## 4. Five-Layer Derivation Pipeline

```
LAYER 1 — Execution (D6, owned by Schedule)
  schedule_shift: planned date, start_time, end_time, breaks, position_id, employee_id, status
       ↓ (employee clocks in/out via mobile)
LAYER 2 — Reality (D6, owned by Schedule)
  timesheet.time_entry: punch_in, punch_out, breaks JSONB, location, status
       ↓ (interpret rules applied — RPC: derive_shift_hours)
LAYER 3 — Interpretation (D6, owned by Payroll)
  shift_hour_interpretation: regular/OT/night/holiday/weekend hours, break_deductions,
                              derivation_version (append-only per shift)
       ↓ (derive cost from tariff snapshot — RPC: snapshot_shift_cost)
LAYER 4 — Derivation (C3, owned by Payroll)
  shift_cost_snapshot: tariff_rate_snapshot JSONB (frozen), base/regular/night/holiday cost,
                       supplements, deductions, calculation_version
       ↓ (aggregate per period + per employee)
LAYER 5 — Decision (C3 + C4, owned by Payroll)
  payroll_calculation (append-only per period): scheduled vs actual, gross_minutes,
                                                base_pay, total_supplements, total_deductions, total_pay
  payroll_calculation_line: per-item rows for export
  payroll_deviation: warnings/errors blocking period.approved transition
  payroll_period: open → locked → approved → exported
       ↓ (export)
EXPORTERS:
  payroll_export_event + payroll_export_line:
    - csv (admin download)
    - pdf (lønnsgrunnlag per ansatt)
    - amelding (XML to Altinn, via Tripletex)
    - tripletex_api (push)
       ↓ (5-year audit retention)
AUDIT:
  shift_pay_calculation_event (ADR-0251): one row per pay rule fired per shift,
    rate_value_applied snapshotted, provenance JSONB, supersession-chain, immutable.
    Retention anchor: shift_period_end_date.
```

**Re-derivation rule:** any layer can be re-run, producing a new version row (never updating). `payroll_calculation` is `append-only` per shift per period — newest version wins (`MAX(calculated_at)`). Tariff version change after period close = new amendment flow per ADR-0252; archived calculations stay frozen.

---

## 5. Capability Layer

Per ADR-0242, the `payroll` capability is the high-PII isolation point.

| Property | Value |
|---|---|
| Capability name | `payroll` |
| File | `packages/ai/src/capabilities/payroll/{index,tools,gate}.ts` |
| `defaultAuthority` | `read_only` |
| `allowedChannels` | `["chat"]` (Layer 3 voice forbidden) |
| `min_role` | `admin` |
| `level` | `confirm` |
| `requires_four_eyes` | per workspace policy (default false; opt-in per ADR-0254-pattern) |
| `toolAuthPattern` | `direct_admin` |
| `emitPrefix` | `payroll` |

### Existing skeleton tools (Phase 0b)

| Tool | Status | Phase 0c+ work |
|---|---|---|
| `update_payroll_profile` | stub | wire to `employee_payroll_profile` writes via `gatedMutation` |
| `query_tax_card` | stub | wire to Skatteetaten fetch (ADR-0250) |
| `set_pension_scheme` | stub | implement OTP-scheme write |
| `view_personal_number` | stub (masked) | RevealableField pattern, audit-emit on reveal |
| `view_bank_account` | stub (masked) | same |
| `salary_query` | stub | wire to `get_salary_breakdown(profile_id, period)` RPC (ADR-0251) |

### Phase 1+ tools to add (mutation-bearing)

| Tool | Channel | Level | min_role | Purpose |
|---|---|---|---|---|
| `lock_period` | chat | confirm | admin | Period transition open → locked |
| `approve_period` | chat | confirm + four-eyes | admin | locked → approved |
| `add_manual_supplement` | chat | confirm | admin | Insert into `payroll_manual_supplement` |
| `override_calculation_line` | chat | confirm | admin | Spawn `change_proposal` of type `wage_line_override` |
| `acknowledge_deviation` | chat | suggest | manager | Set `payroll_deviation.acknowledged_*` |
| `export_period` | chat | confirm | admin | Trigger exporter (CSV/PDF/A-melding/Tripletex) |
| `recalculate_period` | system | autonomous | system | Re-run layers 3–5 after tariff change |

All Phase 1+ tools must:
1. Call `gatedMutation` per ADR-0204.
2. Verify `profile_id ∈ workspace_id` server-side (ADR-0151 forgery defence).
3. Emit `payroll.*` event with full provenance.
4. Write `shift_pay_calculation_event` audit row when relevant (ADR-0251).

---

## 6. Invariants

These properties hold across the engine; any code that breaks them is a bug:

1. **Immutability of audit rows.** `shift_pay_calculation_event`, `payroll_ledger_archive`, and `shift_cost_snapshot` (per version) are RLS-blocked from UPDATE/DELETE. Re-derivation = new row.
2. **Tariff freeze at calculation time.** `shift_cost_snapshot.tariff_rate_snapshot` is a JSONB freeze. No runtime tariff lookup during `aggregatePeriod`.
3. **No cascade write-back.** Payroll never writes `schedule_shift`, `time_entry`, `framework_rule`, `tariff_rate_table`, `employment_contract`, `employee_payroll_profile`. Mutations to those go through their owning capability.
4. **Append-only payroll_calculation.** Newest `calculated_at` wins. Old rows stay for audit.
5. **Period state machine is one-way except open→open re-entry on same period.** open → locked → approved → exported. To "reopen" an approved period: open a new corrective period, do NOT mutate the original.
6. **Deviation severity gates approval.** Any `payroll_deviation` with `severity=error` AND `acknowledged_by IS NULL` blocks `period.approved` transition.
7. **PII gate.** Personnummer/bankkonto reveal requires audit-emit + revealable-field UI. Voice channel forbidden (ADR-0078).
8. **Retention anchor is `shift_period_end_date`, not `created_at`.** Bokføringsloven §13 5-year clock starts from regnskapsår-slutt of the period the row belongs to (ADR-0251).
9. **AML gates are blocking, not advisory.** `framework_rule` GATE-rules (W01–W12) BLOCK calculation if `severity=error`. Bypass requires explicit `change_proposal` with admin override.
10. **Tip pool merges at lock, not before.** `tip_distribution.payroll_period_id` is set when period transitions open → locked. Distributions stay editable in pool until then.

---

## 6.5. Integration With Existing Surfaces (Reuse, Don't Rebuild)

Phase 1 bygger ON TOP OF eksisterende infra. Ingen nye admin-flater for ting som finnes.

| Concern | Existing surface | Phase 1 extension |
|---|---|---|
| Edit per-employee payroll fields | `apps/web/src/app/dashboard/people/[id]/_components/LonnsprofilSection.tsx` | Add `overtime_mode` select + `toil_agreement_signed_at` badge + `holiday_allowance_pct` field |
| Per-employee tip rule | `apps/web/src/app/dashboard/people/[id]/_components/TipsregelModal.tsx` | NO change — existing flow integrates via `contract_tip_rule` |
| Workspace salary codes | `dashboard/settings/_components/salary-codes-settings.tsx` | NO change — already has `tripletex_code` + `a_melding_code` fields |
| Workspace supplement rules (6 types) | `dashboard/settings/_components/supplement-rules-settings.tsx` | Add "Test rule" preview panel. Evaluator wired to calc engine. See [DYNAMIC-SUPPLEMENTS.md](./DYNAMIC-SUPPLEMENTS.md). |
| Workspace tariff overrides | `dashboard/settings/_components/TariffRatesPanel.tsx` | NO change — Phase 1 calc reads from existing rows |
| Workspace payroll general settings | `dashboard/settings/_components/payroll-general-settings.tsx` | Add `toil_default_max_banked_hours`, `wellness_days_per_year_default`, `supplement_stacking_policy`, `split_shift_threshold_minutes`, `split_shift_allowance_amount` |
| Time-bank ledger | `payroll.timebank_entry` (table) + `apps/mobile/app/(app)/(me)/payroll/timebank.tsx` (read) | New `TimebankPanel.tsx` under `LonnsprofilSection`. Account-type filter chips on mobile. See [TIME-BANKS.md](./TIME-BANKS.md). |
| Absence quota | `payroll.absence_quota` (existing) + `absence-balance.tsx` (mobile read) | Add `wellness` absence_type. Existing surfaces continue to work. |
| Manual supplement entry | `apps/mobile/.../supplements.tsx` (employee submit) | Add admin web counterpart in Lines drawer per USER-FLOWS Flow E |
| Manager review/approve UI | DOES NOT YET EXIST | New: `apps/web/src/app/dashboard/payroll/` (Phase 1 deliverable) |

**Principle:** if it already exists in code, extend the existing surface. Don't fork. Don't duplicate. Phase 1 changes are **additive**.

---

## 7. Module Boundaries

### Inside the module
- All `payroll.*` schema tables.
- `shift_hour_interpretation`, `shift_cost_snapshot`, `shift_pay_calculation_event` (live in `public` but logically owned by payroll).
- `packages/ai/src/capabilities/payroll/`.
- `packages/payroll-export/` (Phase 3+ deliverable, NEW package).
- `apps/web/src/app/dashboard/payroll/` (Phase 1+ deliverable, NEW pages).
- `apps/web/src/app/dashboard/my-salary/` (employee read).
- `apps/mobile/app/(app)/(me)/payroll/` (employee read).
- `supabase/functions/skatteetaten-fetch/` (Phase 5).
- `supabase/functions/tripletex-sync/` (Phase 7).
- `supabase/functions/amelding-export/` (Phase 6).

### Outside the module (read-only consumers OR upstream owners)
- `schedule_shift`, `time_entry`, `schedule_absence` — read by payroll, owned by Schedule.
- `tariff_rate_table`, `framework_rule`, `regulatory_framework`, `public_holiday` — read by payroll, owned by I1/cascade D3.
- `employment_contract`, `employment_contract_detail` — read by payroll, owned by Contracts.
- `employee_payroll_profile` — read by payroll for calculation; write by `payroll` capability tools only.
- `change_proposal` — used by payroll for line-override approvals; owned by cascade C4.
- `tip_pool`, `tip_distribution` — read by payroll on period lock; written by Tip module.
- `engine_authority_config` — read for gate decisions; managed via authority migrations.

### Hard "do not touch"
- Stripe billing (`apps/admin/`, `pricing_terms`, `invoice`) — different concern (workspace subscription).
- DocuSeal (`contract.signed_pdf_url`) — Contracts module's concern.

---

## 8. Open Decisions

See [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md). Ten unresolved questions block phase progression:

1. Multi-workspace per company A-melding aggregation
2. Lønnsgrunnlag acknowledgement requirement (digital sign vs view-only)
3. Recalculation trigger model (auto on time_entry write vs manual vs hybrid)
4. A-melding submission timing (manual button vs auto on approve)
5. Four-eyes default policy for period approval
6. Period rollback flow (correction-period vs unlock)
7. Indekstillegg amendment — new ansatt-signature required?
8. Tips A-melding kode classification (111-A vs annenArbeidsinntekt)
9. Lærlinglønn + OTP edge cases (Opplæringsloven kap. 4)
10. Frikort / AGA-fritak grenseverdi-håndtering (årlig oppdatering)

---

## 9. Phases — see [PHASES.md](./PHASES.md)

Phase 1 (calculation engine + manager review UI) ships first. Phase 4 (PDF lønnsgrunnlag) is the second-priority deliverable because it is what employees actually see. Phases 5–8 are compliance and integration build-out.
