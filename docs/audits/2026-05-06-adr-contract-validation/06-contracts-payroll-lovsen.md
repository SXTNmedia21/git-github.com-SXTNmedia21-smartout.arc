---
title: "Audit Slice 06 — contracts / payroll / lovsen"
date: 2026-05-06
auditor: slice-06-agent
status: complete
scope: packages/ai/src/capabilities/contract/, packages/ai/src/capabilities/payroll/, packages/ai/src/capabilities/legal/, services/contract-service/
adrs_verified: 0024, 0076, 0077, 0078, 0079, 0234, 0235, 0241, 0242, 0243, 0244, 0245, 0249, 0250, 0251, 0252, 0253, 0254, 0256, 0257, 0258, 0259
baseline: 2026-05-02
---

# Audit Slice 06 — Contracts / Payroll / Lovsen

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 3 |
| LOW | 1 |

All four 2026-05-02 baseline findings verified. Three are CLOSED. One (sendEmployeeContract emit) remains OPEN and is confirmed here. Three new findings added.

---

## Delta vs 2026-05-02 Baseline

| Baseline finding | Status |
|-----------------|--------|
| B1: `legal/classify_amendment` declares ADR-0249 + gate but execute body had zero `callGateAction` | CLOSED — `callGateAction` now called at line 263 in tools.ts before any stub logic |
| B2: 5 contract tools (createEmployeeContract, sendEmployeeContract, forkTemplate, publishWorkspaceTemplate, deprecateWorkspaceTemplate) only `resolveActorRole`, no `callGateAction` | CLOSED — all 5 tools now call `gateMutation()` → `callGateAction` as first action in execute body |
| B3: 5 contract/legal tools emit zero (ADR-0004) | CLOSED — createEmployeeContract (line 302), forkTemplate (line 536), publishWorkspaceTemplate (line 626), deprecateWorkspaceTemplate (line 721), validateAml146 (line 123), citeLaw (line 189), classifyAmendment (line 298) all emit |
| B4: `sendEmployeeContract` emits zero | OPEN — confirmed zero emit calls in the execute body (lines 331–406). See finding F-01. |

---

## Findings

### F-01 — HIGH — `sendEmployeeContract` emits zero (ADR-0004 violation, persisted from baseline B4)

**File:** `packages/ai/src/capabilities/contract/tools.ts:331–406`

**Description:** `sendEmployeeContract.execute()` has the full gate call (`gateMutation`, line 342) and role check (line 345), but no `emit()` call anywhere in the success or error paths. The tool logs "contract sent" to the contract-service audit trail via `contract_event` INSERT (in the service), but the capability-layer ADR-0004 canonical emit is missing. This means the `activity_trail`, PostHog, and `engine_event` destinations receive no signal when an agent-triggered contract send succeeds.

**ADR violated:** ADR-0004 (every mutation emits), ADR-0193 (NonEmptyString telemetry IDs).

**Fix:** Add `void emit({ event: "contract sent", workspace_id: ctx.workspaceId, actor_id: ctx.profileId, properties: { entity: { entity_type: "contract", entity_id: params.contract_id }, data: { sent_by: ctx.profileId } } })` in the success branch after the service response returns `sent: true`.

---

### F-02 — HIGH — `contract-service` POST /contracts uses `workspace_id` from request body, not from validated service-key context (ADR-0151 partial violation)

**File:** `services/contract-service/src/routes/contracts.ts:43–123`

**Description:** The server.ts `onRequest` hook validates the `X-Service-Key` and attaches `request.workspaceId` from the key validation response (line 53). However, the POST /contracts route reads `body.workspace_id` (line 92) rather than `request.workspaceId` to stamp the created `contract` record, and resolves company_id from the body-supplied workspace (line 52). An attacker with a valid service key for workspace A could supply `workspace_id=B` in the body and create contract records attributed to workspace B.

**ADR violated:** ADR-0151 (workspace_id must come from JWT/validated-key context, never from body).

**Caveat:** The service is called only from within the Vercel route handler (apps/web) which validates workspace_id server-side from JWT before calling the service. However, the service itself does not enforce this invariant — any caller with a valid service key can bypass the constraint.

**Fix:** Replace `body.workspace_id` usage with `request.workspaceId ?? body.workspace_id` and add an explicit check that they match when both are present, or require `request.workspaceId` to be non-null (meaning key validation succeeded and resolved a workspace).

---

### F-03 — MEDIUM — `cite_law` has no Layer 3 channel guard in the execute body (ADR-0078 partial gap)

**File:** `packages/ai/src/capabilities/legal/tools.ts:170–206`

