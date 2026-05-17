---
title: "Journey — payroll-tariff-7h-followup"
status: verified
feature: tariff-7h-followup
updated: 2026-05-17
created: 2026-05-17
module: ai
tags: [journey, payroll, tariff, phase-7h, audit-symmetry, profile-context]
---

# Journey — payroll-tariff-7h-followup

> Phase 7h followup. Closes 2 of 3 deferred Phase 7g items. Item 3 (union master table) escalated to separate ADR sortie.

## Journey: Tariff write — full audit chain (Item 1)

**Precondition:** Admin authenticated, payroll tariff write tool invoked (setup/change/supplement).

1. Payroll tool pre-generates `payrollEmitId` (Phase 7g)
2. Payroll tool calls cascade tool (e.g. `cascade.bind_workspace_union`)
3. **NEW (7h):** Cascade tool pre-generates own `cascadeEmitId` BEFORE emit
4. Cascade emits with `correlation_id: cascadeEmitId` — queryable in `activity_trail`
5. Cascade returns `{...data, cascade_emit_id}` in result JSON
6. **NEW (7h):** Payroll tool reads `cascadeEmitId` from cascade result (no longer pre-generates own placeholder)
7. Payroll emits with `correlation_id: payrollEmitId`
8. BFF audit response: `{payroll_emit_id, cascade_emit_id}` — both real

**Postcondition:** Full audit chain queryable via `activity_trail.correlation_id` on both rows:
- One row category=`payroll`, correlation_id=`payroll_emit_id`
- One row category=`cascade`, correlation_id=`cascade_emit_id`
- Both linked via shared workspace_id + close timestamps + reciprocal `actor_capability` / `delegated_via`

## Journey: Tariff view — real actor_id (Item 2)

**Precondition:** User opens `/dashboard/payroll/tariff`, DashboardShell context populated with `profileId` server-side.

1. `TariffClient.tsx` mounts
2. **NEW (7h):** Destructures `profileId` from `useContext(DashboardContext)` (existing context, no new hook needed)
3. `resolvedProfileId` guard confirms non-null + non-empty
4. `useEffect` defers view-emit until `resolvedProfileId` available
5. `emit("payroll.tariff_view_loaded", {actor_id: nonEmpty(resolvedProfileId, "profileId"), ...})` — real profile_id (ADR-0186 contract)
6. **L-0177 fail-fast:** If `!isLoading && !resolvedProfileId`, render explicit Norwegian error card (no silent emit with empty string)

**Postcondition:** PostHog + Logger receive view event with real `actor_id = profileId`, enabling user-funnel analysis.

## Items closed

| # | Item | Resolution | Commit |
|---|---|---|---|
| 1 | `cascade_emit_id` real round-trip | Cascade tools own emit ID, payroll reads from cascade result | b966c026b |
| 2 | `TariffClient.tsx` actor_id real profile_id | DashboardContext hook + L-0177 fail-fast | 38341eae1 |
| 3 | Union master table | DEFERRED to separate ADR sortie (needs migration + cascade FK rewire) | — |

## Tests updated

- `cascade/__tests__/tools.test.ts` T1+T7: assert `result.cascade_emit_id` matches emit `correlation_id`
- `payroll/__tests__/tariff-tools.test.ts` T1+T4+T6: stable cascade emit ID fixtures, assert payroll tool's returned `cascade_emit_id` equals fixture (proves round-trip, not random)

## Profile-context resolution method

Hook via existing `DashboardContext` (no new hook, no server prop threading). `profileId: string | null` populated in `DashboardShell.tsx` line 296. Existing client component already consumed `DashboardContext` for other fields.

## Deferred Phase 7i+

- Union master table sortie (Item 3 from Phase 7g)
- Production smoke with full audit chain query (verify both `activity_trail` rows linked)
- Phase 8 user testing
