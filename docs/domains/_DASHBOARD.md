---
title: "Domains — Status Dashboard"
status: in_progress
updated: 2026-05-23
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
| [communication](./communication/) | 8/8 | 🟡 partial (channel schema + chat UI + voice/video + announcements + helpdesk Phase 1 + targeted note fanout shipped; channel_ai_policy half-wired; C2 intelligence pipeline not built; helpdesk_query capability not implemented; mobile parity missing) | 🟡 partial (domain-chat-ownership E2E; harness adapter; nyheter partial; core chat flows: MISSING) | mixed | 2026-05-23 | 11 |
| [core-structure](./core-structure/) | 8/8 | 🟡 partial (dept+location+zone+asset+position+dept_operating_hours+dept_hours_override+workspace_operating_hours+planning_cycle schema+UI live; I1 bootstrap live; zone+asset surfaced in V1; dept_location schema live, no admin UI; onboarding Step 7 bootstrap pipe not wired) | 🟡 partial (season-activation D1 fanout pgTAP; partial E2E; dept/location/zone/asset/hours-override/planning_cycle no dedicated E2E) | mixed | 2026-05-23 | 9 |
| [day-session](./day-session/) | 8/8 | 🟡 partial (dept-anchored + ADR-0367 Phase A+B shipped; Phase C UI + D mobile + E push in flight; admin dagsgodkjenning live; close flow live) | 🟡 partial (Playwright for quickadd + filter + templates; close/approval/settlement: MISSING; mobile: MISSING) | mixed | 2026-05-22 | 11 |
| [procedure-engine](./procedure-engine/) | 8/8 | 🟡 partial (governance spine + task ontology ADR-0298 live; Phase 1 schema + capability + cron expansion ADR-0391 shipped; Phase 1 UI: RoutineForm + clock-in + notifications NOT built; ADR-0387a shipped; 0387b council-gated) | 🟡 partial (dagslinjen-quickadd + timeline-templates Playwright exist; routine/Phase-1 capability unit tests pending; mobile shift-tasks tests missing) | mixed | 2026-05-22 | 28 |

## Overlap edges (consolidate / split watch)

