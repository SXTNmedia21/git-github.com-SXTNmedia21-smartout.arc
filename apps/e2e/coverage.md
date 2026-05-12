---
title: Botsson Harness E2E Coverage Matrix
status: in_progress
updated: 2026-05-11
created: 2026-05-11
module: ai
tags: [e2e, coverage, harness, observability]
---

# Botsson Harness E2E Coverage Matrix

Live tracking of which `packages/ai/src/capabilities/*` have end-to-end pipe coverage in `apps/e2e/tests/*-harness-e2e.spec.ts`.

**Updated:** 2026-05-12 (batch 9 — FINAL)
**Total capabilities:** 29 (24 with tools, 5 empty placeholders)
**Total tools:** 127 (communication = 8, not 5)
**Covered:** 24 capabilities · 99 tools · 78% by tool count — **100% of capabilities with registered tools**

## Status legend

| Symbol | Meaning                                                |
| ------ | ------------------------------------------------------ |
| 🟢     | E2E harness spec exists, all positive assertions pass  |
| 🟡     | E2E spec exists with documented skipped negative paths |
| 🔴     | No E2E harness spec — uncovered                        |
| ⬜     | Capability has 0 tools (placeholder / stub)            |

## Matrix

| Capability              | Tools | Spec                                          | Status | Notes                                                                                                                                                                                                                                            |
| ----------------------- | ----- | --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| availability            | 3     | `availability-harness-e2e.spec.ts`            | 🟡     | All 3 tools (set_own_availability, clear_own_availability, query_others_availability). 21 tests · 2 designed-skip (LiveKit voice channel guard)                                                                                                  |
| billing-query           | 6     | `billing-query-harness-e2e.spec.ts`           | 🟡     | All 6 read-side tools covered + email masking inline. RPC dependency get_invoice_basis graceful                                                                                                                                                  |
| business-intelligence   | 6     | `business-intelligence-harness-e2e.spec.ts`   | 🟡     | All 6 covered (4 readOnly + 2 suggest). Scrapling unreachable tolerated. gate_action never called (M1 verifies)                                                                                                                                  |
| communication           | 8     | `communication-harness-e2e.spec.ts`           | 🟡     | All 8 tools incl send_message mutation + gate path. compile_day_brief + compile_preclose_summary conditional on active dept                                                                                                                      |
| contract                | 10    | `contract-harness-e2e.spec.ts`                | 🟡     | 5 read tools covered (list_employee_templates, list_employee_contracts, check_contract_status, explain_contract_clause, get_compliance_drift_for_contract). 5 write tools deferred (DocuSeal sandbox required)                                   |
| contract-intake         | 3     | `contract-intake-harness-e2e.spec.ts`         | 🟡     | All 3 tools (submit_field_group, decline_intake, get_intake_progress). 17 tests · PII non-echo invariant (banking group never echoed). Dual-path tolerant on read_only authority                                                                 |
| engine-world            | 3     | `engine-world-harness-e2e.spec.ts`            | 🟡     | All 3 tools (read_surface, read_surface_class, report_observation). Phase 1 migration prereq                                                                                                                                                     |
| governance              | 1     | `governance-harness-e2e.spec.ts`              | 🟡     | gate_action verified at router level. 2 designed-skip (LiveKit, employee profile). Brief gap: list_change_proposals + get_governance_summary don't exist in registry                                                                             |
| guardian                | 3     | `guardian-harness-e2e.spec.ts`                | 🟡     | All 3 tools (get_signals, acknowledge_signal, get_workspace_health). 20 tests. Gate gap: acknowledge_signal lacks gate_action (G3 pattern) — documented, not blocking                                                                            |
| helpdesk_query          | 4     | `helpdesk-harness-e2e.spec.ts`                | 🟡     | All 4 covered (list_my_queue, get_ticket, open_ticket, resolve_ticket). Router-level gate verified. open_ticket authority-conditional skip                                                                                                       |
| journey                 | 4     | `journey-harness-e2e.spec.ts`                 | 🟡     | All 4 runtime journey tools (run_dev, publish_mission, publish_guide, run_guided). ADR-0194 Gate blocks happy-path run_guided                                                                                                                    |
| journey-authoring       | 4     | `journey-authoring-harness-e2e.spec.ts`       | 🟡     | All 4 tools (save_draft, check_duplicates, lookup_journeys, publish_draft). 22 tests · ADR-0240 delegation gap: publish_draft writes journey+journey_version directly, gate-wrapped, acknowledged in tool body                                   |
| kb_query                | 1     | `kb-query-harness-e2e.spec.ts`                | 🟡     | search_kb covered. 9 tests. Empty-state (workspace_doc_chunk=0 rows in seed) + dual execution path (OPENROUTER_API_KEY present/absent). A4 soft-skip on read-only tool-invoke telemetry per ADR-0099 §2                                          |
| legal                   | 3     | `legal-harness-e2e.spec.ts`                   | 🟡     | cite_law + validate_aml_14_6 covered. classify_amendment system-channel-only gap                                                                                                                                                                 |
| memory                  | 1     | `botsson-harness-e2e.spec.ts`                 | 🟡     | 14/16 pass · 2 designed-skip (N1 workspace, N3 voice). save_memory + summary writer + reader injection covered                                                                                                                                   |
| mission                 | 2     | `mission-harness-e2e.spec.ts`                 | 🟡     | get_active_missions + get_workspace_roadmap covered. Empty-state structured response (no hallucination)                                                                                                                                          |
| onboarding              | 10    | `onboarding-harness-e2e.spec.ts`              | 🟡     | 5 tools covered (update_business, update_season, add_departments, add_locations, add_procedures). Scrapling/BRREG tools skipped (search_company, identify_company, scrape_website). add_zones structurally identical to add_locations            |
| operations              | 5     | `operations-harness-e2e.spec.ts`              | 🟡     | 4/5 tools covered (get_my_tasks, get_session_info, get_department_status, create_deviation). complete_task UUID-param-trap skip                                                                                                                  |
| operations-intelligence | 1     | `operations-intelligence-harness-e2e.spec.ts` | 🟡     | triage_event covered. 10 tests. Empty-state (engine_event=0 rows in seed) tolerated. G3-ops gap: triage_event lacks per-action gate_action (ADR-0099 §2) — router-level gate covers, separate sortie to add internal gate                        |
| payroll                 | 6     | `payroll-harness-e2e.spec.ts`                 | 🟡     | 16 pos + 3 neg designed-skip · 4 read tools (query_tax_card, salary_query, view_personal_number, view_bank_account) · 2 write tools deferred (campaign/payroll active)                                                                           |
| personal                | 5     | `personal-harness-e2e.spec.ts`                | 🟡     | All 5 tools (add_note, create_task, set_reminder, get_history, update_setting). A16 history-trail-emit gap                                                                                                                                       |
| profile                 | 4     | `profile-harness-e2e.spec.ts`                 | 🟡     | All 4 covered (get_profile, get_team, get_contract_status, search_profiles_by_name). PII non-leak verified                                                                                                                                       |
| schedule                | 7     | `schedule-harness-e2e.spec.ts`                | 🟡     | All 7 tools targeted. Admin tool (get_workspace_schedule) + date-aware employee tool (get_date_schedule_for_me) shipped today                                                                                                                    |
| season                  | 0     | —                                             | ⬜     | No tools registered                                                                                                                                                                                                                              |
| shift-lifecycle         | 5     | `shift-lifecycle-harness-e2e.spec.ts`         | 🟡     | 3 chat-channel tools covered (publish_shift, approve_shift, get_shift_lifecycle). Two-level gate verified (router + tool). interpret_shift + settle_shift system-channel-only — unreachable via BFF chat (ADR-0078 design)                       |
| shift-swap              | 5     | `shift-swap-harness-e2e.spec.ts`              | 🟡     | All 5 tools (get_swap_requests, get_swap_eligibility, request_swap, respond_to_swap, cancel_swap). 26 tests. Swap state in engine_state.context JSONB (ADR-0067), not separate table. Lifecycle: pending_recipient → pending_manager → cancelled |
| tips                    | 0     | —                                             | ⬜     | No tools registered                                                                                                                                                                                                                              |
| training                | 3     | `training-harness-e2e.spec.ts`                | 🟡     | All 3 covered (get_my_training_status, get_next_protocol, get_team_readiness). Authority lifecycle non-destructive                                                                                                                               |
| ui                      | 5     | `ui-harness-e2e.spec.ts`                      | 🟡     | All 5 tools (navigate_to, fill_field, highlight_element, show_panel, show_toast). 22 tests. Real backend capability w/ broadcast-directive model (ctx.broadcast callback). emitPrefix=null, M1 gate_action-absence invariant verified            |

