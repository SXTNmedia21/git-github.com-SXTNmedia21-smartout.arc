---
title: "Journey — Employee without ticket sees no badge (empty state)"
feature: m2-thread-continuation
journey: employee-no-ticket
status: verified
verified_at: 2026-04-28
e2e_test: apps/e2e/tests/journey-help-active-ticket-empty.spec.ts
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [journey, help, helpdesk, employee, empty-state]
---

# Journey: Employee without active ticket sees no badge

**Role:** employee

**Precondition:** Employee has zero open helpdesk threads where they are participant.

## Happy Path

1. Employee navigates to `/dashboard/help`.
2. Server-side query `getActiveHelpdeskThreadsForProfile(profileId, workspaceId, 'employee')` returns empty array.
3. Page renders WITHOUT `<ActiveTicketBadge>` — no DOM nodes for it.
4. NO telemetry emit for `help.active_ticket_badge_viewed` (only emitted when ≥1 ticket).
5. Page composition (Panic Bar / Botsson chat hero / Quick paths / Curated articles / Kontakt footer) renders unchanged from M1.

**Postcondition:** Employee sees the standard /help layout with no continuation cue.

## Error Paths

- **Scenario:** Query returns empty (no tickets) → no badge → no error → no telemetry. Pure absence.
- **Scenario:** Query returns rows that all fail role-filter → treated as empty.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter) — assert zero matches for `[data-testid="active-ticket-badge"]`
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
