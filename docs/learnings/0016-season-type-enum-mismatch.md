---
title: "Season Type Enum Mismatch"
id: "0016"
status: canonical
layer: learning
created: 2026-03-03
updated: 2026-03-12
tags: [enum, onboarding, database, frontend]
---

# Learning-0016: Season Type Enum Mismatch Between Frontend and Database

## Context

During onboarding wizard bug fixing, the `SeasonIdentityStep` and `BattlefieldReviewStep` components failed because the frontend used season type values `Permanent` and `Temporal`, while the database enum `season_type` expected `default` and `calendar`.

## Discovery

The frontend `types.ts` defined season types as human-readable labels (`Permanent`/`Temporal`) instead of the actual database enum values (`default`/`calendar`). The `activate_workspace_v3` RPC rejected the mismatched values with a PostgreSQL enum constraint error.

**Fix:** Map frontend display values to DB enum values on the frontend side (in `types.ts` and step components), rather than creating a migration to change the DB enum.

## Impact

- **Always check `database.types.ts`** before using enum values in frontend code
- Frontend display labels and DB enum values are often different — map between them explicitly
- When fixing enum mismatches, prefer frontend mapping over DB migration (less risk, no downtime)
- This pattern applies to ALL enums in the system (30+ exist)

## References

- `WORKLOG-fix-onboarding-flow.md` — documents the fix
- `apps/web/src/app/onboarding/types.ts` — where the mapping lives
- `supabase/migrations/` — `season_type` enum definition
