---
title: "Harness Coverage Top-3 Batch 3 — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: ai
tags: [e2e, harness, coverage, profile, operations, mission]
---

# Harness Coverage Top-3 Batch 3 — HANDOFF

## What was built

Three new E2E harness specs.

| Spec | Tools covered | Tests / Skips |
|------|---------------|---------------|
| `apps/e2e/tests/profile-harness-e2e.spec.ts` | get_profile, get_team, get_contract_status, search_profiles_by_name | 16 pos + 2 neg, ~40 expects |
| `apps/e2e/tests/operations-harness-e2e.spec.ts` | get_my_tasks, get_session_info, get_department_status, create_deviation | 7 tests, ~20 hard assertions, complete_task skipped (UUID trap) |
| `apps/e2e/tests/mission-harness-e2e.spec.ts` | get_active_missions, get_workspace_roadmap | 10 pos + 3 skip, 2/2 tools covered |

## Decisions

### D1: Pattern reuse from batches 1-2
Three agents dispatched parallel on wt-10. Per-spec helper files added where dedup made sense.

### D2: UUID-param-trap pattern documented
operations `complete_task` requires UUID task_id parameter. LLM cannot extract UUID from natural language. Same class as schedule `get_shift_colleagues` (G-SC-COL-01) and `get_shift_detail` (G-SC-DET-01). Tracked as G-OPS-CTASK-01. Pattern requires two-step extraction or fixture-driven UUID injection.

### D3: read_only defaultAuthority skips deny tests
Profile + mission capabilities both default `read_only`. No engine_authority_config row needed. No deny path exists for read tools. N1 (authority denial) skipped by design with documented reason — same as governance + helpdesk batches.

### D4: DOCUSEAL_WEBHOOK_SECRET stub fix in start script
mission agent discovered `apps/e2e/scripts/start-local-next-app.sh` missing `DOCUSEAL_WEBHOOK_SECRET` export — caused 500 on all BFF routes. Fix landed in wt-10 commit. Must backport pattern to main-repo if not already there.

## Known issues / debt

1. UUID-param-trap (D2) — affects complete_task + get_shift_colleagues + get_shift_detail. Generic solution: extract UUID resolution into a fixture-helper.
2. Workspace isolation tests skipped (N3 in mission) — requires second workspace user not in seed.
3. Voice channel guard tests skipped across all specs — Playwright cannot drive LiveKit. Unit-test coverage exists.

## Next steps

1. Merge to development.
2. Refresh `apps/e2e/coverage.md`: profile/operations/mission → 🟡
3. Coverage post-batch-3: 10/29 capabilities = 34%, 43/124 tools = 35%
4. Next top-3 (suggested by batch 4 in flight): legal, helpdesk_query, billing-query

## References

- Template: `apps/e2e/tests/botsson-harness-e2e.spec.ts`
- Prior batches: HANDOFF-harness-coverage-top3.md (batch 1), HANDOFF-harness-coverage-top3-batch2.md (batch 2)
- ADR-0078 channel guard, ADR-0099 capability authority, ADR-0151 server-derive IDs, ADR-0116 tool_invoked telemetry
