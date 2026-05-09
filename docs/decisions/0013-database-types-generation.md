---
title: "ADR-0013: Auto-Generated Database Types Workflow"
id: ADR-0013
status: accepted
layer: decision
created: 2026-02-27
updated: 2026-02-27
---

# ADR-0013: Auto-Generated Database Types Workflow

**Date:** 2026-02-27
**Status:** Accepted

## Context

Supabase generates TypeScript types from the database schema. These types must stay in sync with migrations to prevent runtime errors.

## Decision

`packages/supabase/src/database.types.ts` is **auto-generated** and must never be edited manually.

### Workflow

After every migration:

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

### Rules

1. **Never** edit `database.types.ts` by hand
2. **Always** regenerate after applying a migration
3. **Always** commit the regenerated file
4. **Always** run `pnpm --filter @smartout/supabase lint` after regeneration to verify
5. Remove the `Connecting to db XXXX` line if it appears on line 1 (Supabase CLI stderr leak)

## Rationale

- Generated types guarantee 1:1 match with actual database schema
- Manual edits would be silently overwritten on next generation
- Committing the generated file means consumers don't need a running database to build

## Consequences

- CI should validate that committed types match current schema
- New enums must be checked against existing ones in the types file to avoid naming conflicts (e.g., `contract_status` is already taken by `employment_contract`)
