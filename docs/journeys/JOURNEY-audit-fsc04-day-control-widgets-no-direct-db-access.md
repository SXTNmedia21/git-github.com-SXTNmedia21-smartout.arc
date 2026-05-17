---
title: "Journey — Day-control widgets respect ADR-0156 no-direct-DB rule"
feature: audit-fsc04-day-control-server-actions
journey: day-control-widgets-no-direct-db-access
status: verified
verified_at: 2026-06-10
e2e_test: null
created: 2026-05-13
updated: 2026-06-10
module: schedule
tags: [journey, adr-0156, governance, grep-invariant]
---

# Journey: Grep across day-control surface returns 0 direct DB writes

**Role:** future auditor

**Precondition:** Refactor complete. Both new Server Actions shipped.

## Happy Path

1. Run grep across day-control widget tree:

   ```bash
   grep -rn '\.from("deviation")\|\.from("department_session")' \
     apps/web/src/components/day/ \
     apps/web/src/app/dashboard/schedule/_components/day-control/ \
     | grep -E '\.update\(|\.insert\(|\.upsert\(|\.delete\('
   ```

2. Returns 0 hits (verified 2026-06-10 on sortie close)
3. Day-control widget tree is read-only on DB for these tables; all writes route through Server Actions at `apps/web/src/app/dashboard/_actions/update-deviation-action.ts` + `update-department-session-action.ts`
4. Auditor confirms F-SC-04-15 + F-SC-04-13 stay closed

**Postcondition:** ADR-0156 audit-integrity driver upheld. ADR-0204 backlog reduced by 2 sites.

## Verification

- [x] Grep command returns 0 hits in widget tree (verified 2026-06-10)
- [x] Server Actions live at `apps/web/src/app/dashboard/_actions/update-deviation-action.ts` + `update-department-session-action.ts`
- [x] Synthesis F-SC-04-15 + F-SC-04-13 → CLOSED
- [x] Authority seed migration `20260610100000_seed_day_control_action_authority.sql` covers all 3 new capabilities (`hms.resolve_deviation`, `hms.acknowledge_deviation`, `session.update_duty_leader`)

**Note:** read-only `supabase.from("department_session").select(...)` calls in OversiktTab + OkonomiTab remain (lookup queries inside `useQuery`). ADR-0156 forbids day-control widgets from owning **writes** to DB — reads via `useQuery` are explicitly the canonical pattern.

**Verified 2026-06-10 by sortie feat/audit-fsc04-day-control-server-actions.**
