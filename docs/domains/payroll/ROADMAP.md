---
title: "Payroll — Roadmap"
status: draft
mirror: aspirational
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: payroll
tags: [domain, payroll, roadmap, phases, blueprint]
---

# Payroll — Roadmap

> Forward plan + design intent. **Aspirational** — ahead of code. What ships here moves to ARCHITECTURE/DATA-MODEL and out of GAPS. Sources: `docs/modules/payroll/PHASES.md`, completed plan handoffs, `SORTIE-PHASE-1.md`.

## Phase status summary

| Phase | Title | Status | Handoff |
|---|---|---|---|
| 0a | Schema (23 tables in `payroll.*`) | ✅ DONE | — |
| 0b | Capability skeleton (6 stub tools) | ✅ DONE | — |
| 0c | PII tools real bodies | ✅ DONE (Phase 5 superseded this) | — |
| 1 | Calculation engine + manager review UI + time-banks + dynamic supplements | ✅ DONE | `docs/HANDOFF-payroll-phase-1.md`, `docs/HANDOFF-payroll-phase-1-closeout.md` |
| 2 | Manual supplements + line override + C4 change proposals | ✅ DONE | `docs/HANDOFF-payroll-phase-2.md`, `docs/HANDOFF-payroll-phase-2-recalc-verification.md` |
| 3 | CSV export (aggregate + provenance + unmasked) | ✅ DONE | `docs/HANDOFF-payroll-phase-3.md` |
| 4 | PDF lønnsgrunnlag (bundle + single + signed URL) | ✅ DONE | `docs/HANDOFF-payroll-phase-4.md` |
| 5 | PII reveal (personal number + bank account + tax card) | ✅ DONE (Skatteetaten integration removed out of scope) | `docs/HANDOFF-payroll-phase-5.md` |
| 6 | A-melding XML | ❌ OUT OF SCOPE | Accountant submits via Tripletex/Visma using Phase 3/4 lønnsgrunnlag. Smartout does not submit to Skatteetaten. |
| 7f | Tariff capability tools (setup/change/supplement-override via cascade delegation) | ✅ DONE | `docs/handoffs/HANDOFF-payroll-tariff-capability-tools.md` |
| 7 | Tripletex push-sync | 🔴 Proposed | Needs ADR for auth + idempotency |
| 8 | Recalc orchestration via Event Engine | 🔴 Proposed | Needs ADR for trigger model |
| MVP blockers | Custom rate + deduction consent + golden-month repairs | ✅ DONE | `docs/HANDOFF-payroll-mvp-blockers.md` |
| Lovsen 7d | ADR amendments (ADR-0355, ADR-0356, ADR-0292/0293/0294) | ✅ DONE | `docs/handoffs/HANDOFF-payroll-lovsen-phase-7d-adr-amendments.md` |

## Phase 7 — Tripletex push-sync (proposed)

**Goal:** Admin can trigger or schedule a push of locked period payroll data to Tripletex. Tripletex receives lønnsgrunnlag lines in its API format and creates/updates salary entries.

**Acceptance criteria:**
- Push is idempotent (re-push = no duplicates in Tripletex)
- Failure is surfaced in UI with structured error (not silent)
- All pushes logged to `shift_pay_calculation_event` audit trail

**Pending:**
- ADR for Tripletex auth (API key vs OAuth) + idempotency strategy
- ADR for retry/backoff model
- Tripletex API capability or Edge Function design

**Source:** `docs/modules/payroll/TRIPLETEX-INTEGRATION.md` (archived) + `docs/modules/payroll/PHASES.md` Phase 7.

## Phase 8 — Recalc via Event Engine (proposed)

**Goal:** When upstream data changes (new supplement rule, tariff update, tip distribution revision), a structured recalc event is emitted and the Event Engine triggers a targeted period re-run.

**Acceptance criteria:**
- Targeted recalc (affected shifts only, not full-period wipe)
- New `derivation_version` row created; old rows preserved (append-only)
- Recalc blocked on locked periods

**Pending:**
- ADR for trigger model: cron vs DB-trigger vs hybrid
- ADR for period rollback semantics (corrective period vs unlock)

**Source:** `docs/modules/payroll/PHASES.md` Phase 8 + `docs/modules/payroll/OPEN-QUESTIONS.md` (archived).

## Governing ADRs

