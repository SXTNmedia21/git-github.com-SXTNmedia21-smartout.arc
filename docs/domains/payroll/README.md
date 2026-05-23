---
title: "Payroll — Domain Index"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: payroll
tags: [domain, payroll, source-of-truth, lønn]
---

# Payroll — Source of Truth

> Authoritative folder for the **payroll** domain. If code contradicts this folder → **CODE wins**, update these docs.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| Calc engine (`packages/payroll-calculate/`) | ✅ | ✅ | 14 files, golden-month suite |
| AI capability `payroll` (17 tools) | ✅ | 🟡 | 1 unit test; full capability harness pending |
| AI sub-capability `tariff` (3 tools) | ✅ | 🔴 | No dedicated test; delegation chain tested manually |
| Web dashboard `/dashboard/payroll/` | ✅ | 🟡 | Phase 1–5 shipped; E2E smoke only |
| Web self-view `/dashboard/my-salary/[lonnsgrunnlagId]/` | ✅ | 🟡 | Phase 4 PDF + signed URL spec tested |
| Mobile components `apps/mobile/src/components/payroll/` | ✅ | 🟡 | `payroll-calc.test.ts` unit; no mobile E2E |
| Time-banks (feriepenger/TOIL/wellness) | ✅ | 🟡 | Deviation-checks + aggregate tests exist |
| Dynamic supplements (DSL + match) | ✅ | ✅ | `evaluate-supplements.test.ts` |
| CSV export (Phase 3) | ✅ | ✅ | `payroll-phase-3-aggregate-export.spec.ts` |
| PDF lønnsgrunnlag (Phase 4) | ✅ | ✅ | `payroll-phase-4-pdf-bundle.spec.ts` |
| PII reveal tools (Phase 5) | ✅ | ✅ | `payroll-phase-5/reveal.spec.ts` |
| Tariff capability tools (Phase 7f) | ✅ | 🔴 | Ships; no E2E yet |
| Tripletex push-sync (Phase 7) | 🔴 | 🔴 | Proposed |
| A-melding XML | ❌ | ❌ | Out of scope (accountant uses Tripletex) |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix across all domains: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, FKs, enums, RLS, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | Flow index → journeys |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR/journey refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test = proof of built |

## Agent Guardrails

> Read before touching payroll code. Truth lives in this folder. Detailed skill: `.claude/skills/payroll-engine-developer/SKILL.md`.

- **NEVER hardcode tariff rates** in app code. Every sats from `tariff_rate_table` or `framework_rule`. Hardcoded 42.41 kr = architecture violation.
- **NEVER auto-enforce tariff on `is_tariff_bound=false` workspaces.** `payroll.workspace_settings.is_tariff_bound` gates enforcement. Unbound workspaces get soft guidance only.
- **NEVER unlock a closed period.** Bokføringsloven §13 — only corrective period in next period. `payroll.period` has no unlock RPC and must never get one.
- **NEVER manually edit a derived calculation line.** Only `payroll.manual_supplement` rows via `add_manual_supplement` tool.
- **NEVER lock a period with unacknowledged deviations.** `lock_period` tool blocks until `payroll.deviation WHERE acknowledged_by IS NULL` = 0.
- **NEVER build authoring UI on mobile.** ADR-0133: mobile = read-only payslip + push-confirm. No period lock, no supplement authoring, no line override on mobile.
- **NEVER bypass `gatedMutation`** on any payroll capability tool. ADR-0204 required per tool.
- **NEVER derive `workspace_id`/`profile_id` from body-supplied rows without fail-fast on row-not-found.** ADR-0151 forgery defense.
- **NEVER omit `tariff_rate_snapshot` on `shift_cost_snapshot`.** Tariff data must be frozen at first calc — re-run without frozen snapshot gives non-deterministic results.
- **NEVER use `law_version='latest'`** in any DB write or tool call. Always explicit: `'2024'`, `'2025'`, `'2026'`.
- **NEVER write payroll capability tools claiming ADR compliance in the docstring before the body satisfies it.** L-0176: write body first, verify, then docstring.
- Owning packages: `packages/payroll-calculate/` · `packages/ai/src/capabilities/payroll/` · Edge Functions: `supabase/functions/payroll-period-locked-handler/` · Core tables: `payroll.*` schema (23 tables) · Public tables: `public.employee_payroll_profile`, `public.shift_cost_snapshot`, `public.shift_pay_calculation_event`, `public.payroll_ledger_archive`, `public.supplement_rule`, `public.supplement_rule_match`, `public.workspace_union_binding`, `public.tariff_rate_table` (K1a, owned by platform)
