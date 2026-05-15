---
title: Dagslinjen QuickAdd — Slot-popover, filter, targeted note fanout
status: draft
created: 2026-05-15
updated: 2026-05-15
module: MODULE_COMMUNICATION
tags: [spec, day-control, communication, scheduling, notifications]
---

# Dagslinjen QuickAdd — Slot-popover, filter, targeted note fanout

## Summary

Transform the read-only `DayTimelineStrip` (Oversikt → Dagslinjen tab) into a write surface:

1. **Slot quick-add** — click any time on the strip → popover with 5 actions (booking, notat, oppgave, avvik, vaktstart). Each action opens existing sheet/dialog prefilled with the selected time + active scope.
2. **Scope filter** — strip header dropdown: filter timeline by avdeling | team | vakt (any one + day).
3. **Targeted note fanout** — `session_note` extended with `audience` (dept_ids[] / team_ids[] / shift_ids[] / profile_ids[]) + `notify_at` timestamp. Event Engine process fires push/SMS at `notify_at` to resolved audience.

## Goal

Restaurant manager planning Saturday: click 20:00 → "Selskap booking" prefilled; add notat "VIP-bord 12 — Gluten allergi" targeted to lørdag-vakt-team, notify_at = 18:00; add 3 oppgaver til kjøreplan; filter timeline by "Lørdag PM-team" to verify the day reads correctly.

## Non-goals

- Drag-to-create on timeline (Phase 2)
- Recurring bookings (Phase 2)
- Mobile authoring (per ADR-0133 mobile is execute-only)

## Architecture

### Reads (already shipped)
- `useDayTimelineEvents` aggregates 5 sources (booking/note/task/deviation/checkin-checkout)
- `DayTimelineStrip` renders markers

### Writes (this spec)
- **Reused:** `add-booking-action`, `DailyNoteSheet` (session_note writer), `NoteEditDialog`, `ReservationSheet`
- **New:** `SlotQuickAddPopover` launcher, prefill bridge, `useDayTimelineScope` filter hook
- **New schema:** `session_note.audience` JSONB + `session_note.notify_at` TIMESTAMPTZ + `session_note_audience_resolved` view OR explicit junction
- **New Event Engine:** `engine_process` "scheduled-note-fanout" → reads notes with `notify_at <= now` AND `delivered_at IS NULL` → resolves audience → emits notification per recipient

### Authority (C4)
- Booking creation: `manager+`
- Targeted note fanout: `manager+` for own department; `admin+` for cross-department
- Audience whitelist enforced in BFF + RLS

## Open questions

- Audience model: JSONB blob vs normalized junction table? Council escalation.
- Notification transport: reuse `@smartout/notifications` package as-is, or extend with `scheduled_at`?
- D6 vs D2 vs Communication module boundary for `session_note.audience` — Cascade Council input.

## ADRs needed

- ADR — session_note.audience + notify_at schema
- ADR — scheduled-note-fanout Event Engine process
- ADR — C4 authority gate for cross-dept targeting

## Out of scope (this sortie)

- Mobile execution UI (recipient-side push handling falls back to existing notification surface)
- Recurring notes (Phase 2)
