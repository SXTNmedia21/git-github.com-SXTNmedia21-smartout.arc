---
title: "Journey — payroll-tariff-7g-reconcile"
status: verified
feature: tariff-7g-reconcile
updated: 2026-05-17
created: 2026-05-17
module: ai
tags: [journey, payroll, tariff, phase-7g, reconcile, contract]
---

# Journey — payroll-tariff-7g-reconcile

> Phase 7g reconciliation. Closes 9 gaps + 1 code-review blocker from Phase 7e parallel sortie. End-to-end production-ready.

## Journey: Admin POSTs tariff setup (corrected)

**Precondition:** Admin authenticated, no active binding.

1. Web client POST `/api/payroll/tariff/setup` with `{union_id: "taro-79", law_version: "2025", ...}` — enum string, no UUID
2. BFF Zod-validates against `setupTariffRequestSchema` (now uses `unionIdSchema`, no UUID coercion needed)
3. BFF invokes `setupWorkspaceTariffTool` with body passed through directly
4. Tool generates `payrollEmitId` + `cascadeEmitId` UUIDs BEFORE emit()
5. Tool delegates to `cascade.bind_workspace_union(caller_capability='payroll')`
6. Cascade atomic RPC INSERT
7. Tool emits with `correlation_id: payrollEmitId` (queryable in `activity_trail`)
8. Tool returns `{workspace_union_binding_id, effective_from, union_id, law_version, payroll_emit_id, cascade_emit_id}`
9. BFF response audit block uses REAL tool-returned emit IDs (not synthetic)

**Postcondition:** Real audit trail queryable via `activity_trail.correlation_id = payroll_emit_id`.

## Journey: Admin POSTs tariff change (corrected old_law_version)

**Precondition:** Existing binding with known law_version.

1. POST `/api/payroll/tariff/change` with new params
2. Tool SELECTs `law_version` from current `workspace_union_binding` (effective_to IS NULL) BEFORE cascade call
3. Captured as `oldLawVersion`
4. Cascade switch flow
5. Tool returns `{..., old_law_version: <real DB value>, new_law_version: <body>}`
6. BFF passes real value (no body-proxy placeholder)

**Postcondition:** Audit shows true delta old→new law_version.

## Journey: Manager adds supplement (DB taxonomy)

**Precondition:** Workspace tariff-bound.

1. AddSupplementForm dropdown shows DB taxonomy options: `normal | week_based | day_based | manual | holiday | contract_rule`
2. Form imports `SupplementType` named export from `@smartout/types`
3. POST `/api/payroll/tariff/supplement` — value passed direct (no UX→DB mapping)
4. PostgreSQL tariff-floor trigger validates
5. Tool returns real emit IDs

## Journey: View tariff page (admin + mobile)

**Precondition:** Any authenticated user with workspace access.

1. Page/screen mounts
2. `useCurrentTariff()` GET `/api/payroll/tariff/current`
3. BFF reads `workspace_union_binding` + enriches via `lovsen-client.ts`
4. Response `union_id` validated against `unionIdSchema.nullable()` (read contract now matches write)
5. ParagrafEntry `rate_type` uses DB taxonomy strings
6. View-emit fires (no longer commented):
   - Web: `payroll.tariff_view_loaded` via `emit()`
   - Mobile: `payroll.tariff_view_loaded_mobile` via `emit()` with `safeGetProfileContext()` L-0177 fail-fast

**Postcondition:** PostHog + Logger receive view events. No `activity_trail` row (read, not mutation).

## Gaps closed (9 from Phase 7e + 1 from code-review)

| # | Gap | Fix commit |
|---|---|---|
| 1 | `union_id` UUID vs enum (write) | df5c36ca0 |
| 2 | `supplement_type` UX vs DB | df5c36ca0 |
| 3 | `rate_type` unreachable values | df5c36ca0 |
| 4 | Audit emit IDs synthetic | 96de94ca3 + e5241e7ea |
| 5 | `old_law_version` placeholder | 96de94ca3 |
| 6 | `SupplementType`/`RateType` named exports missing | df5c36ca0 |
| 7 | `payroll.tariff_view_loaded` not registered | 868876499 |
| 8 | `payroll.tariff_view_loaded_mobile` not registered | 868876499 |
| 9 | `lovsen-client.ts` duplication | ffca9e4c9 |
| 10 | `currentTariffResponseSchema.union_id` UUID (read drift) | 42943b5fb |

## Deferred to Phase 7h

- `cascade_emit_id` round-trip from cascade tool result (currently pre-generated at payroll layer)
- `TariffClient.tsx` actor_id placeholder uses workspaceId (web view-emit lacks client-side profile context hook — needs ProfileContextProvider extension)
- Union master table (enum sufficient V1)
