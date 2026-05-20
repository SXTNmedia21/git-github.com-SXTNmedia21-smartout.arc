---
title: "Slice 06 — Contracts / Payroll / Lovsen"
status: complete
created: 2026-05-20
updated: 2026-05-20
audit_run: 2026-05-20-adr-contract-validation-02
baseline: 2026-05-20-adr-contract-validation/00-SYNTHESIS.md
slice: "06 of 14"
surfaces:
  - packages/ai/src/capabilities/contract/
  - packages/ai/src/capabilities/payroll/
  - packages/ai/src/capabilities/legal/
  - services/contract-service/
adrs_checked: [0024, 0076, 0077, 0078, 0079, 0234, 0235, 0241, 0242, 0243, 0244, 0245, 0249, 0250, 0251, 0252, 0253, 0254, 0256, 0257, 0258, 0259]
tags: [audit, contracts, payroll, legal, lovsen]
---

# Slice 06 — Contracts / Payroll / Lovsen

## Summary

| Severity | Count | vs Baseline |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 1 | (F-06-05, carry-forward from baseline) |
| LOW | 2 | (F-06-03, F-06-04, carry-forward from baseline) |
| INFO | 1 | (deprecated webhook route still registered) |
| **Total** | **4** | Baseline F-06-02 confirmed closed; F-06-03/04/05 unchanged open |

**Verdict: GREEN — no new findings. Zero regressions. F-06-05 (MEDIUM) is the only active issue; F-06-03/04 remain open stubs. Slice is safe to promote.**

---

## Findings

### F-06-05 — MEDIUM — CARRY-FORWARD (open)

**cite_law returns bare string confidence, not ADR-0257 Confidence object**

- **File:** `packages/ai/src/capabilities/legal/tools.ts:406–435`
- **ADR:** ADR-0257 (Lovsen Confidence Model)
- **Status:** Unchanged from baseline 2026-05-20 synthesized as F-06-05 MEDIUM

`cite_law.execute()` returns:
```
{ confidence: "LAV" as const, ... }
```
This is a bare `"LAV"` string literal. ADR-0257 mandates a `Confidence` object from `@smartout/lovsen-contract` with dual representation:
```
{ level: "LAV", score: number, stale_paragraph: boolean, missing_data: string[] }
```
The `@smartout/lovsen-contract` package exists (`packages/lovsen-contract/src/confidence.ts`) but is not imported anywhere in `capabilities/legal/`. The `confidence: "LAV"` literal bypasses the `ConfidenceSchema` type contract, disabling:
- `lovsen.confidence.degraded` telemetry threshold gate (P1.S4)
- `stale_paragraph` / `missing_data` diagnostic fields
- Score-based downstream gating

**Note:** `cite_law` is a Phase 0c+ stub (body comment is explicit). Violation is scoped to the stub path. When Lovdata MCP integration ships in Phase 0c+, the `Confidence` object must be constructed before the stub is lifted.

**Remediation:** Import `ConfidenceSchema` from `@smartout/lovsen-contract` in `tools.ts`. Return `{ level: "LAV", score: 0, stale_paragraph: true, missing_data: [] }` from the stub. Cost: ~10 minutes. Defers production scoring to Phase 0c+ without blocking telemetry type safety.

---

### F-06-03 — LOW — CARRY-FORWARD (open / intentional stub)

**cite_law body is a Phase 0c stub — Lovdata MCP integration absent**

- **File:** `packages/ai/src/capabilities/legal/tools.ts:403–435`
- **ADRs:** ADR-0258 (Lovsen MCP Boundary), ADR-0256 (Citation Contract)
- **Status:** Unchanged. Tracked, not regression.

`cite_law` returns a hard-coded placeholder object with `stub: true` and a comment pointing to the Phase 0c+ work. ADR-0258 requires 4 stdio MCP servers (`lovdata`, `mattilsynet`, `arbeidstilsynet`, `nho-reiseliv`) to be the fetch boundary; ADR-0256 requires a structured `Citation` object with SHA-256 hash + verbatim text. Neither is present. The `@smartout/lovsen-contract` `CitationSchema` is not imported.

This is an in-progress feature, not a regression. The stub comment is explicit and accurate. **No blocking issue — tracked for Phase 0c+ delivery.**

