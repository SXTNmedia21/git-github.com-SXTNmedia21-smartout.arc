---
title: "Audit — Contracts + Payroll + Lovsen Capabilities"
status: done
updated: 2026-05-02
created: 2026-05-02
module: agent-sdk
tags: [audit, contracts, payroll, lovsen, adr-compliance]
---

# Slice 06: Contracts + Payroll + Lovsen — ADR Compliance Audit

**Scope:** `packages/ai/src/capabilities/contract/`, `packages/ai/src/capabilities/payroll/`, `packages/ai/src/capabilities/legal/`, `services/contract-service/`
**ADRs validated:** 0024, 0076–0079, 0234–0235, 0241–0245, 0249–0254, 0256–0259 + L-0177, L-0178

---

## Summary — Top 5 Findings

1. **CRITICAL — `classify_amendment` missing `callGateAction` (ADR-0099 violation).** ADR-0249 + the tool docstring both declare `gate_action: enforce, default_allow: false` for `classify_amendment`. The execute body contains zero calls to `callGateAction` (or any RPC gate). The Phase 0c stub will always pass through without authority check — this is the CVE-class L-0066 gap for a mutation-driving tool. File: `packages/ai/src/capabilities/legal/tools.ts:238–289`.

2. **HIGH — Authority seed capability name mismatch (ADR-0259 vs migration).** ADR-0259 specifies capability name `'industry_intelligence.lovsen_query'` in its seed SQL. Migration `20260520130000_legal_capability_authority_seed.sql` seeds under `'legal'`. These are two different rows. The `legal` row is what the registered capability uses; the ADR-specified `'industry_intelligence.lovsen_query'` row is never seeded. When real classify_amendment lands, its gate_action call will look up `'legal'` (correct per index.ts) but ADR-0259's channel restriction (`chat-only`) is expressed against a non-existent row. No runtime impact today (stub returns pass), but ADR text and seed diverge.

3. **HIGH — `validate_aml_14_6` channel guard + `allowedChannels` mismatch (ADR-0249).** ADR-0249 tool channel table says `allowedChannels: ["chat", "voice*"]` for `validate_aml_14_6` (with a footnote that voice is aspirational). `legal/index.ts` declares `allowedChannels: ["chat", "voice", "system"]`. But `validate_aml_14_6.execute()` at line 87 blocks voice with a hard error (only `chat`, `undefined`, `system` pass). The capability-level `allowedChannels` thus advertises voice as permitted when the tool itself forbids it — defence-in-depth inversion.

4. **MEDIUM — `sendEmployeeContract` has no `emit()` call (telemetry gap, ADR-0004).** `createEmployeeContract` emits `"contract created"` (line 266). `sendEmployeeContract` (lines 295–366) performs an irreversible send via contract-service but emits nothing. This leaves the most consequential mutation in the contract flow with zero telemetry coverage — no `activity_trail` entry, no PostHog event, no engine_event routing for the send action.

5. **MEDIUM — `cite_law` emit missing `entity` field.** The `legal.law_cited` emit at `tools.ts:186–203` has `properties.data` but no `properties.entity`. Every other capability emit includes `entity: { entity_type, entity_id }`. Missing entity means `activity_trail` routing has no anchor. This is consistent with cite_law being read-only with no contract_id, but the emit shape should at minimum carry a `null` entity or omit for a documented reason.

---

## Capability Compliance Table

| Capability | ADRs Owned | Verdict | Key Evidence |
|---|---|---|---|
| `contract` | 0024, 0076, 0079, 0078, 0241, 0242, 0244, 0245 | **PASS WITH GAPS** | Correct role guard, workspace_id from ctx, emit on create/fork/publish/deprecate. Gap: no emit on send. |
| `payroll` | 0077, 0078, 0242, 0250, 0251, 0252, 0254 | **PASS** | All tools: channel guard → callGateAction → ADR-0151 workspace check → emit. Gate fails closed on RPC error. |
| `legal` (lovsen) | 0249, 0256, 0257, 0258, 0259, 0078, 0099 | **FAIL (classify_amendment gate missing)** | validate_aml_14_6 + cite_law: correct stubs, emit present. classify_amendment: gate documented but absent in execute body. |
| `contract-service` | 0024, 0079, 0243, 0244 | **PASS WITH GAPS** | Auth via X-Service-Key enforced. send route dispatches to DocuSeal correctly. validate_aml_14_6 NOT wired in contract-service `/contracts/:id/send` (only in Next.js `/api/contracts/send`). |

---

## Per-ADR Rollup

