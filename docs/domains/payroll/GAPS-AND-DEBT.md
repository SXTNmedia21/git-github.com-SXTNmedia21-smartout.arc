---
title: "Payroll — Gaps & Debt"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: payroll
tags: [domain, payroll, gaps, debt, deviations]
---

# Payroll — Gaps & Debt

> The bridge between built and planned. Every claim cited.

## 1. Verification method

- **CODE** = grepped, file:line cited (anchor string + ±hint).
- **ROADMAP / SPEC / PLAN** = target/intent described in ROADMAP.md or a `docs/superpowers/{specs,plans}` source.
- **GAP** = intent with no matching code. **DEVIATION** = code differs from intent. **CONFIRMED** = code matches → lives in the spine, not here.

---

## 2. Working (shipped + verified)

| # | Capability | Evidence |
|---|---|---|
| W1 | 14-file calc engine | `packages/payroll-calculate/src/` — `interpret-shift.ts`, `evaluate-supplements.ts`, `snapshot-cost.ts`, `aggregate-period.ts`, `deviation-checks.ts`, `timebank-emitter.ts`, `overtime-resolver.ts`, `seniority-resolver.ts`, `stacking.ts`, `apply-override.ts`, `oslo-time.ts`, `cents.ts`, `types.ts`, `index.ts` |
| W2 | 17 payroll capability tools | `packages/ai/src/capabilities/payroll/tools.ts:73` anchor `name: "update_payroll_profile"` through `:2829` `name: "view_lonnsgrunnlag"` |
| W3 | 3 tariff sub-capability tools | `packages/ai/src/capabilities/payroll/tariff-tools.ts:197` `name: "setup_workspace_tariff"`, `:469` `name: "change_workspace_tariff"`, `:786` `name: "add_supplement_override"` |
| W4 | Web period list + detail + tariff admin | `apps/web/src/app/dashboard/payroll/page.tsx`, `[periodId]/page.tsx`, `tariff/page.tsx` |
| W5 | Web self-view lønnsgrunnlag | `apps/web/src/app/dashboard/my-salary/[lonnsgrunnlagId]/page.tsx` |
| W6 | Mobile read-only components (9 files) | `apps/mobile/src/components/payroll/` — `TimebankScreen.tsx`, `PayrollHomeCard.tsx`, `PayslipList.tsx`, `PayslipScreen.tsx`, `SupplementBadges.tsx`, `SupplementsDetailScreen.tsx`, `AbsenceDetail.tsx`, `AbsenceBalanceScreen.tsx`, `AbsenceRequestScreen.tsx` |
| W7 | Time-bank dual-currency (NOK + hours) | `packages/payroll-calculate/src/timebank-emitter.ts` + `payroll.timebank_entry` migration `20260527100300_payroll_phase1_time_banks.sql` |
| W8 | Dynamic supplement DSL | `public.supplement_rule` (`20260527100600_payroll_phase1_dynamic_supplements.sql:28`) + `evaluate-supplements.ts` |
| W9 | Supplement match audit trail | `public.supplement_rule_match` (`20260527100600_payroll_phase1_dynamic_supplements.sql:127`) — INSERT-only |
| W10 | CSV export (Phase 3) | 27 BFF route folders at `apps/web/src/app/api/payroll/` — `export-period/`, `exports/`, `aggregate-period/` |
| W11 | PDF lønnsgrunnlag (Phase 4) | `generate-pdf-bundle/`, `generate-pdf-single/`, `lonnsgrunnlag-url/` BFF routes + Storage bucket `payroll-longsgrunnlag` (`20260604000007_payroll_phase4_lonnsgrunnlag_storage.sql:35`) |
| W12 | PII reveal tools (Phase 5) | `reveal-personal-number/` + `reveal-bank-account/` BFF routes + `apps/e2e/payroll-phase-5/reveal.spec.ts` |
| W13 | Tariff tools delegation chain | `tariff-tools.ts:263` writes to `workspace_union_binding` via cascade capability per ADR-0356 |
| W14 | Deduction consent (ADR-0311) | `payroll.consent_document` (`20260615110000_create_payroll_consent_document.sql:12`) + `consent-documents/` BFF route |
| W15 | Period lock + audit trail | `shift_pay_calculation_event` INSERT-only (`20260527100700_payroll_phase1_audit_event.sql:23`) per ADR-0251 |
| W16 | Golden-month CI tests | `packages/payroll-calculate/__tests__/golden-month/` |
| W17 | 43 telemetry events | `packages/telemetry/src/registry.ts` — anchor `"// Naming: dot convention (payroll.*)"` at line ±7217 |
| W18 | Workspace settings policies (is_tariff_bound, overtime_mode, stacking) | `payroll.workspace_settings` extended in `20260527100200_payroll_phase1_workspace_policies.sql` |
| W19 | pg_cron period-locked notifier process | `20260617100000_payroll_period_locked_notifier_process.sql` |
| W20 | Edge Function payroll-period-locked-handler | `supabase/functions/payroll-period-locked-handler/index.ts` |

---

## 3. Gaps (planned, not built)

| # | Gap | Severity | Blocking? | Roadmap phase |
|---|---|---|---|---|
| G1 | Tripletex push-sync | high | no | Phase 7 |
| G2 | Event Engine recalc orchestration (targeted per affected shifts) | high | no | Phase 8 |
| G3 | Dedicated payroll-engine agent (`payroll-engine-agent.md`) | low | no | Proposed in skill (`.claude/skills/payroll-engine-developer/SKILL.md:255`) |
| G4 | Supplement rule "Test rule" preview panel in settings UI | med | no | Phase 1 D spec (from `docs/modules/payroll/PHASES.md` Phase 1 §D) |
| G5 | Period rollback semantics ADR (corrective period vs unlock) | med | no (workaround = add-manual-supplement) | Phase 1 pending |
| G6 | Four-eyes default policy ADR for period lock | low | no | Phase 1.5 |
| G7 | `TimebankPanel` on `/dashboard/people/[id]/` with three accounts | low | no | Phase 1 §D |

