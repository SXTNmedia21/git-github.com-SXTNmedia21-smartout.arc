---
title: "Domains — Status Dashboard"
status: in_progress
updated: 2026-05-23
created: 2026-05-22
domain: _index
last_verified: 2026-05-23
tags: [domain, dashboard, status, source-of-truth]
---

# Domains — Status Dashboard

> Honest map of every domain. Maintained by `domain-steward`. NOT git-state (see `docs/DASHBOARD.md` for that, ADR-0075).
> Legend: ✅ done · 🟡 partial · 🔴 not built · — n/a

## Domains

| Domain | Spine | Build state | Tested | mirror | last_verified | Open gaps |
|---|---|---|---|---|---|---|
| [billing](./billing/) | 8/8 | 🟡 partial (Fase 1-3B + apps/admin accountant portal built; peppol adapter + auto-dunning live + PlatformAdminToolContext missing) | 🟡 partial (schema pgTAP + Vitest strong; Playwright weak — admin kartotek + avstemming covered) | mixed | 2026-05-22 | 10 |
| [botsson](./botsson/) | 8/8 | 🟡 partial (overlay UI + host mount + soul + 7 missions + session recorder Phase D1+2a+2b built; persona identity chat-unwired; proposal pipeline 🔴; soul-on-platform-admin 🔴; generator API 🔴; mission E2E 0/7) | 🟡 partial (harness E2E + recorder 3 specs + orb polish + domain-chat-ownership; mission Playwright: MISSING; voice E2E: MISSING) | mixed | 2026-05-23 | 11 |
| [communication](./communication/) | 8/8 | 🟡 partial (channel schema + chat UI + voice/video + announcements + helpdesk Phase 1 + targeted note fanout shipped; channel_ai_policy half-wired; C2 intelligence pipeline not built; helpdesk_query capability not implemented; mobile parity missing) | 🟡 partial (domain-chat-ownership E2E; harness adapter; nyheter partial; core chat flows: MISSING) | mixed | 2026-05-23 | 11 |
| [core-structure](./core-structure/) | 8/8 | 🟡 partial (dept+location+zone+asset+position+dept_operating_hours+dept_hours_override+workspace_operating_hours+planning_cycle schema+UI live; I1 bootstrap live; zone+asset surfaced in V1; dept_location schema live, no admin UI; onboarding Step 7 bootstrap pipe not wired) | 🟡 partial (season-activation D1 fanout pgTAP; partial E2E; dept/location/zone/asset/hours-override/planning_cycle no dedicated E2E) | mixed | 2026-05-23 | 9 |
| [day-session](./day-session/) | 8/8 | 🟡 partial (dept-anchored + ADR-0367 Phase A+B shipped; Phase C UI + D mobile + E push in flight; admin dagsgodkjenning live; close flow live) | 🟡 partial (Playwright for quickadd + filter + templates; close/approval/settlement: MISSING; mobile: MISSING) | mixed | 2026-05-22 | 11 |
| [payroll](./payroll/) | 8/8 | 🟡 partial (Phases 1–5 + 7f DONE: calc engine, 17 tools, CSV export, PDF lønnsgrunnlag, PII reveal, tariff capability tools; Phase 7 Tripletex + Phase 8 Event Engine recalc proposed; mobile read-only components only — no mobile route) | 🟡 partial (calc engine: strong Vitest + golden-month CI; Phase 3–5 Playwright E2E; Phase 2 manual supplements + line override: MISSING; tariff tools: MISSING; mobile: MISSING) | mixed | 2026-05-23 | 10 |
| [procedure-engine](./procedure-engine/) | 8/8 | 🟡 partial (governance spine + task ontology ADR-0298 live; Phase 1 schema + capability + cron expansion ADR-0391 shipped; Phase 1 UI: RoutineForm + clock-in + notifications NOT built; ADR-0387a shipped; 0387b council-gated) | 🟡 partial (dagslinjen-quickadd + timeline-templates Playwright exist; routine/Phase-1 capability unit tests pending; mobile shift-tasks tests missing) | mixed | 2026-05-22 | 28 |
| [year-wheel](./year-wheel/) | 8/8 | 🟡 partial (canvas + season detail + 5-tool capability + 13 Botsson page-tools + activate_season RPC + D1 fanout trigger + 3 authority seeds shipped; M1+M3 of campaign DONE; SeasonGoalsTab + SeasonProceduresTab deferred; Duplicate UI not wired; drag-to-resize not built; M2 design-debt partial; M4 deferred completions open) | 🟡 partial (3 Playwright spec files: year-wheel-redesign + season-planning + season-activation; draw-to-create E2E missing; budget/factors tabs not tested; D1 fanout E2E missing) | mixed | 2026-05-23 | 7 |

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
| payroll | core-structure | `employee_payroll_profile` — lives in `public` schema (D2), payroll domain owns it, core-structure references it as a pointer | **keep** — payroll owns; core-structure acknowledges with pointer in `docs/domains/core-structure/DATA-MODEL.md:227`. | resolved (keep) |
| payroll | billing | `pricing_terms` read path — payroll reads for tariff/cost context | **keep** — billing owns `pricing_terms`; payroll read is a known FK boundary per `docs/domains/billing/GAPS-AND-DEBT.md:98`. | resolved (keep) |
| payroll | contracts | `employment_contract` (ansiennitet source) + `employee_payroll_profile` PII boundary (ADR-0242) | **keep** — ADR-0242 governs split: contracts own contract rows; payroll reads for calc + owns PII fields. No dual ownership. | resolved (keep — ADR-0242) |
| payroll | lovsen-mcp | `tariff_rate_table` data flow — lovsen-mcp authors K1a tariff data; payroll reads it | **keep** — lovsen-mcp is upstream platform seeder; payroll is downstream consumer. Clear author/consumer boundary. | resolved (keep) |
| day-session | procedure-engine | `session_hook.linked_procedure_id` / `linked_routine_id` — hooks authored by procedure-engine, consumed at runtime by day-session. `session_task` DDL shared: day-session owns session anchor + lifecycle; procedure-engine generates task content + provenance. See procedure-engine GAPS §5a. | **keep** — author/consumer split with shared DDL; seam formally documented. | resolved (keep — seam in GAPS §5a) |
| day-session | communication | Komm session channel auto-created per `department_session`. BroadcastComposer sends through it. | **keep** — day-session creates container; communication owns routing. | resolved (keep) |
| communication | announcements (`docs/modules/announcments/`) | `channel_message WHERE message_type='announcement'` in `news` channel | **keep** — communication owns channel/message infra; announcements owns Nyheter composers + UI. Seam: `message_type` discriminator. | resolved (keep) |
| communication | notifications (future domain) | `channel_notification_policy` table; `notification_outbox` dispatch | **keep boundary** — communication = message creation + channel-level routing rules; future notifications = external delivery (push/SMS/email), quiet hours, rate limiting. | open (notifications domain not yet defined) |
| communication | botsson | `channel_ai_policy`, `channel_member WHERE is_ai=true`, `channel_type='ai'` | **keep** — communication owns AI policy schema; botsson owns runtime behavior. Seam: `channel_ai_policy.voice_participation` determines Botsson room joins. Botsson domain now defined. | resolved (keep) |
| botsson | agent-harness (future domain) | `services/stage-engine/`, `packages/ai/src/{router,classifiers,gate,engine}/` — L3 runtime plumbing | **split candidate** — botsson-domain Scope A = persona surface (orb, soul, mission, host). Plumbing = future `agent-harness` domain. Seam: BFF HTTP call to stage-engine. When agent-harness domain is defined, `packages/ai/src/agents/` directory needs classification (botsson.ts + onboarding.ts IN; rest OUT). | open (agent-harness domain not yet defined) |
| botsson | procedure-engine | Mission lifecycle shows procedures via `training`/`governance` capabilities. Botsson `onboarding` capability creates protocols. | **keep** — botsson SHOWS procedures via capability tools; procedure-engine OWNS procedure data. Clear author/consumer. | resolved (keep) |
| botsson | task | `fn_list_my_tasks`, `task` capability tools, `emma_task` table — botsson surfaces tasks | **keep** — task domain self-owns; botsson surfaces via capability registration. `use-emma-tasks.ts` is a thin bridge hook (botsson-owned). | resolved (keep) |
| botsson | core-structure / day-session | Workforce snapshot injection (ADR-0297): botsson reads `department_session`, `schedule_shift`, `department`, `workspace` | **keep** — botsson reads only; day-session + core-structure own the tables. Clear read/write boundary. | resolved (keep) |
| year-wheel | core-structure | `planning_cycle` (D1): year-wheel links seasons via `season.planning_cycle_id` FK; core-structure owns the table. `department_operating_hours`: activation trigger seeds D1 rows that core-structure references as its primary operating-hours record. | **keep** — clear author/consumer. core-structure provides D1 envelope; year-wheel consumes + seeds D1 rows on activation. | resolved (keep) |
| year-wheel | scheduling (future domain) | `planning_event` (D4 demand signal) — currently rendered on year-wheel canvas via `usePlanningEvents`. When scheduling domain is defined, `planning_event` will migrate there; year-wheel becomes a read-only consumer. `planning_cycle` may follow. | **split candidate** — flag for scheduling domain `pre` run. | open (deferred) |
| year-wheel | day-session | `department_session.season_id` FK: active season is the temporal envelope for daily sessions. Season activation seeds `department_operating_hours` that day-session reads at runtime. | **keep** — clear author/consumer. year-wheel provides season lifecycle; day-session consumes it. | resolved (keep) |
| year-wheel | payroll | Season period defines tariff `effective_from/to` slice window for cost attribution. Payroll reads season start/end dates; year-wheel never touches tariff tables. | **keep** — read-only boundary. payroll owns tariff resolution; year-wheel provides the period. | resolved (keep) |
| year-wheel | procedure-engine | `season_policy_binding.policy_id` FK → `public.policy` (procedure-engine owns policy rows). year-wheel owns the binding record; procedure-engine reads bindings to determine per-season HMS policy activation. `season.get_readiness` tool reads `protocol_assignment` table (procedure-engine data). | **keep** — clear author/consumer. year-wheel owns binding; procedure-engine owns policy + protocol. | resolved (keep) |

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
| `docs/modules/payroll/` (13 compiled files) | payroll | ✅ absorbed + archived (2026-05-23) |
| `docs/architecture/modules/SMARTOUT_MODULE_8_PAYROLL.md` | payroll | ✅ absorbed + archived (2026-05-23) |
| `docs/modules/payroll/design/spec/MODULE_PAYROLL.md` | payroll | ✅ merged (lønnsgrunnlag terminology) + git rm (2026-05-23) |
| `docs/architecture/BOTSSON-SYSTEM-MAP.md` | botsson | ✅ absorbed + archived (2026-05-23) — L-0150 closed |
| `docs/architecture/BOTSSON-STAGE-MISSION-MODEL.md` | botsson | ✅ absorbed + archived (2026-05-23) |
| `docs/architecture/BOTSSON-KNOWN-LIMITATIONS.md` | botsson | ✅ absorbed + archived (2026-05-23) |
| `docs/architecture/BOTSSON_SOUL_ARCHITECTURE.md` | botsson | ✅ absorbed + archived (2026-05-23) |
| `docs/architecture/modules/MODULE_BOTSSON.md` | botsson | ✅ absorbed + archived (2026-05-23) |
| `docs/engines/artificial-intelligence/BOTSSON-SYSTEM-MAP.md` | botsson | ✅ archived (2026-05-23) — stale duplicate of architecture version |
| `docs/architecture/modules/SMARTOUT_MODULE_*` (others) | various | 🔴 pending |
| `docs/modules/MODULE_YEAR_WHEEL_PRD.md` | year-wheel | ✅ absorbed + archived (2026-05-23) |
| `docs/architecture/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md` | year-wheel | ✅ absorbed + archived (2026-05-23) |
| `docs/modules/MODULE_*.md` (flat, non-communication, non-billing, non-year-wheel) | contracts / etc. | 🔴 pending |

## Cross-ref update backlog

| What | Where | Priority |
|---|---|---|
| `docs/modules/daytimeline/` path references in `docs/decisions/` ADRs | Update to `docs/domains/day-session/` | LOW — do in next cleanup sortie |
| `docs/modules/daytimeline/` reference in project `CLAUDE.md` | DO NOT EDIT CLAUDE.md — document here only | — |
| `docs/modules/procedure-engine/` path references in `docs/decisions/` ADRs (0298, 0367, 0317, 0387, 0391 etc.) | Update to `docs/domains/procedure-engine/` in next cleanup sortie | LOW |
| `docs/modules/core-structure/` path references in ADRs (0367, etc.) | Update to `docs/domains/core-structure/` in next cleanup sortie | LOW |
| `docs/modules/procedure-engine/` reference in project `CLAUDE.md` | DO NOT EDIT CLAUDE.md — document here only | — |