| ADR | Status | Finding |
|---|---|---|
| ADR-0024 | PASS | Contract system architecture: contract-service exists as documented, role guard via `resolveActorRole`, employment_contract FK pattern used. |
| ADR-0076 | PASS | Contract composition as cascade derivation: template + placeholder resolution implemented, framework_snapshot on employment_contract used in `explainContractClause`. |
| ADR-0077 | PASS | PII handling: payroll tools use `employee_payroll_profile`, not `profile`; `view_personal_number` + `view_bank_account` return presence indicator only (Phase 0c); no PII echoed to LLM. |
| ADR-0078 | PARTIAL | Channel restriction: contract (`chat` only), payroll (`chat` only with execute-time guard) — PASS. legal/validate_aml_14_6 blocks voice in execute but allowedChannels advertises voice — see Finding 3. classify_amendment correctly restricts to system/autonomous. |
| ADR-0079 | N/A | ADR-0024 amendment (employment vs platform contracts): contract_type check in sendEmployeeContract (`contract_type !== 'employee'` guard at line 322) — PASS. |
| ADR-0234 | PASS | Helpdesk SLA Phase 2: cross-link not implemented yet; contract capability split matches ADR-0242 allocation. |
| ADR-0235 | PASS | Helpdesk SLA consumer path: SLA trigger references are in contract-service reminders. No obligation-overdue cron in capability layer (deferred). |
| ADR-0241 | PROPOSED | Schema migration foundation: migration `20260519100100_*` supersedes old `0001`. Capability tools use current `status` enum values (`draft`, `sent`, `viewed`, `signed`, `expired`). Tool enum at tools.ts:47 does not include new values (`pending_signature`, `active`, `superseded`) from ADR-0241. |
| ADR-0242 | PASS | Capability split: `contract` and `payroll` are separate capabilities with distinct `allowedChannels`, `emitPrefix`, `toolAuthPattern`. Dead `payroll` CapabilityName resurrected. |
| ADR-0243 | PROPOSED | Obligation lifecycle trigger: no application-layer code exists yet for obligation lifecycle. Field classification moved to TS const — see `packages/contracts/` (not verified in this slice). |
| ADR-0244 | PROPOSED | Amendment flow: `classifyAmendment` stub always returns `"admin"` with `requires_resigning: false`. ADR-0244 constraint requires `requires_employee_signature` column — no migration in this PR wave. Stub is correctly marked as Phase 0c placeholder. |
| ADR-0245 | PROPOSED | Employee contract mobile flow: mobile surface partitioning spec only. No mobile code. Web `/api/contracts/send` wires validate_aml_14_6 gate (PASS). No `<DomainChatOwnership>` declaration checked (L-0178 risk deferred to mobile implementation PR). |
| ADR-0249 | PARTIAL | Legal capability fifth sibling: capability registered, authority seed exists, `validate_aml_14_6` wired in web send route. Gap: `classify_amendment` missing gate body (see Critical finding). |
| ADR-0250 | PROPOSED | Skatteetaten integration: no code yet. `query_tax_card` returns data from `employee_payroll_profile` (local store). Integration deferred. |
| ADR-0251 | PARTIAL | Shift pay calculation audit: `salary_query` reads `shift_cost_snapshot` and builds citations from `contract_pay_rule.source_text`. Integration exists but `shift_cost_snapshot` query requires `profile_id` column (not verified against current schema). |
| ADR-0252 | PROPOSED | Riksavtalen versioning: `salary_query` cites from `contract_pay_rule.source_text` which may contain Riksavtalen refs. Version-aware fetching deferred to Lovdata MCP (Phase 0c+). |
| ADR-0253 | PROPOSED | Lærling kontrakter: no code. `employment_category` column present on `contract_template` insert in `forkTemplate` (line 468). Schema ready, tooling deferred. |
| ADR-0254 | PROPOSED | Overtime cap default scope: no code. `framework_rule` integration referenced in comments only. |
| ADR-0256 | PARTIAL | Lovsen citation contract: `CitationSchema` exists in `packages/lovsen-contract/src/citation.ts` (hash, verbatim_text, fetched_at, source_url — correct shape). `cite_law` execute returns a plain string stub, NOT a `CitationSchema` object. No import of `CitationSchema` in legal/tools.ts — ADR-0256 rule violated in stub. |
| ADR-0257 | PARTIAL | Lovsen confidence model: `ConfidenceSchema` exists (see `Aml146Issue.confidence: "HØY"\|"MEDIUM"\|"LAV"`). `cite_law` stub returns `confidence: "LAV"` as string, not a `Confidence` object. `classifyAmendment` returns `confidence: "LAV"` as literal. No numeric `score` field — ADR-0257 dual representation not implemented. |
| ADR-0258 | NOT STARTED | Lovsen MCP boundary: 4 stdio MCPs (`lovdata`, `mattilsynet`, `arbeidstilsynet`, `nho-reiseliv`) are Phase 0c+ work. Stubs correctly return placeholder text without calling MCPs. `LOVSEN_FIXTURE_MODE` not implemented. |
| ADR-0259 | PARTIAL | Lovsen capability authority: migration seeds `capability='legal'` (correct for registered capability). ADR-0259 decision SQL uses `'industry_intelligence.lovsen_query'` — name mismatch documented. chat-only channel restriction in seed comment but ADR-0259 text says `allowedChannels: ['chat']` for the authority row — migration enforces `min_role='manager'`, `level='read_only'`. Functionally adequate for Phase 0c but text/migration diverge. |
| L-0177 | PASS | workspace_id from JWT: all capability tools use `ctx.workspaceId` (from JWT context), never from request body. ADR-0151 workspace verification via `.eq("workspace_id", ctx.workspaceId)` present in all mutation tools. |
| L-0178 | DEFERRED | Dual-surface misroute: contract screen not yet implemented on mobile. Risk documented in ADR-0245. No `<DomainChatOwnership>` needed until mobile PR ships. |

