---
title: Slice 06 — Contracts · Payroll · Lovsen Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: contracts-payroll-legal
tags: [audit, adr, contracts, payroll, lovsen, slice-06]
---

# Slice 06 — Contracts · Payroll · Lovsen

**Date:** 2026-05-20
**Scope:** `packages/ai/src/capabilities/contract/`, `packages/ai/src/capabilities/payroll/`, `packages/ai/src/capabilities/legal/`, `services/contract-service/`
**ADRs checked:** 0024, 0076, 0077, 0078, 0079, 0234, 0235, 0241–0245, 0249–0254, 0256–0259
**Baseline:** 2026-05-18-adr-contract-validation-02/06-contracts-payroll-lovsen.md

---

## Summary

Top findings ranked by severity:

1. **MEDIUM F-06-05** — `cite_law` returns bare `"LAV"` confidence string; ADR-0257 mandates the full `Confidence` object (`score`, `reasons`, `stale_paragraph`, `missing_data`) from `@smartout/lovsen-contract`. Type contract package exists but is never imported by `legal/tools.ts`.
2. **LOW F-06-06** — `legal/index.ts` lines 10 + 71 still say "chat + voice" for `cite_law` post F-CL-14 fix (commit f61991a96 updated `tools.ts` only); `allowedChannels: ["chat","system"]` at line 77 contradicts both stale comments.
3. **LOW F-06-03 (persists)** — Deprecated `services/contract-service/src/routes/webhooks.ts` still lacks `emit()` call. Production canonical path (Next.js DocuSeal webhook) is compliant; residual code is maintenance trap.
4. **INFO F-06-04 (persists)** — `classify_amendment` stub returns `"admin"` for all field changes; `cite_law` stub returns `"LAV"` for all queries. Phase 0c scope; C4 gates correct on both.
5. **INFO** — New `POST /api/payroll/consent-documents` route (court_order) uses `capability: "payroll"` which is seeded (`confirm/admin`). `actionType: "create_consent_document"` is logged to `gate_evaluation` via RPC but no per-action-type row required — `gate_action` queries only by `(workspace_id, capability)`. No default-allow gap.

---

## Findings table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| F-06-05 | MEDIUM | `packages/ai/src/capabilities/legal/tools.ts:406–416` | ADR-0257 | `cite_law` returns `{ confidence: "LAV", stub: true }` — not a `Confidence` object (no `score`, `reasons`, `stale_paragraph`, `missing_data`); `@smartout/lovsen-contract` has canonical type but zero import call-sites in `packages/ai/` |
| F-06-06 | LOW | `packages/ai/src/capabilities/legal/index.ts:10,71` | L-0176 | Line 10 comment: `cite_law (chat + voice)`; line 71 description: `"cite_law: chat + voice reference tool"` — both contradict `allowedChannels: ["chat","system"]` at line 77 and line 16 (`chat only`). F-CL-14 fix (commit f61991a96) updated `tools.ts` but missed `index.ts`. |
| F-06-03 | LOW | `services/contract-service/src/routes/webhooks.ts:1` | ADR-0193 | DEPRECATED handler updates `contract` status + inserts `contract_event` with zero `emit()` calls. Production canonical path (Next.js) is compliant. Residual code is a re-enable trap. |
| F-06-04 | INFO | `packages/ai/src/capabilities/legal/tools.ts:507–525` | — | `classify_amendment` stub; `cite_law` stub. Phase 0c acknowledged. C4 gate correctly called on both paths. |

---

## Per-ADR rollup

| ADR | Topic | Status | Notes |
|-----|-------|--------|-------|
| 0024 | Contract system architecture | ✅ | Contract capability + BFF send route + webhooks coherent |
| 0076 | Contract composition as cascade derivation | ✅ | No drift found |
| 0077 | Contract intake PII handling | ✅ | `view_personal_number` + `view_bank_account` emit on all paths; `was_revealed` flag present |
| 0078 | Engine process channel restriction | ✅ (⚠️ doc) | Code enforces chat-only / system-only correctly; F-06-06 is doc-only |
| 0079 | Employment vs platform contracts | ✅ | No mixing found |
| 0234 | Helpdesk SLA phase 2 | ✅ | Not impacted by slice surface |
| 0235 | Helpdesk breach handler | ✅ | Not impacted by slice surface |
| 0241 | Contract schema migration foundation | ✅ | No new violations |
| 0242 | Contract/payroll capability split | ✅ | Boundaries respected; legal as third sibling intact |
| 0243 | Obligation lifecycle trigger semantics | ✅ | Not impacted |
| 0244 | Amendment flow acknowledgement | ✅ | `framework_snapshot` frozen at send time in BFF; no drift |
| 0245 | Employee contract mobile flow | ✅ | authoring tools stay web-only per ADR-0133 channel guard |
| 0249 | Legal capability fifth sibling | ✅ | Authority seed confirmed; legal/index.ts channel contract intact |
| 0250 | Skatteetaten integration | ✅ | Phase 7 deferred; `tax_card_fetched_at` manual timestamp present; ADR-0250 deferral noted in tests |
| 0251 | Shift pay calculation audit | ✅ | Not in slice surface |
| 0252 | Riksavtalen versjonering migration policy | ✅ | Riksavtalen §4 carve-out (Rule 7) in amendment-classifier confirmed present |
| 0253 | Lærling kontrakter | ✅ | Status: proposed (not yet accepted); `employment_form='apprentice'` UI-blocked per ADR-0241 |
| 0254 | Overtime cap default scope | ✅ | Not in slice surface |
| 0256 | Lovsen citation contract | ⚠️ | `cite_law` stub returns minimal shape; full citation object (verbatim text + hash + fetched_at per ADR-0256) not yet implemented. Phase 0c+ scope, not a regression. |
| 0257 | Lovsen confidence model | ⚠️ | See F-06-05 — `Confidence` type from `@smartout/lovsen-contract` not used; bare string returned |
| 0258 | Lovsen MCP boundary | ✅ | Lovdata MCP not yet connected; stub flag explicit; no premature coupling found |
| 0259 | Lovsen capability authority | ✅ | FP-005 confirmed (see below): `legal` capability is ADR-0249; `industry_intelligence.lovsen_query` is future ADR-0259 unshipped |

