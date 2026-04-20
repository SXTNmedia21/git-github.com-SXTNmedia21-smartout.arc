---
name: smartout-database-guide
description: |
  AUTHORITATIVE guide for Smartout database work. MUST be loaded before any SQL, migration, schema, table, enum, RLS, Supabase, or type-regen work.

  Triggers (English): database, db, SQL, Supabase, Postgres, schema, table, column, enum, RLS, row-level security, policy, migration, workspace_id, auth.uid, service role, anon key, pgvector, btree_gist, types, database.types.ts, seed, fixture, JWT, foreign key, trigger, constraint, index.

  Triggers (Norwegian): skjema, tabell, kolonne, migrasjon, database, regel, policy, nøkkel.

  Triggers (files/paths): supabase/migrations/**, supabase/seed.sql, supabase/functions/**, packages/supabase/src/**, packages/supabase/src/database.types.ts.

  Triggers (specific tables to watch): user_identity, company, company_member, workspace, profile, employment_contract, employee_payroll_profile, schedule_shift, schedule_absence, department, department_operating_hours, department_session, session_hook, session_task, regulatory_framework, framework_rule, tariff_rate_table, team, planning_cycle, policy, protocol, engine_process, engine_state, engine_authority_config, engine_memory, workspace_doc_chunk, activity_trail.

  Triggers (schemas): public (169 tables), payroll (23), websites (13), timesheet (1).

  Traps to remember: table is user_identity NOT user; profile has display_name only; 72 enums exist — ALWAYS check database.types.ts before creating new ones; subscription on company table; contract_status enum is taken.

  ALWAYS load when writing SQL, editing a file under supabase/, changing a table, or regenerating types.
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

## Migration Timestamp Ordering (CRITICAL — L-0042)

**Migration timestamps are CAUSAL order in a dependency DAG, not chronological markers.** `supabase db reset` applies migrations in lexicographic timestamp order. A migration dated `20260417120000` runs **before** a migration dated `20260421100200`, regardless of when each file was written.

**Before choosing a timestamp, always run:**

```bash
# 1. Find the current repo tip (max timestamp)
ls supabase/migrations/ | tail -1

# 2. For EVERY table/column/enum/function your migration references,
#    find its creation migration
grep -l "<referenced_identifier>" supabase/migrations/ | tail -1
```

**Your new migration's timestamp MUST be strictly greater than:**
- The current repo tip (from step 1), AND
- Every dependency's creation timestamp (from step 2).

**Common trap:** The repo routinely has future-dated migrations (e.g. `20260421*`, `20260510*`). Picking "today's wall-clock date" is WRONG if the tip is already in the future. Pick at least one HHMM slot after the tip.

**Do NOT use runtime guards** (`DO $$ IF NOT EXISTS ...`) to mask ordering bugs — retimestamp the file instead. Runtime guards are for production backfill anomalies, not developer-time ordering discipline.

**See L-0042** for empirical basis (two occurrences on 2026-04-17: PR #216 gate_action_accept_entity_id, and Audit Remediation Week 1 Task 1 — both caught by Supabase Preview failure or council review).

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
