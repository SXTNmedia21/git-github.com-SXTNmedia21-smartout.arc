---
title: Slice 01 — capability-tools Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, capability-tools, adr]
run: 2026-05-20
baseline: 2026-05-18 (01-capability-tools.md)
adrs: [0151, 0173, 0186, 0204, 0238, 0240]
traps: [L-0176, L-0177]
scope: packages/ai/src/capabilities/**/tools.ts
files_in_scope: 37
---

# Slice 01: Capability Tools Audit (2026-05-20)

## Summary

Top 5 findings ranked by severity:

1. **M-001 (carryover)** — `billing-query/tools.ts:255,270` body-supplied `workspace_id` accepted as scope filter → cross-workspace read inside same company. ADR-0151 violation. Unchanged since 2026-05-18.
2. **M-002 (carryover)** — `payroll/tools.ts:1104,1186` `adjust_timebank_balance` + `force_timebank_payout` use callGateAction + direct insert, no gatedMutation wrapper. ADR-0204 gap. Unchanged.
3. **M-003 (carryover)** — `shift-lifecycle/tools.ts:177,350` `publish_shift` + `approve_shift` callGateAction + direct update, no gatedMutation. ADR-0204 gap. Unchanged.
4. **M-004 (carryover)** — `timeline-template/tools.ts:332-345` `apply_template` inserts `session_hook` directly without delegating to owning capability. ADR-0173 delegation gap. Unchanged.
5. **M-005 (NEW)** — `personal/tools.ts:256-304` + `helpdesk_query/tools.ts:133,385` cross-namespace inserts into `engine_event` / `engine_trigger` / `engine_delayed_trigger` + `channel_member` directly from non-owning capabilities. ADR-0173 delegation gap, same class as M-004.

