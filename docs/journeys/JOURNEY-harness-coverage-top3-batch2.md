---
title: "Journey — harness-coverage-top3-batch2"
feature: harness-coverage-top3-batch2
branch: feat/harness-coverage-top3-batch2
created: 2026-05-11
updated: 2026-05-11
module: ai
status: verified
tags: [e2e, harness, coverage, contract, onboarding, shift-lifecycle]
---

# Journey — harness-coverage-top3-batch2

## Why

Second wave of Botsson harness E2E coverage. After batch 1 (memory + schedule + governance + payroll), batch 2 closes the next 3 highest-leverage capability gaps: contract (10 tools), onboarding (10 tools), shift-lifecycle (5 tools, write-side gate critical). Pattern proven, helpers reused.

## Journey 1 — Contract capability E2E

**Precondition:** Stage-engine fresh, Supabase healthy, seed admin profile in seed workspace.

1. BFF call `/api/botsson/chat` with read-side contract query
2. Stage-engine routes to contract capability
3. Tool fires (list_employee_templates / list_employee_contracts / check_contract_status / explain_contract_clause / get_compliance_drift_for_contract)
4. `activity_trail.botsson.tool_invoked` row written with success=true
5. Assistant response does NOT contain failure-text patterns
6. PII-Cat-B tools: response does NOT leak raw values

**Postcondition:** All 5 read-side contract tools end-to-end verified. Write-side (DocuSeal) tracked as gap for journey-employee-contract spec.

**Error paths:** DocuSeal mutation tools deferred to dedicated specs (irreversible).

## Journey 2 — Onboarding capability E2E

**Precondition:** Same as J1. Workspace snapshot taken to restore name/niche after tests.

1. BFF call with onboarding query (`"vi heter Test Restaurant"`, `"legg til avdeling kjøkken"`)
2. Tool fires inside `purpose='onboarding'` context if needed
3. DB state asserted: workspace field updated, season row created, protocol row created
4. Workspace snapshot restored in afterAll

**Postcondition:** 5 onboarding tools verified (update_business, update_season, add_departments, add_locations, add_procedures). add_zones structurally identical to add_locations — skipped.

**Error paths:** Scrapling/BRREG tools skip in absence of service (search_company, identify_company, scrape_website).

## Journey 3 — Shift-lifecycle capability E2E (write-side gate)

**Precondition:** Test schedule_shift seeded with marker. Workspace authority preserves shift_lifecycle level for restore.

1. BFF call with write query (`"publiser vakten min"`, `"godkjenn vakten min"`)
2. Stage-engine intent → shift_lifecycle
3. Tool fires gatedMutation → `gate_evaluation` row written
4. Both router-level AND tool-level gate verified
5. DB state mutation observable (schedule_shift.status changed)
6. Authority temporarily disabled in N1 → tool blocked → restored in finally

**Postcondition:** 3 chat-channel tools verified (publish_shift, approve_shift, get_shift_lifecycle). interpret_shift + settle_shift documented as system-channel-only (unreachable via BFF chat by ADR-0078 design).

**Error paths:** No daily_reconciliation FK chain → approve_shift soft-skip with documentation. State machine violation → tool returns non-empty error response, no crash.