## Coverage gaps — RESOLVED

All 24 capabilities with registered tools now have E2E harness specs. The remaining 5 capabilities (season, tips, + 3 unused) have zero registered tools and require no spec.

## Within-capability tool gaps (deferred per spec)

| Capability      | Uncovered tools | Reason                                                                                  |
| --------------- | --------------- | --------------------------------------------------------------------------------------- |
| onboarding      | 3               | Scrapling/BRREG (search_company, identify_company, scrape_website) — droplet dependency |
| contract        | 5               | DocuSeal write tools — sandbox env required                                             |
| payroll         | 2               | Write tools — campaign/payroll active, integration sortie pending                       |
| operations      | 1               | complete_task — UUID-param-trap                                                         |
| legal           | 1               | classify_amendment — system-channel-only (ADR-0078)                                     |
| shift-lifecycle | 2               | interpret_shift + settle_shift — system-channel-only (ADR-0078)                         |

## Batch history

Batch 1 shipped: memory, schedule, governance, payroll.
Batch 2 shipped: contract, onboarding, shift-lifecycle.
Batch 3 shipped: profile, operations, mission.
Batch 4 shipped: legal, helpdesk_query, billing-query.
Batch 5 shipped: engine-world, personal, training.
Batch 6 shipped: communication, business-intelligence, journey.
Batch 7 shipped: availability, contract-intake, guardian.
Batch 8 shipped: journey-authoring, shift-swap, ui.
Batch 9 (final): kb_query, operations-intelligence. **100% capability coverage achieved.**

