---
title: Hotel Wedding Saturday — Gap + Bug Findings (Agent A7)
created: 2026-05-25
updated: 2026-05-25
agent: A7
slice: Hotel-Sat
status: draft
tags: [simulation, hotel, wedding, banquet, event-ops, gaps]
---

# Agent A7 — Hotel Wedding Saturday: Grand Hotel Sjølyst

> Persona: Norwegian banquet captain (Andreas) + event coordinator (Linda).
> Scenario: Saturday, 80-guest wedding peak, 30 staff, 08:00–02:30 next day.

---

## Method

Code-traced against:
- `packages/ai/src/capabilities/day-line/tools.ts`
- `packages/ai/src/capabilities/schedule/tools.ts`
- `packages/ai/src/capabilities/communication/tools.ts` + `audience-resolver.ts` + `publish-announcement.ts`
- `packages/ai/src/capabilities/timeline-template/tools.ts` (lines 415–540)
- `supabase/migrations/20260304200000_department_session.sql`
- `supabase/migrations/20260412100000_session_enums.sql` + `20260412100300_session_infrastructure.sql`
- `supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql`
- `supabase/migrations/20260428220003_tips_pool_table.sql`
- `supabase/migrations/20260301600003_schedule_persistence_tables.sql` (lines 353–398)
- `supabase/migrations/20260616100700_seed_comm_note_fanout_cross_dept_authority.sql`
- Confirmed absent: no `event_timeline`, `seating_plan`, `banquet_session`, `event_checkpoint`, `ceremony_phase` tables in any migration.

---

## Findings

### GAP-1 — No event-as-entity: wedding is invisible to Smartout (CRITICAL)

**What happens:** Linda opens Smartout on Saturday morning. She cannot see "Marit + Espen wedding" as a first-class entity. The wedding exists only as a `schedule_day_booking` row (`supabase/migrations/20260301600003_schedule_persistence_tables.sql:353–368`) with `guest_count`, `title`, `booking_time`, and `status`. There is no foreign key to a department, no phase/checkpoint tracking, no multi-day continuity, no event_id that ties Saturday's ballroom sessions to Friday's welcome dinner or Sunday's settlement. A 3-day wedding looks like 3 unrelated bookings.

**What's missing:**
- No `event` / `banquet_event` table with `starts_on`, `ends_on`, `primary_manager_profile_id`, lifecycle status
- No `event_phase` / checkpoint model (ceremony_setup → ceremony → reception → dinner → dancing → close)
- No cross-day session grouping under a shared event entity
- `schedule_day_booking` has no `department_id` FK — it is a workspace-level record with zero cascade integration

**Code trace:** `20260301600003_schedule_persistence_tables.sql:353` — `schedule_day_booking` has `workspace_id` + `shift_date` but no `department_id`, no event FK, no phase enum. Cannot join to `department_session` (which is per-department-per-day) or to `day_line`.

**Severity: CRITICAL** — this is the core gap of the hotel/event sector. Every finding below cascades from this.

---

### GAP-2 — Multi-department orchestration not supported in session model (CRITICAL)

**What happens:** Saturday requires at minimum 5 parallel `department_session` rows: Restaurant (breakfast), Housekeeping, Banquet/Garden (ceremony setup), Ballroom (reception + dinner), Bar (night service). Each session is scoped to `(workspace_id, department_id, session_date)` with a UNIQUE constraint (`20260304200000_department_session.sql:51`). That works. But:

1. There is no surface or capability that shows Linda *all 5 sessions at once* as a unified event view.
2. `day_line.create` requires a `department_location` pairing (`day-line/tools.ts:121–133`). Ballroom is likely not pre-configured as a `department_location` for the Banquet department — it's a special venue, not a restaurant section.
3. `session_hook` types are: `pre_open`, `open`, `scheduled`, `pre_close`, `close` (`20260412100000_session_enums.sql:11–17`). There are no event-specific hooks: `ceremony_ready`, `service_hold` (speeches at 20:00), `bar_transition`, `last_call`. A wedding is not a bistro open/close lifecycle.
4. The `planned_shifts` / `actual_shifts` metrics on `department_session` (`20260304200000_department_session.sql:41–44`) are counts, not named roles. Andreas at the pass, Linda coordinating DJ/photographer, Jonas as runner — these positional roles within a banquet team are invisible to the session model.

