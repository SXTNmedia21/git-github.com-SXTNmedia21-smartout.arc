---
title: "Plan — audit-fan-out"
status: in_progress
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [plan, billing, telemetry, settlement, audit, adr-0264]
---

# Plan — audit-fan-out

> Branch: `feat/order-system-audit-fan-out` | Worktree: /home/sxtnl/dev/smartout.ai-order-system-wt-9 | Base: `campaign/order-system` | Module: billing | Started: 2026-05-02

## Goal

Implement ADR-0264 option (a) fan-out per company so that platform-scoped settlement events (`run_completed`, `run_failed`, `period_locked`) actually persist to `billing_activity_log` — restoring the audit guarantee promised in ADR-0262 Amendment 1, which is currently broken (events emit, get accepted by registry, never persist).

## Pre-read (in order, BEFORE touching any code)

1. `docs/decisions/0264-cross-company-audit-destination.md` — the ADR (this plan implements it)
2. `docs/decisions/0262-admin-file-downloads-302-redirect-signed-urls.md` — Amendment 1 sets the routing rule
3. `packages/telemetry/src/providers/billing-activity-log.ts` — current rejection point (line ~147)
4. `packages/billing/src/server/settlement/run.ts` — emit call sites (lines 195, 333, 372)
5. `supabase/migrations/20260417122417_billing_activity_log.sql` — schema confirmation (`invoice_id` is nullable, `company_id NOT NULL`)
6. `packages/telemetry/src/providers/__tests__/billing-activity-log.nested-entity.test.ts` — existing test patterns to follow

## Tasks

- [ ] **Task 1 — Provider fan-out branch** (`packages/telemetry/src/providers/billing-activity-log.ts`)
  - Add fan-out branch BEFORE the existing single-company resolution logic (after `data` and `changes` extraction, before `invoiceId` resolution).
  - Trigger: `Array.isArray(data.company_ids) && data.company_ids.length > 0`.
  - For each `company_id` in the array:
    - Verify exists in `public.company` table (defense-in-depth, same as existing `declaredCompanyId` path at line 122–145).
    - INSERT row with `company_id: cid, invoice_id: null, event, entity_type, entity_id, data, changes, actor_user_id, source`.
    - On insert error: `console.error` and continue (do not throw — telemetry must never block business logic).
    - On company-not-found: `console.warn` and skip that one row.
  - Use `Promise.allSettled` for the fan-out inserts, then `return` to skip the single-company path.
  - Keep ADR-0264 reference comment at the top of the branch.

- [ ] **Task 2 — Emit payloads** (`packages/billing/src/server/settlement/run.ts`)
  - **Line ~195** `settlement period_locked` (per-workspace, has workspace_id): add `company_id: companyMap.get(wsId)` to `data`. Single-company path will resolve.
  - **Line ~333** `settlement run_completed` (workspace_id: null): compute `const resolvedCompanyIds = Array.from(new Set([...companyMap.values()]));` and add `company_ids: resolvedCompanyIds` to `data`. Triggers fan-out.
  - **Line ~372** `settlement run_failed` (catch block, workspace_id: null): inline `company_ids: Array.from(new Set([...companyMap.values()]))` in `data`. `companyMap` is in outer scope (line 136) so available in catch.

- [ ] **Task 3 — Provider unit tests** (`packages/telemetry/src/providers/__tests__/billing-activity-log.fan-out.test.ts` — new file)
  - Test 1: `data.company_ids = ['cid-A', 'cid-B']` with both verified → 2 inserts, 0 warnings.
  - Test 2: `data.company_ids = ['cid-A', 'cid-NOT-FOUND']` → 1 insert + 1 console.warn (verify Skip path).
  - Test 3: `data.company_ids = []` → falls through to single-company path (regression guard — empty array must NOT trigger fan-out).
  - Test 4: `data.company_ids` absent → falls through to single-company path (existing behavior preserved).
  - Test 5: insert error on one row of 2 → other row succeeds, console.error logged (Promise.allSettled semantics).
  - Test 6: `data.company_ids = ['cid-A']` (single-element array) → 1 insert via fan-out path (boundary case).
  - Mock pattern: follow `nested-entity.test.ts` existing in same `__tests__/` directory.