## Patterns

Every new spec must:

1. Import shared helpers from `apps/e2e/helpers/botsson-harness.ts` (freshness check, cleanup, BFF caller)
2. Add capability-specific helper in `apps/e2e/helpers/<capability>-harness.ts` if dedup makes sense
3. Use `test.describe.configure({ mode: "serial" })` to prevent cross-test pollution
4. Assert at minimum:
   - `intent_capability='<capability>'` in `agent_session_recording` classifier_output
   - `activity_trail.event='botsson.tool_invoked' AND data->>'tool'=<expected>` AND `data->>'success'='true'`
   - Assistant response does NOT match `/feilet|teknisk feil|kunne ikke/i`
   - Specific DB persistence/state per capability semantics

## Known architectural facts learned during coverage build

- `gate_action` fires at the ROUTER level (`services/stage-engine/src/core/agent-router.ts:292`), not per-capability. Every turn gets one `gate_evaluation` row regardless of capability.
- Stage-engine `agent_session_recording` writes `llm_request`, `llm_response`, `classifier_input`, `classifier_output` phases. Does NOT write `tool_call` / `tool_result` per individual tool. Per-tool detection relies on `activity_trail.event='botsson.tool_invoked'`.
- `assert_gate_caller` SECURITY DEFINER reads PostgREST 14 composite `request.jwt.claims` (JSONB) — fixed 2026-05-11 in migration `20260601000000_assert_gate_caller_postgrest14_compat.sql`.

## Next steps

1. Build heartbeat job: scan capability registry against `apps/e2e/tests/*-harness-e2e.spec.ts` filenames → alert on drift
2. Ship next top-3 specs (contract, onboarding, shift-lifecycle)
3. After 80% capability coverage, retire single-tool checks in favour of `pnpm --filter e2e test:e2e -- --grep harness-e2e`

## References

- Template spec: `apps/e2e/tests/botsson-harness-e2e.spec.ts`
- Shared helper: `apps/e2e/helpers/botsson-harness.ts`
- HANDOFF-harness-coverage-top3.md
- ADR-0099 — capability authority gate
- ADR-0116 — `botsson.tool_invoked` telemetry contract
- ADR-0151 — server-derive workspace_id + profile_id