| Domain A | Domain B | Shared surface | Recommendation | Status |
|---|---|---|---|---|
| billing | settlement (future domain) | `billing.settlement_run`, `billing.settlement_artifact` — accountant period reconciliation | **keep in billing** — confirmed by `apps/admin/avstemming/` code: these tables represent accountant-facing period close for Smartout's B2B billing cycle (not workspace-internal employee settlement). `billing.settlement_period` remains a split candidate if workspace-level period-lock grows independently. Revised 2026-05-22. | resolved (keep) |
| billing | accountant-portal (future) | `billing.accountant_company_grant` | **keep** for now — promote to own domain when ADR-0269 is accepted + portal UI grows | open |
| core-structure | day-session | `department` + `location` — day-session anchors `department_session` on dept and `day_line` on location (ADR-0367) | **keep** — clear D1/D6 author/consumer split. core-structure provides; day-session consumes. | resolved (keep) |
| core-structure | procedure-engine | `location` — `routine.location_id FK → location` added by `20260622100000_routine_location_team_scope.sql`; procedure-engine reads `department_location` for scope | **keep** — FK ownership follows owning table (routine = procedure-engine). core-structure provides the location rows. | resolved (keep) |
| core-structure | scheduling (future domain) | `planning_cycle` + `planning_event` (D4) — planning_cycle is D1 structural envelope; planning_event is D4 demand signal | **split candidate** — when scheduling domain is defined, `planning_event` (D4) should move there. `planning_cycle` may follow. Flag for that domain's `pre` run. | open (deferred) |
| day-session | billing | Word "Avstemming" — operational day-approval (`daily_reconciliation`) vs accountant B2B close (`billing.settlement_run`). Different objects, same Norwegian word. | **keep** both — seam is the word. Rename day-session UI label to "Dagsgodkjenning" (see day-session GAPS §6). | open — rename pending |
| day-session | payroll | Overtime/supplement hours confirmed at close; `shift_cost_snapshot` feeds payroll after `daily_reconciliation.approved_at`. | **keep** — clear author/consumer seam. Day-session confirms hours; payroll reads after approval. | resolved (keep) |
| day-session | procedure-engine | `session_hook.linked_procedure_id` / `linked_routine_id` — hooks authored by procedure-engine, consumed at runtime by day-session. `session_task` DDL shared: day-session owns session anchor + lifecycle; procedure-engine generates task content + provenance. See procedure-engine GAPS §5a. | **keep** — author/consumer split with shared DDL; seam formally documented. | resolved (keep — seam in GAPS §5a) |
| day-session | communication | Komm session channel auto-created per `department_session`. BroadcastComposer sends through it. | **keep** — day-session creates container; communication owns routing. | resolved (keep) |
| communication | announcements (`docs/modules/announcments/`) | `channel_message WHERE message_type='announcement'` in `news` channel | **keep** — communication owns channel/message infra; announcements owns Nyheter composers + UI. Seam: `message_type` discriminator. | resolved (keep) |
| communication | notifications (future domain) | `channel_notification_policy` table; `notification_outbox` dispatch | **keep boundary** — communication = message creation + channel-level routing rules; future notifications = external delivery (push/SMS/email), quiet hours, rate limiting. | open (notifications domain not yet defined) |
| communication | botsson (future domain) | `channel_ai_policy`, `channel_member WHERE is_ai=true`, `channel_type='ai'` | **keep** — communication owns AI policy schema; botsson will own runtime behavior. Seam: agent-router integration with channel_ai_policy. | open (botsson domain not yet defined) |

## Migration backlog (pre-domain sources to absorb)

| Legacy source | → Domain | Done? |
|---|---|---|
| `docs/modules/MODULE_BILLING.md` | billing | ✅ absorbed + archived (2026-05-22) |
| `docs/modules/daytimeline/` (8 files) | day-session | ✅ absorbed + archived (2026-05-22) |
| `docs/modules/procedure-engine/` (13 files) | procedure-engine | ✅ absorbed + archived (2026-05-22) |
| `docs/modules/core-structure/` (4 files) | core-structure | ✅ absorbed + archived (2026-05-23) |
| `docs/architecture/modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md` | core-structure | ✅ absorbed + archived (2026-05-23) |
| `docs/modules/MODULE_COMMUNICATION.md` | communication | ✅ absorbed + archived (2026-05-23) |
| `docs/architecture/modules/SMARTOUT_MODULE_9_COMMUNICATION.md` | communication | ✅ absorbed + archived (2026-05-23) |
| `docs/architecture/modules/SMARTOUT_MODULE_*` (others) | various | 🔴 pending |
| `docs/modules/MODULE_*.md` (flat, non-communication, non-billing) | contracts / year-wheel / etc. | 🔴 pending |

## Cross-ref update backlog

| What | Where | Priority |
|---|---|---|
| `docs/modules/daytimeline/` path references in `docs/decisions/` ADRs | Update to `docs/domains/day-session/` | LOW — do in next cleanup sortie |
| `docs/modules/daytimeline/` reference in project `CLAUDE.md` | DO NOT EDIT CLAUDE.md — document here only | — |
| `docs/modules/procedure-engine/` path references in `docs/decisions/` ADRs (0298, 0367, 0317, 0387, 0391 etc.) | Update to `docs/domains/procedure-engine/` in next cleanup sortie | LOW |
| `docs/modules/core-structure/` path references in ADRs (0367, etc.) | Update to `docs/domains/core-structure/` in next cleanup sortie | LOW |
| `docs/modules/procedure-engine/` reference in project `CLAUDE.md` | DO NOT EDIT CLAUDE.md — document here only | — |
