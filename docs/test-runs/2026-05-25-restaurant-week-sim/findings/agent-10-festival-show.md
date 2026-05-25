---
title: "Festival Showtime — Agent A10 Findings (14:00–22:00)"
created: 2026-05-25
agent: A10
slice: Festival-showtime
status: draft
tags: [festival, simulation, security, stage, deviation, communication, tips, pos]
---

# Festival Showtime Findings — A10 (14:00–22:00)

> Sjølyst Sommerfest: 1200 guests, 60 staff, 3 concert blocks.
> Persona: Norwegian festival ops manager, peak hours.
> All findings are NEW — cross-checked against BUGS.md (22 bugs) to avoid duplication.

---

## 1. What Liv (stage manager) coordinates that NO Smartout surface touches

Liv's domain is **production-schedule ownership**: artist soundcheck windows, stage cues, AV transitions, pyro/lighting timecodes, and artist rider compliance. None of these concepts exist anywhere in the Smartout capability surface.

**Concrete gaps:**

**GAP-A10-01 — No production-schedule entity**
The cascade model has `department_session` (D6) as the runtime unit, but it assumes a single planned_open/planned_close window per department per day. Liv needs to manage 3 distinct locked blocks (opener 15:30–16:15, middle 17:00–18:00, headliner 20:00–21:30) within a single department. The `department_session` table (migration `20260304200200_deviation_shift_approval.sql` and D6 schema) has one `session_date` + one `planned_open`/`planned_close` per row — **no support for multiple time-locked sub-blocks within a session**.

A stage block behaves more like a `session_hook` with hard-locked timing, but `session_hook` (D6) is defined as a reactive trigger, not a hard wall. Liv has no surface to lock 19:00 soundcheck as "crew-only — public staff barred" or to enforce a 2-minute cue sequence for lighting.

**GAP-A10-02 — Hospitality runner routing has no channel**
Vegard (trainee runner) transports food from VIP kitchen to artist hospitality. His actions — "deliver meal to dressing room B by 19:45" — look like `session_task` or `personal_task`. But the task capability (`packages/ai/src/capabilities/task/tools.ts:6`) supports `create_session` (manager+) and `create_day_ad_hoc` (manager+, chat-only V1). There is no "runner-task" concept that auto-routes based on physical zones. Trine (production lead) would have to create tasks for Vegard one-by-one via chat — there is no batch-dispatch or zone-routing surface.

---

## 2. What Sigrid (security) needs that `deviation` does not cover

**GAP-A10-03 — No security incident type in deviation_domain**
`deviation_domain` enum contains: `'safety', 'customer', 'procedure', 'system', 'material'` (migration `20260304200200_deviation_shift_approval.sql:11-13`). **There is no `security` domain.**

A crowd surge at stage front, a guest ejection, or a medical handoff to ambulance are security incidents, not "safety deviations" in the process-quality sense. Sigrid would be forced to log these as `domain='safety'`, which collapses security ops with food-safety violations in the deviation log. The `subcategory` TEXT column (line 51) could carry "ejection" as freetext, but there is no enum enforcement, no query surface that separates physical-security events from kitchen safety events.

**GAP-A10-04 — No incident_type or incident_severity escalation**
`deviation_severity` = `'low', 'medium', 'high', 'critical'` (migration line 18-22). Security incidents require two additional axes that do not exist:

- **Category**: `crowd_surge`, `medical`, `ejection`, `theft`, `intruder`, `fire` — these drive different response protocols.
- **Escalation state**: police-notified, ambulance-called, CCTV-requested. The current `deviation_status` enum (`'open', 'acknowledged', 'resolved', 'escalated'`) has a single `escalated` bucket with no destination. Sigrid cannot log "escalated to police ref #123" — there is no `external_ref` or `escalation_agency` column on the deviation table.

**GAP-A10-05 — No medical handoff record**
If a guest collapses at 20:45 (mid-headliner), Sigrid needs to record: guest_id (unknown), location (pit front, section B2), first-aider on scene, paramedic arrival time, hospital handoff. None of these fields exist on `deviation`. The current table has `linked_shift_id` (references schedule_shift) but no `guest_ref`, no `location_label`, no `responding_profile_id` array (multiple responders), no `external_agency_ref`.