---

### F-06-04 — LOW — CARRY-FORWARD (open / intentional stub)

**classify_amendment body is a Phase 0c stub — returns "admin" for all field changes**

- **File:** `packages/ai/src/capabilities/legal/tools.ts:507–525`
- **ADRs:** ADR-0235 (amendment classifier), ADR-0234 (capability split)
- **Status:** Unchanged. Tracked, not regression.

`classify_amendment.execute()` returns `classification: "admin"` for every input field change with a warning comment `"classify_amendment er en stub. Ikke bruk i produksjon."`. The real implementation (ADR-0235) should read `field_classification_metadata` and apply the constructive-dismissal-risk rules.

Important: the **pure-function** `classifyAmendment` in `amendment-classifier.ts` is fully implemented with the correct 9-rule decision tree (UP / MATERIAL / ENDRINGSOPPSIGELSE), and is correctly wired into `payroll/tariff-tools.ts` via `classifyAmendmentLogic` re-export. The capability *tool wrapper* (`classifyAmendment` in `tools.ts`) is the stub — not the underlying logic. This means tariff-change flows already use the real rule matrix; only the agent-exposed tool body is stub-level.

**No blocking issue — agent surface stub is acceptable at Phase 0c. Real wiring exists in tariff-tools.ts.**

---

### INFO-06-01 — INFO

**Deprecated webhook route still registered in contract-service server**

- **File:** `services/contract-service/src/routes/webhooks.ts:1–6`, `src/server.ts:73`
- **ADR:** ADR-0076/0077 (webhook auth perimeter)

The webhooks.ts file is explicitly marked `DEPRECATED: Use /api/webhooks/docuseal in the Next.js app (apps/web).` However, `server.ts:73` still calls `app.register(webhookRoutes)`, meaning the endpoint `POST /webhooks/docuseal` is live on the Fastify service at port 5012.

The deprecated route does validate the shared secret (`x-docuseal-secret` / `x-docuseal-signature`) correctly and includes status regression prevention (STATUS_WEIGHT). Auth is not broken. The risk is operational: two DocuSeal webhook receivers are reachable if DocuSeal is misconfigured to point at the Fastify service instead of the Next.js app. No CRITICAL, but the registration should be removed to avoid split-receiver confusion.

---

## Per-ADR Rollup

