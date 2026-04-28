---
title: "Journey — Employee with active ticket sees badge → click → /komm thread"
feature: m2-thread-continuation
journey: employee-active-ticket
status: draft
verified_at: null
e2e_test: null
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [journey, help, helpdesk, employee]
---

# Journey: Employee with active helpdesk ticket sees "Pågående sak" badge

**Role:** employee

**Precondition:** Employee has at least one open `engine_state` row with `process_id='helpdesk_query_lifecycle'` linked to a `channel_thread` where they are participant. Status NOT in (resolved, archived, cancelled).

## Happy Path

1. Employee navigates to `/dashboard/help`.
2. Server-side query `getActiveHelpdeskThreadsForProfile(profileId, workspaceId, 'employee')` returns 1 active thread.
3. Page renders `<ActiveTicketBadge>` above the Botsson chat hero with:
   - Heading: "Pågående sak"
   - Subject from `engine_state.context.subject` or first message preview
   - Last-message preview (≤80 chars, truncated)
   - Relative timestamp (e.g. "2 timer siden")
4. Telemetry emits `help.active_ticket_badge_viewed` with `{ workspaceId, actorId, channelId, ticketCount: 1 }`.
5. Employee clicks the badge.
6. Client emits `help.active_ticket_badge_clicked` with `{ workspaceId, actorId, channelId }`.
7. Browser navigates to `/dashboard/komm/thread/<channelId>`.

**Postcondition:** Employee is on the thread page in /komm. They can read history and reply.

## Error Paths

- **Scenario:** Query fails (RLS misconfig or DB error) → badge silently absent (no crash). Error logged to Sentry.
- **Scenario:** Channel exists but is archived → not returned by query (status filter excludes archived).
- **Scenario:** No active threads → badge not rendered (see employee-no-ticket journey).

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
