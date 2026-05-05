---
title: "M8 Erik UAT — Bug-stack discovered during live walkthrough"
status: open
created: 2026-05-02
updated: 2026-05-02
module: billing
tags: [m8, bug-stack, settlement, schema-drift]
---

# M8 Erik UAT — Bug-stack discovered

## Context

During M8 Erik UAT walkthrough (apps/e2e/onboarding/erik/walkthrough.ts) on 2026-05-02, three production bugs surfaced that were NOT caught by the M7c vitest suites because acceptance criteria #1-4 in ADR-0264 were verified against mocked Supabase clients, not live Postgres.

This is exactly the gap noted in the ADR-0264 sortie closure ("Mock-testene er forarbeid, ikke erstatning") — M8 was always the proper integration test window.

## Bugs

### Bug 1 — `lock_settlement_period` uses `auth.uid()` under service-role (FIXED)

**Symptom:** First Kjør avstemming click → `check_violation` on `settlement_period_locked_fields_check`.

**Root cause:** `billing.lock_settlement_period(uuid, date, date)` was a SECURITY DEFINER function that resolved `locked_by` via `auth.uid()`. `executeSettlementRun` calls it via service-role client (no JWT context) → `auth.uid() = NULL` → constraint violation (locked_by must be NOT NULL when status='locked').

**Fix:** Migration `20260523000000_lock_settlement_period_locked_by_param.sql` — adds explicit `p_locked_by uuid` parameter. Caller resolves authenticated `userId` at application layer. `packages/billing/src/server/settlement/run.ts` updated to pass `p_locked_by: userId`.

**Status:** ✅ Applied + verified. Period rows now insert successfully.

### Bug 2 — `compute_period_aggregates` joins invoice via non-existent `i.workspace_id` (FIXED)

**Symptom:** `column i.workspace_id does not exist` after lock fix.

**Root cause:** `billing.compute_period_aggregates` joined `LEFT JOIN public.invoice i ON i.workspace_id = w.workspace_id`. `public.invoice` is **company-scoped** — only has `company_id`, not `workspace_id`. Function was written against an older planned schema.

**Fix:** Migration `20260523000100_compute_period_aggregates_company_join.sql` — replaces 4 occurrences of `i.workspace_id` join condition with `i.company_id = w.company_id` (main aggregate) and `i.company_id = (SELECT company_id FROM public.workspace WHERE workspace_id = v_ws_id)` (3 sub-queries).

**Status:** ✅ Applied. Joins now resolve.

**Caveat:** Aggregation semantics implicitly assume 1 company → 1 workspace in seed data. If a company has multiple workspaces, the same invoice's amount is counted N times across the workspaces. **Not a bug for current seed (4 companies, 4 workspaces, 1:1 mapping)** but a latent issue for multi-workspace tenants. Track as ADR consideration: should invoice rollups dedupe at company level?

### Bug 3 — `compute_period_aggregates` references non-existent invoice columns (NOT FIXED)

**Symptom:** `column i.issue_date does not exist` after Bug 2 fix.

**Root cause:** Function references `i.issue_date`, `i.due_date`. Real schema has `i.issued_at`, `i.due_at` (timestamptz, not date). Schema-drift from older planning.

**Affected references in `compute_period_aggregates`:**

- `i.issue_date >= p_period_start` × 4 occurrences
- `i.due_date < CURRENT_DATE - INTERVAL '14 days'` × 1
- Possibly more (full audit not done)

**Likely additional drift in same function:**

- Joins to `public.payment` table — verify table name (could be `invoice_payment` or moved to billing schema)
- `public.invoice_line_item` — verify exists with expected columns

**Fix not attempted in this session** — requires fuller schema audit + careful date-vs-timestamp casting (`i.issued_at::date`).

**Status:** ⛔ Open. Tracked as separate sortie below.

## Other findings

### Telemetry actor-resolution warning (BENIGN)

```
[telemetry] Could not resolve actor profile for "settlement period_locked"
in workspace "b4000000-..." Activity trail rejected.
```

Erik (`auth.users` row) has no `public.profile` row in workspaces — accountants are NOT workspace members. The activity_trail provider expects actor to be a workspace profile. Per ADR-0262 Amendment 1 + ADR-0264, settlement events should route to `billing_activity_log`, not `activity_trail`. The warning is the expected drop-by-design behavior, but reads as scary.

**Recommendation:** silence the warn for `audit:'billing'` events. Logger noise only.

### ADR-0264 fan-out verified working (GOOD NEWS)

The `settlement run_failed` event payload from the failed runs included:

```json
"company_ids":[
  "a1000000-...",
  "a2000000-...",
  "a3000000-...",
  "a4000000-..."
]
```

Architecture decision from ADR-0264 is correctly wired in `run.ts` — the catch-block emit picked up `companyMap.values()` and fanned out the audit row. Once Bug 3 is fixed and a run completes, billing_activity_log will get 4 rows per `run_completed`.

### Server Action `RunSettlementResult` re-export (FIXED)

**Symptom:** `ReferenceError: RunSettlementResult is not defined` on POST /avstemming/run.

**Root cause:** `apps/admin/src/lib/avstemming/actions.ts` had `export type { RunSettlementResult }` in a `"use server"` file. Next.js 16 Server Actions only permit async function exports. Type re-export compiled to runtime value reference.

**Fix:** Removed `export type { RunSettlementResult }` line. Local type `RunSettlementInput` made non-exported.

**Status:** ✅ Applied.

## What was delivered

- `apps/e2e/onboarding/erik/walkthrough.ts` — Playwright headless walkthrough (8 steps, screenshots auto-captured)
- `apps/e2e/onboarding/erik/screenshots/*.png` — 8 real screenshots from live admin app + Supabase Local
- `apps/e2e/onboarding/erik/ONBOARDING.md` — narrative guide for Erik

Run-trigger step (click Kjør avstemming + capture run detail page) is **commented out** in walkthrough.ts pending Bug 3 resolution. Re-enable after schema-drift fix.

## Next sortie — recommended scope

**Title:** `feat/order-system-settlement-fn-schema-drift`

**Migration:** `20260524000000_compute_period_aggregates_invoice_columns.sql`

**Scope:**

1. Audit ALL column references in `compute_period_aggregates` against actual `public.invoice`, `public.invoice_line_item`, `public.payment` schemas.
2. Replace `issue_date` → `issued_at::date`, `due_date` → `due_at::date` (or accept timestamptz comparison and cast `p_period_start::timestamptz`).
3. Verify `public.payment` table exists. If renamed/moved, update join.
4. Re-run M8 walkthrough end-to-end to confirm `run_completed` row + 4 artifacts inserted.
5. Update ONBOARDING.md screenshots with run-detail page (where 4 artifacts visible).
6. Verify `billing_activity_log` has 4 rows for `settlement run_completed` (ADR-0264 acceptance #1 against live DB).
7. Silence telemetry warn for `audit:'billing'` events when actor not in profile (separate package change).

**Estimated effort:** 2-3 hours once schema drift mapping is complete.

**Out of scope:** rewriting compute_period_aggregates from scratch; multi-workspace-per-company semantic decision (separate ADR if it matters).
