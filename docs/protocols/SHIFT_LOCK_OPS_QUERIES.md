---
title: "SHIFT LOCK OPS QUERY PACK"
status: canonical
owner: platform
updated: 2026-03-29
tags: [shift-lock, operations, sql, audit]
---

# Shift Lock Ops Query Pack

Copy/paste SQL pack for daily drift and rollout monitoring.

## 1) Workspace rollout mode overview

```sql
select
  w.workspace_id,
  w.name as workspace_name,
  coalesce(p.lock_mode, 'enforce') as lock_mode,
  p.updated_at as policy_updated_at
from public.workspace w
left join public.schedule_shift_lock_policy p
  on p.workspace_id = w.workspace_id
where w.is_active = true
order by lock_mode, workspace_name;
```

## 2) Override activity (last 24h)

```sql
select
  a.workspace_id,
  w.name as workspace_name,
  count(*) as override_attempts_24h
from public.schedule_shift_lock_audit a
join public.workspace w
  on w.workspace_id = a.workspace_id
where a.created_at >= now() - interval '24 hours'
  and a.is_overridden_by_high_access = true
group by a.workspace_id, w.name
order by override_attempts_24h desc, workspace_name;
```

## 3) Top reason-codes (last 24h)

```sql
select
  reason_code,
  count(*) as attempts_24h
from public.schedule_shift_lock_audit
where created_at >= now() - interval '24 hours'
group by reason_code
order by attempts_24h desc;
```

## 4) Workspace ranking by override rate (last 24h)

```sql
with base as (
  select
    workspace_id,
    count(*) as total_attempts,
    count(*) filter (where is_overridden_by_high_access = true) as override_attempts
  from public.schedule_shift_lock_audit
  where created_at >= now() - interval '24 hours'
  group by workspace_id
)
select
  b.workspace_id,
  w.name as workspace_name,
  b.total_attempts,
  b.override_attempts,
  round(
    case
      when b.total_attempts = 0 then 0
      else (b.override_attempts::numeric / b.total_attempts::numeric) * 100
    end,
    2
  ) as override_rate_pct
from base b
join public.workspace w
  on w.workspace_id = b.workspace_id
order by override_rate_pct desc, b.total_attempts desc, workspace_name;
```

## 5) Enforced blocks vs shadow allows (last 24h)

```sql
select
  lock_mode,
  is_enforced,
  count(*) as attempts_24h
from public.schedule_shift_lock_audit
where created_at >= now() - interval '24 hours'
group by lock_mode, is_enforced
order by lock_mode, is_enforced desc;
```

## 6) Actor-level override leaderboard (last 7d)

```sql
select
  a.actor_user_id,
  coalesce(ui.first_name || ' ' || ui.last_name, 'Unknown') as actor_name,
  count(*) as override_attempts_7d
from public.schedule_shift_lock_audit a
left join public.user_identity ui
  on ui.user_id = a.actor_user_id
where a.created_at >= now() - interval '7 days'
  and a.is_overridden_by_high_access = true
group by a.actor_user_id, actor_name
order by override_attempts_7d desc, actor_name;
```

## 7) High-risk shifts with repeated override (last 7d)

```sql
select
  a.workspace_id,
  w.name as workspace_name,
  a.schedule_shift_id,
  count(*) as override_count_7d,
  min(a.created_at) as first_seen,
  max(a.created_at) as last_seen
from public.schedule_shift_lock_audit a
join public.workspace w
  on w.workspace_id = a.workspace_id
where a.created_at >= now() - interval '7 days'
  and a.is_overridden_by_high_access = true
group by a.workspace_id, w.name, a.schedule_shift_id
having count(*) >= 2
order by override_count_7d desc, last_seen desc;
```

## 8) Emergency check: currently `off` workspaces

```sql
select
  p.workspace_id,
  w.name as workspace_name,
  p.lock_mode,
  p.updated_at
from public.schedule_shift_lock_policy p
join public.workspace w
  on w.workspace_id = p.workspace_id
where p.lock_mode = 'off'
order by p.updated_at desc;
```

## Suggested daily routine

1. Run query 8 first (`off` workspaces).
2. Run query 2 + 4 (override volume and rate).
3. Run query 3 (reason-code drift).
4. Run query 5 (enforce/shadow balance).
5. Escalate if override rate spikes or `off` remains active >24h.
