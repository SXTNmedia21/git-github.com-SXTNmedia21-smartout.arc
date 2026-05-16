---
title: Dagslinjen QuickAdd — Slot-popover, filter, targeted note fanout
status: in_progress
created: 2026-05-15
updated: 2026-05-15
module: MODULE_COMMUNICATION
tags: [spec, day-control, communication, scheduling, notifications]
---

# Dagslinjen QuickAdd — Slot-popover, filter, targeted note fanout

## 1. Summary

Transform the read-only `DayTimelineStrip` (Oversikt → Dagslinjen tab) into a write surface:

- **Slot quick-add** — click any time on the strip → `SlotQuickAddPopover` with 5 actions (Booking / Notat / Oppgave / Avvik / Vaktstart); each opens the matching existing sheet/dialog prefilled with clicked time + active session context.
- **Scope filter** — `ScopeFilterPill` in strip header; filter by Avdeling | Team | Vakt; state persisted in URL search-param `?scope=type:<id>`.
- **Targeted note fanout** — `session_note` extended with `audience` JSONB + `notify_at` TIMESTAMPTZ + `delivered_at` TIMESTAMPTZ; pg_cron (5-min cadence) invokes `note-fanout-scheduler` Edge Function which resolves audience → emits push/in-app notification per recipient at `notify_at`; idempotent via `delivered_at IS NULL` predicate.

## 2. Goal + Non-goals

**Goal.** Restaurant manager planning Saturday: click 20:00 on strip → booking form prefilled with `time=20:00`, `date=today`, `department_id=current`. Add notat "VIP-bord 12 — Gluten allergi" targeted to Lørdag PM-team with `notify_at=18:00`. Filter timeline by Lørdag PM-team to verify the day reads correctly. Push fires at 18:00 to the 4 team members.

**Non-goals.**
- Drag-to-create on timeline (Phase 2)
- Recurring bookings / recurring notes (Phase 2)
- Mobile authoring (per ADR-0133 — mobile is execute-only; mobile receives push, does not author)
- Bulk-edit on timeline (Phase 2)

## 3. Component Tree

```
WebDayControl (apps/web/src/components/day/WebDayControl.tsx) [edit]
├── TabPanel "Dagslinjen"
│   └── TimelineTab (apps/web/src/components/day/tabs/TimelineTab.tsx) [edit]
│       ├── ScopeFilterPill [new] — apps/web/src/components/day/ScopeFilterPill.tsx
│       │   └── ScopeFilterPopover [new] — 3-tab selector (Avdeling/Team/Vakt)
│       └── DayTimelineStrip [edit] — gains props: editable, onSlotClick, scope, onScopeChange
│           ├── existing event markers (read-only render preserved)
│           └── SlotQuickAddPopover [new] — apps/web/src/components/day/SlotQuickAddPopover.tsx
│               ├── trigger: invisible time-axis hit-zones
│               ├── 5 action buttons (Booking/Notat/Oppgave/Avvik/Vaktstart)
│               └── opens existing sheets prefilled via useSlotQuickAdd hook [new]:
│                   ├── ReservationSheet (existing) — booking
│                   ├── DailyNoteSheet (edit) — adds audience + notify_at picker
│                   ├── TaskCreateDialog (existing) — task
│                   ├── DeviationSheet (existing) — avvik
│                   └── ShiftStartDialog [new] — vaktstart
└── useDayTimelineEvents (apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts) [edit]
    ├── existing params: workspaceId, departmentId, sessionId, dateISO
    └── new params: teamId, shiftId
```

**Server-side new:**
- `apps/web/src/app/dashboard/_actions/create-targeted-note-action.ts` [new Server Action — writes session_note with audience + notify_at, gated]
- `supabase/functions/note-fanout-scheduler/index.ts` [new Edge Function — invoked by pg_cron, resolves audience, emits notifications]
- `supabase/migrations/<TS>_session_note_targeted_fanout.sql` [new — schema delta]
- `supabase/migrations/<TS>_note_fanout_scheduler_cron.sql` [new — pg_cron job]

## 4. Data Flow (per journey)

### Journey 1 — Manager click-slot quick-add

