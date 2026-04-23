---
title: "Journey — Fix bulk endpoint C4 governance wiring"
feature: contract-hub-fix-forward
journey: fix-bulk-gate-action
status: verified
verified_at: 2026-04-22
e2e_test: null
created: 2026-04-22
updated: 2026-04-22
module: contracts
tags: [journey, fix-forward, p0]
---

# Journey: Fix bulk endpoint gate_action (C4 governance wiring)

**Role:** workspace-admin (initiating bulk send) / system (C4 governance)

**Precondition:** Bulk-send endpoint at `/api/employment-contracts/bulk/route.ts` mutates contracts at scale (N profiles in one call) with only its own admin/owner role check — never invokes `gate_action` → no C4 audit trail, no authority enforcement, no `gate_evaluation` row → bulk operations bypass governance entirely while single-contract sends produce full audit.

## Happy Path

1. Engineer adds `gate_action` call at the entry of `apps/web/src/app/api/employment-contracts/bulk/route.ts` BEFORE any mutation — called ONCE per batch (not per profile) with `capability="contract"`, `action_type="bulk_send"`, `p_entity_id=template_id` (ADR-0101 per-entity scope), `p_channel="system"` (dashboard-originated, not agent channel). Fail-closed: `gate_denied` returns 403 with reason + min_role.
2. Engineer registers `ContractBulkSendInitiated` event in `packages/telemetry/src/registry.ts` with `entity=workspace` + `data={batch_id, template_id, profile_count}`, matching the existing `ContractHubViewed` dot-namespaced pattern. Wired into `SmartoutEvent` union and `EVENT_ROUTING` map (4 destinations: posthog, logger, activity_trail, engine_event).
3. Route emits `contract.bulk_send_initiated` BEFORE the per-profile loop so downstream consumers can correlate per-profile `contract.created` / `contract.sent` events back to one admin action via `batch_id`.
4. File header doc-comment updated: removed stale "event is NOT emitted, registry is frozen" note; documented gate + emit step in numbered scope.
5. Verify in DB: admin triggers bulk send to 5 profiles → `select * from gate_evaluation where capability='contract' and action_type='bulk_send' order by created_at desc limit 1` returns one row with allow=true; `select count(*) from activity_trail where event='contract.bulk_send_initiated'` increments by 1.

**Postcondition:** Every bulk-send call passes through C4 `gate_action` ONCE per batch. `gate_evaluation` row created per call. `contract.bulk_send_initiated` emitted with `{batch_id, template_id, profile_count}` enabling per-profile correlation. Bulk operations indistinguishable from single operations from a governance/audit perspective.

## Error Paths

- **Scenario (pre-fix):** Admin without `contract.bulk_send` authority calls bulk endpoint → mutation runs → 50 contracts sent → no audit, no block → governance bypassed → **Now:** gate_action denies → 403 returned → 0 contracts sent → gate_evaluation row records denial.
- **Scenario (pre-fix):** Bulk send succeeds → no telemetry → KPI dashboard shows 0 bulk operations → **Now:** Single `contract.bulk_send_initiated` event per call → dashboards reflect actual bulk volume.

## Verification

- [x] Implementation matches Council Gate 4 R2 fix spec — `gate_action` wired + `contract.bulk_send_initiated` event added (commit `4a53a0f5`)
- [x] `gate_action` called ONCE per batch (not per profile) — ADR-0101 per-entity scope, channel="system", fail-closed 403
- [x] `ContractBulkSendInitiated` registered in telemetry registry, wired to all 4 destinations (posthog, logger, activity_trail, engine_event)
- [x] Stale "event is NOT emitted, registry is frozen" doc-comment removed
- [ ] E2E test exists (deferred to P1 follow-up sortie)

**Status flipped to `verified` 2026-04-22 — implementation verified against `4a53a0f5`.**
