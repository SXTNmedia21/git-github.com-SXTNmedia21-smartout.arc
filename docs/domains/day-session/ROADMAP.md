---
title: "Day Session — Roadmap"
status: in_progress
mirror: aspirational
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-22
domain: day-session
tags: [domain, day-session, roadmap, adr-0367, forward-plan]
---

# Day Session — Roadmap

> Forward plan + design intent. Mirror: **aspirational** — this file describes the target, not the current state. For current state, see [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md).

## Governing ADRs

| ADR | Topic | Status |
|---|---|---|
| [ADR-0069](../../decisions/0069-session-execution-ownership.md) | Session execution ownership | accepted |
| [ADR-0096](../../decisions/0096-schedule-shift-vs-department-session.md) | schedule_shift vs department_session | accepted |
| [ADR-0156](../../decisions/0156-day-control-panel-canonical-admin-surface.md) | Day control panel canonical admin surface | accepted |
| [ADR-0187](../../decisions/0187-session-state-events-single-emit-source.md) | Session state events single-emit source | accepted |
| [ADR-0228](../../decisions/0228-tips-signoff-integration.md) | Tips sign-off integration | accepted (referenced in SignoffTab) |
| [ADR-0273](../../decisions/0273-deviation-day-info-server-action-migration.md) | Deviation + day-info Server Action migration | accepted |
| [ADR-0297](../../decisions/0297-workforce-snapshot-session-bootstrap.md) | Workforce snapshot session bootstrap | accepted |
| [ADR-0298](../../decisions/0298-task-ontology-five-sources.md) | Task ontology — five sources, one read surface | accepted |
| [ADR-0334](../../decisions/0334-ephemeral-presence-supabase-broadcast.md) | Ephemeral presence via Supabase Broadcast | accepted |
| [ADR-0335](../../decisions/0335-timeline-templates-d6-authoring.md) | Timeline templates — D6 authoring | accepted |
| [ADR-0367](../../decisions/0367-day-line-area-anchored-runtime.md) | Day Line Area-Anchored Runtime + Core-Structure Clarification | accepted — **primary governing ADR for tri-layer model** |

Adjacent ADRs (load-bearing for implementation):
ADR-0078 (channel restrictions), ADR-0099 (gate_action), ADR-0114 (Server Actions), ADR-0132 (mobile AI routing), ADR-0133 (mobile surface boundary), ADR-0134 (mobile telemetry contract), ADR-0151 (server-resolved IDs), ADR-0204 (gatedMutation), ADR-0240 (cross-namespace writes), ADR-0287 (gate_action mandatory), ADR-0298 (task ontology), ADR-0325 (page-tool authority), ADR-0356 (Pattern B delegation), ADR-0358 (telemetry registry emit wiring), ADR-0366 (Nordic Split OKLCH literal ban).

---

## Governing Specs + Plans

| Source | Topic | Status vs code |
|---|---|---|
| `docs/design/day-handoff/README.md` + `source/day/` | Original day-handoff design spec — 6 phases, 10 widgets, 3 surfaces | Partially delivered (see reconciliation below) |
| `docs/superpowers/specs/2026-05-18-dagslinje-area-anchored-design.md` | ADR-0367 tri-layer model spec | Phase A+B shipped; C+D+E in flight |

---

## Phase Map — ADR-0367 Tri-Layer Delivery

| Phase | Scope | Status |
|---|---|---|
| **A** | Schema: `day_line`, `shift_session`, `shift_session_day_line`, `department_location`, child FKs, `session_hook` UNIQUE, backfill, capability seeds | **Shipped** |
| **B** | Capabilities (`day-line.create/add_item/instantiate_template`), Server Actions, shift_session trigger, telemetry registry events | **Shipped** |
| **C** | UI rewire: `DayLineStrip` + `DayLineStripHeader`, `AggregatedDayLineList`, `OpenCloseEditPopover`, multi-strip `TimelineTab`, dialogs | **In flight** |
| **D** | Mobile: `shift_session` read via `useShiftSession`, multi-area section list, defensive RLS filter, leak detection telemetry | **In flight** |
| **E** | Push pipeline: engine-dispatch 1-min cron, push fan-out via `shift_session_day_line`, idempotency via `engine_event` | **In flight** |
| **F** | Journey docs + E2E + module/domain doc updates | **This PR / open** |