```
User clicks 20:00 on DayTimelineStrip
  → onSlotClick(time="20:00") fires
  → SlotQuickAddPopover opens anchored to click position
  → User clicks "Booking"
  → useSlotQuickAdd opens ReservationSheet({ time: "20:00", date: today, departmentId: current })
  → User fills form → submit
  → add-booking-action (existing) writes schedule_day_booking row
  → emit("schedule.booking.created", { workspace_id, actor_id, booking_id, time, ... })
  → invalidateQueries(["day-control", "timeline-events"])
  → DayTimelineStrip re-renders with new marker at 20:00
```

### Journey 2 — Manager filter timeline

```
User clicks ScopeFilterPill in TimelineTab header
  → ScopeFilterPopover opens with 3 tabs (Avdeling/Team/Vakt)
  → User picks "Team → Lørdag PM"
  → router.push(`?scope=team:<team_id>`) updates URL search-param
  → useDayTimelineScope hook reads search-param → returns { type: "team", id: <team_id> }
  → useDayTimelineEvents re-runs with new queryKey including teamId
  → Server query joins schedule_shift.team_id, filters events to those tied to team's shifts/sessions
  → Strip re-renders within 200ms with restricted event set
```

### Journey 3 — Manager creates targeted note + scheduled fanout

```
User clicks 14:00 → SlotQuickAddPopover → "Notat"
  → DailyNoteSheet opens prefilled time=14:00
  → User types body, picks audience (radio: Avdeling|Team|Vakt|Persons + multi-select),
    picks notify_at via datetime picker
  → User clicks "Lagre"
  → create-targeted-note-action fires (Server Action):
    1. Authority gate: gateAction("comm.note_fanout_cross_dept", min_role: audience-resolved)
       - if audience.dept_ids contains dept != actor's primary dept → require admin+
    2. Validate audience non-empty AND notify_at > now
    3. Insert session_note row with audience JSONB + notify_at + delivered_at=NULL
    4. emit("comm.scheduled_note.created", { workspace_id, actor_id, note_id, audience, notify_at })
  → Toast "Notat lagret — påminner X personer kl 18:00"
  → Strip refreshes; note marker at 14:00 with clock-overlay icon
```

### Journey 4 — Employee receives scheduled push

```
pg_cron job runs every 5 minutes (configurable via 0 */5 * * *)
  → calls Edge Function note-fanout-scheduler via supabase_functions.http_request
  → Function queries:
    SELECT id, workspace_id, audience, body, created_by_profile_id
    FROM session_note
    WHERE notify_at <= now()
      AND delivered_at IS NULL
      AND deleted_at IS NULL
    LIMIT 100
  → For each note:
    1. Resolve audience JSONB → profile_ids[]:
       - audience.profile_ids[] → as-is
       - audience.team_ids[] → JOIN team_member ON team_id = ANY(audience.team_ids)
       - audience.shift_ids[] → JOIN schedule_shift_assignment ON shift_id = ANY(audience.shift_ids)
       - audience.dept_ids[] → JOIN profile WHERE primary_department_id = ANY(audience.dept_ids)
    2. Deduplicate profile_ids
    3. For each recipient: emit notification via @smartout/notifications (push + in-app)
    4. UPDATE session_note SET delivered_at = now() WHERE id = $1 AND delivered_at IS NULL
       (idempotent — guards double-fire)
    5. emit("comm.scheduled_note.delivered", { note_id, recipient_count })
  → Employee mobile/web receives notification
  → Tap → deep-link to /dashboard/communication/notes/<id> (web) or NoteDetail (mobile)
```

## 5. Schema Delta

### Migration: `<TS>_session_note_targeted_fanout.sql`