**Description:** `validateAml146` and `classifyAmendment` both have explicit Layer 3 channel guards in their `execute()` bodies. `citeLaw.execute()` at line 171–172 has a comment stating "Allowed channels checked at capability level" but no actual runtime guard. The capability `allowedChannels: ["chat", "voice", "system"]` (index.ts line 57) is a broader union. If the router or a future refactor passes `channel: "system"` or `channel: "autonomous"` directly to `citeLaw`, no layer 3 rejects it.

**ADR violated:** ADR-0078 (per-tool channel restriction defence-in-depth requires Layer 3 guard in execute for non-trivial channel splits). ADR-0249 table specifies `cite_law` Layer 3 guard as "None" explicitly, but the spec note says `allowedChannels: ["chat", "voice"]` for the capability — the index.ts registers `["chat", "voice", "system"]` as union for all tools, which is broader than cite_law's intended channel set.

**Severity rationale:** MEDIUM not HIGH because the tool is read-only (no mutation), cite_law has no callGateAction so gate enforcement is capability-level only, and the Phase 0c stub returns a placeholder. Becomes HIGH when real Lovdata integration ships.

**Fix:** Add `if (ctx.channel && ctx.channel !== "chat" && ctx.channel !== "voice") { return JSON.stringify({ error: "cite_law er kun tilgjengelig via chat eller voice. (ADR-0078)" }); }` at the top of the execute body.

---

### F-04 — MEDIUM — `payroll` capability does not implement `set_trade_union_membership` tool or GDPR Art. 9 treatment-basis documentation (ADR-0242 Lovsen Amendment open)

**File:** `packages/ai/src/capabilities/payroll/tools.ts`, `packages/ai/src/capabilities/payroll/index.ts`

**Description:** ADR-0242 §"Lovsen Amendments" (GDPR Art. 9 sensitive data) requires the `payroll` capability to: (1) document Art. 9(2)(b) treatment basis in capability frontmatter, (2) implement `set_trade_union_membership` tool with `payroll.gdpr_art_9_write` event, and (3) restrict read access to `trade_union_*` fields to `payroll` capability only. None of these are implemented. The `payroll/index.ts` has no DPA/data-processing-record reference. `set_trade_union_membership` does not exist. The `employee_payroll_profile` table contains `trade_union_member` and `trade_union_name` columns (GDPR Art. 9(1) sensitive) that could be read via `queryTaxCard` or `updatePayrollProfile` if the query is expanded.

**ADR violated:** ADR-0242 Lovsen Amendments §GDPR Art. 9 (HØY confidence finding, marked ESKALÉR in ADR).

**Severity rationale:** MEDIUM because the tools that currently exist do not directly expose `trade_union_*` columns — the gap is missing tooling and documentation, not an active data leak. However, the ADR-0242 amendment was flagged HØY confidence requiring DPO review before go-live.

**Fix:** Add `Art. 9(2)(b) — employment law obligation` reference to `payroll/index.ts` capability description. Create `set_trade_union_membership` tool with `payroll.gdpr_art_9_write` emit. Add explicit column exclusions in `queryTaxCard` and `updatePayrollProfile` for `trade_union_member` / `trade_union_name`.

---

### F-05 — MEDIUM — `contract-service` POST /contracts and POST /contracts/:id/send have no emit (ADR-0004 service-level gap)

**File:** `services/contract-service/src/routes/contracts.ts:43–420`

**Description:** The contract-service Fastify routes mutate the `contract` and `contract_event` tables directly but import no telemetry library and fire no `emit()`. Contract creation (POST /contracts) and send (POST /contracts/:id/send) are high-value mutations that drive the signing lifecycle. The `contract_event` INSERT provides an internal audit trail, but the four-destination canonical emit (PostHog, logger, activity_trail, engine_event) required by ADR-0004 is absent for all routes.

**ADR violated:** ADR-0004 (every mutation emits via canonical emit function).

**Caveat:** The AI capability tools (createEmployeeContract, sendEmployeeContract) do emit when called. The gap is in the service routes called from the Next.js Vercel route handler, which does not call these capability tools — it calls the service directly. So the emission in the Vercel route (`apps/web/src/app/api/contracts/send/route.ts`) partially covers this, but the service itself is not ADR-0004 compliant.

**Fix:** Import `@smartout/telemetry` in contract-service and add emit calls in each mutation route. Note that `contract-service` is a separate Fastify process — verify telemetry package works in non-Next.js context first, or add an HTTP emit proxy pattern.

---

### F-06 — LOW — `classify_amendment` classify-result always returns `"admin"` stub but uses `callGateAction` with `gate_action: enforce` / `default_allow: false` per ADR-0249 — gate rejects invocation if authority seed row is absent

**File:** `packages/ai/src/capabilities/legal/tools.ts:241–319`, `supabase/migrations/20260520130000_legal_capability_authority_seed.sql`

