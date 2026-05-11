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

**Updated:** 2026-05-11
**Total capabilities:** 29
**Total tools:** 124
**Covered:** 4 capabilities · 19 tools · 15% by tool count

## Status legend

| Symbol | Meaning                                                |
| ------ | ------------------------------------------------------ |
| 🟢     | E2E harness spec exists, all positive assertions pass  |
| 🟡     | E2E spec exists with documented skipped negative paths |
| 🔴     | No E2E harness spec — uncovered                        |
| ⬜     | Capability has 0 tools (placeholder / stub)            |

## Matrix

| Capability              | Tools | Spec                             | Status | Notes                                                                                                                                                                  |
| ----------------------- | ----- | -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| availability            | 3     | —                                | 🔴     |                                                                                                                                                                        |
| billing-query           | 6     | —                                | 🔴     | Erik portal data — high priority                                                                                                                                       |
| business-intelligence   | 6     | —                                | 🔴     |                                                                                                                                                                        |
| communication           | 5     | —                                | 🔴     |                                                                                                                                                                        |
| contract                | 10    | —                                | 🔴     | DocuSeal + signature flow critical                                                                                                                                     |
| contract-intake         | 3     | —                                | 🔴     |                                                                                                                                                                        |
| engine-world            | 3     | —                                | 🔴     | Phase 1+2 shipped 2026-05-06, ready for E2E                                                                                                                            |
| governance              | 1     | `governance-harness-e2e.spec.ts` | 🟡     | gate_action verified at router level. 2 designed-skip (LiveKit, employee profile). Brief gap: list_change_proposals + get_governance_summary don't exist in registry   |
| guardian                | 3     | —                                | 🔴     |                                                                                                                                                                        |
| helpdesk_query          | 4     | —                                | 🔴     |                                                                                                                                                                        |
| journey                 | 4     | —                                | 🔴     |                                                                                                                                                                        |
| journey-authoring       | 4     | —                                | 🔴     |                                                                                                                                                                        |
| kb_query                | 1     | —                                | 🔴     |                                                                                                                                                                        |
| legal                   | 3     | —                                | 🔴     | cite_law tool — frequent voice path                                                                                                                                    |
| memory                  | 1     | `botsson-harness-e2e.spec.ts`    | 🟡     | 14/16 pass · 2 designed-skip (N1 workspace, N3 voice). save_memory + summary writer + reader injection covered                                                         |
| mission                 | 2     | —                                | 🔴     | get_my_missions + getWorkspaceRoadmap                                                                                                                                  |
| onboarding              | 10    | —                                | 🔴     | Wizard surface — separate journey coverage may exist in onboarding/\* test files                                                                                       |
| operations              | 5     | —                                | 🔴     |                                                                                                                                                                        |
| operations-intelligence | 1     | —                                | 🔴     |                                                                                                                                                                        |
| payroll                 | 6     | `payroll-harness-e2e.spec.ts`    | 🟡     | 16 pos + 3 neg designed-skip · 4 read tools (query_tax_card, salary_query, view_personal_number, view_bank_account) · 2 write tools deferred (campaign/payroll active) |
| personal                | 5     | —                                | 🔴     |                                                                                                                                                                        |
| profile                 | 4     | —                                | 🔴     | get_my_profile commonly invoked                                                                                                                                        |
| schedule                | 7     | `schedule-harness-e2e.spec.ts`   | 🟡     | All 7 tools targeted. Admin tool (get_workspace_schedule) + date-aware employee tool (get_date_schedule_for_me) shipped today                                          |
| season                  | 0     | —                                | ⬜     | No tools registered                                                                                                                                                    |
| shift-lifecycle         | 5     | —                                | 🔴     | Write-side lifecycle — gate_action critical here                                                                                                                       |
| shift-swap              | 5     | —                                | 🔴     |                                                                                                                                                                        |
| tips                    | 0     | —                                | ⬜     | No tools registered                                                                                                                                                    |
| training                | 3     | —                                | 🔴     |                                                                                                                                                                        |
| ui                      | 5     | —                                | 🔴     | UI surface tools (likely page-tool registry, not capability)                                                                                                           |

## Coverage gaps ranked by leverage

| Rank | Capability      | Tools | Rationale                                                         |
| ---- | --------------- | ----- | ----------------------------------------------------------------- |
| 1    | contract        | 10    | Production-blocking — DocuSeal signature flow, contract lifecycle |
| 2    | onboarding      | 10    | Wizard surface drives 40% of new-workspace traffic                |
| 3    | shift-lifecycle | 5     | Write-side gate path; cascade integrity depends                   |
| 4    | operations      | 5     | Daily ops dashboard tool calls                                    |
| 5    | mission         | 2     | Roadmap + active missions — surfaced often in chat                |
| 6    | profile         | 4     | get_my_profile is one of most-invoked tools                       |
| 7    | legal           | 3     | cite_law voice path                                               |
| 8    | helpdesk_query  | 4     | Sales surface (channels-som-helpdesk)                             |
| 9    | billing-query   | 6     | Erik portal                                                       |
| 10   | engine-world    | 3     | Phase 1+2 shipped 2026-05-06                                      |

Next 3 sorties (suggested): contract, onboarding, shift-lifecycle.

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
