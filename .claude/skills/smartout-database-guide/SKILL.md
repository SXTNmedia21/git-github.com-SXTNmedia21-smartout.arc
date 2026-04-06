---
name: smartout-database-guide
description: Authoritative guide for Smartout database work — schemas, tables, enums, RLS, migrations, traps. Use when touching any database table, schema, enum, RLS policy, or migration.
tools: Read, Grep, Glob, Bash
---

# Last synced: 2026-04-06

# Smartout Database Guide

This skill is the AUTHORITATIVE source for database conventions. CLAUDE.md points here.

## Schema Map

| Schema      | Tables | Purpose              |
| ----------- | ------ | -------------------- |
| `public`    | 169    | Core + HMS + cascade |
| `payroll`   | 23     | Payroll domain       |
| `websites`  | 13     | Website factory      |
| `timesheet` | 1      | Time tracking        |

**Schema placement rule:** Every new feature MUST brainstorm schema placement. A dedicated schema is warranted when the domain has 5+ tables, distinct RLS patterns, or clear ownership boundary.

## Critical Traps

- Table is `user_identity`, NOT `user`. No `public.user` table exists.
- `profile` has `display_name` only — NOT `first_name`/`last_name`. Identity data lives on `user_identity`.
- Subscription data on `company` table. No `stripe_subscription` table.
- `contract_status` enum already taken by `employment_contract`. Don't reuse.
- 72 enums — check `packages/supabase/src/database.types.ts` before creating new ones.
- `database.types.ts` is auto-generated. Never edit manually.
- Season table has `status` enum (draft/active/archived) — NOT `is_active` boolean.
- `is_godmode` on `user_identity` gates all platform-admin access (renamed from `is_super_admin`).
- Triple operating hours: `company_opening_hours` (wizard intake), `operating_hours` (legacy — MUST migrate away), `department_operating_hours` (cascade runtime truth). Never read/write `operating_hours` in new code.
- `change_proposal_status` enum — do NOT confuse with `contract_status`.
- `tariff_rate_table.workspace_id` is nullable — platform-level rates have NULL workspace_id.

## RLS Patterns

Every workspace-scoped table needs BOTH auth paths:

**JWT policy:**

```sql
CREATE POLICY "jwt_read_{table}" ON {table}
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
```

**API key policy:**

```sql
CREATE POLICY "api_key_read_{table}" ON {table}
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );
```

Skip API key policies only for internal-only tables (platform-admin, audit logs).

## Enum Workflow

1. Check `packages/supabase/src/database.types.ts` for existing enums
2. Search: `grep -i "enum_name" packages/supabase/src/database.types.ts`
3. If creating new: add to migration file, regenerate types after

## Migration Workflow

ALDRI kjør ALTER TABLE direkte. ALLTID lag migrasjonsfil først.

1. Create: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<file>.sql`
3. Regenerate: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

## Common Joins

- Profile → Identity: `profile!inner(user_identity(first_name, last_name))`
- Company → Workspace: `company → workspace (company_id FK)`
- Profile → Department: `profile → department (department_id FK)`
- Workspace → Members: `workspace → company_member → user_identity`

## Key Tables by Domain

- **Identity:** user_identity → company → company_member → workspace → profile
- **Governance:** policy → protocol → {procedure, routine, runbook, control_list, knowledge_test, confirmation}
- **Engine:** engine_process → engine_state → engine_state_step
- **Agent:** engine_memory, engine_authority_config, engine_sessions
- **Schedule:** schedule_shift, schedule_absence
- **Session:** department_session → session_hook, session_task, session_note

## Reference Files

- Full schema: `docs/reference/DATABASE.md`
- Types: `packages/supabase/src/database.types.ts`
- Migrations: `supabase/migrations/`