| ADR | Status | Finding |
|---|---|---|
| 0024 (Employment vs platform contracts) | PASS | contract/tools.ts correctly handles `contract_type === 'employee'` check before send; platform contracts not mixed |
| 0076 (Contract composition as cascade derivation) | PASS | Framework snapshot read via `explain_contract_clause` + `get_compliance_drift_for_contract`; no direct K1a mutation |
| 0077 (PII handling) | PASS | `view_personal_number` + `view_bank_account` emit on every attempt (gate-denied + cross-workspace + success). ADR-0077 §was_revealed pattern implemented correctly |
| 0078 (Channel restriction) | PASS | All three capabilities enforce channel at both Layer 2 (`allowedChannels`) and Layer 3 (tool body). Payroll: `["chat"]` only. Contract: `["chat"]` only. Legal: `["chat","system"]` with per-tool body guards. No voice surface on any PII or mutation tool |
| 0079 (ADR-0024 amendment) | PASS | Employment contract flow separated from platform contracts |
| 0234/0235 (Amendment classifier / capability split) | PARTIAL — F-06-04 | Pure function `amendment-classifier.ts` fully implements ADR-0235 rule matrix. Tool wrapper `classify_amendment` is a Phase 0c stub. Tariff flows correctly consume the pure function |
| 0241 (Contract schema migration) | PASS | Schema fields match tool selects (contract_id, status, workspace_id, docuseal_submission_id, etc.) |
| 0242 (Contract/payroll capability split) | PASS | Three distinct capabilities (contract, payroll, legal) with separate `emitPrefix`, `allowedChannels`, `toolAuthPattern` |
| 0243 (Obligation lifecycle trigger semantics) | PASS — N/A scope | No obligation lifecycle in these surfaces |
| 0244 (Amendment flow acknowledgement) | PASS | `classifyAmendment` in tariff-tools.ts calls `classifyAmendmentLogic` before `mutateWithGate`; ENDRINGSOPPSIGELSE returns early with explicit error |
| 0245 (Employee contract mobile flow) | PASS | Contract tools are chat-only (ADR-0133 mobile authoring boundary respected); no mobile exposure |
| 0249 (Legal capability — fifth sibling) | PASS | `legalCapability` registered with `name: "legal"`, `emitPrefix: "legal"`, `defaultAuthority: "read_only"`. C4 gate seeded by `20260520130000_legal_capability_authority_seed.sql` (referenced in gate.ts comment) |
| 0250 (Skatteetaten integration) | PASS — Phase 7 scope | Tax card fields present in `update_payroll_profile`; Skatteetaten sync marked as Phase 7 (not implemented yet; manual entry path is wired) |
| 0251 (Shift pay calculation audit module) | PASS — N/A scope | `shift_pay_calculation` not in this slice |
| 0252 (Riksavtalen versjonering) | PASS | Rule 7 in `amendment-classifier.ts` handles Riksavtalen version bump correctly with `§4 carve-out`. `tariff-tools.ts` passes `law_version` diff to the classifier |
| 0253 (Lærling contracts) | PASS — N/A scope | Lærling contract type not present in this slice |
| 0254 (Overtime cap default scope) | PASS | `set_overtime_mode` in payroll/tools.ts enforces ADR-0254 guard (line 1025: "Block switch to 'banked' without TOIL agreement") |
| 0256 (Lovsen Citation Contract) | PARTIAL — F-06-03 | `cite_law` stub returns no `Citation` object; `CitationSchema` not imported. Phase 0c+ work item |
| 0257 (Lovsen Confidence Model) | MEDIUM — F-06-05 | `cite_law` returns bare `"LAV"` string; `ConfidenceSchema` not imported from `@smartout/lovsen-contract` |
| 0258 (Lovsen MCP Boundary) | PARTIAL — F-06-03 | 4 stdio MCP servers not yet implemented; stub comment confirms Phase 0c+ scope |
| 0259 (Lovsen capability authority) | PASS (FP-005) | `industry_intelligence.lovsen_query` is a distinct capability (not shipped). `legal` namespace is correct per ADR-0249. No default-allow gap |

---

## Verified Intentional

| Item | Rationale |
|---|---|
| FP-001: `allowedChannels: ["chat","system"]` on legal | Union pattern per ADR-0078; `system` channel needed for `validate_aml_14_6` on `/api/contracts/send` server route |
| FP-005: `engine_authority_config.capability='legal'` vs `industry_intelligence.lovsen_query` | Two distinct capabilities; not a default-allow gap (ADR-0249 closed L-0066 for legal) |
| `classify_amendment` stub returning "admin" | Phase 0c intentional; real `classifyAmendmentLogic` pure function is fully wired in tariff-tools.ts |
| Deprecated webhook route auth | Secret validation present (`x-docuseal-secret` / `x-docuseal-signature`); not a security gap |

---

## In-Progress (not findings)

- **Lovdata MCP integration (Phase 0c+):** `cite_law` + `classifyAmendment` bodies pending. 4 stdio MCP servers (ADR-0258) not yet implemented. `@smartout/lovsen-contract` package exists; `CitationSchema` + `ConfidenceSchema` available for import when stubs are lifted.
- **Phase 7 Skatteetaten sync:** Manual entry path wired; auto-sync from Skatteetaten deferred to Phase 7.
- **A-melding integration (ADR-0241):** Schema foundation in place; submission flow is a Phase 8+ item.

---

## Lønnsgrunnlag positioning check

All payroll export tools use `lønnsgrunnlag` terminology consistently:
- `export_period` description: "PDF lønnsgrunnlag bundle" — PASS
- `view_lonnsgrunnlag` description: "PDF lønnsgrunnlag" — PASS
- Storage bucket: `payroll-lonnsgrunnlag` — PASS
- Telemetry events: `payroll.lonnsgrunnlag_generated`, `payroll.lonnsgrunnlag_url_granted` — PASS
- No `lønnsslipp` / `payslip` / `paycheck` found anywhere in scope — PASS

**Lønnsgrunnlag positioning: CLEAN.**