---

## Planned Work (beyond ADR-0367 current phases)

### P1 — Close-flow journey docs + E2E
Write missing journey files for shipped close flows (F15–F19 in USER-FLOWS). These represent shipped code with no journey documentation. Priority: required for `/close-feature` gate.

### P2 — `financial_close_config` UI
The `financial_close_config` table (`20260328120100`) holds customizable tolerance and approval settings, but no confirmed web UI exists to configure them. Admin needs a settings screen. Council-class? Check with Pontus.

### P3 — `routine.attach_to_line` capability
`AttachRoutineDialog.tsx` exists in the components tree but `packages/ai/src/capabilities/routine/` folder does not. Cross-namespace delegation via Pattern B (ADR-0356) required. Needs own ADR amendment.

### P4 — Rename "Avstemming" → "Dagsgodkjenning" in nav
`sidebar.item_avstemming` i18n key and all UI labels in the reconciliation route currently say "Avstemming". This collides with the billing domain's use of the same word. Planned rename: "Dagsgodkjenning" for the operational day-approval surface. Requires i18n key rename + sidebar-config update. NOT a schema change — pure UI rename.

### P5 — Mobile multi-area section list (Phase D)
`apps/mobile/app/(app)/(calendar)/day/[date].tsx` currently renders a single 08:00–24:00 vertical timeline. Phase D introduces multi-area stacked sections grouped by `day_line`. Requires FlashList virtualization for ≥2 area stacks.

### P6 — Workforce snapshot `day_line` slice
ADR-0297 workforce snapshot bootstraps D2+D6 facts into voice + chat at session start. After ADR-0367 migration, the snapshot slice must include `day_line` rows or Botsson voice loses area-aware day context.

### P7 — Signoff flow / dagsgodkjenning journey unification
The design spec's `pending_signoff → closed → locked` flow spans two surfaces (WebDayControl SignoffTab + /dashboard/reconciliation). A single unified journey narrative is missing. Write `JOURNEY-day-session-close-and-approve.md`.

### P9 — Production Module (future separate domain — not day-session)
MODULE_14_PRODUCTION describes the full food production data model: ingredients, recipes, dishes, menus, bookings, production_session, calculation engine, waste tracking. This is a major future initiative. `production_session` uses `department_session` as a container, but the domain entities are independent.

**Recommendation:** When prioritized, run `domain-steward pre production` (or `menu-production`) as a NEW domain, not an extension of day-session. The seam is `production_session.session_id → department_session`. Day-session provides the operational container; production owns the food/production data model. See GAPS §G15.

### P8 — `DuringShiftViewV2` feature-flag graduation
`DuringShiftViewV2` (M4 gradient-hero redesign) is behind `EXPO_PUBLIC_DURING_SHIFT_V2=true` feature flag. Design intent: graduate to default after A/B testing. Pending product decision.

---

## Design Intent — 10 Widgets (from day-handoff spec)

The design spec defines 10 canonical widgets. Target state when domain is fully delivered:

| Widget | Design intent | Current state |
|---|---|---|
| SessionHeader | `full` + `inline` variants, date/phase/open-time | Exists in `@smartout/ui` package |
| PhaseTimeline | Horizontal time-axis with hook-dots + NÅ-marker | `DayTimelineStrip.tsx` (partial — dept-anchored) |
| ShiftCard | `default`/`detailed`/`compact`, 3px dept-stripe | Exists |
| TaskRow | Checkbox + owner + evidence icons | Exists in TasksTab |
| HookTile | Collapsible card with child TaskRows + progress | Exists |
| KpiTile | Mono-font, tabular-nums, delta arrow | Exists in `@smartout/ui` |
| DeviationCard | 3px severity stripe + actions | Exists in DeviationsTab |
| BroadcastComposer | Type-pills + input + send | BroadcastTab |
| SignoffPanel | 3 stats + notes + CTA | `@smartout/ui` SignoffPanel used in SignoffTab |
| ReconSummary | 2×2 grid omsetning/arbeidstid/lønnskost/margin | `@smartout/ui` ReconSummary used in reconciliation route |

PhaseBadge (additional): exists. Phase-tint bands (prep/service/windDown): `getPhaseBoundaries` from `@smartout/utils` — shipped.
