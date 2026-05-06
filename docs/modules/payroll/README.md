---
title: Payroll Module — Blueprint Index
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [module, payroll, lønn, blueprint, source-of-truth, c3-commercial]
---

# Payroll Module — Blueprint & Source of Truth

> Authoritative blueprint for the Smartout Payroll Engine. If code contradicts this folder → CODE wins, update these docs.

## Status

- **Phase 0a (schema):** done. 23 tables in `payroll.*` namespace.
- **Phase 0b (capability skeleton):** done. 6 stub tools at `packages/ai/src/capabilities/payroll/`.
- **Phase 0c (PII tools real bodies):** in progress.
- **Phase 1 (calculation engine + manager review UI):** **proposed** — this blueprint.
- **Phases 2–8:** proposed, sequenced in `PHASES.md`.

## Reading order

| # | Doc | Purpose |
|---|---|---|
| 1 | [MODULE_PAYROLL.md](./MODULE_PAYROLL.md) | Main module doc — overview, placement (C3), scope rules, invariants |
| 2 | [LEGAL-FRAMEWORK.md](./LEGAL-FRAMEWORK.md) | Norwegian legal scaffolding — Aml., ferieloven, OTP, A-melding, Bokføringsloven §13. Authored by Lovsen. |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | All 23 tables in `payroll.*` schema + cross-cutting tables (`employee_payroll_profile`, `tariff_rate_table`, `framework_rule`) |
| 4 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Five-layer derivation pipeline, Event Engine integration, capability layer |
| 5 | [USER-FLOWS.md](./USER-FLOWS.md) | Manager review/approve, line override, manual supplement, period close |
| 6 | [TIME-BANKS.md](./TIME-BANKS.md) | Engine arkitektur — feriekonto + TOIL/avspasering + velferdskonto. Bygger på eksisterende `payroll.timebank_entry` + `absence_quota`. |
| 7 | [TIME-BANKS-LEGAL.md](./TIME-BANKS-LEGAL.md) | Lovsen — lovgrunnlag for tidskontoer + O11/O12 verifisering |
| 8 | [DYNAMIC-SUPPLEMENTS.md](./DYNAMIC-SUPPLEMENTS.md) | Admin-authored tillegg-regler. Evaluator + audit. Bygger på eksisterende 6-type `supplement_rule`. |
| 9 | [TRIPLETEX-INTEGRATION.md](./TRIPLETEX-INTEGRATION.md) | Tripletex API, SalaryType codes, A-melding fanout, sync strategy |
| 10 | [EXPORTS.md](./EXPORTS.md) | CSV (aggregat + audit), PDF lønnsslipp, A-melding XML, Tripletex push |
| 11 | [WORKSPACE-POLICIES.md](./WORKSPACE-POLICIES.md) | Per-workspace configurable policies — OT-permission, time-rounding, punch-without-shift, GPS/QR/network restriction, break auto-deduct, etc. Aml. §9-1 + Datatilsynet kontrolltiltak-rules. |
| 12 | [BENCHMARK-PLANDAY.md](./BENCHMARK-PLANDAY.md) | Planday feature-benchmark — what to copy, where Smartout has moat |
| 13 | [PHASES.md](./PHASES.md) | Implementation phases 1–8 with acceptance criteria |
| 14 | [SORTIE-PHASE-1.md](./SORTIE-PHASE-1.md) | **Phase 1 sortie spec** — 5–8 dev days (or 7–10 w/ full-scope cascade-fixes), falsifiable acceptance |
| 15 | [AUDIT-CASCADE-2026-05-06.md](./AUDIT-CASCADE-2026-05-06.md) | system-steward cascade-audit: GO-WITH-FIXES verdict, 8 RED + 12 YELLOW + 9 MISSING |
| 15.5 | [DRIFT-PREVENTION-PLAN.md](./DRIFT-PREVENTION-PLAN.md) | 3-tier drift detection (CI + heartbeat + sortie-gate) — 5 phases, 8 stories, ~3 dev days |
| 15.7 | [UI-PLAN.md](./UI-PLAN.md) | Full UI inventory: 20 new surfaces (12 web admin + 4 employee + 4 mobile + 1 Botsson). Phase rollout. ~25–30 dev days total. |
| 15.8 | [design/](./design/) | ✅ **Sofia design-pakke shipped 2026-05-06** — `Payroll Prototype.html` + 9 JSX source-filer + `IMPLEMENTATION.md` handoff-letter. Sprint 1–5 mapping. |
| 16 | [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) | Unresolved decisions blocking phase progression (O1–O30) |

