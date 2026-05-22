---
title: "Domains — Status Dashboard"
status: in_progress
updated: 2026-05-22
created: 2026-05-22
domain: _index
tags: [domain, dashboard, status, source-of-truth]
---

# Domains — Status Dashboard

> Honest map of every domain. Maintained by `domain-steward`. NOT git-state (see `docs/DASHBOARD.md` for that, ADR-0075).
> Legend: ✅ done · 🟡 partial · 🔴 not built · — n/a

## Domains

| Domain | Spine | Build state | Tested | mirror | last_verified | Open gaps |
|---|---|---|---|---|---|---|
| [billing](./billing/) | 8/8 | 🟡 partial (Fase 1-3B + apps/admin accountant portal built; peppol adapter + auto-dunning live + PlatformAdminToolContext missing) | 🟡 partial (schema pgTAP + Vitest strong; Playwright weak — admin kartotek + avstemming covered) | mixed | 2026-05-22 | 10 |
| [day-session](./day-session/) | 8/8 | 🟡 partial (dept-anchored + ADR-0367 Phase A+B shipped; Phase C UI + D mobile + E push in flight; admin dagsgodkjenning live; close flow live) | 🟡 partial (Playwright for quickadd + filter + templates; close/approval/settlement: MISSING; mobile: MISSING) | mixed | 2026-05-22 | 11 |

## Overlap edges (consolidate / split watch)

| Domain A | Domain B | Shared surface | Recommendation | Status |
|---|---|---|---|---|
| billing | settlement (future domain) | `billing.settlement_run`, `billing.settlement_artifact` — accountant period reconciliation | **keep in billing** — confirmed by `apps/admin/avstemming/` code: these tables represent accountant-facing period close for Smartout's B2B billing cycle (not workspace-internal employee settlement). `billing.settlement_period` remains a split candidate if workspace-level period-lock grows independently. Revised 2026-05-22. | resolved (keep) |
| billing | accountant-portal (future) | `billing.accountant_company_grant` | **keep** for now — promote to own domain when ADR-0269 is accepted + portal UI grows | open |
| day-session | billing | Word "Avstemming" — operational day-approval (`daily_reconciliation`) vs accountant B2B close (`billing.settlement_run`). Different objects, same Norwegian word. | **keep** both — seam is the word. Rename day-session UI label to "Dagsgodkjenning" (see day-session GAPS §6). | open — rename pending |
| day-session | payroll | Overtime/supplement hours confirmed at close; `shift_cost_snapshot` feeds payroll after `daily_reconciliation.approved_at`. | **keep** — clear author/consumer seam. Day-session confirms hours; payroll reads after approval. | resolved (keep) |
| day-session | procedure-engine | `session_hook.linked_procedure_id` / `linked_routine_id` — hooks authored by procedure-engine, consumed at runtime by day-session. | **keep** — clear author/consumer seam. | resolved (keep) |
| day-session | communication | Komm session channel auto-created per `department_session`. BroadcastComposer sends through it. | **keep** — day-session creates container; communication owns routing. | resolved (keep) |

## Migration backlog (pre-domain sources to absorb)

| Legacy source | → Domain | Done? |
|---|---|---|
| `docs/modules/MODULE_BILLING.md` | billing | ✅ absorbed + archived (2026-05-22) |
| `docs/modules/daytimeline/` (8 files) | day-session | ✅ absorbed + archived (2026-05-22) |
| `docs/architecture/modules/SMARTOUT_MODULE_*` | various | 🔴 pending |
| `docs/modules/MODULE_*.md` (flat, non-billing) | communication / contracts / year-wheel / etc. | 🔴 pending |

## Cross-ref update backlog

| What | Where | Priority |
|---|---|---|
| `docs/modules/daytimeline/` path references in `docs/decisions/` ADRs | Update to `docs/domains/day-session/` | LOW — do in next cleanup sortie |
| `docs/modules/daytimeline/` reference in project `CLAUDE.md` | DO NOT EDIT CLAUDE.md — document here only | — |