---

## Critical Violations

### V1 — `classify_amendment` gate body absent (CRITICAL)

**File:** `packages/ai/src/capabilities/legal/tools.ts:238–289`
**ADR:** ADR-0249, ADR-0099
**Evidence:** Tool docstring says `gate_action: enforce, default_allow: false per ADR-0099`. Execute body contains channel guard only. No `callGateAction` import, no gate RPC call. Stub returns classifications without authority check.
**Risk:** When Phase 0c+ real implementation ships, if a developer copies the stub body pattern, the gate will not be added unless explicitly tracked. The stub landing on a "server-only" channel is low risk today, but the missing gate is a contract violation that should be fixed pre-Phase-0c+.
**Fix:** Add `callGateAction` (same as `payroll/gate.ts` pattern) before the classification loop, with `actionType: "classify_amendment"`, `default_allow: false` enforcement.

### V2 — `sendEmployeeContract` missing emit (HIGH)

**File:** `packages/ai/src/capabilities/contract/tools.ts:295–366`
**ADR:** ADR-0004 (unified telemetry)
**Evidence:** `createEmployeeContract` emits at line 266 (`"contract created"`). `sendEmployeeContract` performs the irreversible send action but has no `void emit(...)` call.
**Fix:** Add `void emit({ event: "contract sent", workspace_id: ctx.workspaceId, actor_id: ctx.profileId, properties: { entity: { entity_type: "contract", entity_id: params.contract_id }, data: { sent_by: ctx.profileId } } })` after successful send response.

---

## Lovsen Citation / Confidence / MCP / Authority Sub-Table

| Dimension | ADR | Specified | Implemented | Gap |
|---|---|---|---|---|
| Citation shape (`CitationSchema`) | ADR-0256 | `CitationSchema` with hash, verbatim_text, fetched_at, source_url | `packages/lovsen-contract/src/citation.ts` — correct schema | `cite_law` returns plain string stub, not `CitationSchema` object. Import missing in legal/tools.ts. |
| Confidence model (`ConfidenceSchema`) | ADR-0257 | Dual: `level: HØY\|MEDIUM\|LAV` + `score: 0..1` | Only string `confidence: "LAV"` in Aml146Issue type | No `score` field, no `Confidence` object from `lovsen-contract`. Full compliance deferred to Phase 0c+. |
| MCP boundary (4 stdio servers) | ADR-0258 | lovdata, mattilsynet, arbeidstilsynet, nho-reiseliv — no direct scraping | Phase 0c stubs return hardcoded strings | FIXTURE_MODE not implemented. No MCP calls (correct for stubs). |
| Authority seed capability name | ADR-0259 | `'industry_intelligence.lovsen_query'` in ADR SQL example | Migration seeds `'legal'` — matches registered capability | Name mismatch between ADR-0259 example SQL and actual migration. Functionally `'legal'` is correct; ADR text is misleading. |
| Channel restriction (validate_aml_14_6) | ADR-0249 | chat only | Execute-time guard blocks voice. But `allowedChannels: ["chat", "voice", "system"]` in index.ts advertises voice | Capability-level guard is too permissive vs tool-level guard. Should be `allowedChannels: ["chat", "system"]`. |
| classify_amendment gate | ADR-0099 | enforce, default_allow: false | Zero gate calls in execute body | Critical gap (V1 above). |