- [ ] **Task 4 — Integration test** (`packages/billing/src/server/settlement/__tests__/run.audit.test.ts` — new or extend existing)
  - Boot Supabase Local fixtures: 1 tenant, 3 workspaces split across 2 companies, 1 accountant grant covering both.
  - Run `executeSettlementRun` happy path → assert `billing_activity_log` count = 2 with `event = 'settlement run_completed'` and `entity_id = <run_id>`.
  - Run a forced-failure path (mock `compute_period_aggregates` to throw) → assert `billing_activity_log` count = 2 with `event = 'settlement run_failed'`.
  - Per-workspace `period_locked`: assert 3 rows (one per workspace) with correct `company_id`.
  - Verify NO `console.warn "[telemetry.billing_activity_log] Could not resolve company_id"` in output.

- [ ] **Task 5 — Telemetry registry sanity** (`packages/telemetry/src/registry.ts`)
  - Confirm `settlement run_completed`, `settlement run_failed`, `settlement period_locked` already have `audit: "billing"` and route to `billing_activity_log` per Amendment 1. No changes needed if already correct — just verify.
  - If `run_completed`/`run_failed` are still routed to `activity_trail`, fix in this PR (drop `activity_trail` from their destinations array — workspace_id:null guarantees silent drop there).

- [ ] **Task 6 — Typecheck + build packages** (must pass before close-feature)
  - `pnpm --filter @smartout/telemetry build`
  - `pnpm --filter @smartout/billing build`
  - `pnpm turbo typecheck` — must be 0 errors in the affected scope (telemetry, billing). Pre-existing mobile errors documented in memory file `feedback_no_verify_when_justified.md` are tolerated for now.

- [ ] **Task 7 — Run targeted tests + full vitest suite for affected packages**
  - `pnpm --filter @smartout/telemetry test` — all green including new fan-out tests
  - `pnpm --filter @smartout/billing test` — all green including new audit integration test

- [ ] **Task 8 — Journey + handoff documentation** (closure prerequisites)
  - Fill `docs/journeys/JOURNEY-audit-fan-out.md` with 1 journey: "Erik queries his settlement run audit row" — happy path + error path + acceptance criteria from ADR-0264.
  - Write `docs/HANDOFF-audit-fan-out.md` with summary, decisions, learnings (anything surprising), known issues, next steps (M8 Erik UAT).

## Acceptance Criteria

- [ ] All 6 acceptance points from ADR-0264 §"Acceptance Criteria" verified.
- [ ] `pnpm turbo typecheck` 0 errors in scope (telemetry + billing).
- [ ] All vitest suites green for telemetry + billing.
- [ ] Journey written.
- [ ] Handoff written.
- [ ] Decision log entry for ADR-0264 already present (committed in campaign root @ eeed57e91 — no new entry needed).

## Out of scope

- DO NOT touch other emit sites in the codebase. Only the 3 emit sites in `run.ts`.
- DO NOT migrate the `billing_activity_log` schema. Option (a) explicitly avoids migration.
- DO NOT introduce a third destination, new provider, or new table.
- DO NOT amend ADR-0262 again — Amendment 1 already covers the routing rule.
- DO NOT register a new ADR — ADR-0264 is already registered as `proposed`. Promote to `accepted` in the close-feature handoff if all acceptance criteria pass.

## Risk register

- **Risk:** insert errors on one row of N break the audit silently. **Mitigation:** Promise.allSettled + console.error + acceptance criteria item 4 (no warns in clean run).
- **Risk:** `companyMap` not in scope in catch block. **Verified false:** declared at line 136 in `run.ts` outer scope, accessible in catch at line 372.
- **Risk:** existing single-company billing emit sites accidentally pass `company_ids` and trigger fan-out. **Mitigation:** Tests 3 + 4 are explicit regression guards. Provider only fan-outs on non-empty array — undefined or empty falls through.
- **Risk:** `data.company_ids` JSON serialization roundtrip changes string array shape. **Mitigation:** `Array.isArray()` check is robust; provider runs in same Node process as emit() (no JSON wire crossing).

## Estimated effort

3-4 hours per ADR-0264 §"Implementation effort":
- Emit payload changes: 30 min
- Provider fan-out: 45 min
- Unit tests: 60 min
- Integration test: 60 min
- Typecheck + handoff: 30 min
