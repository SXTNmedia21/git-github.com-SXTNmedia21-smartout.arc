---
title: "Harness Coverage Top-3 — HANDOFF"
status: done
updated: 2026-05-11
created: 2026-05-11
module: ai
tags: [e2e, harness, coverage, schedule, governance, payroll]
---

# Harness Coverage Top-3 — HANDOFF

## What was built

Three new E2E harness specs covering top-leverage capabilities:

| Spec | Tools | Pass / Skip / Fail |
|------|-------|--------------------|
| `apps/e2e/tests/schedule-harness-e2e.spec.ts` | 7 schedule tools (get_my_shifts, get_today_schedule, get_workspace_schedule, get_date_schedule_for_me, get_shift_colleagues, get_shift_detail, get_shift_lifecycle) | TBD per run |
| `apps/e2e/tests/governance-harness-e2e.spec.ts` | gate_action + change_proposal flows | 8 pass + 2 designed-skip |
| `apps/e2e/tests/payroll-harness-e2e.spec.ts` | 4 read tools (query_tax_card, salary_query, view_personal_number, view_bank_account) | 16 positive + 3 negative designed-skip |

Plus side-fix in `apps/e2e/scripts/ensure-local-e2e-runtime-fixture.mjs`: `listUsers()` default perPage=50 missed auth users 51+ in post-Bubble-migration environments. Bumped to perPage=1000.

## Decisions

### D1: Three parallel agents, one spec each, shared base helper
Dispatched 3 botsson-harness-builder agents simultaneously. Each owned ONE new spec file. Helpers in `apps/e2e/helpers/<capability>-harness.ts` per capability. No file collisions, no merge conflicts.

### D2: gate_action fires at ROUTER level, NOT per-capability
Governance agent discovered: `gate_evaluation` table receives one row per agent turn via `services/stage-engine/src/core/agent-router.ts:292`. ADR-0099 §2 exempts read-only tools from calling `gate_action` in their execute() bodies — but not from the router-level gate. Specs that assumed "no gate_evaluation row for read tool" were wrong; corrected.

### D3: tool_call / tool_result phases not recorded
Stage-engine `agent_session_recording` writes `llm_request` + `llm_response` + `classifier_input` + `classifier_output` phases. Does NOT write `tool_call` / `tool_result` per individual tool. Per-tool detection relies on `activity_trail.event='botsson.tool_invoked' AND data->>'tool'=<name>`. Specs adapted.

### D4: Spec must include `payroll` lønnsgrunnlag-not-lønnsslipp noun guard
Per project positioning memory (2026-05-08), `lønnsslipp` is the wrong word — Smartout produces `lønnsgrunnlag`. Payroll spec includes assertion `A5/A10/A16` asserting LLM response does NOT contain `lønnsslipp`.

## Known issues / debt

1. Schedule spec local run pending. Run via `pnpm --filter e2e test:e2e -- tests/schedule-harness-e2e.spec.ts` after merge to verify clean.
2. Governance spec had to skip `get_governance_summary` + `list_change_proposals` — those tool names do NOT exist in `packages/ai/src/capabilities/governance/tools.ts`. The brief was wrong. Actual governance read tools to be enumerated next sortie.
3. Per-tool recording phases gap (D3) — limits granularity of failure isolation. Tracked separately for future stage-engine recorder enhancement.
4. Coverage matrix not yet built. Next sortie: scan all 20+ capabilities + record matching spec presence in `apps/e2e/coverage.md`.

## Next steps

1. Build `apps/e2e/coverage.md` matrix listing all capabilities + E2E presence
2. Add capability-without-spec heartbeat detection (proposal — needs ADR if drift-job pattern not already established)
3. Run all 3 new specs end-to-end on next preview environment to validate
4. Enumerate next top-3 capabilities for coverage (likely mission, contract, kb_query)

## References

- Template: `apps/e2e/tests/botsson-harness-e2e.spec.ts` (shipped earlier same day)
- Shared helper: `apps/e2e/helpers/botsson-harness.ts`
- ADR-0099 — capability authority gate
- ADR-0151 — server-derive workspace_id + profile_id
- L-0231 — stage-engine subpath imports require @smartout/ai dist
