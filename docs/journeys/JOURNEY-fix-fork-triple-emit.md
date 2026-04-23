---
title: "Journey — Fix fork triple-emit dedup"
feature: contract-hub-fix-forward
journey: fix-fork-triple-emit
status: verified
verified_at: 2026-04-22
e2e_test: null
created: 2026-04-22
updated: 2026-04-22
module: contracts
tags: [journey, fix-forward, p0]
---

# Journey: Fix fork triple-emit (single canonical emit site)

**Role:** system (telemetry) / workspace-admin (downstream observer)

**Precondition:** Fork operation triggers 3 audit_trail rows per single fork: route emits `contract_template forked` once, capability tool emits `contract_template forked` again, and a legacy `contract_template copied` event still fires. Net effect: telemetry inflation, broken `tasks_completed`-style invariants, dashboard miscounts.

## Happy Path

1. Per ADR-0191 + Fix #2 (Option A), each fork path owns its canonical emit site:
   - **Tool path** (agent fork via Mr. Botsson): emits exactly ONE `contract_template forked`, written next to `ctx.supabaseAdmin.insert` in `packages/ai/src/capabilities/contract/tools.ts`.
   - **Route path** (UI fork from MalerTab via `useCopySystemTemplate`): emits exactly ONE `contract_template forked` in `apps/web/src/app/api/contract-templates/copy/route.ts`.
2. Legacy `contract_template copied` emit REMOVED from the route. The G2-registered `contract_template forked` is now the sole event for both paths. Registry entry for the legacy event remains for now (can be marked deprecated in a follow-up sortie); downstream consumers must migrate.
3. Net result: one fork operation = ONE event, regardless of path. No duplicate, no legacy `copied` shadow event.
4. Verify in DB: trigger fork from UI → `select count(*) from activity_trail where event = 'contract_template forked' and entity_id = <new_template>` returns 1; trigger fork via Botsson → same query returns 1 → green.

**Postcondition:** Exactly one activity_trail row per fork operation. Each path (UI/agent) has a single canonical emit site. Legacy `contract_template copied` no longer fires from the route; registry entry slated for deprecation in follow-up.

## Error Paths

- **Scenario (pre-fix):** Admin forks template once → 3 audit_trail rows appear → activity feed shows 3 fork entries to user → confusion + invariant drift → **Now:** 1 row, 1 feed entry, invariants hold.
- **Scenario (pre-fix):** Telemetry consumer (PostHog dashboard) double-counts forks → KPI inflated → **Now:** 1:1 correspondence between fork action and emit; KPIs accurate.

## Verification

- [x] Implementation matches Council Gate 4 R2 fix spec — single emit per path, legacy `copied` removed from route (commit `288fde05`)
- [x] Tool path emits ONE `contract_template forked` next to `ctx.supabaseAdmin.insert`
- [x] Route path emits ONE `contract_template forked`; legacy `contract_template copied` emit deleted
- [ ] E2E test exists (deferred to P1 follow-up sortie)
- [ ] Registry deprecation of legacy `copied` event (deferred — out of scope this round)

**Status flipped to `verified` 2026-04-22 — implementation verified against `288fde05`.**
