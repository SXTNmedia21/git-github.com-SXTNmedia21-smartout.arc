---
title: "UI-driven terminal engine_state transitions must stamp completed_at"
id: LEARNING_0079
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [event-engine, engine_state, telemetry, helpdesk, contract-invariant]
---

# Learning-0079: UI-driven terminal engine_state transitions must stamp completed_at

## Context

Helpdesk Phase 1 UI shipped two resolve paths (web Server Action + mobile
mutation) that updated `engine_state.status = 'complete'` directly instead
of routing through `engine-dispatch`. Both paths left `completed_at` NULL.
The final merge council (2026-04-20) caught this as a merge-blocker before
the feature landed on development.

## Discovery

The `engine-dispatch` Edge Function is the dispatcher-authoritative source
for `completed_at` — it stamps `completed_at: new Date().toISOString()` at
ten call sites whenever it transitions a state row to `complete`. Any code
path that bypasses dispatch and writes `status = 'complete'` directly
inherits a responsibility to mirror that invariant. When it doesn't,
downstream SLA queries, reporting dashboards, and any ordering on
`completed_at` silently drop the UI-resolved rows off the timeline.

The bug looked harmless at every concept-level review (ADR compliance,
spec alignment, RLS scoping all passed) and only surfaced when Supervisor
traced the dispatcher's actual update shape.

## Impact

Promote this to a generalizable rule: **when a UI mutation writes a
terminal engine_state status directly (bypassing engine-dispatch), it
must mirror every column the dispatcher would have stamped on that
transition.** For `complete`: `completed_at` + `updated_at`. For `failed`:
potentially `last_error`. For `escalated`: any dispatcher-written
context fields.

Operational rule for future reviewers: when inspecting a
`supabase.from('engine_state').update(...)` call outside
`engine-dispatch`, grep `supabase/functions/engine-dispatch/**` for the
same status transition and diff the column sets.

## References

- `apps/web/src/app/dashboard/komm/thread/[channelId]/_actions/resolve-ticket.ts` — fix applied via commit `1c20680a`.
- `apps/mobile/src/hooks/mutations/use-resolve-ticket.ts` — fix applied via commit `e37e7b76`.
- `supabase/functions/engine-dispatch/index.ts` — authoritative dispatcher.
- Related: L-0038 (activity-trail silent-drop), L-0045 (emit() payload validation).
