---
title: Slice 06 — Contracts · Payroll · Lovsen Audit
status: done
updated: 2026-05-18
created: 2026-05-18
module: contracts-payroll-legal
tags: [audit, adr, contracts, payroll, lovsen, slice-06]
---

# Slice 06 — Contracts · Payroll · Lovsen

**Date:** 2026-05-18
**Scope:** `packages/ai/src/capabilities/contract/`, `packages/ai/src/capabilities/payroll/`, `packages/ai/src/capabilities/legal/`, `services/contract-service/`
**ADRs checked:** 0024, 0076, 0077, 0078, 0079, 0234, 0235, 0241–0245, 0249–0254, 0256–0259

---

## PASS

### Contract capability (contract/tools.ts)
- All 10 tools call `gateMutation()` (C4 gate via `gate_action` RPC) before any write — ADR-0099 satisfied.
- `sendEmployeeContract` additional role check (`admin | owner`) plus pre-flight status guard (`draft` only) — irreversibility acknowledged in comment, ADR-0099 defence-in-depth confirmed.
- Template lifecycle tools (`forkTemplate`, `publishWorkspaceTemplate`, `deprecateWorkspaceTemplate`) carry both `ctx.channel !== 'chat'` Layer-3 guard AND `gateMutation()` — ADR-0078 Layer 2+3 double coverage.
- `explainContractClause` reads `framework_snapshot` verbatim (read-only, no interpretation) — ADR-0244 snapshot integrity preserved.
- `getComplianceDriftForContract` workspace-scoped query; no ADR-0151 violation.
- `emit()` fires on every mutation path (create, send, fork, publish, deprecate) — ADR-0193 four-destination telemetry verified.
- `forkTemplate` ADR-0191 fix documented in inline comment: previously fetched `/api/contract-templates/copy` without auth header (401). Now writes direct via `ctx.supabaseAdmin`. Fix applied.

### Legal capability (legal/tools.ts + amendment-classifier.ts)
- **FP-001 confirmed not a violation.** `validate_aml_14_6` blocks channel when `ctx.channel !== "chat" && ctx.channel !== undefined && ctx.channel !== "system"` — `system` is explicitly allowed for BFF route use. ADR-0078 layered defence is intentional; the channel guard string is the correct `["chat","system"]` union per `legal/index.ts` `allowedChannels`.
- `classify_amendment` correctly blocks any non-system/non-autonomous channel (Layer-3 redundant with Layer-2 `allowedChannels: ["chat","system"]`).
- `validate_aml_14_15` is system-only and gated; ADR-0311 workspace_id-from-ctx satisfied.
- Amendment classifier (`amendment-classifier.ts`) is a pure function — no I/O, no channel guard needed. Decision-order is rule-prioritised (Rule 4 tariff→non-bound fires BEFORE Rule 6 different-union).
- Riksavtalen §4 carve-out (Rule 7: same union + new law_version → UP) correctly modelled; ADR-0252 §F satisfied.
- 15% lønn-reduction threshold for ENDRINGSOPPSIGELSE documented with LEGAL-FRAMEWORK.md §5 citation.
- `cite_law` is a stub returning confidence=LAV with `stub:true` flag — Phase 0c+ placeholder, not a compliance failure.
- `classifyAmendment` in `tools.ts` is the `legalCapability` tool; `classifyAmendmentLogic` in `amendment-classifier.ts` is the exported pure function. Both named exports coexist without collision.

### Payroll capability (payroll/tools.ts)
- All 6 core tools assert `ctx.channel === "chat"` via `assertChatChannel()` before gate call — ADR-0078 Høy-PII chat-only confirmed.
- `viewPersonalNumber` and `viewBankAccount` emit `payroll.personal_number_revealed` / `payroll.bank_account_revealed` on EVERY attempt (gate-denied, not-found, and success paths) — ADR-0077 full audit trail confirmed.
- `view_personal_number`/`view_bank_account` include `was_revealed: false` on denial and `was_revealed: true` on success — audit trail distinguishes "blocked" from "sent to caller".
- ADR-0151 workspace-scoped forgery defence: all PII tools add `.eq("workspace_id", ctx.workspaceId)` to every SELECT.
- Emit `entity_type: "employment_contract"` used on payroll PII tools — this is semantically debatable (profile entity would be more precise) but consistent with existing registry patterns; not a blocking finding.

### Payroll tariff tools (payroll/tariff-tools.ts)
- ADR-0356 delegation pattern fully implemented: payroll gate fires first via `mutateWithGate`, cascade gate fires inside `bindWorkspaceUnionTool.execute()`. Both layers emit with `actor_capability='payroll'` + `delegated_via='cascade'`.
- `classifyAmendmentLogic` imported from `legal/index.ts` — ADR-0173 frozen-4 boundary respected; no parallel heuristic.
- `change_workspace_tariff` reads prev binding before cascade call (APPEND-ONLY ADR-0355 semantics: `effective_to IS NULL` pattern).
- Phase 7h `cascade_emit_id` is read from cascade result (not pre-generated UUID) — correlation chain is real, not synthetic.
- ADR-0134 + L-0177 fail-fast (`workspaceId.trim() === ""`) on all three tariff tools.