```sql
-- Phase 1: add audience + notify_at + delivered_at + deleted_at to session_note
ALTER TABLE public.session_note
  ADD COLUMN audience JSONB,
  ADD COLUMN notify_at TIMESTAMPTZ,
  ADD COLUMN delivered_at TIMESTAMPTZ,
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- audience JSONB shape:
-- {
--   "dept_ids": ["uuid", ...],   -- optional
--   "team_ids": ["uuid", ...],   -- optional
--   "shift_ids": ["uuid", ...],  -- optional
--   "profile_ids": ["uuid", ...] -- optional
-- }
-- At least one array must be non-empty when notify_at IS NOT NULL.

-- Constraint: targeted notes require audience
ALTER TABLE public.session_note
  ADD CONSTRAINT session_note_audience_when_targeted_chk
  CHECK (
    (notify_at IS NULL AND audience IS NULL)
    OR
    (notify_at IS NOT NULL AND audience IS NOT NULL AND audience != '{}'::jsonb)
  );

-- Extend note_type enum
ALTER TYPE note_type ADD VALUE IF NOT EXISTS 'targeted';

-- Partial index for scheduler hot-path (small index, fast scan)
CREATE INDEX idx_session_note_fanout_pending
  ON public.session_note (notify_at)
  WHERE delivered_at IS NULL
    AND notify_at IS NOT NULL
    AND deleted_at IS NULL;

-- Index for audience resolution (GIN on JSONB)
CREATE INDEX idx_session_note_audience_gin
  ON public.session_note USING GIN (audience)
  WHERE audience IS NOT NULL;

COMMENT ON COLUMN public.session_note.audience IS
  'JSONB with optional arrays of dept_ids/team_ids/shift_ids/profile_ids. Resolved at fanout time. NULL for non-targeted notes.';
COMMENT ON COLUMN public.session_note.notify_at IS
  'When scheduler should fire fanout. NULL for non-scheduled notes. Cron picks rows WHERE notify_at <= now().';
COMMENT ON COLUMN public.session_note.delivered_at IS
  'Set by note-fanout-scheduler when fanout succeeded. Used as idempotency guard.';

-- RLS unchanged — audience is a fanout target, not a read gate. All session_note RLS
-- continues to gate on workspace_id + session->department membership.
```

### Migration: `<TS>_note_fanout_scheduler_cron.sql`

```sql
-- pg_cron job: invoke Edge Function every 5 minutes
SELECT cron.schedule(
  'note-fanout-scheduler',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/note-fanout-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
```

## 6. File-Touch List

| Track | Path | Action | Purpose |
|---|---|---|---|
| A | `supabase/migrations/<TS>_session_note_targeted_fanout.sql` | new | Schema delta — audience + notify_at + delivered_at + index |
| A | `supabase/migrations/<TS>_note_fanout_scheduler_cron.sql` | new | pg_cron job for fanout scheduler |
| A | `packages/supabase/src/database.types.ts` | regen | Type sync after migrations |
| C | `apps/web/src/components/day/SlotQuickAddPopover.tsx` | new | 5-action popover anchored to time-axis click |
| C | `apps/web/src/components/day/_hooks/use-slot-quickadd.ts` | new | Prefill bridge to existing sheets |
| C | `apps/web/src/components/day/ShiftStartDialog.tsx` | new | Vaktstart dialog (missing today) |
| C | `apps/web/src/components/day/DayTimelineStrip.tsx` | edit | Add props: editable, onSlotClick, scope; add invisible hit-zones on time-axis |
| C | `apps/web/src/components/day/tabs/TimelineTab.tsx` | edit | Wire SlotQuickAddPopover + pass props through |
| D | `apps/web/src/components/day/ScopeFilterPill.tsx` | new | Header pill showing active filter |
| D | `apps/web/src/components/day/ScopeFilterPopover.tsx` | new | 3-tab selector (Avdeling/Team/Vakt) |
| D | `apps/web/src/app/dashboard/_hooks/use-day-timeline-scope.ts` | new | URL search-param state + resolver |
| D | `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` | edit | Add teamId + shiftId params; extend Supabase queries |
| E | `apps/web/src/components/dashboard/cockpit/sheets/DailyNoteSheet.tsx` | edit | Add audience picker + notify_at datetime picker |
| E | `apps/web/src/app/dashboard/_actions/create-targeted-note-action.ts` | new | Server Action — write session_note with audience + notify_at, gated |
| E | `packages/types/src/session-note.ts` | edit | Add audience Zod schema + notify_at type |
| F | `supabase/functions/note-fanout-scheduler/index.ts` | new | Edge Function invoked by pg_cron |
| F | `supabase/functions/note-fanout-scheduler/audience-resolver.ts` | new | Resolves audience JSONB → profile_ids[] |
| F | `supabase/functions/note-fanout-scheduler/_tests/audience-resolver.test.ts` | new | Unit tests for resolver |
| F | `packages/telemetry/src/registry.ts` | edit | Register 3 new events |
| G | `apps/web/e2e/dagslinjen-quickadd/slot-quickadd.spec.ts` | new | Journey 1 E2E |
| G | `apps/web/e2e/dagslinjen-quickadd/filter-timeline.spec.ts` | new | Journey 2 E2E |
| G | `apps/web/e2e/dagslinjen-quickadd/target-note-fanout.spec.ts` | new | Journey 3 E2E |
| G | `apps/web/e2e/dagslinjen-quickadd/employee-receives-note.spec.ts` | new | Journey 4 E2E |
| H | `docs/HANDOFF-dagslinjen-quickadd.md` | new | Closure handoff |
| H | `docs/decisions/0331-dagslinjen-audience-jsonb-vs-junction.md` | new | ADR for Q1 |
| H | `docs/decisions/0332-dagslinjen-fanout-scheduler-cadence.md` | new | ADR for Q2 |
| H | `docs/decisions/0333-dagslinjen-cross-dept-c4-gate.md` | new | ADR for Q3 |
| H | `docs/decisions/0000-decision-log.md` | edit | Register ADR-0331/0332/0333 |

