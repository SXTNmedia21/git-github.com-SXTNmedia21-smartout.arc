---
title: "Journey — audit-fan-out"
status: done
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [journey, billing, settlement, audit, bokforingsloven, adr-0264]
---

# Journey — audit-fan-out

> Feature: `feat/order-system-audit-fan-out` | ADR: ADR-0264

## Journey: Erik queries settlement run audit row

**Role:** Accountant (Erik)
**Surface:** Platform Admin → Billing → Audit Log

**Precondition:**
- Erik has an active `accountant_company_grant` for company A and company B
- A settlement run has been executed covering 3 workspaces (2 for Company A, 1 for Company B)

### Happy path

1. Platform admin (or scheduled cron) calls `executeSettlementRun` with `workspace_ids: [ws-A1, ws-A2, ws-B1]`
2. System resolves `companyMap: {ws-A1 → company-A, ws-A2 → company-A, ws-B1 → company-B}` via RLS-scoped workspace lookup
3. System emits `settlement period_locked` for each workspace with `data.company_id` set → billing_activity_log single-company path writes 3 rows (one per workspace, each with correct `company_id`)
4. System emits `settlement run_completed` with `data.company_ids: [company-A, company-B]` and `workspace_id: null`
5. `billing_activity_log` provider detects `data.company_ids.length > 0` → enters fan-out path
6. Provider verifies `company-A` exists in DB → inserts row with `company_id: company-A, event: 'settlement run_completed', entity_id: <run_id>, invoice_id: null`
7. Provider verifies `company-B` exists in DB → inserts row with `company_id: company-B, event: 'settlement run_completed', entity_id: <run_id>, invoice_id: null`
8. Erik queries `billing_activity_log WHERE company_id = 'company-A'` → sees 1 `run_completed` row + 2 `period_locked` rows for the run period
9. Erik queries `billing_activity_log WHERE company_id = 'company-B'` → sees 1 `run_completed` row + 1 `period_locked` row

**Postcondition:**
- `billing_activity_log` contains M rows per `run_completed` event (where M = distinct companies in run scope)
- Each row is scoped to one company — Erik's RLS grant exposes only his company's rows
- `invoice_id` is NULL on run lifecycle rows (correct — no invoice for a run-level event)
- No `console.warn "Could not resolve company_id"` in system logs

### Error path: settlement run fails

1. System calls `executeSettlementRun`; `compute_period_aggregates` throws
2. Catch block emits `settlement run_failed` with `data.company_ids: Array.from(new Set([...companyMap.values()]))`
3. Fan-out path writes M rows to `billing_activity_log` with `event: 'settlement run_failed'`
4. Erik queries audit log → sees the failed run rows per company, with `data.error` containing the error message (truncated to 500 chars)

**Postcondition:** Failed runs appear in the audit log with correct company scoping. Bokføringsloven §10 coverage is intact even for failures.

### Error path: unknown company_id in fan-out

**Precondition:** A company_id in `data.company_ids` is stale (company deleted between run and emit)

1. Provider iterates `data.company_ids`; for the stale ID:
   - DB lookup returns `null`
   - Provider logs `console.warn "[telemetry.billing_activity_log] fan-out: company <cid> not found..."`
   - Row is skipped (no insert)
2. All other company_ids proceed normally
3. `Promise.allSettled` ensures partial failure does not abort the remaining inserts

**Postcondition:** At least M-1 rows written. Stale company ID is warned and skipped — no unhandled exception, no business logic disruption.

### Error path: DB insert fails for one company

1. Provider attempts insert for company-A → DB returns error
2. Provider logs `console.error "[telemetry.billing_activity_log] fan-out insert failed..."`
3. Provider continues with company-B → insert succeeds
4. `Promise.allSettled` semantics: no throw, no re-raise

**Postcondition:** At least M-1 rows written. Single insert failure does not block business logic.

---

## Acceptance Criteria (from ADR-0264 §"Acceptance Criteria")

1. Running `executeSettlementRun` in local Supabase with N workspaces across M companies produces exactly M rows in `billing_activity_log` with `event = 'settlement run_completed'` and `entity_id = <run_id>`. **✓ covered by run.audit.spec.ts test 1**
2. A settlement run that throws produces exactly M rows with `event = 'settlement run_failed'`. **✓ covered by run.audit.spec.ts test 3**
3. Each `period_locked` emit produces exactly 1 row with correct `company_id`. **✓ covered by run.audit.spec.ts test 2**
4. No `console.warn "Could not resolve company_id"` in logs during successful run. **✓ covered by run.audit.spec.ts test 4**
5. Existing `billing_activity_log` provider tests pass without modification. **✓ all 17 telemetry test files green**
6. `pnpm turbo typecheck` passes with 0 errors in scope. **✓ telemetry + billing 0 errors**
