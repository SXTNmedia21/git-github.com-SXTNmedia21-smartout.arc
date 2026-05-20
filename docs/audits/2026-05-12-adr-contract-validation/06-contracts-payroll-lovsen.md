---
title: "Slice 06 — contracts-payroll-lovsen ADR audit"
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, contracts-payroll-lovsen, adr]
---

# Slice 06 — Contracts / Payroll / Lovsen ADR Audit

**Date:** 2026-05-12
**ADRs in scope:** 0024, 0076, 0077, 0078, 0079, 0234, 0235, 0241, 0242, 0243, 0244, 0245, 0249, 0250, 0251, 0252, 0253, 0254, 0256, 0257, 0258, 0259, 0295
**Surfaces scanned:** `packages/ai/src/capabilities/contract/`, `packages/ai/src/capabilities/payroll/`, `packages/ai/src/capabilities/legal/`, `services/contract-service/`, `packages/payroll-export/src/`, `apps/web/src/components/contracts/`, `supabase/migrations/`
**Active-campaign filter:** `campaign/payroll` MERGED 2026-05-12 16:24 UTC — findings in that domain are MEDIUM priority.
**FP filter:** FP-001 (validate_aml_14_6 channel inversion) confirmed applied — not re-flagged.

---

## CRITICAL

### C-01 — ADR-0259 capability-name mismatch: seed uses `legal` not `industry_intelligence.lovsen_query`

**File:** `supabase/migrations/20260520130000_legal_capability_authority_seed.sql:77,106`
**ADR:** ADR-0259
**Evidence:** ADR-0259 Decision Outcome seeds capability `'industry_intelligence.lovsen_query'` with `level='read_only'`, `min_role='employee'`, `allowedChannels=['chat']`. The actual seed migration at line 77 and 106 seeds capability `'legal'`. The code capability in `packages/ai/src/capabilities/legal/index.ts` is also named `legal`. The `engine_authority_config` gate_action lookup uses the capability name as the key — if Botsson ever invokes `industry_intelligence.lovsen_query` as the capability string (matching the ADR-0259 C4 seed), no row will match and `gate_action` falls through to default-allow (CVE-class per ADR-0189 pattern). The mismatch may be intentional (ADR-0249 renamed the capability to `legal`), but ADR-0259 was never updated to reflect this. One ADR says one name, the other says another — the gate may silently pass-through depending on which string the router resolves.

**Verdict:** CRITICAL unless `industry_intelligence.lovsen_query` has been formally superseded by `legal` in a registered ADR amendment.

---

### C-02 — ADR-0254 `overtime_cap_policy` table not in schema: PLAN Phase 5 and ADR-0245 push-trigger blocked

**File:** `packages/supabase/src/database.types.ts` (column count = 0 for `overtime_cap_policy`)
**ADR:** ADR-0254
**Evidence:** ADR-0254 §4.A defines `overtime_cap_policy` table with DB-enforced Aml. §10-6 CHECK constraints. The table does not appear in `database.types.ts`, confirming no migration has shipped. ADR-0254 §4.B also requires `employment_contract.overtime_cap_policy_id` FK — also absent. Downstream: (1) PLAN Phase 5 engine_event for 80%-cap warning has no numeric source; (2) ADR-0245 §H `contract.overtime_cap_warning_threshold_crossed` event cannot be emitted without a `policy_id`; (3) `contract_pay_rule` overtime evaluations rely on hardcoded values in application code which ADR-0254 §7 explicitly forbids. ADR-0254 is `proposed` — not yet `accepted` — but the absence blocks work declared as unblocked in PLAN.

**Verdict:** CRITICAL — schema gap blocking Phase 5 + ADR-0245 mobile push-trigger.

---

## HIGH

### H-01 — ADR-0076 violated: `createEmployeeContract` calls contract-service directly, bypassing cascade derivation `change_proposal`

