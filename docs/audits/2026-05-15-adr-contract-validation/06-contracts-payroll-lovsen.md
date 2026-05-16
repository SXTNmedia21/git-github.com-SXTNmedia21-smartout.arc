---
title: "Slice 06 — Contracts / Payroll / Lovsen ADR Audit"
status: complete
updated: 2026-05-15
created: 2026-05-15
module: contract, payroll, legal
tags: [audit, contracts, payroll, lovsen, adr]
---

# Slice 06 — Contracts / Payroll / Lovsen

Audit date: 2026-05-15. Branch: development HEAD. Read-only.

Surfaces covered:
- `packages/ai/src/capabilities/contract/`
- `packages/ai/src/capabilities/payroll/`
- `packages/ai/src/capabilities/legal/`
- `services/contract-service/src/`

ADRs verified: 0024, 0076, 0077, 0078, 0079, 0163, 0234, 0235, 0241, 0242, 0243, 0244, 0245, 0249, 0250, 0251, 0252, 0253, 0254, 0256, 0257, 0258, 0259, 0287, 0293, 0295

---

## Summary

3 findings. 1 MEDIUM-new, 2 LOW-new. Both baselines (F-CL-11, F-CL-13) confirmed closed. F-CL-12 partially addressed (BFF compliant; capability path missing). ADR-0295 remains `proposed` not `accepted`.

---

## Findings Table

| ID | Severity | Surface | ADR | Description |
|----|----------|---------|-----|-------------|
| F-CL-11 | ~~CRITICAL~~ CLOSED | legal/index.ts:64 | 0163 | allowedChannels narrowed to ["chat","system"]. Verified closed. |
| F-CL-12 | MEDIUM (updated) | payroll/tools.ts:1559, 2534 | 0293 | Pattern B recalc skipped on capability path for add/delete_manual_supplement. BFF routes compliant; capability tools bypass. |
| F-CL-13 | ~~HIGH~~ CLOSED | payroll/tools.ts:1880 | 0295 | feriepenger_basis=0 closed. computeFeriepengerBasis now called at three sites. Verified closed. |
| F-CL-14 | MEDIUM (new) | legal/tools.ts:400 | 0078, 0163 | cite_law tool body declares allowedChannels ["chat","voice"] but capability Layer 2 is ["chat","system"]. Tool description and Layer 3 comment are contradicted by Layer 2. Voice is silently blocked — no explicit mismatch error. |
| F-CL-15 | LOW (new) | services/contract-service/src/routes/contracts.ts:92,102,126 | 0151 | contract-service reads workspace_id from request body without cross-checking against request.workspaceId derived from the API key. server.ts decorates workspaceId on request but contracts.ts never validates body.workspace_id === request.workspaceId. |
| F-CL-16 | LOW (new) | docs/decisions/0295-feriepenger-boundary.md | 0295 | ADR-0295 status is still `proposed` not `accepted`. The feriepenger_basis implementation is live and correct; the ADR has not been promoted to `accepted`. Per ADR-0295's own closing instruction: "After acceptance: amend status to `accepted`, update `0000-decision-log.md` row." |

---

## Per-ADR Rollup

