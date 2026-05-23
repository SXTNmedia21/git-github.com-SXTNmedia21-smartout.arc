---
title: "Journey — A new location is created in-txn during commit"
feature: procedure-engine-2b
journey: inline-location-create
status: verified
verified_at: null
e2e_test: null
created: 2026-05-22
updated: 2026-05-22
module: procedure-engine
tags: [journey]
---

# Journey: A new location is created in-transaction during commit

**Role:** manager

**Precondition:** The manager's draft has no matching existing location; they type a new location name in the review screen.

## Happy Path

1. Manager enters a new location name (instead of picking an existing one) → submit sends `new_location: { name }` with `location_id: null`.
2. The commit RPC inserts a `location` row (workspace-scoped, server-derived workspace_id) within the same transaction.
3. The routine is assigned to the new location; session_hooks are wired for the location's departments.

**Postcondition:** A new location row and the routine both exist, created atomically.

## Error Paths

- **Both location_id and new_location null** → request rejected (`location_required`), no write.
- **Mid-txn failure after location insert** → location insert rolls back (no orphan location).

## Verification

- [ ] Implementation matches the steps above
- [ ] Tests exist and pass (RPC creates location when new_location supplied; rollback asserted)
- [ ] Manually verified: new location appears tied to the created routine

**Mark `status: verified` in frontmatter when all three boxes are checked.**
