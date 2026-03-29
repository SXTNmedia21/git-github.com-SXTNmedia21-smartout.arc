---
title: "SHIFT LOCK ROLLOUT PROTOCOL"
status: canonical
owner: platform
updated: 2026-03-29
tags: [shift-lock, rollout, shadow-mode, enforce-mode, scheduling]
---

# Shift Lock Rollout Protocol

This protocol defines how to safely roll out temporal shift lock per workspace.

## Why this exists

Temporal lock is DB-canonical and affects all mutation channels (`web`, `voice`, `MCP`, service-role writes).  
Wrong rollout can block legitimate operational work. This protocol makes rollout safe and reversible.

## Runtime modes

- `off` — no temporal lock handling
- `shadow` — lock violations are allowed, but audited in `schedule_shift_lock_audit`
- `enforce` — lock violations are blocked and audited

## Decision rule

Use this sequence for each workspace:

1. `off` (optional, only for emergency stabilization)
2. `shadow` (observe)
3. `enforce` (activate)

Never jump directly to `enforce` on an unobserved workspace.

## Rollout steps

### 1) Set workspace to shadow

Use dashboard UI:

- `Settings -> Security -> Shift Lock Policy -> shadow`

Or SQL:

```sql
insert into public.schedule_shift_lock_policy (workspace_id, lock_mode)
values ('<workspace_uuid>', 'shadow')
on conflict (workspace_id)
do update set lock_mode = excluded.lock_mode, updated_at = now();
```

### 2) Observe audit for 3-7 days

Run these checks daily:

```sql
select reason_code, count(*) as attempts
from public.schedule_shift_lock_audit
where workspace_id = '<workspace_uuid>'
  and created_at >= now() - interval '24 hours'
group by reason_code
order by attempts desc;
```

```sql
select operation, count(*) as attempts
from public.schedule_shift_lock_audit
where workspace_id = '<workspace_uuid>'
  and created_at >= now() - interval '24 hours'
group by operation
order by attempts desc;
```

```sql
select lock_mode, is_enforced, count(*) as attempts
from public.schedule_shift_lock_audit
where workspace_id = '<workspace_uuid>'
  and created_at >= now() - interval '24 hours'
group by lock_mode, is_enforced
order by attempts desc;
```

```sql
select is_overridden_by_high_access, count(*) as attempts
from public.schedule_shift_lock_audit
where workspace_id = '<workspace_uuid>'
  and created_at >= now() - interval '24 hours'
group by is_overridden_by_high_access
order by attempts desc;
```

### 3) Promote to enforce

Promote when **all** are true:

- Team understands top reason-codes.
- No critical operational flow is blocked in shadow review.
- Voice/MCP clients show clear lock denial messages.
- At least one leader confirms readiness in production flow.

Set mode:

- UI: `Settings -> Security -> Shift Lock Policy -> enforce`
- or SQL update as above with `lock_mode = 'enforce'`.

### 4) Post-enforce verification (same day)

Check:

- Attempted forbidden mutation returns `SHIFT_LOCKED_MUTATION:<reason_code>`.
- Allowed operational transitions still work:
  - `published -> active`
  - `active -> completed`
  - ad-hoc start assignment carve-out
- Audit rows appear with `is_enforced = true`.

## Rollback protocol

If production blockers appear:

1. Set mode to `shadow` immediately (keeps audit visibility).
2. If blockers persist or are severe, set `off` temporarily.
3. Capture top reason-codes and affected flows.
4. Fix client/tool behavior.
5. Return to `shadow`, then promote again.

## KPI thresholds (platform default)

Use these as governance thresholds in Platform Admin:

- **Normal:** override rate `< 5%` and `off_workspaces = 0`
- **Warning:** override rate `>= 5%` and `< 15%`
- **Critical:** override rate `>= 15%` OR `off_workspaces > 0`

Alert surfaces:

- `/platform-admin/health` (detailed Shift Lock alert card)
- `/platform-admin/dashboard` (overview governance alert strip)

Recommended policy:

- keep workspace in `shadow` if warning/critical repeats for 2+ consecutive days
- require explicit owner signoff before promoting to `enforce` after a critical day

## High-access override behavior

In `enforce` mode, high-access users can override lock when needed for critical operations.

- Eligible actors: workspace admin/owner-level access and godmode users
- Effect: mutation is allowed even in `enforce`
- Audit: row is still written to `schedule_shift_lock_audit` with
  `is_overridden_by_high_access = true`

Use this sparingly and review override counts daily during rollout.

For ready-to-use daily SQL, see:

- `docs/protocols/SHIFT_LOCK_OPS_QUERIES.md`

## Required cross-channel test matrix

Before global rollout wave, verify each in `shadow` and `enforce`:

- Web schedule mutations
- Voice schedule tools
- `shift-mcp` `update_shift` and `delete_shift`
- service-role batch updates (if used)

Also verify timezone edge cases:

- Shift starts exactly at current local minute.
- Shift date boundary at local midnight.
- DST forward transition day.
- DST backward transition day.

## Reason-code reference

Current lock reason-codes:

- `planning_fields_immutable_after_start_or_past_date`
- `invalid_status_transition_for_locked_shift`
- `cannot_delete_started_or_past_shift`

Clients should always map these to human-readable denials.
