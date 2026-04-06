### Q-001: Check platform-admin route query pressure

**Use case:** Validate whether admin navigation still triggers frequent identity and dashboard reads.
**SQL:**

```sql
select
  date_trunc('minute', created_at) as minute_bucket,
  count(*) as total_queries
from pg_stat_statements, now()
where query ilike '%user_identity%'
   or query ilike '%platform_metrics_daily%'
group by 1
order by 1 desc
limit 30;
```

**Notes:** Requires `pg_stat_statements` availability and may need adaptation based on Supabase permissions.

### Q-002: Find employee name variant collisions

**Use case:** Diagnose voice lookup misses caused by spelling variants or transliterations.
**SQL:**

```sql
select
  profile_id,
  display_name,
  lower(display_name) as lower_name,
  regexp_replace(lower(display_name), '[^a-z0-9 ]', '', 'g') as normalized_hint
from profile
where workspace_id = :workspace_id
order by display_name;
```

**Notes:** Use alongside the voice query string to compare normalized forms (`alexander` vs `aleksander`).