---

## PASS (unchanged from baseline)

### Contract capability (contract/tools.ts)
- All 5 mutation tools call `gateMutation()` (wraps `callGateAction`) before any write — ADR-0099 satisfied.
- `sendEmployeeContract` telemetry emit added (commit 37a091f0c) covering all 4 destinations — previous HIGH gap closed.
- `explainContractClause` read-only; `getComplianceDriftForContract` workspace-scoped.
- Template lifecycle tools (`forkTemplate`, `publishWorkspaceTemplate`, `deprecateWorkspaceTemplate`) carry `ctx.channel !== "chat"` Layer-3 guard + `gateMutation()`.
- `emit()` on every mutation path with `entity_type: "contract"`.

### Payroll capability (payroll/tools.ts)
- All tools call `assertChatChannel()` as Layer-3 defence-in-depth before `callGateAction`.
- PII tools (`viewPersonalNumber`, `viewBankAccount`) emit `payroll.personal_number_revealed` / `payroll.bank_account_revealed` on every attempt including denied + not-found paths.
- ADR-0151 workspace forgery defence: `.eq("workspace_id", ctx.workspaceId)` on every SELECT.
- Pattern B feriepenger recalc wired into `override_calculation_line`, `add_manual_supplement`, `delete_manual_supplement` via `computeFeriepengerBasis` from `@smartout/payroll-export`. Emits `payroll.feriepenger_basis_computed` on every mutation path — ADR-0293/ADR-0295 compliant.
- New `POST /api/payroll/consent-documents` (court_order): ADR-0151 server-derived workspace, L-0177 fail-fast on profile not found, `gateAction` before INSERT, `emit()` with `nonEmpty()` guards — compliant.

### Payroll tariff tools (payroll/tariff-tools.ts)
- ADR-0356 delegation pattern intact: payroll gate fires first via `mutateWithGate`, cascade gate fires inside cascade tool.
- L-0177 fail-fast (`workspaceId.trim() === ""`) present on all three tariff tools at lines 214, 221, 485, 492, 802, 809.
- `classifyAmendmentLogic` imported from `legal/index.ts` — ADR-0173 frozen-4 boundary respected.
- ADR-0355 APPEND-ONLY semantics: `effective_to IS NULL` pattern confirmed.
- Phase 7h `cascade_emit_id` round-trip confirmed (commit ca89c216c).

### Legal capability (legal/tools.ts)
- `validate_aml_14_6` rule-driven body (17 bokstaver a–q); L-0177 fail-fast on contract/workspace mismatch; emit includes `bokstaver_failed[]`, `rule_count`, `validator_version` (Q-H3).
- FP-001 still intentional: `validate_aml_14_6` channel guard allows `"system"` for BFF route — ADR-0078 layered defence.
- `classify_amendment` C4 gate called with `default_allow: false` even on stub path — correct.
- `validate_aml_14_15` (ADR-0311): system-only channel guard, L-0177 fail-fast, delegates to `validateAml1415Logic` pure function, `emit()` with `workspace_id`/`actor_id` from ctx.

### BFF send route + DocuSeal webhook
- ADR-0244 `framework_snapshot` frozen at send time; ADR-0310 `pdf_preview_viewed_at` server-validated.
- ADR-0151 `workspaceId` from JWT; `target_profile_id` cross-checked before send.
- DocuSeal Next.js webhook: HMAC-SHA256 constant-time verification; `emit()` present.
- F-CL-15 fix (commit 36946c860) in `contract-service/routes/contracts.ts` confirmed: cross-workspace body mismatch returns 409.

---

## Verified intentional

**FP-001** — `validate_aml_14_6` channel guard: `ctx.channel !== "chat" && ctx.channel !== undefined && ctx.channel !== "system"`. System allowed for BFF use. ADR-0078 layered defence. Confirmed.

**FP-005** — `engine_authority_config.capability='legal'` (ADR-0249, shipped) vs `industry_intelligence.lovsen_query` (ADR-0259, future, no code references). Not a default-allow gap. Confirmed.

---

## In-progress (mid-campaign)

Payroll campaign (`campaign/payroll`) is active. Commits ca89c216c (Phase 7h cascade_emit_id) and 12c9f4ab8 (Pattern B feriepenger) are merged to development. No in-progress violations; all new patterns are compliant.

---

## Delta vs baseline (2026-05-18)

| Baseline finding | Status |
|-----------------|--------|
| F-06-02 (LOW) cite_law docstring chat+voice | FIXED in tools.ts by f61991a96; new LOW F-06-06 for index.ts residue |
| F-06-03 (LOW) deprecated webhook no emit | Persists — still deprecated, not re-enabled |
| F-06-04 (INFO) classify_amendment stub | Persists — Phase 0c scope |
| NEW F-06-05 (MEDIUM) ADR-0257 confidence type drift | New finding |
| NEW F-06-06 (LOW) index.ts stale voice comments | New finding |
