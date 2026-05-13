---
title: "Journey — staff_event manager flow still works after rls hardening"
feature: audit-fdb12-staff-event-rls
journey: staff-event-happy-path-still-works
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, rls, happy-path, staff-event]
---

# Journey: Manager creates/updates/deletes staff_event in own workspace

**Role:** manager (or admin/owner) in workspace A

**Precondition:** Migration applied. Manager in A. Existing department in A.

## Happy Path

1. Manager creates staff_event via UI / Server Action → INSERT staff_event row + linked staff_event_attendee rows
2. Postgres evaluates INSERT policy → role gate passes → WITH CHECK passes (workspace_id matches manager's workspace)
3. Row created. Telemetry `staff_event.created` emits (separate concern — verify still works)
4. Manager updates staff_event title → UPDATE policy passes
5. Manager deletes staff_event (cascade to attendees) → DELETE policy passes

**Postcondition:** staff_event lifecycle functional in own workspace. No regression.

## Error Paths

- **Employee-tier user tries to create staff_event** → blocked by role gate (intended per A.2 deviation pattern).

## Verification

- [ ] pgTAP `lives_ok` on manager INSERT on staff_event
- [ ] pgTAP `lives_ok` on manager UPDATE on staff_event
- [ ] pgTAP `lives_ok` on manager INSERT on staff_event_attendee
- [ ] Real schedule UI smoke if dev server running (optional)

**Mark `status: verified` when first 3 checked.**
