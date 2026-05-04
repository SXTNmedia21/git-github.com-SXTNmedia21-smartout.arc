---
title: "Journey — audit-pipeline-fix"
feature: audit-pipeline-fix
branch: feat/order-system-audit-pipeline-fix
status: verified
verified_at: 2026-05-02
created: 2026-05-02
updated: 2026-05-02
module: telemetry
tags: [telemetry, billing, settlement, audit]
---

# Journey — Audit Pipeline Fix

## Journey: Accountant Runs Settlement and Audit Row Is Written

**Precondition:** Accountant is authenticated. Workspace grants are active. Period has not been previously settled.

1. Accountant submits the settlement form → `runSettlement()` server action is called.
2. `executeSettlementRun()` inserts a `settlement_run` row and returns a real UUID `run_id`.
3. Server action emits `settlement run_initiated` with `entity_id: result.run_id` (real UUID). → `billing_activity_log` receives one row with `entity_type = settlement_run`.
4. `executeSettlementRun()` emits `settlement period_locked` per workspace (workspace_id is non-null). → `activity_trail` receives one row per workspace.
5. `executeSettlementRun()` emits `settlement run_completed` with `workspace_id: null`. → `activity_trail` early-returns (deliberate routing boundary). → `billing_activity_log` receives one row with nested entity resolved correctly.
6. Accountant sees settlement result with run_id returned from action.

**Postcondition:** Three audit rows exist: one `run_initiated` + one `run_completed` in `billing_activity_log`; N `period_locked` rows in `activity_trail` (one per workspace).

**Error paths:**
- If `executeSettlementRun` throws before inserting the run row → `run_initiated` is not emitted (no `run_id` available). `run_failed` is emitted by `run.ts` if a `run_id` was assigned before failure.

---

## Journey: Accountant Downloads Settlement Artifact and Audit Row Is Written

**Precondition:** Settlement run exists with status `succeeded`. Artifact row exists in `billing.settlement_artifact`. Accountant initiated the run.

1. Accountant clicks download link for an artifact → `GET /api/avstemming/[run_id]/artifact/[type]` is called.
2. Route verifies accountant identity and run ownership.
3. Route queries `billing.settlement_artifact` selecting `artifact_id, storage_path, artifact_type`.
4. Route generates a 60-second signed URL from Supabase Storage.
5. Route emits `settlement artifact_downloaded` fire-and-forget with `entity_type: settlement_artifact`, `entity_id: artifactRow.artifact_id`. → `billing_activity_log` receives one row.
6. Browser is redirected to signed URL (302). Download begins.

**Postcondition:** One `artifact_downloaded` row in `billing_activity_log` with correct entity reference to the specific artifact (not the run).

**Error paths:**
- Artifact not found → 404, no emit.
- Signed URL generation fails → 500, no emit (emit guard: fire-and-forget, does not affect response).

---

## Journey: Order Download Route Does Not Block Response on Emit

**Precondition:** Order invoice exists. Accountant has access.

1. Accountant requests `GET /orders/[id]/download-csv` or `/download-pdf`.
2. Route authenticates accountant, verifies invoice ownership.
3. `streamOrderCsv` / `streamOrderPdf` is called (currently returns 501 stub until M6).
4. On success path: `void emit(...).catch(console.error)` fires without awaiting. Response is returned immediately.
5. Emit resolves independently — if it fails, only `console.error` is called, the response is not affected.

**Postcondition:** Response is returned without waiting for telemetry. If emit succeeds, `billing_activity_log` receives one row.

**Error paths:**
- Generator throws (current: always 501) → 501 response, emit is never reached (emit is inside try block after generator call).