**File:** `packages/ai/src/capabilities/contract/tools.ts:246-380`
**ADR:** ADR-0076
**Evidence:** ADR-0076 Decision Outcome states: "Botsson sin `createEmployeeContract`-tool MÅ gå gjennom cascade derivation, ikke direkte insert til `employment_contract`." The tool body at line 246 fetches `CONTRACT_SERVICE_URL` and POSTs to `${serviceUrl}/contracts` — direct microservice call, no `change_proposal` of type `employment_contract_compose`, no cascade preview/apply pipeline, no compliance validation against `regulatory_framework` + `framework_rule`. The ADR explicitly lists this as an agent impact rule and marks it as blocking.

**Verdict:** HIGH (MEDIUM under active-campaign filter — payroll campaign just merged; contract capability work is in-flight per ADR-0241 Phase 0a status = `proposed`). Mark as HIGH drift requiring sortie.

---

### H-02 — ADR-0252 `tariff_revision_kind` column not in schema — bulk-amendment flow unimplementable

**File:** `packages/supabase/src/database.types.ts` (no `tariff_revision_kind` column found)
**ADR:** ADR-0252
**Evidence:** ADR-0252 §G §D require `regulatory_framework.tariff_revision_kind` enum column (`indekstillegg | full_revision`) before the bulk-amendment trigger flow can distinguish autonomous from manual-confirmation revisions. The column is absent from `database.types.ts`. The `framework.tariff_version_changed` event consumer in stage-engine cannot safely default `kind` without the column — it would treat all Riksavtalen revisions as `full_revision` implicitly, but this is undocumented behavior. ADR-0252 is `proposed`.

**Verdict:** HIGH — blocking Phase 6 bulk-amendment implementation.

---

### H-03 — Stale ADR reference in `classify_amendment` tool: references ADR-0235 (Helpdesk SLA — superseded) instead of ADR-0243 (Obligation Lifecycle / field classification)

**File:** `packages/ai/src/capabilities/legal/tools.ts:212,279`
**ADR:** ADR-0243 (and ADR-0235 which is the wrong target)
**Evidence:** Lines 211-212: `// Real implementation reads field_classification_metadata + conditional rules // per ADR-0235.` and line 279: `// TODO(Phase 0c+): read field_classification_metadata per ADR-0235`. ADR-0235 is `0235-helpdesk-sla-consumer-path-breach-handler-process.md` — the Helpdesk SLA Phase 2 consumer-path ADR (also itself superseded per the STATUS NOTE in ADR-0234). The correct ADR for field classification is ADR-0243 (`0243-obligation-lifecycle-trigger-semantics.md`), which explicitly rejects `field_classification_metadata` DB table and mandates a TS const map (`packages/contracts/src/field-classification.ts`). When Phase 0c+ implements `classify_amendment`, a build agent reading the TODO comment will follow the wrong ADR and introduce the rejected DB-table anti-pattern.

**Verdict:** HIGH — stale ADR citation will mislead Phase 0c+ implementation.

---

## MEDIUM

### M-01 — ADR-0077 engine_memory PII redaction middleware: `sensitivity` column exists but redaction middleware location unclear

**File:** `supabase/migrations/20260501100300_engine_channel_sensitivity_cancellation.sql:16`; `services/stage-engine/src/core/session-recorder.ts:14`
**ADR:** ADR-0077
**Evidence:** ADR-0077 §"engine_memory sensitivity tagging" requires memory-manager to: (1) redact personnummer regex (`/\d{6}\s?\d{5}/`) before embedding, (2) tag intake-sessions as `sensitivity='pii'` with `expires_at = NOW() + INTERVAL '7 days'`. The `sensitivity` column exists in the migration. `session-recorder.ts` imports `redactPII` from `@smartout/ai/lib/pii-redact` — redaction is present. However, the mandatory `expires_at = NOW() + 7 days` for `sensitivity='pii'` rows was not confirmed in the migration SQL (the migration only adds the column; no DEFAULT expires_at trigger is visible). If the expiry is not auto-set at write time for intake sessions, PII accumulates permanently — violating the 7-day retention rule.

