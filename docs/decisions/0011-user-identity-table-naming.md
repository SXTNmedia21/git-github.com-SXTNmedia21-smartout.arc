# ADR-0011: User Table Named `user_identity` (Not `user`)

**Date:** 2026-02-27
**Status:** Accepted

## Context

PostgreSQL reserves `user` as a keyword. While it can be used as a table name with quoting (`"user"`), this causes constant friction with ORMs, query builders, and code generation tools.

## Decision

The user table is named `public.user_identity`, not `public.user`.

```sql
-- CORRECT
SELECT * FROM public.user_identity WHERE user_id = $1;

-- WRONG — this table does not exist
SELECT * FROM public.user WHERE user_id = $1;
```

### Trigger

The `handle_new_user()` trigger on `auth.users` INSERT automatically creates a corresponding `user_identity` row, copying `email`, `first_name`, `last_name` from `raw_user_meta_data`.

## Rationale

- Avoids PostgreSQL reserved keyword conflicts
- No quoting needed in raw SQL, RLS policies, or generated types
- `database.types.ts` generates clean TypeScript types without escaping
- Explicit name distinguishes from Supabase's `auth.users` table

## Consequences

- All code, documentation, and agents must use `user_identity` — never `user`
- Module docs that reference `user` table need correction
- The CLAUDE.md enforces this in the "What NOT To Do" section