**Accepted:**
- [ADR-0057](../../decisions/0057-payroll-schema-separation.md) — `payroll.*` schema separation
- [ADR-0110](../../decisions/0110-payroll-ledger-archive-semantics.md) — `payroll_ledger_archive` read-only (Bubble migrate)
- [ADR-0204](../../decisions/0204-gated-mutation-composition-orchestrator.md) — `gatedMutation` per tool
- [ADR-0242](../../decisions/0242-contract-payroll-capability-split.md) — Contract/payroll capability split (PII isolation)
- [ADR-0250](../../decisions/0250-skatteetaten-integration.md) — Skatteetaten integration scope
- [ADR-0251](../../decisions/0251-shift-pay-calculation-audit-module.md) — `shift_pay_calculation_event` INSERT-only
- [ADR-0252](../../decisions/0252-riksavtalen-versjonering-migration-policy.md) — Riksavtalen versioning policy
- [ADR-0254](../../decisions/0254-overtime-cap-default-scope.md) — Overtime cap + time-bank dual-currency
- [ADR-0259](../../decisions/0259-lovsen-capability-authority.md) — Lovsen capability authority
- [ADR-0292](../../decisions/0292-payroll-override-applier-semantics.md) — Override applier semantics
- [ADR-0293](../../decisions/0293-payroll-pattern-b-sync-recalc-chain.md) — Recalc chain (Pattern B)
- [ADR-0294](../../decisions/0294-payroll-pdf-library.md) — PDF library choice (Phase 4)
- [ADR-0311](../../decisions/0311-consent-document-payroll-deductions-aml-14-15.md) — Deduction consent document (AML §14/15)
- [ADR-0346](../../decisions/0346-lonnsgrunnlag-positioning-canonical.md) — Lønnsgrunnlag canonical positioning
- [ADR-0355](../../decisions/0355-supplement-floor-cascade-tariff.md) — Supplement floor + cascade tariff contract (if exists; from 7d)
- [ADR-0356](../../decisions/0356-cascade-namespace-delegation-pattern.md) — Cascade namespace delegation (tariff tools)

**Proposed/pending (for future phases):**
- ADR-XXXX — Tripletex auth + idempotency (Phase 7)
- ADR-XXXX — Recalc trigger model: cron vs DB-trigger vs hybrid (Phase 8)
- ADR-XXXX — Period rollback semantics: corrective period vs unlock (future)
- ADR-XXXX — Four-eyes default policy for period lock (future)

## Planned journeys (future phases)

- Phase 7 (Tripletex): `JOURNEY-payroll-phase-7-tripletex-push.md` — to be declared at sortie start
- Phase 8 (Event Engine recalc): `JOURNEY-payroll-phase-8-recalc-event-trigger.md` — to be declared at sortie start

## Working docs (not yet graduated)

These sources live in `docs/modules/payroll/` and have NOT been absorbed — they contain active working context or are phase-specific plans that haven't closed:

| File | Status | Notes |
|---|---|---|
| `SORTIE-PHASE-1.md` | Active reference | Canonical sortie spec for Phase 1 (calc engine). Still consulted for Phase 1 detail. |
| `AUDIT-CASCADE-2026-05-06.md` | Active | Audit findings from 2026-05-06 that informed debt tracking |
| `DRIFT-PREVENTION-PLAN.md` | Active | Ongoing drift prevention checklist |
| `OPEN-QUESTIONS.md` | Active | Live open questions — review before starting Phase 7/8 |
| `PHASES.md` | Active | Phase definition source (absorbed summary above) |
| `UI-PLAN.md` | Active | UI design details not fully absorbed into ARCHITECTURE |

Design assets:
- `docs/modules/payroll/design/Payroll Prototype.html` — Sofia design handoff (static HTML). Reference for UI work.
- `docs/modules/payroll/design/source/` + `spec/` — companion design source files.

Golden-month reference:
- `docs/modules/payroll/golden-month-worksheet/` — hand-computed worksheet backing the CI golden test.

PDF source (Riksavtalen):
- `docs/modules/payroll/krav-riksavtalen---2026.pdf`
- `docs/modules/payroll/riksavtalens-satser-fra-1.-april-2025---nett.pdf`
- `docs/modules/payroll/tariffoppgjoret-og-bedriften-2015.pdf`

## Boundary watch

| Domain | Shared surface | Recommendation |
|---|---|---|
| day-session | `shift_cost_snapshot` — day-session authors after reconciliation; payroll reads | **keep** — clear author/consumer seam |
| core-structure | `employee_payroll_profile` — payroll owns, core-structure references it as D2 | **keep** — payroll owns, core-structure acknowledges with pointer |
| billing | `pricing_terms` read path | **keep** — payroll reads for tariff/cost reasons; billing owns billing extension columns |
| contracts | `employment_contract` ansiennitet source, `employee_payroll_profile` PII boundary | **keep** — ADR-0242 governs split; contracts own contract rows, payroll reads for calc |

Full overlap detail: [GAPS-AND-DEBT.md §Overlap](./GAPS-AND-DEBT.md).