**Code trace:** `20260304200000_department_session.sql:50–52` — UNIQUE on `(workspace_id, department_id, session_date)` means one session per department per day. Fine for normal ops; banquet events may need multiple sessions per department (e.g. kitchen does both hotel breakfast AND wedding dinner as separate sessions). This UNIQUE constraint blocks that scenario.

**Severity: CRITICAL**

---

### GAP-3 — Tip pool is per-department-session; cross-department banquet pool cannot be modeled (HIGH)

**What happens:** Wedding tip pool at Grand Hotel Sjølyst: 50% banquet servers, 30% kitchen, 20% bar. This is a cross-department pool split by role, not per-session. Smartout's `tip_pool` has `CONSTRAINT uq_tip_pool_session UNIQUE (department_session_id)` (`20260428220003_tips_pool_table.sql:25`) — one pool per session. To model the wedding tip split you would need:

- A banquet department_session → tip_pool (50%)
- A kitchen department_session → tip_pool (30%)
- A bar department_session → tip_pool (20%)

But these are three separate pools with no shared parent. There is no `event_tip_pool` or cross-session aggregation. `contract_tip_rule.tip_pool_id` (`20260519100100_contracts_module_foundation.sql:711`) links a *contract* to a pool by UUID but has no mechanism to model a split where the same event's tip is distributed across pools in proportions. The banquet captain (Andreas) cannot record a single "wedding tip: 8000 kr" that auto-splits to three departments.

**Code trace:** `20260428220003_tips_pool_table.sql:9–30` — `tip_pool` anchors to `department_session_id` with UNIQUE. No cross-department aggregation parent. No `event_id` FK.

**Severity: HIGH**

---

### GAP-4 — Temporal lock fires at shift_date midnight, trapping 02:00–02:30 Saturday checkout (HIGH)

**What happens:** Saturday service runs 17:00–02:00 Sunday. The service team checkout and temporal lock happen at 02:30 — which is Sunday `2026-05-26` in Oslo wall-clock. The temporal lock function (`20260428130000_schedule_shift_temporal_lock.sql:43`) checks:

```sql
RETURN p_shift_date < v_local_now::date OR v_shift_start_local <= v_local_now;
```

Any shift with `shift_date = 2026-05-25` that ended after midnight is now on a passed date. Andreas wanting to approve a server's Saturday shift at 02:20 AM will hit `SHIFT_LOCKED_MUTATION`. The `lock_checkout` action in the engine (`CLAUDE.md` cascade spec) fires a C4 gate before `schedule_shift` hour-approval writes — but the temporal lock is a DB trigger that fires regardless of C4. This is the same class of issue as the bistro 00:30 checkout, but more acute for events: a wedding reception can run 3+ hours past midnight, with staff checking out and managers approving hours all in the 00:00–03:00 window.

**Code trace:** `20260428130000_schedule_shift_temporal_lock.sql:43` — date comparison uses `v_local_now::date` which rolls to Sunday at midnight Oslo. `shift_date` is Saturday. Lock fires.

**Note:** This may already be known from bistro sim (cross-reference agent-3 or similar). Severity elevated for hotel because events routinely close at 01:00–03:00.

**Severity: HIGH — cross-midnight event checkout is a known-untested production path**

---

### GAP-5 — 16:30 table plan change: no surface, no tool, no propagation (HIGH)

**What happens:** Bride calls Linda at 16:30: "Move table 4 to the window, add two seats to table 7, Uncle Erik cannot sit near the band." This is a seating/table plan change. Smartout has:

