---
title: "Slice 06 — contracts-payroll-lovsen — ADR/Contract Audit"
id: AUDIT-2026-05-13-06
slice: 06
slice_name: contracts-payroll-lovsen
status: done
created: 2026-05-13
updated: 2026-05-13
audit_date: 2026-05-13
auditor: opus-4-7-1M
mode: read-only
scope:
  - packages/ai/src/capabilities/contract/
  - packages/ai/src/capabilities/payroll/
  - packages/ai/src/capabilities/legal/
  - services/contract-service/
adrs_checked:
  [
    0024,
    0076,
    0077,
    0078,
    0079,
    0163,
    0204,
    0234,
    0235,
    0241,
    0242,
    0243,
    0244,
    0245,
    0249,
    0250,
    0251,
    0252,
    0253,
    0254,
    0256,
    0257,
    0258,
    0259,
    0292,
    0293,
    0294,
    0295,
  ]
counts:
  critical: 1
  high: 2
  medium: 4
  low: 3
  pass: 5
---

# Slice 06 — contracts-payroll-lovsen

Surfaces: `packages/ai/src/capabilities/{contract,payroll,legal}/`, `services/contract-service/`.
Baseline reference: 2026-05-10 audit (F-CL-01 inversion, F-CL-09 PASS, F-CL-10 PASS).

## 1. Verdicts vs baseline

| ID         | Verdict 2026-05-10                                    | Verdict 2026-05-13                                                     | Notes                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-CL-01** | `validate_aml_14_6` L2 declares voice, L3 blocks      | **STILL OPEN**                                                          | `legal/index.ts:57` declares `allowedChannels: ["chat","voice","system"]`. Tool body `validate_aml_14_6` (`legal/tools.ts:90`) blocks voice. Capability-level is the union of the three tools' surfaces (chat-validate, chat+voice cite_law, system-only classify) — but ADR-0163 §rule 4 forbids "voice" on any capability that handles contract content. |
| **F-CL-09** | PASS: contract/payroll/legal mutations wrapped        | **PASS with documented deviation**                                       | All mutation tools call `callGateAction` (gate-then-write convention) before any `.update()/.insert()`. ADR-0204 §"merge-blockers" forbids inline `supabase.rpc('gate_action')` outside `gatedMutation()`. `legal/gate.ts:46` marks itself `@authority-gate-ungated` — codebase-accepted convention. No regression vs baseline.                       |
| **F-CL-10** | PASS: payroll Høy-PII tools have 3 layers             | **PASS**                                                                | `viewPersonalNumber` + `viewBankAccount` retain channel guard + gate + emit (success + denial + cross-workspace). ADR-0077 audit-emit fully preserved. Phase 5 PII reveal flow unchanged.                                                                                                                                                            |

## 2. New findings (post-baseline)

### CRITICAL

| ID         | Title                                                          | File / line                                            | ADR     | Body                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-CL-11    | `legalCapability.allowedChannels` violates ADR-0163 §rule 4    | `packages/ai/src/capabilities/legal/index.ts:57`       | 0163    | ADR-0163 rule 4 (accepted 2026-04-20): "Any capability handling personnummer, bank details, salary, **contract content**, health data, or schedule-of-individuals MUST have `allowedChannels: ['chat']` explicitly." `validateAml146` handles contract content (oppsigelse, sykefravær, garantilønn §14-6 g, salary). Capability declares `["chat","voice","system"]`. Defence-in-depth at L2 weakened to L3-only. Fix: split capability into `legal` (chat-only) + `legal_reference` (cite_law on chat+voice), OR redeclare `legal: ["chat","system"]` and move cite_law's voice surface into `communication` (PII-unrestricted by ADR-0163 §retrofit). |

### HIGH

