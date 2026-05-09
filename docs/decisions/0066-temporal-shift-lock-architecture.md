---
title: "Temporal Shift Lock Architecture"
id: ADR-0066
status: accepted
layer: decision
created: 2026-03-28
updated: 2026-03-29
---

# ADR-0066: Temporal shift lock architecture

## Context and Problem Statement

Smartout currently allows `schedule_shift` mutations from multiple write channels
(web hooks, voice tools, shared package hooks, and `shift-mcp` service paths)
without a canonical temporal immutability rule. The product needs a hard rule:
planning mutations must be blocked once a shift has started or the shift date
has passed, while allowing narrowly scoped operational updates.

## Decision Drivers

- Locking must be non-bypassable across all write channels.
- Shift clock and operational status transitions must continue to work after lock.
- Authority semantics must remain coherent across Stage Engine, voice, and MCP.
- Lock behavior must be explainable to users and auditable.

## Considered Options

1. **UI-only lock checks** — disable/edit guards in web and voice clients.
2. **RLS-only lock predicates** — enforce lock in row-level policies.
3. **DB-canonical lock contract** — enforce via DB guard (trigger/function/RPC)
   with field-level exception matrix; keep client checks as UX helpers.

## Decision Outcome

Chosen option: **"DB-canonical lock contract"**, because UI checks are bypassable
and RLS alone does not cover service-role channels like `shift-mcp`.

## Rules & Consequences

- **Good, because** the lock becomes canonical and applies uniformly to web,
  mobile, voice, MCP, and future write surfaces.
- **Good, because** field-level exceptions preserve valid D6 runtime updates
  (clock/status/confirmation paths) while freezing planning edits.
- **Bad, because** rollout requires coordinated migration of mutation paths and
  a larger regression matrix (timezones, DST, cross-channel writes).
- **Agent Impact:** all schedule mutation tools and hooks must use the same lock
  contract and return reason-coded denials for blocked mutations.

---

### Implementation Guardrails

1. Define lock window + timezone contract (`workspace.timezone`).
2. Define explicit exception matrix (allowed fields/actions post-lock).
3. Enforce contract in DB first; treat client checks as secondary UX.
4. Converge write channels onto one mutation contract surface.
5. Add telemetry for denied attempts and run cross-channel regression tests.

### Runtime Contract (implemented)

The production contract is now DB-canonical and mode-driven:

1. **Temporal decision point:** `schedule_shift_is_temporally_locked(...)` evaluates
   lock using `workspace.timezone` and shift-local start time.
2. **Mutation guard:** trigger `trg_schedule_shift_temporal_lock` calls
   `enforce_schedule_shift_temporal_lock()` on `UPDATE/DELETE`.
3. **Reason-code contract:** blocked writes raise `SHIFT_LOCKED_MUTATION:<reason_code>`.
4. **Rollout modes per workspace:** `schedule_shift_lock_policy.lock_mode`:
   - `enforce`: block + audit
   - `shadow`: allow + audit
   - `off`: allow without lock handling
5. **Audit trail:** `schedule_shift_lock_audit` stores operation, reason, lock mode,
   enforcement flag, actor, and row snapshots.
6. **High-access override:** in `enforce` mode, high-access actors (workspace
   admin/owner or godmode) may override lock. Override attempts are always audited.

### Operational Exceptions (implemented)

In locked window, the following remain allowed:

- `status: published -> active`
- `status: active -> completed`
- ad-hoc start assignment (`is_adhoc = true`, `employee_id` null -> set, with
  `status -> active`)
- high-access override in `enforce` mode (audited as override, not block)

All planning-field edits remain immutable after lock.

### Admin Control Surface (implemented)

- `workspace-api`:
  - `GET /v1/shift-lock-policy` (`schedules:read`)
  - `PUT /v1/shift-lock-policy?lock_mode=enforce|shadow|off` (`schedules:write`)
- Dashboard UI:
  - `Settings -> Security -> Shift Lock Policy` supports mode change and shows
    latest audit events.

### Rollout Protocol

Operational rollout sequence and rollback criteria are documented in:

- `docs/protocols/SHIFT_LOCK_ROLLOUT.md`