Zero CRITICAL. Zero HIGH. Five MEDIUM (4 carryover + 1 new). Three LOW (carryover). No new ADR violations introduced by post-baseline merges (PR #430 mobile-voice, PR #431 ui-shell-followup, ADR-0367 BT2 routine+org).

In-progress files in active worktrees (last 2-3 days): `day-line/tools.ts` (BT1), `org/tools.ts` (BT2), `routine/tools.ts` (BT2), `cascade/tools.ts`, `task/tools.ts`, `shift-swap/tools.ts`, `shift_marketplace/tools.ts` — graded "in-progress" not "violation" per slice-prompt rules; all show clean gate+emit+L-0177 patterns.

---

## Findings table

| ID | severity | file:line | ADR | evidence |
|---|---|---|---|---|
| M-001 | MEDIUM | `billing-query/tools.ts:255,270` | 0151 | Schema accepts `workspace_id` as body param; `.eq("workspace_id", params.workspace_id)` enables cross-workspace read inside same `company_id` anchor. |
| M-002 | MEDIUM | `payroll/tools.ts:1104,1186` | 0204 | callGateAction at L1085 + direct `.schema("payroll").from("timebank_entry").insert(...)` outside gatedMutation/mutateWithGate. Same pattern at L1186 force_timebank_payout. |
| M-003 | MEDIUM | `shift-lifecycle/tools.ts:177,350` | 0204 | `publish_shift` + `approve_shift` callGateAction + direct `.from("shift_approval").update(...)` outside gatedMutation. |
| M-004 | MEDIUM | `timeline-template/tools.ts:332-345` | 0173, 0240 | `applyTemplate` session_hook branch inserts directly into `session_hook` (a D6 governance-owned table) without delegating to operations or governance capability. |
| M-005 | MEDIUM | `personal/tools.ts:256-304`; `helpdesk_query/tools.ts:133,385` | 0173, 0240 | Cross-namespace inserts: `personal.set_reminder` writes 3 engine tables; `helpdesk_query.open_ticket` writes `channel_member` + `engine_delayed_trigger`. No delegation to owning capability. |
| L-001 | LOW | `billing-query/tools.ts:249-279` | 0186 | `get_usage_snapshot` returns `counted_profile_ids` (PII-adjacent) with no `emit()` read-audit event. Carryover. |
| L-002 | LOW | `schedule/tools.ts:138` | n/a | `getShiftColleagues` first query uses `.eq("id", params.shift_id)` vs canonical `schedule_shift_id`; second query L148 uses correct PK. Inconsistency. Carryover. |
| L-003 | LOW | `contract-intake/tools.ts:396-445` | n/a | `get_intake_progress` reads PII columns (personal_number, bank_account, address) without gate; self-scoped read but no audit. Carryover. |

---

## Per-ADR rollup (file-level, in-scope mutation tools only)

| ADR | compliant | partial | violation |
|---|---|---|---|
| 0151 (server-derived workspace_id) | 36 | 0 | 1 (billing-query M-001) |
| 0173 (frozen-4 capability boundary) | 33 | 0 | 4 (timeline-template M-004, personal M-005, helpdesk_query M-005, onboarding writes to season/season_budget) |
| 0186 (telemetry/emit on mutations) | 37 | 0 | 0 (all mutations emit; L-001 is read-side observability) |
| 0204 (gatedMutation composition) | 31 | 6 | 0 (payroll, shift-lifecycle, operations, day-line, task, onboarding use "callGateAction + direct write" payroll convention; flagged MEDIUM, not HIGH per baseline rubric) |
| 0238 (Botsson surface disambiguation) | n/a | n/a | n/a (no tool-level surface declarations; enforced at BotssonShell composition layer outside slice scope) |
| 0240 (cross-namespace delegation) | 33 | 0 | 4 (same set as ADR-0173) |

---

## Verified intentional

- **FP-001** validate_aml_14_6 channel "inversion" — not in this slice's scope (legal/tools.ts in slice 06).
- **Payroll "gate-then-direct" convention** — 6 capabilities (payroll, shift-lifecycle, operations, day-line, task, onboarding) all use callGateAction + direct write. Documented intent per baseline §Notes. Recommend formal ADR-0204 amendment or migration to mutateWithGate. Not re-flagged as new finding; tracked as M-002/M-003 sub-class.
- **Onboarding writes to `season` + `season_budget`** (`onboarding/tools.ts:255,280`) — onboarding is the "first writer" for these tables during workspace bootstrap; arguably owns them in I1 phase. Borderline ADR-0173; flagged here under M-005 rollup but not promoted to its own finding because the docstring explicitly cites ADR-0173 and ADR-0240 as considered. Recommend explicit ADR exemption.
- **Day-line, routine, org (ADR-0367 BT1/BT2)** — all three NEW capabilities (merged 2026-05-18 commits 590bb9154, 339745052) demonstrate the correct delegation pattern: routine.attach_to_line and day-line.add_item delegate to `task.createSession.execute(...)` and `applyTemplate.execute(...)` rather than writing session_task / session_hook directly. ADR-0240 + ADR-0356 Pattern B audit symmetry (actor_capability + delegated_via) emitted correctly. L-0177 fail-fast via `nonEmpty(ctx.workspaceId)` + cross-workspace verification of `day_line.workspace_id === ctx.workspaceId` and `department.workspace_id === ctx.workspaceId`. Working as designed — establishes the canonical delegation pattern.
- **engine-world (ADR-0290)** — `engine-world/tools.ts:204-236` uses `gatedMutation` correctly; UPSERT inside execute callback. Cross-workspace read uses platform RPC `read_surface` with SECURITY DEFINER. Working as designed.

---

## In-progress (mid-campaign)

The following files belong to active worktrees with commits in last 72h. Issues flagged here are "in-progress" status, not violations:

- `packages/ai/src/capabilities/day-line/tools.ts` (BT1, ADR-0367) — clean. No findings.
- `packages/ai/src/capabilities/org/tools.ts` (BT2, ADR-0367) — clean. No findings.
- `packages/ai/src/capabilities/routine/tools.ts` (BT2, ADR-0367) — clean. No findings.
- `packages/ai/src/capabilities/task/tools.ts` — already cleared in baseline (5 tools PASS); recent change e77655108 adds `description` + `scheduled_at` to create_session — no new mutation paths, schema-only extension. Clean.
- `packages/ai/src/capabilities/shift-swap/tools.ts` + `shift_marketplace/tools.ts` — already cleared in baseline (all PASS via mutateWithGate).
- `packages/ai/src/capabilities/cascade/tools.ts` — already cleared in baseline. Recent commits 326999a1f + 6e60f6547 add ADR-0356 Pattern B audit symmetry; emit includes `actor_capability` + `delegated_via`. Clean.

---

## Delta vs 2026-05-18 baseline

- **No new HIGH or CRITICAL findings.**
- **M-001 / M-002 / M-003 / M-004**: all unchanged — fixes deferred to remediation sortie.
- **M-005 (NEW)**: cross-namespace inserts in `personal` + `helpdesk_query`. Both files existed pre-baseline but were NOT traced in baseline's per-tool table. They use the same payroll-convention pattern (gate + direct write) but to **engine-namespace tables** (engine_event, engine_trigger, engine_delayed_trigger) rather than capability-owned tables. ADR-0173 delegation gap. Same class as M-004 timeline-template/session_hook.
- **+3 new files (day-line, routine, org)**: all clean. Establish reference pattern for ADR-0240 delegation done correctly.
- **6 files identified as in-progress**: graded per slice-prompt §3 active-campaign filter.

---

## Trust Gate verdict (mutation tools, this run)

Net result: **5 MEDIUM (4 carryover + 1 new), 3 LOW carryover, 0 HIGH, 0 CRITICAL.**

Baseline rubric preserved: payroll-convention gate-then-direct is graded MEDIUM not HIGH because the C4 gate IS evaluated before every write. The gap is `gatedMutation` audit-log linkage (change_proposal / gate_evaluation linkage to write event), not the gate itself.

**Recommended remediation sortie scope:**

1. M-001 fix (1-line: derive workspace_id from ctx, drop schema field).
2. ADR-0204 amendment to acknowledge "callGateAction + direct write" as approved variant when workspace scoping + emit() are present — or migration sortie for all 6 capabilities to `mutateWithGate`.
3. M-004 + M-005 delegation pattern: either (a) delegate session_hook + engine_* writes to owning capability tools, or (b) draft ADR-0173 exemption listing the 3 capabilities (personal, helpdesk_query, timeline-template) as authorized writers to engine namespace.
4. L-002 schedule_shift PK column verification.

---

## Notes

1. **Pattern crystallizes**: ADR-0367 BT1/BT2 (day-line + routine + org) is the canonical reference for "delegation done right" — pre-flight workspace verification (L-0177 fail-fast), C4 gate via capability-scoped gate.ts, delegation via `.execute()` call on owning tool, Pattern B emit symmetry (actor_capability + delegated_via).
2. **Pre-existing capabilities (personal, helpdesk_query, onboarding) need retrofit** to match this reference pattern OR explicit ADR-0173 exemptions documenting why they own writes to engine_* and season_* namespaces during specific lifecycle phases.
3. **41% of mutation tools traced (16/39)** use full `mutateWithGate` / `gatedMutation`; **44% (17/39)** use payroll-convention gate-then-direct; **15% (6/39)** are read-only or no mutations. The two patterns coexisting without an authoritative ADR is the root drift driver.
4. No ADR-0238 (Botsson surface) violations observed at tool layer — that ADR enforces at the BotssonShell composition site, not inside capability execute bodies.
5. **L-0176 docstring-drift check**: spot-checked day-line + routine + org docstrings against bodies. All match. No new L-0176 drift.
6. **L-0177 silent-fallback check**: 3 new capabilities all use `nonEmpty(ctx.workspaceId)` + explicit row-belongs-to-workspace verification. No silent fallback patterns observed. The pre-existing `personal.set_reminder` and `helpdesk_query.open_ticket` paths use raw `ctx.workspaceId` without nonEmpty — minor L-0177 hygiene gap but not silent-fallback class (no body-supplied row reference).
