---
title: "Journey — Admin sees aggregate count + preview → click → /komm filtered"
feature: m2-thread-continuation
journey: admin-aggregate
status: draft
verified_at: null
e2e_test: null
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [journey, help, helpdesk, admin]
---

# Journey: Admin (responsible_profile_id = self) sees aggregate count + top-1 preview

**Role:** admin

**Precondition:** Admin is `responsible_profile_id` on N≥2 open helpdesk channels (`channel_type='desk'` with `helpdesk_enabled=true`) tied to active `engine_state` rows.

## Happy Path

1. Admin navigates to `/dashboard/help`.
2. Server-side query `getActiveHelpdeskThreadsForProfile(profileId, workspaceId, 'admin')` returns N rows ordered by most-recent message DESC.
3. Page renders `<ActiveTicketBadge>` aggregate variant:
   - Heading: "X åpne saker" (where X = N)
   - Top-1 preview: subject + last-message snippet of most recent
   - Secondary link: "Se alle X saker →" pointing to `/dashboard/komm?filter=helpdesk` (or equivalent filter URL)
4. Telemetry emits `help.active_ticket_badge_viewed` with `{ workspaceId, actorId, ticketCount: N, role: 'admin' }`.
5. Admin clicks the top-1 preview.
6. Client emits `help.active_ticket_badge_clicked` with `{ workspaceId, actorId, channelId, role: 'admin' }`.
7. Browser navigates to `/dashboard/komm/thread/<channelId>` (the most recent ticket).

OR

5'. Admin clicks "Se alle X saker →".
6'. Client emits `help.active_ticket_badge_clicked` with `{ workspaceId, actorId, role: 'admin', target: 'list' }`.
7'. Browser navigates to `/dashboard/komm?filter=helpdesk`.

**Postcondition:** Admin lands on the thread or filtered list and can triage.

## Error Paths

- **Scenario:** Admin has 0 tickets where they are responsible → empty state per `employee-no-ticket` shape (no badge rendered).
- **Scenario:** Admin has exactly 1 ticket → renders single-ticket variant (mirrors employee journey), not aggregate.
- **Scenario:** Filter URL `/dashboard/komm?filter=helpdesk` does not exist yet → fallback link `/dashboard/komm`. (Confirmed acceptable per spec Q2.)

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter) — assert `"3 åpne saker"` text + preview node + secondary link
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