## 7. Telemetry Events

Register in `packages/telemetry/src/registry.ts`:

| Event Name | Destinations | Payload Keys |
|---|---|---|
| `comm.scheduled_note.created` | activity_trail, posthog, logger | workspace_id, actor_id, note_id, audience_summary, notify_at |
| `comm.scheduled_note.delivered` | activity_trail, posthog, logger | workspace_id, note_id, recipient_count, delivered_at |
| `comm.scheduled_note.deleted` | activity_trail, logger | workspace_id, actor_id, note_id |

Existing events reused without change:
- `schedule.booking.created` (Journey 1)
- `session.task.created` (Journey 1)
- `deviation.created` (Journey 1)
- `shift.started` (Journey 1)

## 8. Authority Matrix

| Action | Employee | Manager (own dept) | Manager (cross-dept) | Admin | Owner |
|---|---|---|---|---|---|
| Click slot → open popover | ✗ (read-only) | ✓ | ✓ | ✓ | ✓ |
| Create booking | ✗ | ✓ | ✗ | ✓ | ✓ |
| Create note (untargeted) | ✗ | ✓ | ✗ | ✓ | ✓ |
| Create note targeted to own dept/team | ✗ | ✓ | ✗ | ✓ | ✓ |
| Create note targeted cross-dept | ✗ | ✗ | ✗ | ✓ | ✓ |
| Create task on session | ✗ | ✓ | ✗ | ✓ | ✓ |
| Create deviation | ✗ | ✓ | ✗ | ✓ | ✓ |
| Start shift | ✗ | ✓ | ✗ | ✓ | ✓ |
| Filter scope (any) | ✓ (read) | ✓ | ✗ (other depts hidden) | ✓ | ✓ |

**Gate enforcement:**
- UI: hide popover if `role === 'employee'` (preserves read-only UX)
- Server Action: `gateAction("comm.note_fanout_cross_dept", { min_role: resolved-from-audience })` writes audit row to `engine_authority_config` per ADR-0099
- RLS: existing `session_note` RLS gates reads on workspace_id + session→department membership — unchanged

## 9. Open Questions for Council (Gate 1)

### Q1 — Audience model: JSONB blob vs normalized junction table?

**Framing.** Notes are write-once (manager creates), read-once at fanout (scheduler resolves), and the audience snapshot is what matters at fire-time. Junction table (`session_note_audience` with one row per dept_id/team_id/shift_id/profile_id) gives queryable per-recipient, indexable, and FK integrity at cost of 2-3× more rows + 1 extra migration + RLS policy.

**Decision criteria.**
- Phase 2 needs (per-recipient delivery status? audit who saw what?) → junction
- Audience size typical (4-12 profiles after team resolution) → blob fine
- RLS complexity tolerance