## Cross-references

### ADRs
- **Accepted:** [ADR-0057](../../decisions/0057-payroll-schema-separation.md), [ADR-0110](../../decisions/0110-payroll-ledger-archive-semantics.md), [ADR-0259](../../decisions/0259-lovsen-capability-authority.md)
- **Proposed:** [ADR-0242](../../decisions/0242-contract-payroll-capability-split.md), [ADR-0250](../../decisions/0250-skatteetaten-integration.md), [ADR-0251](../../decisions/0251-shift-pay-calculation-audit-module.md), [ADR-0252](../../decisions/0252-riksavtalen-versjonering-migration-policy.md), [ADR-0254](../../decisions/0254-overtime-cap-default-scope.md)
- **Adjacent:** ADR-0078 (channel restrictions), ADR-0118 (C3 placement pattern from billing), ADR-0204 (gatedMutation), ADR-0234/0235/0236/0244/0249 (contracts + Lovsen).

### Code locations
- Capability: `packages/ai/src/capabilities/payroll/{index,tools,gate}.ts`
- Schema migrations: `supabase/migrations/20260422110*` (config/calculation/absence) + `20260422110700` (schema-move) + `20260515100500` (Bubble archive)
- Riksavtalen seed: `supabase/migrations/20260424100000_seed_hospitality_framework.sql`
- Mobile read: `apps/mobile/app/(app)/(me)/payroll/payslip*.tsx`
- Web read: `apps/web/src/app/dashboard/my-salary/`
- Manager UI: `apps/web/src/app/dashboard/payroll/` **(does not yet exist — Phase 1 deliverable)**

### Sibling capabilities
- `contract` — composition, send, obligation. Medium-PII.
- `contract_intake` — composition PII intake (employee self).
- `legal` (Lovsen) — read-only legal references.
- **`payroll` (this module)** — high-PII. `min_role=admin`, `level=confirm`, `allowedChannels=['chat']`.

## Authoring rules

- All payroll mutations gate via `gatedMutation` (ADR-0204). No direct writes outside `payroll.*` from app code.
- All payroll mutations emit telemetry with `payroll.*` prefix (registry: `packages/telemetry/src/registry.ts`).
- All `shift_pay_calculation_event` rows immutable per ADR-0251 (RLS UPDATE/DELETE blocked).
- All Bubble-archived rows in `payroll_ledger_archive` immutable per ADR-0110.
- `employee_payroll_profile` PII (personnummer, kontonummer) accessed only via Phase 0c+ RevealableField. Voice-channel forbidden (ADR-0078).
- All tariff snapshots frozen as JSONB on `shift_cost_snapshot.tariff_rate_snapshot` — no runtime tariff lookup at calculation time.

## Glossary (selected)

- **Lønnsart / SalaryType** — Tripletex term for a salary line code (010 fastlønn, 020 timelønn, 110 overtidstillegg). Smartout calls it `salary_code`.
- **Inntektsmottaker** — A-melding term for income recipient (the employee).
- **Inntektslinje** — A-melding term for one income line on the report.
- **Feriepengegrunnlag** — vacation pay basis (gross income excluding feriepenger itself).
- **Tabelltrekk / Prosenttrekk / Frikort** — three Norwegian tax card types.
- **Forskuddstrekk** — tax withheld at source by employer.
- **Arbeidsgiveravgift (AGA)** — employer social security; 14.10% sone 1.
- **OTP** — Obligatorisk tjenestepensjon. Min 2% over 1G.
- **Riksavtalen** — collective bargaining agreement between NHO Reiseliv and Fellesforbundet for restaurant/hotel.
- **Bokføringsloven §13** — 5-year retention of accounting material from year-end.
