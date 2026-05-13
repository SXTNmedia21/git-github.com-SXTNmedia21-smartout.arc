---
title: Audit slice 01 — capability-tools
slice: capability-tools
mode: smoke
created: 2026-05-14
findings_critical: 0
findings_high: 0
findings_medium: 0
findings_low: 0
---

# Audit slice 01 — capability-tools

**Scope:** `packages/ai/src/capabilities/**/tools.ts` (29 files, 43 mutation tools, 89 read-only tools)
**ADRs checked:** 0151, 0173, 0186, 0204, 0238, 0240, 0287, 0303
**Known-false-positives applied:** FP-001 (legal allowedChannels), FP-005 (legal/lovsen_query keys)
**Active-campaign filter applied:** wt-1, wt-10, wt-11

---

## Method summary

1. Grepped all 29 `tools.ts` files for direct `supabase.from().insert|update|delete|upsert` calls.
2. For each direct write found, traced whether a `callGateAction` / `gatedMutation` / `mutateWithGate` / `gateTaskAction` call precedes it in the same `execute` body.
3. Ran `scripts/gate-action-coverage.ts --baseline` (ADR-0287 CI-gated script) — returned 0 violating, 43 passing, 89 read-only.
4. Checked schema definitions for body-supplied `workspace_id` / `profile_id` (ADR-0151 / ADR-0238 / L-0177).
5. Checked for cross-namespace writes (ADR-0173 / ADR-0240).
6. Checked D6 table writes for correct capability ownership (ADR-0303 sister-sweep).

---

## CRITICAL

None.

---

## HIGH

None.

---

## MEDIUM

None.

---

## LOW

None.

---

## Verified (no findings)

- **ADR-0151 / L-0177 — server-derive identity, fail-fast on row-not-found**
  All body-supplied `profile_id` values (e.g. `payroll/tools.ts:updatePayrollProfile`, `contract/tools.ts:create_employee_contract`, `task/tools.ts:create_session_task`) perform a workspace-scoped row lookup before the mutation and return a 4xx-shaped error string on not-found. No silent fallback to JWT-default workspace or JWT-default profile detected.

- **ADR-0204 / ADR-0287 — gatedMutation or callGateAction before every mutation**
  Automated scan (`scripts/gate-action-coverage.ts`): 43 mutation tools, 0 violating.
  Manual trace on 9 direct `supabase.from()` write sites:
  - `helpdesk_query/tools.ts:133` (channel_member.insert) — inside gate-approved block, callGateAction at line 57.
  - `helpdesk_query/tools.ts:385` (engine_delayed_trigger.insert) — inside SLA-breach helper, callGateAction at caller tool (line 517).
  - `journey/tools.ts:239,242` (engine_state_step.insert, engine_state.delete) — inside gate-approved block, callGateAction at line 116.
  - `journey/tools.ts:461,497,503` (engine_missions.insert, engine_stages.insert, engine_missions.delete) — inside gate-approved block, callGateAction at line 435.
  - `journey/tools.ts:991,994` — same pattern as above (second run_dev tool).
  - `onboarding/tools.ts:274` (season_budget.insert) — inside gate-approved block, callGateAction at line 232.
  All clear.

- **ADR-0238 / ADR-0151 — workspace_id in tool schema (L-0177 cross-check)**
  Two tools accept `workspace_id` in schema:
  - `availability/tools.ts:queryOthersAvailability` — used ONLY as a cross-workspace guard (`if (params.workspace_id !== ctx.workspaceId) return mismatch`); actual DB queries use `ctx.workspaceId`. Correct defense-in-depth.
  - `billing-query/tools.ts:get_usage_snapshot` — read-only, no mutation; `company_id` resolved from `ctx` via `resolveCompanyId(ctx)`. Billing queries are cross-workspace by design (platform-admin surface). Acceptable.
  No body-supplied workspace used as authoritative isolation key.

- **ADR-0173 — frozen-4 capability boundary (cross-namespace writes)**
  `journey-authoring/tools.ts:publishDraftTool` writes to `journey` and `journey_version` tables. ADR-0240 follow-up note at line 452-457 explicitly acknowledges this is the only-writer surface for those tables (journey-authoring is the sole insert path; journey capability only reads them). The writes are inside `gatedMutation().execute` callback. Tracked for future delegation refactor; does not constitute a boundary violation under current ADR-0240 language ("delegation where possible").

- **ADR-0240 — no cross-namespace writes without delegation**
  `onboarding/tools.ts` — no writes to `journey`, `journey_version`, `engine_missions`, or `engine_stages` tables. Verified by grep.

- **ADR-0186 — Guardian event emission**
  `guardian/tools.ts:acknowledge_signal` — calls `callGateAction` at line 71 before the `guardian_signal.update`. No phantom emit detected. Tool does not emit a guardian event itself (appropriate — guardian signals are created by the stage engine / guardian evaluator, not by capability tools).

- **ADR-0303 sister-sweep — D6 writes outside gateTaskAction-like pattern**
  D6 table writes (`session_task`, `department_session`, `schedule_shift`) traced:
  - `task/tools.ts` — all session_task writes behind `gateTaskAction` + workspace-scoped row lookup.
  - `shift-lifecycle/tools.ts` — `schedule_shift.update` (publish_shift) behind `callGateAction` at line 156.
  - `schedule/tools.ts`, `operations/tools.ts`, `operations-intelligence/tools.ts`, `payroll/tools.ts` — all `schedule_shift` accesses are `.select()` reads. No rogue D6 writes.

- **L-0176 — docstring compliance claims match body**
  Spot-checked three docstrings with explicit ADR compliance claims:
  - `payroll/tools.ts:69` — claims "gate-then-update is the established payroll convention". Body confirms: `callGateAction` at line 146, then workspace-scoped fetch at line 162, then `.update()` at line 200. Docstring accurately describes the pattern.
  - `engine-world/tools.ts:10,21` — claims `gatedMutation (ADR-0204)`. Body confirms: `gatedMutation(supabase, {...})` at line 204 with `execute` callback containing the `.upsert()` at line 237.
  - `journey-authoring/tools.ts:283-284` — claims `gatedMutation wraps all 3 writes`. Body confirms: single `gatedMutation` call at line 460, three writes inside the `execute` callback (lines 482, 508, 535).

- **ADR-0287 CI gate status**
  `scripts/gate-action-coverage.ts` exists, runs against `packages/ai/src/capabilities/**/tools.ts`. Script is in `--baseline` mode (exit 0). The promotion to `--strict` (exit 1) is a pending action per ADR-0287 — not a violation, but a known open item. The CI pipeline's `.github/workflows/` integration was shipped per F-DB-11 (`88b6abcf5`).

---

## Summary

Clean across all 6 ADRs in scope. 29 capability tool files, 43 mutation tools, 89 read-only tools. The automated CI gate (gate-action-coverage.ts) confirms 0 violations. Manual traces of 9 direct write sites confirm gate ordering is correct. The only structural caveat is journey-authoring's cross-namespace write to `journey`/`journey_version` — acknowledged in-body under ADR-0240 and gated inside `gatedMutation`, so risk is contained.
