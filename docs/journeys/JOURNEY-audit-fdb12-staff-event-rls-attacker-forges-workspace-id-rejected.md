---
title: "Journey — Attacker forges workspace_id on staff_event UPDATE rejected"
feature: audit-fdb12-staff-event-rls
journey: attacker-forges-workspace-id-rejected
status: verified
verified_at: 2026-05-13
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, rls, security, staff-event]
---

# Journey: Attacker forges workspace_id on staff_event UPDATE — rejected

**Role:** Multi-workspace user (admin or manager in workspaces A and B)

**Precondition:** Existing `staff_event` row in workspace A. User is member of both A and B.

## Happy Path (attacker prevented)

1. Attacker UPDATEs staff_event row in A, setting `workspace_id = '<workspace_B_id>'`
2. Postgres evaluates UPDATE policy → USING passes (user in A) → WITH CHECK evaluates new row → workspace_id is now B → policy requires `is_member_of_workspace(auth.uid(), workspace_id)` AND role check → fails or proceeds depending on role
3. Postgres returns `42501 new row violates row-level security policy`
4. Row in workspace A unchanged

**Postcondition:** No cross-workspace data leak. No new row in workspace B.

Applies to: `staff_event`, `staff_event_attendee`.

## Error Paths

- **User legitimately admin in both workspaces** — current legitimate move. Test fixture must use non-member workspace for the forge target.

## Verification

- [ ] pgTAP `throws_ok 42501` on forge UPDATE on staff_event
- [ ] pgTAP `throws_ok 42501` on forge UPDATE on staff_event_attendee
- [ ] T5 verifier captures both pgTAP outputs

**Mark `status: verified` when all three checked.**
