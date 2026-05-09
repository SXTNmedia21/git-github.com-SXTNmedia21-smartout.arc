---
title: "Partial Unique Index on Pending Invitations"
id: ADR-0169
status: accepted
layer: decision
created: 2026-04-20
updated: 2026-05-02
---

# ADR-0169: Partial Unique Index on Pending Invitations

## Context and Problem Statement

Today an admin can create multiple pending invitations for the same email in the same workspace — there is no DB-level constraint preventing duplicates. Users receive multiple invite links; accepting one leaves the others as orphaned `pending` rows; cancelling one does not cancel siblings. The `create-invitation` Edge Function does a soft pre-check but race conditions between concurrent admins still produce duplicates. We need a hard DB-enforced rule that allows one active pending invitation per (workspace, email) while permitting historical accepted/expired/cancelled records to coexist.

## Decision Drivers

- Admins need to re-invite users after cancel or expiry — full uniqueness on `(workspace_id, email)` breaks this.
- Data integrity: two pending invitations for the same user creates an ambiguous acceptance path (which one wins race-condition-wise?).
- Telemetry clarity: `invitation_created` event count should match real unique invitation attempts, not duplicated spam.
- Audit log: historical cancelled/expired rows must remain queryable — they are compliance evidence.
- Case-insensitive email: `Foo@X.com` and `foo@x.com` are the same identity in auth.users (Supabase lowercases email on insert) — our constraint must match.

## Considered Options

1. **Full unique on `(workspace_id, email)`** — simplest, but breaks re-invitation flow. Rejected.
2. **Partial unique index on `(workspace_id, lower(email)) WHERE status = 'pending'`** — database enforces one active pending per workspace+email; accepted/expired/cancelled rows coexist; case-insensitive match.
3. **Trigger-based constraint** — BEFORE INSERT check queries for existing pending row. More flexible but slower, not atomic under concurrent writes, and trigger logic drifts from documentation.

## Decision Outcome

Chosen option: **"Partial unique index on `(workspace_id, lower(email)) WHERE status = 'pending'`"** (Option 2), because it is atomic, race-safe, case-insensitive, and allows the re-invitation workflow without additional application logic.

## Rules & Consequences

- **Good, because** race conditions between concurrent `create-invitation` calls resolve at the DB layer — second INSERT fails with constraint violation, not silent duplicate.
- **Good, because** re-invitation after cancel works naturally: old row has `status = 'cancelled'`, new row has `status = 'pending'`, constraint allows both.
- **Good, because** historical audit trail preserved — `SELECT * FROM workspace_invitation WHERE email = $1 ORDER BY created_at` shows the full lifecycle.
- **Bad, because** migration must backfill — if duplicate pending rows already exist in production, migration fails. Mitigation: `UPDATE workspace_invitation SET status = 'cancelled' WHERE status = 'pending' AND id NOT IN (SELECT DISTINCT ON (workspace_id, lower(email)) id FROM workspace_invitation WHERE status = 'pending' ORDER BY workspace_id, lower(email), created_at DESC)` as pre-migration cleanup.
- **Bad, because** the constraint is case-insensitive on email — requires `lower(email)` in the index. A naïve query `WHERE email = 'Foo@X.com'` won't use the index. Mitigation: `create-invitation` Edge Function must normalize email to lowercase before lookup and insert.
- **Bad, because** the constraint does not cover cross-workspace duplicates — user with email `X` can have pending invites in workspace A and workspace B simultaneously. This is intentional: cross-workspace invitations are independent.
- **Agent Impact:**
  - Migration file: `supabase/migrations/YYYYMMDDHHMMSS_invitation_partial_unique_pending.sql` containing the cleanup UPDATE + `CREATE UNIQUE INDEX`.
  - `create-invitation/index.ts` must catch the unique violation error code (PostgreSQL `23505`) and return a user-friendly "Allerede invitert" response with the existing pending invitation ID.
  - Admin UI (`invite-member-dialog.tsx`) shows the existing pending invite instead of creating a duplicate — "Denne personen har allerede en ventende invitasjon. Vil du sende på nytt?"
  - RLS policies on `workspace_invitation` are unaffected — RLS controls row visibility, this index controls row uniqueness.
  - `smartout-database-guide` skill adds this pattern as an example of partial unique indexing for lifecycle-status tables.

## References

- ADR-0167 (invitation tokens as credentials — constraint applies at row-level, not token-level)
- `supabase/migrations/00011_employee_invitations.sql` (original invitation table — no unique constraint)
- `supabase/functions/create-invitation/index.ts` (current soft pre-check, to be replaced by DB constraint + 23505 error handling)
- L-0090 (enum vs timestamp — related cascade-shape decision)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
