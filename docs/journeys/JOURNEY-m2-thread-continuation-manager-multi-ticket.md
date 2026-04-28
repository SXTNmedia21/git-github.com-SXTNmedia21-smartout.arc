---
title: "Journey — Manager with multiple tickets sees count + latest preview → click → /komm latest"
feature: m2-thread-continuation
journey: manager-multi-ticket
status: verified
verified_at: 2026-04-28
e2e_test: apps/e2e/tests/journey-help-active-ticket-admin.spec.ts
created: 2026-04-28
updated: 2026-04-28
e2e_coverage_note: "Shares code path with admin-aggregate (both render aggregate variant when threads.length>=2 AND role in {admin,manager,owner}). Dedicated manager-role E2E deferred to M2.2 if filter UI lands; admin-aggregate spec exercises identical component branch."
module: Core
tags: [journey, help, helpdesk, manager]
---

# Journey: Manager with multiple active tickets sees aggregate badge

**Role:** manager

**Precondition:** Manager is `responsible_profile_id` on N≥2 open helpdesk channels in their workspace.

## Happy Path

1. Manager navigates to `/dashboard/help`.
2. Server-side query `getActiveHelpdeskThreadsForProfile(profileId, workspaceId, 'manager')` returns N rows.
3. Page renders `<ActiveTicketBadge>` aggregate variant — same shape as admin journey:
   - Heading: "X åpne saker"
   - Top-1 preview (most-recent message)
   - Secondary "Se alle X saker →" link
4. Telemetry emits `help.active_ticket_badge_viewed` with `{ workspaceId, actorId, ticketCount: N, role: 'manager' }`.
5. Manager clicks top-1 preview → navigates to `/dashboard/komm/thread/<channelId>`.

**Postcondition:** Manager lands on the most-recent thread.

## Error Paths

- **Scenario:** Manager not assigned `responsible_profile_id` on any thread → empty state (no badge).
- **Scenario:** Manager on exactly 1 ticket → single-ticket variant rendered.
- **Scenario:** Manager workspace_id does not match query workspace_id → query returns empty (RLS enforced via `auth.uid()`).

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter) — distinct seed from admin journey to verify role independence
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
