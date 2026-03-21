---
title: "ADR-0057: Payroll Schema Separation"
status: accepted
updated: 2026-03-21
created: 2026-03-21
module: payroll
tags: [database, schema, architecture, payroll]
---

# ADR-0057: Payroll Schema Separation

## Status

Accepted

## Context

The payroll module adds 23 tables and 16 enums. Placing everything in the `public` schema (alongside 50+ existing tables) creates namespace clutter and makes it harder to reason about module boundaries.

## Decision

Create a dedicated `payroll` schema for all payroll-specific database objects.

- Tables use clean names without prefix: `payroll.workspace_settings`, not `public.payroll_workspace_settings`
- Enums follow the same pattern: `payroll.wage_type`, not `public.payroll_wage_type`
- Cross-schema FKs are used where payroll references public tables (workspace, profile, schedule_shift) and vice versa
- Cross-schema enum references work (e.g., `public.schedule_shift.custom_rate_type` uses `payroll.custom_rate_type`)
- RLS policies moved with tables — no changes needed
- Type generator uses `--schema public --schema payroll`
- Supabase JS client uses `supabase.schema('payroll').from('table')` for payroll queries

### Role Grants

| Role            | Access                                       |
| --------------- | -------------------------------------------- |
| `authenticated` | SELECT, INSERT, UPDATE, DELETE (RLS applies) |
| `anon`          | SELECT (RLS applies)                         |
| `service_role`  | ALL                                          |

### Pattern for Future Modules

This establishes the pattern for schema separation. Future candidates:

- `scheduling.*` — schedule_shift, schedule_absence, etc.
- `governance.*` — policy, protocol, procedure, etc.
- `identity.*` — user_identity, company, workspace, etc.

Each module should get its own schema when it reaches sufficient table count (5+) or when starting a new module from scratch.

## Consequences

- Payroll queries must specify schema: `supabase.schema('payroll').from('workspace_settings')`
- Type paths change: `Database["payroll"]["Tables"]["workspace_settings"]` instead of `Database["public"]["Tables"]["payroll_workspace_settings"]`
- Future payroll migrations must use `SET search_path TO payroll, public, extensions;`
- Cross-schema FKs work but are slightly less visible in schema diagrams

## Alternatives Considered

1. **Keep everything in public with prefix** — simpler but doesn't scale. 50+ tables already, adding 23 more makes navigation painful.
2. **Schema per module retroactively** — too risky mid-project. Better to establish the pattern now and migrate existing modules later.