| ADR | Status | Notes |
|-----|--------|-------|
| ADR-0078 | PARTIAL | Layer 2+3 present on contract/payroll/legal. cite_law Layer 3 comment contradicts Layer 2 (F-CL-14). |
| ADR-0099 | PASS | callGateAction called in all mutation tools (contract, payroll, legal). ADR-0287 baseline 43 passing. |
| ADR-0151 | PARTIAL | Capability tools: compliant (ctx.workspaceId server-derived). contract-service: body.workspace_id used without request.workspaceId cross-check (F-CL-15). |
| ADR-0163 | PASS | F-CL-11 verified closed. legal capability allowedChannels:["chat","system"]. All three capability namespaces declare allowedChannels. |
| ADR-0204/0287 | PASS | gatedMutation / callGateAction present in all mutation tools surveyed. gate-action-coverage baseline 43/0/0. |
| ADR-0241 | N/A | Migration foundation ADR — schema migration artefacts not in scope of this code audit pass. |
| ADR-0242 | PASS | contract + payroll capability split registered correctly. emitPrefixes distinct. toolAuthPattern "direct_admin" declared. |
| ADR-0249 | PASS | legal capability registered as fifth sibling. systemTools split (classifyAmendment, validateAml1415) correctly excludes readOnlyTools tier. |
| ADR-0256/0257/0258/0259 | IN-PROGRESS | Lovsen MCP integration is Phase 0c+ stub. cite_law returns stub with confidence:"LAV". Compliant for current phase. |
| ADR-0293 | PARTIAL | BFF routes (add-manual-supplement, delete-manual-supplement) call Pattern B recalculate-period. Capability tools (addManualSupplement, deleteManualSupplement) write directly to DB and do NOT call recalculate-period — Pattern B gap on the agent path (F-CL-12 updated). |
| ADR-0295 | PARTIAL | Computation correct (3 sites in payroll/tools.ts:1880, 2176, 2345). ADR status `proposed` not `accepted` (F-CL-16). |
| ADR-0311 | PASS | validateAml1415 in systemTools tier. aml-14-15.ts shared utility: workspace_id server-derived, L-0177 fail-fast at line 88. Channel guard at tools.ts:589. |

---

## Verified Intentional

| Item | ADR | Notes |
|------|-----|-------|
| FP-001 validate_aml_14_6 channel "inversion" | 0078 | layered-defense union. validate_aml_14_6 allows both chat + system at Layer 3. System used by /api/contracts/send route. Correct. |
| FP-005 lovsen_query vs seeded 'legal' | 0259 | Two distinct capabilities. industry_intelligence.lovsen_query (ADR-0259) is NOT shipped today. legal capability (ADR-0249) is the shipped sibling. No default-allow gap. |
| contract-service body.workspace_id | N/A | Service is internal-only (X-Service-Key auth). BFF caller is responsible for correct workspace_id. F-CL-15 is LOW because the service key restricts access; however no runtime cross-check exists. |
| cite_law voice stub | 0256/0258 | Lovdata MCP not connected in Phase 0c. cite_law returns stub with confidence:"LAV". Compliant placeholder. |
| ADR-0295 proposed status | 0295 | Implementation correct but ADR promotion deferred. Flag for hygiene only. |

---

## In-Progress

| Item | Status | Notes |
|------|--------|-------|
| Pattern A engine_dispatch handlers for payroll.recalc_triggered_by_supplement | Pending | ADR-0293 §Migration Path. Pattern B bridge in BFF routes. Capability path has no equivalent bridge (F-CL-12). |
| Lovdata MCP integration (cite_law real body) | Phase 0c+ | Current stub compliant for phase. |
| contract-service emit() coverage | Gap | No emit() calls found in contracts.ts write paths. contract_event INSERT used as audit substitute but not routed through @smartout/telemetry. |

---

## Delta vs 2026-05-13

| Finding | 2026-05-13 | 2026-05-15 | Change |
|---------|-----------|-----------|--------|
| F-CL-11 | CRITICAL — voice in allowedChannels | CLOSED | Verified closed by 47bffe635. legal/index.ts:64 = ["chat","system"]. |
| F-CL-12 | HIGH — ADR-0293 Pattern B recalc skipped on capability path | MEDIUM — BFF compliant, capability path gap confirmed | BFF routes add-manual-supplement + delete-manual-supplement now implement Pattern B correctly (verified in apps/web/src/app/api/payroll/). Capability tools (addManualSupplement, deleteManualSupplement in payroll/tools.ts) still write directly without Pattern B recalc. Severity downgraded from HIGH to MEDIUM: BFF is the primary path; capability tool path is agent-triggered only. |
| F-CL-13 | HIGH — feriepenger_basis=0 | CLOSED | computeFeriepengerBasis called at tools.ts:1880, 2176, 2345. Emits payroll.feriepenger_basis_computed per ADR-0295. |
| F-CL-14 | Not previously identified | MEDIUM (new) | cite_law Layer 2 vs Layer 3 channel mismatch. |
| F-CL-15 | Not previously identified | LOW (new) | contract-service body.workspace_id not cross-checked against request.workspaceId. |
| F-CL-16 | Not previously identified | LOW (new) | ADR-0295 status `proposed` despite implementation being live. |
