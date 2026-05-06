---
title: "Handoff — audit-fan-out"
status: done
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [handoff, billing, settlement, audit, bokforingsloven, adr-0264]
---

# Handoff — audit-fan-out

> Branch: `feat/order-system-audit-fan-out` | ADR: ADR-0264 | Sortie of: `campaign/order-system`

## Summary

Implemented ADR-0264 option (a) — fan-out per company in `billing_activity_log` provider. This restores the Bokføringsloven §10 audit guarantee for `settlement run_completed` and `settlement run_failed` events, which were previously silently dropped by both audit destinations (`activity_trail` drops workspace_id:null; `billing_activity_log` rejected with "Could not resolve company_id").

**Root cause:** Platform-scoped settlement events cover multiple companies but the provider only had a single-company resolution path. The fix adds a fan-out branch triggered by `data.company_ids[]` that inserts one audit row per company.

**Zero migrations.** `invoice_id` was already nullable per `20260417122417_billing_activity_log.sql:15`.

## What Was Built

| File | Change |
|------|--------|
| `packages/telemetry/src/providers/billing-activity-log.ts` | +63 lines: fan-out branch (before single-company path), `Promise.allSettled`, DB verification per company_id |
| `packages/billing/src/server/settlement/run.ts` | +12 lines: `company_ids` on `run_completed` and `run_failed` emits; `company_id` on `period_locked` emits |
| `packages/telemetry/src/registry.ts` | +17 lines: optional `company_ids?` field on `SettlementRunCompleted` and `SettlementRunFailed`; optional `company_id?` on `SettlementPeriodLocked` |
| `packages/telemetry/src/__tests__/billing-activity-log.fan-out.test.ts` | New — 6 unit tests for provider fan-out |
| `packages/billing/src/__tests__/run.audit.spec.ts` | New — 5 integration tests for `executeSettlementRun` audit emit payloads |
| `docs/journeys/JOURNEY-audit-fan-out.md` | New — Erik accountant journey + acceptance criteria |

## Decisions Made

All decisions are registered in ADR-0264 (`docs/decisions/0264-cross-company-audit-destination.md`, status: proposed → mark `accepted` after this closure).

Key decisions:
- **Option (a) fan-out** over (b) nullable company_id and (c) third table. Rationale: zero migration, preserves `company_id NOT NULL` security invariant, gives Erik per-company rows that match accounting reality.
- **Registry types extended with optional fields** (`company_ids?: string[]`, `company_id?: string`) rather than making them required. This preserves backward-compatibility with existing test fixtures that don't include these fields.
- **Absolute path mock for accountant/grants.ts** in `run.audit.spec.ts` — vitest module resolution doesn't reliably match `../../accountant` from test vs. run.ts import contexts. Absolute path is the safe pattern for this monorepo layout.

## Learnings

- `vi.hoisted()` is required when `vi.mock()` factory references a `const` that would otherwise be declared after the hoisted mock call. Pattern: `const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() })); vi.mock("module", () => ({ fn: mockFn }));`
- vitest mock path resolution: `vi.mock("../../accountant")` in `src/__tests__/run.audit.spec.ts` does NOT match the import `../../accountant` in `src/server/settlement/run.ts` — they resolve to different relative paths. Use absolute paths or mock the leaf file directly.
- ADR-0264 noted `companyMap` is in outer scope at line 136 and accessible in the catch block — verified correct. No scope issue.
- Registry type extension with optional fields is always safer than required, even when callers always provide the field — prevents existing test fixtures from failing typecheck.

## Known Issues / Debt

- `data` column on `billing_activity_log` rows inserted via fan-out contains `company_ids: string[]` — a field irrelevant to single-company billing events. ADR-0264 §"Bad, because" notes this is minor schema-smell. Future work: strip `company_ids` from `data` before insert in the fan-out path (easy, deferred, no functional impact).
- No true end-to-end test against local Supabase with real data — the billing integration test is fully mocked. This was by plan (Task 4 in PLAN specified mock-level testing); a follow-up integration test against local Supabase seed data would complete the M8 Erik UAT.

## Next Steps

1. Mark ADR-0264 `status: accepted` in `docs/decisions/0264-cross-company-audit-destination.md`
2. M8 Erik UAT: run `executeSettlementRun` against local Supabase with a 2-company seed → query `billing_activity_log` → verify 2 rows per run event
3. Deferred: strip `company_ids` from `data` before fan-out insert (tech debt item from ADR-0264 §"Bad, because")
4. Monitor for `console.warn "[telemetry.billing_activity_log] fan-out: company X not found"` in production — if it fires, it signals a company was deleted after its workspace was included in a settlement run (data integrity concern)
