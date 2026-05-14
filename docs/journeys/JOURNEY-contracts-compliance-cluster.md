---
title: "Journey — Contracts Compliance Cluster"
feature: contracts-compliance-cluster
status: verified
created: 2026-05-14
updated: 2026-05-14
module: contracts
tags: [sma-306, sma-307, sma-310, sma-311, compliance, pdf-gate, aml-14-6, gate-action]
---

# Journey: Contracts Compliance Cluster

Four user journeys covering SMA-306 (§14-6 rule-driven validation), SMA-307 (Walt fallback removal),
SMA-310 (PDF gate server-enforce), and SMA-311 (singular-path bypass closure).

Status: `in_progress` — E2E pgTAP not yet run. Mark `verified` when green.

---

## Journey A: Attacker Forges Singular-Path Bypass — REJECTED

**Scenario:** An attacker or unauthorized employee POSTs directly to a contract mutation route
(e.g. `POST /api/employment-contracts/[id]/regenerate`) without going through the UI.

**Precondition:**
- Attacker has a valid JWT (is a workspace member, but not admin)
- A draft `employment_contract` row exists for a target employee

**Steps:**
1. Attacker POSTs to `/api/employment-contracts/<contract_id>/regenerate` with a valid JWT.
   → System loads actorProfile from JWT.
2. System checks role: `actorProfile.role` is `employee` (not admin/owner).
   → System returns 403 `Forbidden: admin or owner role required`.
3. If attacker is admin but capability is denied by authority config:
   → System calls `gateAction({ capability: 'contract', actionType: 'regenerate', ... })`.
   → `gate_action` RPC returns `allow: false`.
   → System emits `gate.contract_send_denied` (activity_trail audit).
   → Returns 403 `{ error: "gate_denied", reason: "...", denied_by: "gate_action" }`.

**Postcondition:**
- No `employment_contract` mutation occurred.
- `gate.contract_send_denied` event in `activity_trail` (audit trail).
- `frame_rule` rows unchanged.

**Error paths:**
- If `gate_action` RPC errors: `gateAction` returns `allow: false` with `gate_action_rpc_error` reason → same 403.

---

## Journey B: Malformed §14-6 Contract — REJECTED with Bokstav List

**Scenario:** Admin tries to dispatch a contract where required §14-6 fields are missing.

**Precondition:**
- Admin has a valid JWT with admin/owner role
- Draft `employment_contract` row exists with `position_title = NULL` and `start_date = NULL`
- Workspace has `hospitality.no.default.v1` framework binding

**Steps:**
1. Admin opens ContractDispatchDrawer, completes blocks, views PDF, clicks "Send kontrakt".
2. Client POSTs to `/api/contracts/send` with `pdf_preview_viewed_at`, `blocks_acknowledged`, etc.
3. Server validates PDF gate timestamp (passes).
4. Server runs `gateAction({ actionType: 'send_dispatch' })` → allowed.
5. Server UPSERTs contract with `status: 'ready_to_send'` + `pdf_preview_viewed_at`.
6. Server calls `validateAml146({ contract_id, validation_mode: 'strict' })`.
7. `validateAml146` loads 17 `framework_rule` rows (aml.14_6.a–q from hospitality framework).
8. Evaluates bokstav c (position_title) → NULL → error.
9. Evaluates bokstav d (start_date) → NULL → error.
10. Returns `{ pass: false, status: 'missing_fields', errors: [{bokstav:'c',...}, {bokstav:'d',...}], bokstaver_failed: ['c', 'd'] }`.
11. Server returns 422: `{ error: "Kontrakten oppfyller ikke...", aml_errors: [...], aml_status: "missing_fields" }`.
12. Drawer renders: "Mangler etter §14-6: c (Stilling), d (Tiltredelsesdato)."

**Postcondition:**
- Contract NOT dispatched to DocuSeal.
- Contract status remains `ready_to_send` (was updated pre-gate, rollback not implemented — admin must fix fields).
- `legal.aml_14_6.validated` event emitted with `pass: false`, `bokstaver_failed: ['c','d']`.

**Error paths:**
- If `framework_rule` rows are missing (migration not applied): validator returns 422 `skip` status.
- If `validation_mode: 'advisory'`: same checks but `severity: 'warning'` → `pass: true` → dispatch proceeds.

---

## Journey C: Walt-Disabled Production Path — 503, Not Stub-Row

**Scenario:** Production environment, `CONTRACT_SERVICE_URL` not configured or contract-service down.

**Precondition:**
- `isContractServiceConfigured()` returns false OR contract-service returns non-2xx
- All other gates pass (PDF gate, §14-6, gateAction)
- No `CONTRACT_SERVICE_DEV_FALLBACK` env var exists (removed by SMA-307)

**Steps:**
1. All pre-dispatch gates pass (PDF gate, gateAction, §14-6 validation).
2. Server checks `isContractServiceConfigured()` → false.
3. `sendSucceeded` remains `false`.
4. Server emits `contract.send_failed.service_down`.
5. Server returns 503:
   ```json
   {
     "error": "Kontrakt-tjenesten er utilgjengelig...",
     "code": "CONTRACT_SERVICE_DOWN",
     "retry_after_seconds": 60
   }
   ```
6. Client drawer shows toast: "Kontrakt-tjenesten er utilgjengelig akkurat nå. Prøv igjen om 1 minutt."
   (with "Prøv nå" retry action button).

**Postcondition:**
- NO `contract` row inserted into signing table.
- `employment_contract.status` remains `ready_to_send` (set pre-dispatch).
- `employment_contract.signing_contract_id` remains NULL.
- `contract.send_failed.service_down` event in activity_trail + posthog.

**Error paths:**
- Same path applies in local dev (no synthetic stub row ever created).
- E2E tests that need a signed state must INSERT stub `contract` row directly via admin client.

---

## Journey D: Missing `pdf_preview_viewed_at` — REJECTED

**Scenario:** Scripted client POSTs to `/api/contracts/send` without `pdf_preview_viewed_at` field
(or with a future timestamp) — bypass attempt.

**Precondition:**
- Actor has valid JWT with admin/owner role
- Draft contract exists

**Steps — missing field:**
1. Client POSTs body without `pdf_preview_viewed_at`.
2. Zod `SendBodySchema.safeParse()` fails — `pdf_preview_viewed_at` is required.
3. Server returns 400: `{ error: "Required" }`.
4. (No bypass — Zod blocks before any gate or validation.)

**Steps — future timestamp:**
1. Client POSTs `pdf_preview_viewed_at: "2030-01-01T00:00:00Z"`.
2. Zod passes (valid ISO datetime string).
3. Server parses: `new Date("2030-01-01T00:00:00Z") > new Date()` → true.
4. Server returns 422:
   ```json
   {
     "error": "pdf_preview_viewed_at must be a valid past timestamp",
     "code": "INVALID_PDF_GATE",
     "i18n_key": "contracts.send.errors.invalid_pdf_gate"
   }
   ```

**Steps — not persisted (infrastructure failure):**
1. All validations pass. UPDATE fires.
2. Post-persist SELECT returns `pdf_preview_viewed_at: null` (RLS rewrote or UPDATE failed silently).
3. Server emits `contract.pdf_gate.bypassed_attempt` (reason: "not_persisted").
4. Server returns 422: `{ code: "PDF_GATE_NOT_PERSISTED" }`.

**Postcondition:**
- Contract NOT dispatched.
- `contract.pdf_gate.bypassed_attempt` emitted to `activity_trail` (attack signal).
- No notification sent to employee.