**Active-campaign filter:** payroll campaign merged today. Mark MEDIUM.

---

### M-02 — ADR-0253 apprentice `blocking obligation` for `lærekontrakt_registration_ref` — no migration found

**File:** `supabase/migrations/` (no `_apprentice_contract_fields.sql` found)
**ADR:** ADR-0241 (Lovsen amendment 5), ADR-0253
**Evidence:** ADR-0253 Seksjon 6 requires a `contract_obligation` row of type `lærekontrakt_registrering` with `is_blocker = true` created automatically when a lærling contract is created. ADR-0241 amendment 5 blocks `employment_form='apprentice'` via UI until this ADR ships. No migration for the 9 nullable apprentice columns nor the `enforce_apprentice_dismissal_risk` trigger was found. Both ADRs are `proposed`. The blocker-obligation is currently unimplemented — if the UI block is ever removed without this migration landing, Opplæringsloven §4-2 registration enforcement disappears.

**Active-campaign filter:** MEDIUM.

---

### M-03 — ADR-0295 `feriepenger_basis` rename complete in payroll-export; UI label compliant — no drift detected (PASS)

**File:** `packages/payroll-export/src/types.ts:45`, `packages/payroll-export/src/pdf/components/TotalsBlock.tsx:147`
**ADR:** ADR-0295
**Evidence:** `feriepenger_basis` is the field name in `types.ts`, `csv.ts`, `pdf.ts`. `TotalsBlock.tsx:147` renders `Feriepenger-grunnlag (regnskapsfører beregner)` — matching the mandatory label from ADR-0295. No `feriepenger_accrued` references found. **PASS — no finding.**

---

### M-04 — ADR-0249 `validate_aml_14_6` send-route hook wired (Phase 0c) — stub always passes; gate is not enforced yet (documented)

**File:** `apps/web/src/app/api/contracts/send/route.ts:341`
**ADR:** ADR-0249
**Evidence:** The hook is wired (`validateAml146.execute()` called at line 341 before DocuSeal dispatch). Per ADR-0249 §"Phase 0c vs Phase 0c+ split": "stub always passes — gate is a framework hook, not enforcement." This is expected behavior. No finding against ADR — but flagging as MEDIUM tracking item: the stub will silently allow non-compliant contracts to be dispatched until Phase 0c+ real validator ships.

**Active-campaign filter:** MEDIUM — acknowledged tech debt, not a violation.

---

### M-05 — ADR-0259 `industry_intelligence.lovsen_query` authority seed not found — only `legal` capability seeded (see also C-01)

This is the same finding as C-01. If C-01 is resolved as "intentional rename to `legal`" and ADR-0259 is amended accordingly, this drops. If the capability names are genuinely decoupled, C-01 severity stands.

---

## LOW

### L-01 — ADR-0256/0257/0258 `lovsen-contract` package exists with `CitationSchema` + `ConfidenceSchema` — scaffold compliant (PASS)

**File:** `packages/lovsen-contract/src/` (contains `citation.ts`, `confidence.ts`, `lovsen-answer.ts`, `validation-result.ts`)
**ADR:** ADR-0256, ADR-0257, ADR-0258
**Evidence:** Package scaffold exists. `citation.ts` and `confidence.ts` match the ADR contracts. MCP fixture mode (ADR-0258) is declared in the ADR but the 4 stdio MCP servers themselves are Phase 0c+ scope — no production violation. **PASS for scaffold; MCP server gap is known deferred work.**

---

### L-02 — ADR-0251 `shift_pay_calculation_event` table and `shift_period_end_date` Bokføringsloven anchor confirmed in schema — PASS

**File:** `packages/supabase/src/database.types.ts:17749,17766`
**ADR:** ADR-0251
**Evidence:** `shift_pay_calculation_event` exists in `database.types.ts` with `shift_period_end_date` column (line 17766). Bokföringsloven §13 retention anchor is in place. **PASS.**