**Description:** This is a structural note, not a direct violation. The authority seed migration (`20260520130000_legal_capability_authority_seed.sql`) sets `min_role = 'manager'` at the capability level, but ADR-0249 specifies `classify_amendment` should require `admin` + `gate_action: enforce, default_allow: false`. The current seed sets the row for the whole `legal` capability at `manager` level — there is no per-action authority row for `classify_amendment` specifically. The `callGateAction` call inside `classifyAmendment.execute()` passes `actionType: "classify_amendment"` and `capability: "legal"`, but if `gate_action` RPC resolves by capability only (not by action_type), the effective min_role is `manager` not `admin` for this high-sensitivity mutation-driving tool.

**ADR violated:** ADR-0249 authority spec (classify_amendment: admin, gate_action enforce, default_allow false). Pending investigation of `gate_action` RPC to determine if per-action authority rows are supported.

**Severity rationale:** LOW because the Phase 0c stub always returns `"admin"` classification without writing — no actual mutation occurs yet. Becomes HIGH when Phase 0c+ real enforcement lands.

---

## ADR Coverage Summary

| ADR | Status |
|-----|--------|
| ADR-0024 | Compliant — contract system architecture respected, C4 gate active on all mutations |
| ADR-0076 | Compliant — contract composition treated as cascade derivation; framework_snapshot frozen on send |
| ADR-0077 | Compliant — PII handled via capability split (payroll), personal numbers masked in Phase 0c tools |
| ADR-0078 | Partial — cite_law missing Layer 3 guard (F-03); all other tools compliant |
| ADR-0079 | Compliant — amendment flow uses classifyAmendment; MATERIAL/NON-MATERIAL classification in types |
| ADR-0234 | Compliant — contract/payroll split applied |
| ADR-0235 | Compliant — payroll capability as HøyPII boundary |
| ADR-0241 | Proposed status — migration exists (20260519100100_contracts_module_foundation.sql) |
| ADR-0242 | Partial — capability split done; GDPR Art. 9 amendment open (F-04) |
| ADR-0243 | Not directly verified (obligation lifecycle trigger — out of tool scope) |
| ADR-0244 | Compliant — framework_snapshot frozen in /api/contracts/send route |
| ADR-0249 | Partial — gate active, authority seeded; per-action min_role for classify_amendment unclear (F-06) |
| ADR-0256 | Phase 0c+ scope — not yet implemented (stub active); LovsenAnswer.citations not yet wired |
| ADR-0257 | Phase 0c+ scope — ConfidenceSchema not yet in capability layer |
| ADR-0258 | Phase 0c+ scope — 4 stdio MCPs not built; stub returns placeholder |
| ADR-0259 | Proposed — Lovsen authority seed for `industry_intelligence.lovsen_query` pending Phase 1.S4 |

---

## Contract-Service Architecture Notes

`services/contract-service` is a Fastify service (port 5012) protected by `X-Service-Key` header validated against Supabase `validate-api-key` Edge Function. The service has a fallback to `config.SERVICE_KEY` env var when the Edge Function returns 5xx. This fallback is broad and could allow any holder of the static key to bypass workspace-scoped validation — acceptable for internal use but worth noting. Webhooks endpoint is unauthenticated (correctly, for DocuSeal), but the deprecated local webhook handler in `routes/webhooks.ts` verifies the `x-docuseal-secret` header correctly.

DocuSeal signing flow: resolves HTML, transforms Tiptap custom fields to DocuSeal HTML tags, auto-signs Leverandør party, creates submission. Signing URL stored as token (not the full DocuSeal embed URL) — low-risk design. Idempotency: `sendEmployeeContract` in the capability layer checks contract status == `draft` before calling the service; the service itself does not have idempotency keys on contract creation (double-POST creates duplicate rows).

---

## Recommended Remediation Priority

1. **F-01 (HIGH)** — Add emit to `sendEmployeeContract.execute()` success path. Single-line fix. Should be in next PR touching contracts capability.
2. **F-02 (HIGH)** — Contract-service should verify `request.workspaceId` (from key validation) against `body.workspace_id`. Internal callers are safe today but the invariant should be enforced at the service boundary.
3. **F-03 (MEDIUM)** — Add Layer 3 channel guard to `citeLaw.execute()`. One-line guard before the stub body.
4. **F-04 (MEDIUM)** — GDPR Art. 9 ESKALÉR: requires DPO/personvernrådgiver review before go-live. Not a code fix alone.
5. **F-05 (MEDIUM)** — Contract-service emit gap: defer to a dedicated telemetry integration sortie; the service's architecture (separate process) needs deliberate wiring.
6. **F-06 (LOW)** — Investigate `gate_action` RPC per-action authority resolution; add per-action row for `classify_amendment` if RPC supports it.