- No `seating_plan` table (confirmed absent from all migrations)
- No `table_assignment` concept
- `schedule_day_booking` has `notes` (TEXT) — freeform, no structured seat data
- `day_line` has `notes` (TEXT, `20260620120200_day_line_table.sql:15`) — same problem
- No realtime propagation to the print-ready floor plan, kitchen, or the DJ

The only tool that could carry this information is `day-line.add_item` with `item_type: "task"` (e.g. "Revisit seating table 4 and 7 before 17:00") — a workaround, not a solution. It would create a `session_task` for the banquet department but with no structured data, no visibility to kitchen or front-desk, and no acknowledgment flow.

**Smartout's best path for 16:30 bride call:**
1. Linda opens chat with Botsson
2. Asks to create a task "Oppdater bordsetting — bord 4 til vinduet, 2 ekstra til bord 7, Erik ikke nær band"
3. Assigns to herself
4. Manually notifies Andreas via channel message

Steps 3–4 require 3 separate tool calls with no structured event notification. The change is in `session_task.description` (free text) — not queryable, not printable, not propagated.

**Severity: HIGH — the most time-critical wedding coordination scenario gets a workaround, not a solution**

---

### GAP-6 — Service pause at 20:00 speeches: no Smartout concept for a "hold" state (MEDIUM)

**What happens:** At 20:00, speeches begin. Andreas tells the team: "Ingen service i 30 minutter." In bistro model, sessions go `active → pending_signoff → closed`. There is no `paused` or `hold` state in `department_session_status` (`20260304200000_department_session.sql:11–18`: `upcoming | active | pending_signoff | closed | missed`). Andreas cannot signal to the kitchen and bar that service is on hold without either:
- Creating a task "Hold service 20:00–20:30"
- Sending a channel message manually

The session stays `active`. No system-wide hold signal. Kitchen may continue prepping courses unnecessarily. This matters less for a bistro (holds are rare) but is routine in banquet events.

**Code trace:** `20260304200000_department_session.sql:13–18` — enum lacks `paused` / `hold` variant.

**Severity: MEDIUM — workaround exists (task + message) but ergonomics poor under live service pressure**

---

### GAP-7 — Trainee Jonas as runner: no banquet-specific role assignment path (MEDIUM)

**What happens:** Jonas is assigned as runner (low-stakes, supervised). In Smartout, `schedule_shift` has `role` (text, `20260301600003_schedule_persistence_tables.sql` — not inspected in full, but role is a string). Position is per-shift, not per-person (CLAUDE.md: "Position is per-shift, not per-person"). So Andreas can theoretically set Jonas's shift role to "runner".