---

### L-03 — ADR-0077 no-echo rule confirmed in `MissingInfoSheet` — admin-fill PII flow compliant

**File:** `apps/web/src/components/contracts/MissingInfoSheet.tsx:259-266`
**ADR:** ADR-0077 (SMA-305 amendment)
**Evidence:** MissingInfoSheet POSTs to `/api/contracts/admin-fill-pii` with `high_pii_acknowledged` flag. Per-tier ack dialog logic visible at line 203. No value echo in response body visible in the component. **PASS — ADR-0077 admin-fill amendment implemented.**

---

### L-04 — ADR-0078 `payroll` capability `allowedChannels: ["chat"]` confirmed

**File:** `packages/ai/src/capabilities/payroll/index.ts:91`
**ADR:** ADR-0078, ADR-0242
**Evidence:** `allowedChannels: ["chat"]` at line 91 — correct. All payroll tools for Høy-PII confirmed chat-only. **PASS.**

---

### L-05 — ADR-0234/0235 relevance: ADR-0234 (Helpdesk SLA) is not in scope for contracts surface — legal/tools.ts references it erroneously (already flagged as H-03)

No additional finding beyond H-03.

---

## Summary Table

| ID | Severity | ADR | One-liner |
|----|----------|-----|-----------|
| C-01 | CRITICAL | ADR-0259 | `industry_intelligence.lovsen_query` vs `legal` capability name mismatch — gate_action may default-allow |
| C-02 | CRITICAL | ADR-0254 | `overtime_cap_policy` table absent — Phase 5 cap-check + ADR-0245 push-trigger blocked |
| H-01 | HIGH | ADR-0076 | `createEmployeeContract` calls contract-service directly, bypassing cascade derivation `change_proposal` |
| H-02 | HIGH | ADR-0252 | `tariff_revision_kind` column absent — bulk-amendment flow unimplementable |
| H-03 | HIGH | ADR-0243 | `classify_amendment` TODO cites ADR-0235 (Helpdesk SLA) instead of ADR-0243 (field classification) |
| M-01 | MEDIUM | ADR-0077 | `engine_memory` `expires_at = +7d` for pii-sensitivity rows not confirmed in migration |
| M-02 | MEDIUM | ADR-0253 | Apprentice `lærekontrakt_registration_ref` blocking-obligation migration not found |
| M-04 | MEDIUM | ADR-0249 | `validate_aml_14_6` stub always passes — gate is framework hook only until Phase 0c+ |
| L-01 | LOW (PASS) | ADR-0256/0257/0258 | `lovsen-contract` scaffold exists and matches ADR contracts |
| L-02 | LOW (PASS) | ADR-0251 | `shift_pay_calculation_event` + Bokföringsloven anchor `shift_period_end_date` confirmed |
| L-03 | LOW (PASS) | ADR-0077 | Admin-fill PII (SMA-305) MissingInfoSheet no-echo compliant |
| L-04 | LOW (PASS) | ADR-0078 | `payroll` capability `allowedChannels: ["chat"]` correct |
| M-03 | PASS | ADR-0295 | `feriepenger_basis` rename and UI label compliant across all 4 sites |

---

## Top 3 Critical One-liners

1. **C-01:** `engine_authority_config` seeded for `'legal'` but ADR-0259 specifies `'industry_intelligence.lovsen_query'` — if the router dispatches using the ADR name, `gate_action` falls through default-allow (CVE-class per ADR-0189).
2. **C-02:** `overtime_cap_policy` table does not exist in the schema — Phase 5 80%-overtime engine_event and ADR-0245 mobile push-trigger for cap warnings have no numeric source and cannot ship.
3. **H-01:** `createEmployeeContract` bypasses the ADR-0076 cascade derivation requirement (`change_proposal` of type `employment_contract_compose`) and calls `contract-service` directly — no compliance validation against `regulatory_framework` / `framework_rule` runs before contract is sent.