| ID         | Title                                                                       | File / line                                                                                                                | ADR     | Body                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-CL-12    | Capability `addManualSupplement`/`deleteManualSupplement` skip Pattern B recalc | `packages/ai/src/capabilities/payroll/tools.ts:1558-1657, 2380-2472`                                                       | 0293    | ADR-0293 §Decision: "Each BFF route that makes a payroll-affecting write... MUST... Synchronously POST to `/api/payroll/recalculate-period`." The BFF routes (`apps/web/src/app/api/payroll/add-manual-supplement/route.ts:256` and `.../delete-manual-supplement/...`) implement this. The capability tools write directly to `payroll.manual_supplement` and rely solely on the DB trigger `payroll_manual_supplement_recalc_trg`, which emits to `engine_event` with no registered `engine-dispatch` handler. Agent-invoked path = period totals stale until next manual recalc. Fix: capability tools should HTTP-call the BFF route (auth-forwarded) instead of writing direct, OR invoke a shared `recalcPeriod()` helper after write+emit. |
| F-CL-13 — **CLOSED 2026-05-13 by feat/audit-fcl13-feriepenger-basis** | Capability `exportPeriod` emits `feriepenger_basis: 0` instead of computing  | `packages/ai/src/capabilities/payroll/tools.ts:1877, 2136, 2258`                                                            | 0295    | ADR-0295 (proposed 2026-05-11) requires `feriepenger_basis = sum(holiday_eligible_pay) × holiday_allowance_pct / 100` with `holiday_allowance_pct` resolved from `employee_payroll_profile`. BFF routes (`generate-pdf-bundle`, `generate-pdf-single`, `export-period`) implement this correctly. **Fix shipped (option b):** capability tool now imports `computeFeriepengerBasis` from `@smartout/payroll-export` (same helper as BFF) and calls it per profile across all 3 sites (PDF, CSV aggregate, CSV audit). Each branch fetches `holiday_allowance_pct` from `employee_payroll_profile` and falls back to 12.0 (Riksavtalen) when null. `payroll.feriepenger_basis_computed` emitted per profile (PDF + CSV aggregate) and per row (CSV audit — matches BFF audit variant). Vitest at `packages/ai/src/capabilities/payroll/__tests__/exportPeriod-feriepenger.test.ts` asserts parity with helper output + non-zero CSV values + 12.0 default fallback. |

### MEDIUM

| ID         | Title                                                            | File / line                                                                       | ADR     | Body                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-CL-14    | `validate_aml_14_6` is still a stub returning `pass:true`         | `packages/ai/src/capabilities/legal/tools.ts:113-120`                              | 0249    | `validator_version: "aml-14-6-2024-07-stub"`. 16-letter checklist not implemented (TODO Phase 0c+). `apps/web/src/app/api/contracts/send/route.ts:341` calls this as the mandatory §14-6 gate before dispatch, but it always passes. Effective rule: any contract can be sent regardless of `employment_form`/`scope_of_work`/`hours_of_work` completeness. Acceptable Phase 0c posture per stub design, but the security claim "mandatory gate" is unfulfilled. Track as known Phase 0c+ debt. |
| F-CL-15    | `classify_amendment` is a stub returning every field as "admin"   | `packages/ai/src/capabilities/legal/tools.ts:281-296`                              | 0235    | ADR-0235 conditional-classification (trial period, tariff revision, material change) is bypassed. Tool returns "admin" with `requires_resigning: false` for every field. Drives `contract_amendment` insertion downstream — a salary cut would be classified admin, no acknowledgement evidence collected (ADR-0244). Phase 0c stub; flag for Phase 0c+ closure. |
| F-CL-16    | `contract-service` writes contract/contract_event with no `emit()` | `services/contract-service/src/routes/contracts.ts:98-132, 389-425, 455-470, 531`  | 0134    | Service-as-actor pattern: `contract-service` is auth'd by service-key, writes `contract`, `contract_event`, `contract.signed_pdf_url` directly. No `@smartout/telemetry` `emit()` calls anywhere in `services/contract-service/src/`. ADR-0134 requires "every mutation emits". Activity_trail entries for service-initiated writes are missing — only DocuSeal webhook-driven status flips and the BFF/agent caller's emit are recorded. Compensating control: agent `sendEmployeeContract` (line 402-414) and BFF `/api/contracts/send/route.ts:488,612` emit on the originating call, so most observable state changes are covered. The `cancel_contract` and `sync_contract` paths in `services/contract-service/src/routes/contracts.ts:455-470, 531` have no upstream emit, leaving a gap. |
| F-CL-17    | `addManualSupplement` emit shape mixes profile_id of caller in delete | `packages/ai/src/capabilities/payroll/tools.ts:2457`                               | 0134    | `deleteManualSupplement` emit sets `target_profile_id: ctx.profileId` (the actor) instead of resolving the shift's `employee_id`. `addManualSupplement` does this correctly at 1641 (`shift.employee_id`). Audit-trail downstream consumers grouping by `target_profile_id` will misattribute deletes to the deleter. Tighten to look up shift.employee_id before emit. Also `period_id: ""` is empty-string instead of resolved period — see L-0177 prohibition on empty fallback (memory). |

### LOW