---

## 3. Real-time ops gaps (stage cues, security alerts, crowd counters)

**GAP-A10-06 — Announcement HITL adds 2-call latency to crowd-surge alerts**
The `publish_announcement` capability enforces a mandatory 2-call draft-confirm pattern (ADR-0398, `packages/ai/src/capabilities/communication/publish-announcement.ts:44-60`). Draft phase returns an `InlineConfirmCardDescriptor` requiring manager tap before commit. In a crowd-surge scenario at 20:15 (mid-headliner), Magnus needs to push "Security alert: stage front is at capacity — hold entry" to all 60 staff in <30 seconds. The HITL round-trip requires:

1. Magnus triggers Botsson → draft returned → card shown on Magnus's device
2. Magnus taps "Publiser" → commit fires → push notifications fan out

Under peak mobile load with 60 push recipients, this is a 5–15s pipeline minimum even with no latency. The `publish_announcement_atomic` RPC resolves audience synchronously server-side with no async fan-out queue. **There is no emergency-broadcast fast path that bypasses HITL.** `tier='external'` (line 113) routes email + push but still requires HITL confirmation.

**GAP-A10-07 — `on_duty` audience resolver caps at 500 (hard limit)**
`resolveAudience` `on_duty` branch queries `timesheet.time_entry` with `.limit(500)` (audience-resolver.ts:67). At a festival with 60 staff all clocked in, this is fine — but if a multi-workspace setup is attempted (4 food vendors + core team), the limit could silently truncate. More critically: the resolver queries `punch_out IS NULL` — **volunteer staff who are not in `timesheet.time_entry` (because volunteers have no employment contract and no payroll profile) will resolve to zero recipients via `on_duty`.** Vegard + any other volunteer would miss the crowd-surge alert.

**GAP-A10-08 — `query_monitor_alerts` has no stage-cue or zone-based severity filter**
`queryMonitorAlerts` (monitor-tools.ts:14-111) queries `engine_event` rows with `event_type LIKE 'ops.monitor.%'`. There is no event producer for physical-zone alerts (crowd density, POS queue depth, bar-zone throughput). The `ops.monitor.*` namespace is populated by session/task-overdue monitors, not by real-time sensor or POS-stream events. During headliner (20:00–21:30), bar zone B peaks — Magnus has no capability tool to query "how many transactions in the last 5 minutes at bar zone B" or "average wait time at bar 3". The `get_session_intelligence` tool (monitor-tools.ts:117-288) is department-scoped but returns only task/shift/alert counts — no POS throughput metrics.

**GAP-A10-09 — No real-time capacity counter surface**
The CONCERT-FESTIVAL-PLAN.md (line 54) asks: "Real-time capacity counter?" for 1200-guest cap. There is **no `venue_capacity`, `gate_in_count`, or `crowd_density` table anywhere in the migration set**. The entire capacity/headcount tracking surface is absent. This is expected scope gap, but operationally means Kasper (entrance) has no Smartout integration for the capacity gate — security has no Smartout query to check current occupancy vs fire-regulation limit (typically 1200 for this event).

---

## 4. Multi-zone POS reconciliation gap

**GAP-A10-10 — POS capability is workspace-scoped, not zone-scoped**
`pos_account_management/tools.ts:3-7` wires to one Lightspeed K-Series account per workspace (ADR-0305). The festival has **3 bar zones + 4 food vendors = 7 POS streams**. Food vendors are conceptually separate operators — if they are sub-workspaces, there is no cross-workspace aggregation surface. If they share the single festival workspace, there is no `zone_id` or `pos_zone` concept in the schema. A multi-zone night reconciliation (Magnus + Jens at 00:00) cannot be broken down by zone through any capability tool today. The `connect_lightspeed` tool accepts a single OAuth token per workspace — multiple accounts in the same workspace are not supported by the current schema.

---

## 5. Volunteer hours gap

**GAP-A10-11 — No `volunteer` employment_form enum value**
`employment_form_enum` values: `'permanent', 'temporary', 'apprentice', 'practice', 'freelance'` (migration `20260519100100_contracts_module_foundation.sql:45-51`). **There is no `volunteer` value.** A festival volunteer (no pay, perks instead) cannot be onboarded under any valid employment form. Options are:

- Use `practice` (mis-classified, legal risk under AML-14/15 and arbeidsmiljøloven)
- Omit employment_contract entirely and create a profile without payroll — technically possible but the `profile.status` flow (`trainee → active`) would still try to trigger contract phases

There is also no `hours_volunteer` column on `employee_payroll_profile` to track volunteer hours separately from paid hours for event reporting.

---

## 6. Tips pool cross-department gap

**GAP-A10-12 — Tips capability is per-session, not per-event**
`tips.set_pot` tool (tips/tools.ts:33-54, Sortie 1 skeleton) requires `department_session_id`. A festival tip pool spans bar (3 sessions), VIP restaurant (1 session), and possibly stage crew. There is no "event-level tip pool" concept that aggregates across department sessions. Magnus cannot create a festival-wide tip pool from a single tool call — he would need to create 4+ pools and manually allocate shares, or wait for Sortie 2 which has not yet shipped (all 4 tips tools are `not_implemented` stubs as of Sortie 1).

---

## 7. Cascade model fitness for pop-up event

**GAP-A10-13 — D1 envelope has no dissolution timestamp**
The D1 `department` entity (CLAUDE.md data model §Cascade Dimensions) represents a permanent operational unit. The festival's "Stage" department is created for one day. There is no `dissolves_at` or `event_scope` field on `department`. After the festival, the department persists in the workspace (polluting future `get_department_status` queries) unless an admin manually deletes it. The migration set has no soft-delete or `is_temporary` flag on `department`.

---

## Summary table

| ID | Area | Severity | Code trace |
|---|---|---|---|
| GAP-A10-01 | Stage blocks — no multi-block D6 sub-session | HIGH | `20260304200200_deviation_shift_approval.sql`, D6 schema |
| GAP-A10-02 | Runner task routing — no zone/batch dispatch | MEDIUM | `task/tools.ts:6` create_session schema |
| GAP-A10-03 | No `security` domain in deviation_domain enum | HIGH | `20260304200200_deviation_shift_approval.sql:11-13` |
| GAP-A10-04 | No incident_type / escalation_agency on deviation | HIGH | `20260304200200_deviation_shift_approval.sql:48-82` |
| GAP-A10-05 | No medical handoff fields on deviation | HIGH | `20260304200200_deviation_shift_approval.sql:70-82` |
| GAP-A10-06 | HITL latency on crowd-surge announcement | HIGH | `publish-announcement.ts:44-60`, ADR-0398 |
| GAP-A10-07 | `on_duty` resolver hard cap 500 + volunteer blind spot | MEDIUM | `audience-resolver.ts:67` |
| GAP-A10-08 | No POS-throughput or zone-level monitor events | MEDIUM | `monitor-tools.ts:14-111` |
| GAP-A10-09 | No venue capacity counter surface | HIGH | (absent from all migrations) |
| GAP-A10-10 | POS is single-account per workspace, no zone split | MEDIUM | `pos_account_management/tools.ts:3`, ADR-0305 |
| GAP-A10-11 | No `volunteer` employment_form value | MEDIUM | `20260519100100_contracts_module_foundation.sql:45-51` |
| GAP-A10-12 | Tips pool is per-session, no event-level aggregation | MEDIUM | `tips/tools.ts:33-54` (skeleton) |
| GAP-A10-13 | D1 department has no dissolution / is_temporary flag | LOW | D1 envelope schema |

---

## Dedup note (vs BUGS.md)

All 13 gaps are NEW. BUGS.md covers: BUG-1 (communication authority seed), BUG-2/10 (testid), BUG-3 (pin/unpin), BUG-4/5 (day-line popover), BUG-6 (contracts/send), BUG-7 (note-fanout), BUG-8/12 (schema FK/NOT NULL), BUG-9 (billing combobox), BUG-11 (Maler tab), BUG-13/14/15 (contracts UI/crash/Orb), BUG-16/17 (auth/HMS), BUG-18-22 (day-line/cascade/helpdesk/journey/shift). None overlap with the festival ops gaps above.
