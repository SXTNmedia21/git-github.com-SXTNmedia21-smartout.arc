---
title: "Payroll — Overview"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: payroll
tags: [domain, payroll, overview, lønn, cascade]
---

# Payroll — Overview

> What this domain is and why it exists. **Code wins** — if this contradicts code, update here.

## 1. What it is

The Payroll domain derives Norwegian wage data from operational reality — planned shifts (`schedule_shift`) and actual punches (`time_entry`) — runs a versioned rule engine against Riksavtalen + Arbeidsmiljøloven, and produces auditable per-period payroll components that flow to CSV export, PDF lønnsgrunnlag, and eventually Tripletex sync.

This is **not a spreadsheet**. Every krone is traceable to: which shift, which rule, which tariff version. That transparency is the business moat — compliance becomes a byproduct of actual working data, not logged documentation.

The engine has three distinct layers with no leakage between them:

1. **Input** — `time_entry` + `schedule_shift` + `profile` + `employee_payroll_profile` + `employment_contract`. Raw hours, employee classification, FTE, ansiennitet step, whether the workspace is tariff-bound.
2. **Regelmotor** — versioned tariff data in `tariff_rate_table`, `framework_rule`, `regulatory_framework`, `supplement_rule`. Riksavtalen is data, not code. Classifies hours, resolves supplement firing, applies seniority lookups.
3. **Output** — `payroll.calculation` + `payroll.calculation_line` + `payroll.period` + `shift_pay_calculation_event` (audit, INSERT-only). Each line points back to input + rule + tariff version. Feriepenger accrual, TOIL, wellness days tracked via `payroll.timebank_entry`.

## 2. Cascade placement

| Dimension | Role |
|---|---|
| **D2 Resource** | Consumes — `employee_payroll_profile`, `employment_contract`, `profile` |
| **D3 Rules** | Consumes — `tariff_rate_table`, `framework_rule`, `regulatory_framework` |
| **D6 Production** | Consumes — `schedule_shift` (planned) + `time_entry` (actual) from day-session |
| **C3 Commercial** | Primary owner — `shift_cost_snapshot`, `payroll.calculation`, `payroll.period` |
| **C4 Governance** | Enforces — period lock requires `engine_authority_config` gate (`payroll` capability, `admin` min-role) |
| **K1a Industry** | Reads — `tariff_rate_table` (NULL `workspace_id`) platform-seeded Riksavtalen baseline |

Payroll sits at the **C3 output layer**: it is the last stage in a cascade that starts with D1 (operating hours envelope), flows through D6 (actual session production), passes through C1 (daily reconciliation approval), and terminates here in locked, auditable pay periods.

## 3. Boundaries

**Owns:**
- 3-layer calc engine (`packages/payroll-calculate/src/` — all 14 files)
- AI capability `payroll` (17 tools in `tools.ts`) + sub-capability `tariff` (3 tools in `tariff-tools.ts`)
- Web dashboard `/dashboard/payroll/` (period list + period detail + tariff admin)
- Web self-view `/dashboard/my-salary/[lonnsgrunnlagId]/` (employee lønnsgrunnlag PDF)
- Mobile components `apps/mobile/src/components/payroll/*` (read-only: PayslipList, TimebankScreen, PayrollHomeCard, SupplementBadges, AbsenceDetail) + `apps/mobile/src/lib/payroll-calc.ts` + `apps/mobile/src/lib/supplements.ts`
- Time-banks (feriepenger / TOIL / wellness — dual-currency NOK+hours, ADR-0254)
- Workspace policies: stacking, overtime mode, punch rounding (in `payroll.workspace_settings`)
- Dynamic supplements (admin-authored DSL in `public.supplement_rule` / `public.supplement_rule_match`)
- Exports: CSV aggregate + provenance + unmasked; PDF lønnsgrunnlag (Storage bucket `payroll-lonnsgrunnlag`)
- Period lock + audit (`public.shift_pay_calculation_event`, INSERT-only per ADR-0251)
- Tariff binding management (`public.workspace_union_binding` via delegation to cascade capability per ADR-0356)
- 45 payroll migrations in `supabase/migrations/*payroll*`

**Does NOT own:**
- Employment contracts → `contract` capability (ADR-0242 capability split). Payroll reads `employment_contract` for ansiennitet; it does not write contracts.
- Lovsen-MCP / Riksavtalen authoring → `services/lovsen-nho-reiseliv-mcp/` (Python). Payroll consumes `tariff_rate_table`; it does not author tariff data.
- `tariff_rate_table` rows with `workspace_id IS NULL` (K1a platform baseline) → owned by platform seed migrations.
- A-melding XML → **out of scope**. Accountant uses Tripletex/Visma with the lønnsgrunnlag PDF. Smartout does not submit to Skatteetaten directly.
- Billing (Smartout-bills-its-customer-companies-on-usage) → entirely separate. Payroll = workspace's own labor cost.
- Day-session close → `day-session` domain. Payroll reads `daily_reconciliation` + `shift_cost_snapshot` after `daily_reconciliation.approved_at` is set (after C1 approval).

**Edge — confirmed seams:**
- `employee_payroll_profile` lives in `public` schema (D2 territory, created in `20260421100200_cascade_a1_domain_tables.sql:317`). Core-structure docs acknowledge it as payroll-domain owned (`docs/domains/core-structure/DATA-MODEL.md:227`). **Payroll owns it; core-structure references it.**
- `shift_cost_snapshot` lives in `public` (C3, `20260421100200_cascade_a1_domain_tables.sql:379`). Day-session confirms hours into this table; payroll reads it after approval. **Clear author/consumer seam — keep.**
- `workspace_union_binding` (`20260618100000_workspace_union_binding_and_tariff_floor.sql:76`) — cascade capability authors binding rows via delegation chain from payroll tariff tools. **Payroll initiates; cascade owns the write via ADR-0356.**

## 4. Key invariants

- **Versioned tariff, never overwrite** — `tariff_rate_table` uses `effective_from`/`effective_to`/`law_version`. Old runs reproduce bit-exactly. (`packages/payroll-calculate/src/types.ts`, `20260527100400_payroll_phase1_tariff_law_version.sql`)
- **Idempotent calc** — same `(shift, time_entry, rules, tariff_snapshot, workspace_settings)` → identical `payroll.calculation` row. Re-run increments `derivation_version`, old row preserved. (`packages/payroll-calculate/src/snapshot-cost.ts`)
- **INSERT-only audit trail** — `shift_pay_calculation_event` has RLS rejecting UPDATE/DELETE per Bokf. §13. (`20260527100700_payroll_phase1_audit_event.sql:23`)
- **Golden-month CI** — `packages/payroll-calculate/__tests__/golden-month/` hand-computed reference: 12 employees × 1 month × ~600 shifts, cents-exact. Every rule change runs against this.
- **Tariff snapshot frozen** — `shift_cost_snapshot.tariff_rate_snapshot` JSONB frozen at first calc; re-run reads the frozen snapshot, not live tariff data. (`20260421100200_cascade_a1_domain_tables.sql:379`)
