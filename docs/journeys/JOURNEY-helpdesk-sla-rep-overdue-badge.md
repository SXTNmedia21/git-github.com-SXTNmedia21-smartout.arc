---
title: "Journey — Rep Sees Overdue Badge"
status: draft
updated: 2026-04-28
created: 2026-04-28
module: Helpdesk
tags: [journey, helpdesk, sla, rep, ui]
---

# Journey — Rep Sees Overdue Badge on Min kø (J2)

Read-only journey. No mutations.

## Precondition

- Rep is logged in. `profile.role IN ('manager', 'admin')` (or any role assigned `responsible_profile_id` on a desk channel).
- At least one `engine_state` row with `process_id='helpdesk_query_lifecycle'`, `assignee_id=<rep.profile_id>`, `status IN ('waiting', 'active')`, AND `context.sla_breached_at IS NOT NULL`.
- Rep navigates to `/dashboard/komm`.

## Happy Path

1. Rep opens `/dashboard/komm`. → System: page renders DashboardShell + sidebar.
2. `useMinKo` query fires for the rep's profile_id. → System: queries `engine_state` filtered by assignee_id + open statuses. Returns desk-grouped rows.
3. `MinKoSection` renders one row per desk with `unresolved_count` badge. → User sees: "HR-skranken — 3 åpne".
4. For each desk row, the component checks: does any underlying `engine_state` have `context.sla_breached_at` set? → System: per-row check via the queried context blob.
5. If yes, render `Pill` primitive with text "Forfalt" beside the count. → User sees: "HR-skranken — 3 åpne · Forfalt".
6. Pill uses `text-muted-foreground` (calm). No animation, no color shift, no red/amber. Spec §1.4.

## Postcondition

- Rep sees the calm "Forfalt" badge on every desk row that contains at least one breached ticket.
- `data-testid="overdue-badge"` is present in DOM for those rows (E2E hookable).
- Page does not poll faster than `staleTime: 15_000` (existing useMinKo cadence).

## Error Paths

**E1. Query error.**
- Effect: useMinKo returns `isError`.
- Recovery: MinKoSection shows neutral empty state. No badge. Console error logged via existing TanStack Query handler.

**E2. context.sla_breached_at populated but engine_state.status='complete'.**
- Effect: Resolved ticket should not appear in Min kø at all (status filter drops it).
- Recovery: defensive — if it leaks through, badge still suppressed because resolved rows don't make it into the desk grouping.

**E3. Computed-overdue fallback (Risk #5 in plan).**
- Effect: ticket older than `started_at + 72h` but `context.sla_breached_at` not yet set (poll gap).
- Recovery: use computed fallback only if column null AND age > threshold + 5min grace. Avoid premature badge during the breach-event poll window.