But the trainee supervision contract (Jonas reports to Andreas, Andreas can see Jonas's real-time task completion, Jonas is blocked from D6 signoff authority) has no tooling. The guardian capability (`packages/ai/src/capabilities/guardian/`) is the closest, but it is designed for procedure/compliance gating, not live-event supervision of a runner. The concept of "supervised banquet runner with task scope limited to runner duties" is not in the authority model.

**Code trace:** `20260412100300_session_infrastructure.sql:75` — `session_task.assigned_to` is a single `profile_id`. No concept of "supervisor sees Jonas's task queue in real-time" or "Jonas cannot complete tasks above runner scope."

**Severity: MEDIUM — training/supervision model exists in theory (guardian) but not wired for live banquet supervision**

---

### GAP-8 — Cross-department note fanout requires admin level, blocking Andreas (MEDIUM)

**What happens:** At 14:30, Andreas needs to push "Reception starting — kitchen: prepare canapés now; housekeeping: clear Garden venue; bar: open Ballroom bar." This is a cross-department note. `comm.note_fanout_cross_dept` (`20260616100700_seed_comm_note_fanout_cross_dept_authority.sql:142`) is gated at `min_role = 'admin'` with `level = 'confirm'`. Andreas is a `manager`. He cannot use this tool.

His options:
1. Ask Henrik (admin) to approve the cross-dept fanout — introduces latency at the most time-critical handoff of the day
2. Send per-department channel messages manually — 3 separate actions

For a banquet captain running a live event this is a real operational friction point.

**Code trace:** `20260616100700_seed_comm_note_fanout_cross_dept_authority.sql:142` — `('comm.note_fanout_cross_dept', 'confirm', 'admin', false, 24)`. Manager role blocked.

**Severity: MEDIUM — known design choice (ADR-0333) but creates hard friction in banquet ops**

---

## Event timeline as first-class entity

**Does Smartout have any concept of an event with checkpoints + last-minute changes flowing across departments simultaneously?**

**No. Confirmed absent.**

The wedding at Grand Hotel Sjølyst is modeled as:
- A `schedule_day_booking` row with `guest_count=80`, `title`, `booking_time`, `notes` — a 1D calendar annotation
- Multiple `department_session` rows (one per department per day) — no shared parent, no event_id FK
- `session_hook` lifecycle types: `pre_open | open | scheduled | pre_close | close` — bistro vocabulary, not event vocabulary

What is missing for events:

| Concept | Status | Gap |
|---|---|---|
| `event` entity (multi-day, multi-dept) | ABSENT | No table, no FK chain |
| Event phases / checkpoints (ceremony, reception, dinner) | ABSENT | No enum, no table |
| Cross-department event view (Linda sees all sessions) | ABSENT | No query surface |
| Last-minute change propagation (16:30 table plan) | ABSENT | No structured data, no notification tool |
| Service hold / pause state | ABSENT | session_status enum lacks `paused` |
| Event settlement (tip split + invoice to payer) | ABSENT | tip_pool is per-session, no event aggregation |
| Multi-day continuity (Fri–Sat–Sun same event) | ABSENT | schedule_day_booking per-day, no span |

Closest existing primitive: `schedule_day_booking` (`20260301600003_schedule_persistence_tables.sql:353`) with `guest_count` + `notes`. It is a placeholder, not a first-class event entity. It has no FK to `department_session`, no status machine, no phase model.

**If Smartout wanted to support Grand Hotel Sjølyst today,** the event manager (Linda) would need to:
1. Use `schedule_day_booking` as a memo (no system integration)
2. Create 5+ `department_session` rows manually (no event grouping)
3. Coordinate via channel messages (no structured event broadcasts)
4. Record tip splits manually in payroll notes (no cross-session pool)
5. Handle the 16:30 table-plan change via a freeform task (no seating model)

This is approximately how a paper-based operation or a basic Google Sheet would handle it. The system provides no leverage over the event coordinator's actual job.

---

## Dedup against BUGS.md (2026-05-23)

All gaps above are NEW. Cross-checked:
- BUG-4 (slot quickadd popover broken) — overlaps GAP-5 symptomatically (slot creation for event coordination fails), but root cause is different (popover UI bug vs. missing seating model). Not a duplicate.
- BUG-18 (day-line seed missing) — relevant: Andreas cannot create day_lines for Ballroom if no `department_session` exists for Banquet dept on Saturday. Related but distinct from GAP-2.
- No existing bug covers: event entity, cross-department tip pool, temporal lock at 02:30, service pause state, or seating model.

---

## Priority table

| # | Gap | Severity | Estimated scope |
|---|---|---|---|
| GAP-1 | No event-as-entity | CRITICAL | New domain: `event` + `event_phase` tables |
| GAP-2 | Multi-dept session orchestration broken | CRITICAL | `schedule_day_booking → department_session` FK + event view |
| GAP-3 | Cross-dept tip pool impossible | HIGH | `event_tip_pool` parent + split algorithm |
| GAP-4 | Temporal lock traps 02:30 checkout | HIGH | `session_date` + 1 for overnight shifts, or override window |
| GAP-5 | Table plan change: no surface | HIGH | `seating_plan` table + realtime propagation |
| GAP-6 | No service hold/pause state | MEDIUM | `department_session_status` enum extension |
| GAP-7 | Trainee supervision not wired | MEDIUM | Banquet-scoped guardian profile |
| GAP-8 | Cross-dept fanout blocked for managers | MEDIUM | ADR-0333 Phase 2 allowlist (already planned) |