**Recommendation.** **JSONB blob for Phase 1.** Audience is small (median ~6 profile_ids after resolution), pattern is write-once-read-once, simpler RLS. If Phase 2 requires per-recipient read receipts or delivery status, migrate to junction in dedicated sortie with backfill. **DEFER → Council.**

### Q2 — Scheduler cadence + transport: pg_cron / Edge Function cron / n8n?

**Framing.** Need to wake every N minutes, query `session_note WHERE notify_at <= now AND delivered_at IS NULL`, resolve audience, emit notifications. Options:
- **A. pg_cron → Edge Function** — matches existing `session-hook-executor` pattern; TypeScript handler is testable; HTTP overhead per tick
- **B. pg_cron → inline plpgsql** — fastest, no HTTP, but resolver logic harder to test + reuse
- **C. n8n cron** — visible to Pontus in n8n UI, but n8n is on droplet (network hop to Supabase) and adds availability dependency

**Decision criteria.**
- Reusability of audience resolver across other features
- Local dev DX (Edge Function easy to run locally; pg_cron requires extension)
- Visibility / debuggability

**Recommendation.** **Option A — pg_cron → Edge Function**, 5-min cadence. Matches `session-hook-executor` pattern, TS resolver is testable, audience resolver becomes reusable for other targeted-fanout features. n8n stays for cross-system orchestration, not internal job scheduling. **DEFER → Council.**

### Q3 — Cross-dept C4 authority gate: where + how?

**Framing.** Manager A in Dept X creates note targeted at Dept Y team. Three enforcement points:
- **A. Server Action gate** — `gateAction("comm.note_fanout_cross_dept", { min_role: "admin" })` writes audit row, blocks write
- **B. RLS policy** — adds CHECK on insert: `audience.dept_ids ⊆ user's depts OR role ≥ admin`
- **C. Deferred to fanout** — write succeeds, scheduler filters out cross-dept recipients at fire-time

**Decision criteria.**
- Audit trail requirement (ADR-0099 says: every authority decision = audit row)
- Failure mode (block at write vs silent drop at fire)
- Existing patterns in codebase

**Recommendation.** **Option A — Server Action gate** with `gateAction("comm.note_fanout_cross_dept")` capability. Produces audit row per ADR-0099. Consistent with `add-booking-action` gate pattern. Returns clear error to UI for retry. **DEFER → Council.**

## 10. ADR Plan

Next free slots: **0331, 0332, 0333**.

- **ADR-0331** — Targeted Note Audience Model (JSONB blob, Phase 1) → resolves Q1
- **ADR-0332** — Scheduled Fanout Cadence (pg_cron 5min → Edge Function) → resolves Q2
- **ADR-0333** — Cross-Dept C4 Authority Gate for Note Fanout (Server Action gateAction with `comm.note_fanout_cross_dept` capability) → resolves Q3

All three draft as `proposed` post-Council; promoted to `accepted` on Council green-light.

## 11. Risks (refined R1-R5)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Audience JSONB locks us out of per-recipient read-receipt for Phase 2 | M | M | Junction migration is straightforward later; backfill = `jsonb_array_elements` |
| R2 | Cross-dept gate too restrictive — manager can't target sister-dept team during ops | M | H | Council Q3; explicit allowlist via `engine_authority_config` per workspace if needed |
| R3 | pg_cron 5-min cadence misses tight deadlines (manager schedules 17:58 for 18:00) | L | M | Document floor: notify_at rounds up to next 5-min tick; UX warns "Påminner ca 18:00 (±5 min)" |
| R4 | Notification retry storm if delivered_at write fails after notification emit | L | H | Wrap emit + UPDATE in single Edge Function tx; on partial failure log dedup-key for next tick |
| R5 | Mobile push fallback to in-app silent on permission revoke — user misses note | M | M | Always emit in-app notification regardless of push consent; bell badge guarantees surface |

---

**Next gates:** Council Gate 1 (Q1+Q2+Q3) → ADRs drafted → Track A schema → Tracks C/D in parallel → E sequential → F → G → H.