### BFF send route (apps/web/src/app/api/contracts/send/route.ts)
- Aml. §14-6 gate fires BEFORE DocuSeal dispatch (line 435); blocks on `pass === false` with 422 + structured `aml_errors[]`.
- `validate_aml_14_6` called with `channel: "system"` — matches `allowedChannels` in legal capability.
- ADR-0244 `framework_snapshot` frozen at send time; ADR-0310 `pdf_preview_viewed_at` server-validated (past-timestamp check + post-persist verification with 422 on failure).
- ADR-0151 enforced: `workspaceId` from JWT profile, `target_profile_id` verified against caller workspace before send.
- C4 `gateAction` called on existing-contract UPDATE (line 322) — ADR-0309 Q-H2 gate confirmed.

### DocuSeal webhook (apps/web/src/app/api/webhooks/docuseal/route.ts)
- HMAC-SHA256 signature verification with `timingSafeEqual` (constant-time) — timing-safe, fail-closed on missing header.
- `contract-service/src/routes/webhooks.ts` is DEPRECATED (marked in file header); canonical handler is the Next.js route. No compliance gap — legacy handler is kept for reference/local dev only; production traffic routes through Next.js.
- Status regression guard present in service-side handler (`STATUS_WEIGHT` map, `newWeight <= currentWeight` skip) — L-0004 satisfied.

---

## FINDINGS

### F-06-01 — MEDIUM: `lønnsgrunnlag` vs `lønnsslipp` label in payroll export (informational)
The payroll tools correctly use "lønnsgrunnlag" terminology in telemetry event names (`payroll.workspace_tariff_setup`, `payroll.update_payroll_profile`). No "lønnsslipp" found in capability layer. Per memory `feedback_lonnsgrunnlag_not_lonnsslipp`, this is clean. No action required.

### F-06-02 — LOW: `legal/index.ts` `allowedChannels` includes `"system"` but `cite_law` description says "chat channel only"
`cite_law` docstring reads: "Available on chat channel only" but `allowedChannels: ["chat", "system"]` permits system channel at Layer 2. The tool body has no Layer-3 channel guard for `cite_law`. System channel would silently call the stub. Low risk (stub returns LAV confidence + `stub:true` flag), but the docstring is misleading per L-0176 discipline.
**Remediation:** Add Layer-3 guard in `cite_law.execute` blocking system channel, or remove "chat channel only" from docstring and accept system-channel access as intentional.

### F-06-03 — LOW: DocuSeal `contract-service/webhooks.ts` no `emit()` call
The deprecated service-side webhook handler (`services/contract-service/src/routes/webhooks.ts`) updates `contract` status and inserts `contract_event` but never calls `emit()`. The canonical Next.js handler does emit. Since the service handler is deprecated this is not production-affecting, but residual code without telemetry is a maintenance trap if the deprecated handler is ever re-enabled.

### F-06-04 — INFORMATIONAL: `classify_amendment` in `legal/tools.ts` is a stub (Phase 0c)
Returns `"admin"` classification for all field changes with `confidence: "LAV"` and explicit warning `"classify_amendment er en stub. Ikke bruk i produksjon."` This is acknowledged Phase 0c scope. The C4 gate (`default_allow: false`) is correctly called even on stub path. No compliance gap; stub state is documented.

---

## CONFIRMED FALSE POSITIVE

**FP-001 (legal/tools.ts:87):** `validate_aml_14_6` channel inversion = intentional ADR-0078 layered defence. System channel explicitly permitted for BFF route use. Not a violation. Confirmed.

---

## SUMMARY

| Area | Status |
|------|--------|
| Contract capability (ADR-0099 gate, ADR-0078 channel, ADR-0193 emit) | PASS |
| Legal capability (validate_aml_14_6, FP-001, ADR-0163) | PASS |
| Amendment classifier (ADR-0235, ADR-0252 §F, Riksavtalen carve-out) | PASS |
| Payroll Høy-PII tools (ADR-0077 audit, ADR-0151 forgery, ADR-0078 chat-only) | PASS |
| Payroll tariff delegation (ADR-0356, ADR-0173, ADR-0355, ADR-0134) | PASS |
| BFF send route (ADR-0244 snapshot, ADR-0310 PDF gate, §14-6 gate) | PASS |
| DocuSeal webhook (HMAC-SHA256, ADR-0249 emit) | PASS |
| lønnsgrunnlag vs lønnsslipp labelling | PASS |

**Findings:** 1 LOW (F-06-02 cite_law docstring vs allowedChannels mismatch), 1 LOW residual (F-06-03 deprecated service webhook no emit), 1 INFORMATIONAL (F-06-04 stub state). No CRITICAL or HIGH findings. No blocking issues for merge.