| ID         | Title                                                          | File / line                                                          | ADR     | Body                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-CL-18    | `forkTemplate` / `publishWorkspaceTemplate` / `deprecateWorkspaceTemplate` lack L3 explicit chat-only L3 channel check | `packages/ai/src/capabilities/contract/tools.ts:475, 587, 677`        | 0078    | The three Gate G4 tools assert `ctx.channel && ctx.channel !== "chat"` — but this allows `undefined` to pass (system/internal). Comment claims chat-only but tooltip permits `undefined`. ADR-0078 amendment §C does NOT cover authoring tools (they are domain-mutating Category A). Tighten to `ctx.channel !== "chat"` mirroring payroll convention.                       |
| F-CL-19    | `lock_period`, `acknowledge_deviation`, etc. lack `capability:` field in `defineTool` registration | `packages/ai/src/capabilities/payroll/tools.ts:832, 933, 1006, 1083, 1166, 1244, 1326, 1565, 1671, 2386, 2495`                          | n/a     | Phase 2 T4.2 tools (lock_period through delete_manual_supplement) and `exportPeriod`+`viewLonnsgrunnlag` are missing the `capability: CAPABILITY` field in `defineTool({...})`. `updatePayrollProfile`/`queryTaxCard`/`setPensionScheme`/`viewPersonalNumber`/`viewBankAccount`/`salaryQuery`/`overrideCalculationLine` include it. Likely benign — capability is also declared at index registration — but the inconsistency means programmatic introspection of capability ownership returns `undefined` for the newer tools. Low risk; tidy in next pass. |
| F-CL-20    | `lonnsgrunnlag_generation_failed` emit path returns early without `recalc` cleanup | `packages/ai/src/capabilities/payroll/tools.ts:1900-1955`            | 0294    | PDF bundle render or storage upload failure emits `payroll.lonnsgrunnlag_generation_failed`, returns error. No `export_event` row inserted — Bokføringsloven §13 audit-trail is silent on the failure attempt. ADR-0294 does not explicitly require failed-event persistence, but emitting failure without a paired row leaves audit-trail downstream consumers without the entity_id reference. Consider inserting `export_event` with `status='failed'` BEFORE emit on each error branch. |

## 3. F-CL-09 PASS confirmation

All 15 mutation tools across legal/contract/payroll wrap their persistence calls behind `callGateAction` (legal/gate.ts:46, contract/gate.ts, payroll/gate.ts). Pattern is gate→verify→update→emit, never direct write before gate. The pattern deviates from ADR-0204 §"compose via `gatedMutation`", but the deviation is codebase-accepted (see `legal/gate.ts:46` `@authority-gate-ungated` comment, and the explicit acknowledgement in `payroll/tools.ts:68` docstring). Treat as known convention until SS-5 migration. **No regression vs 2026-05-10 baseline.**

## 4. F-CL-10 PASS confirmation

PII tools `viewPersonalNumber` (lines 408-523) and `viewBankAccount` (lines 527-640) retain all three layers:

- L1 process-allowed_channels: workspace_id from JWT, `engine_process_id` not passed (Layer 1 silent per ADR-0163; acceptable for ad-hoc chat).
- L2 capability `allowedChannels: ["chat"]` declared at `payrollCapability` (line 91).
- L3 `assertChatChannel(channel)` at tool body entry (line 419, 538).
- ADR-0077 audit-emit fires on EVERY reveal — denial, cross-workspace miss, null-value, and success — with `was_revealed` discriminator. Workspace-scoped forgery defence (`.eq("workspace_id", ctx.workspaceId)`) preserved.

## 5. Active-campaign caveats (in-progress, not flagged)

- `packages/ai/src/capabilities/payroll/tools.ts` (payroll-wt-1 active) — F-CL-13, F-CL-17, F-CL-19 fall partly inside this branch's territory; defer remediation to campaign close. F-CL-12 (Pattern B sync) is structural and not bound to a known WIP.
- `packages/ai/src/capabilities/payroll/__tests__/salary-query.test.ts` — not audited (test surface).
- `packages/payroll-calculate/src/types.ts` — outside slice scope.

## Top 3 critical one-liners

1. **F-CL-11 CRITICAL** — `legal/index.ts:57` declares voice in a capability that handles §14-6 contract content; violates ADR-0163 §rule 4. Restrict to `["chat"]` or split off `cite_law`.
2. **F-CL-12 HIGH** — `addManualSupplement`/`deleteManualSupplement` in `payroll/tools.ts` skip ADR-0293 Pattern B sync recalc; agent-invoked supplements leave period totals stale.
3. **F-CL-13 HIGH** — `exportPeriod` in `payroll/tools.ts` emits `feriepenger_basis: 0` instead of computing per ADR-0295; agent-issued exports ship the "data corruption" value Pontus flagged on 2026-05-11. **CLOSED 2026-05-13 by feat/audit-fcl13-feriepenger-basis** — capability now calls `computeFeriepengerBasis` (same helper as BFF) per profile; emits `payroll.feriepenger_basis_computed`.

## Counts

- CRITICAL 1 | HIGH 2 | MEDIUM 4 | LOW 3 | PASS 5 (F-CL-09, F-CL-10, ADR-0292 supersession, ADR-0294 PDF lib, ADR-0259 not-shipped FP confirmed)