---

## 4. Deviations (code differs from spec intent)

| # | Spec intent | Code reality | Impact | Logged |
|---|---|---|---|---|
| D1 | **Skill claims `apps/mobile/src/app/(me)/payroll/` route exists** | `find apps/mobile/src/app -name '*payroll*'` returns empty. No mobile payroll route. Components only in `apps/mobile/src/components/payroll/`. | Medium — skill has stale path reference. | This file |
| D2 | **`docs/modules/payroll/PHASES.md` lists Phase 1 as "PROPOSED"** | Phase 1 is DONE — calc engine + BFF routes + web UI + time-banks + dynamic supplements all shipped across multiple handoffs. PHASES.md never updated post-delivery. | Low — doc drift only. The archived PHASES.md is the source. | This file |
| D3 | **PHASES.md says 23 tables in `payroll.*`** | Migration `20260422110700_payroll_schema.sql` moved 23 tables from public. Migration `20260615110000_create_payroll_consent_document.sql` added `payroll.consent_document`. Total = 24 tables in `payroll.*` schema. | Low — doc drift. | This file |
| D4 | **Skill says `supplement_rule` lives in payroll schema** | TWO distinct tables: `payroll.supplement_rule` (old config table, moved from `payroll_supplement_rule` in `20260422110700_payroll_schema.sql:133`) AND `public.supplement_rule` (Phase 1 DSL table, `20260527100600_payroll_phase1_dynamic_supplements.sql:28`). Different tables, different purposes. | Low — naming collision documented. | This file |
| D5 | **ARCHITECTURE.md in `docs/modules/payroll/` refers to `hospitality.ts` rates as a source** | `docs/architecture/modules/SMARTOUT_MODULE_8_PAYROLL.md` explicitly says `hospitality.ts` rates are WRONG. Payroll reads `tariff_rate_table`, not `packages/ai/src/industry/packages/hospitality.ts`. | High — confusion risk. | This file |
| D6 | **Spec (design/spec/MODULE_PAYROLL.md) uses "lønnsslipp" terminology** | Canonical docs use "lønnsgrunnlag" (confirmed by ADR-0346, `docs/decisions/0346-lonnsgrunnlag-positioning-canonical.md`). "Lønnsslipp" is the old Bubble term. | Low — terminology. Design/spec file archived. | This file |
| D7 | **A-melding (Phase 6) was out-of-scope DURING development** | `PHASES.md` has Phase 6 struck through. Some early module docs still reference A-melding as planned. Smartout does not submit A-melding — accountant uses Tripletex/Visma with the Phase 3/4 exports. | High — confusion risk on scope. ADR-0250 governs. | This file |

---

## 5. Technical debt

| # | Debt item | Severity | Notes |
|---|---|---|---|
| T1 | No tariff capability tools E2E test | high | `setup_workspace_tariff` + `change_workspace_tariff` + `add_supplement_override` ship with no automated E2E proof. Manual testing only so far. |
| T2 | Skill Reference Files section points to old module paths | low | `.claude/skills/payroll-engine-developer/SKILL.md:283-290` lists `docs/modules/payroll/ARCHITECTURE.md` etc. Should point to `docs/domains/payroll/` after this domain run. |
| T3 | `PHASES.md` not updated post-Phase-1 delivery | low | Still says Phase 1 = "PROPOSED". Document drift only; archived source. |
| T4 | `payroll_ledger_archive` has no RLS policies | med | Read-only Bubble archive per ADR-0110. Service role only. If this table is ever made accessible to authenticated users, RLS must be added first. |
| T5 | `payroll.deviation_severity` enum includes `info` but UI only surfaces `error` + `warning` | low | `info` severity deviations are created but not clearly surfaced in `DeviationList.tsx`. Low friction for managers. |
| T6 | Mobile has no dedicated payroll route — only components | med | All mobile payroll surfaces reached via component embedding, not a dedicated route. Means no deep-link to payroll from push notifications. |

---

## 6. Overlap edges

| Domain A | Domain B | Shared surface | Recommendation | Status |
|---|---|---|---|---|
| payroll | day-session | `shift_cost_snapshot` — day-session authors after reconciliation approval; payroll reads | **keep** — clear seam (`daily_reconciliation.approved_at` is the handoff signal). Already documented in `docs/domains/_DASHBOARD.md`. | resolved (keep) |
| payroll | core-structure | `employee_payroll_profile` — lives in `public` schema (D2), payroll owns it | **keep** — payroll domain owns, core-structure references as pointer only. `docs/domains/core-structure/DATA-MODEL.md:227` already has the pointer. | resolved (keep) |
| payroll | billing | `pricing_terms` read path — payroll reads for tariff/cost context | **keep** — `docs/domains/billing/GAPS-AND-DEBT.md:98` confirms: billing owns `pricing_terms`; payroll read path is a known FK boundary. | resolved (keep) |
| payroll | contracts | `employment_contract` (ansiennitet source) + `employee_payroll_profile` PII boundary (ADR-0242) | **keep** — ADR-0242 defines split: contracts own contract rows; payroll reads for calc + owns PII fields. No dual ownership. | resolved (keep) |
| payroll | lovsen-mcp | `tariff_rate_table` data flow — lovsen-mcp AUTHORS tariff data; payroll READS it | **keep** — lovsen-mcp is upstream seeder; payroll is downstream consumer. Platform seeds K1a rows (`tariff_rate_table WHERE workspace_id IS NULL`). | resolved (keep) |
