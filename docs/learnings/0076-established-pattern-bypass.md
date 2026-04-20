---
title: "Established-pattern bypass: new feature silently ignores workspace-aware infrastructure"
id: L-0076
status: accepted
layer: learning
module: meta
created: 2026-04-20
updated: 2026-04-20
tags: [learnings, code-trace, workspace-context, council, trust-gate]
---

# Learning-0076: New feature bypassed existing workspace-aware hook, shipped wrong-by-design

## What Happened

Commit `c992b93b` (feat/schedule temporal shift lock) added `schedule-shift-lock.ts` with `isShiftTemporallyLocked(shift)` as "UI mirror of DB trigger". The DB function `schedule_shift_is_temporally_locked(p_workspace_id, p_shift_date, p_start_time)` reads `workspace.timezone` with `Europe/Oslo` fallback. The TS helper constructed `new Date(year, month-1, day, hour, min)` in **browser local time** with no workspace timezone lookup.

Phase 3 code-trace (council 2026-04-20) found the established pattern the helper should have used:

- `apps/web/src/app/dashboard/_hooks/use-cockpit-date-anchor.ts:40-41`:  
  `const ctx = useWorkspaceOptional(); const timezone = ctx?.workspace.timezone ?? "Europe/Oslo";`
- `apps/web/src/app/dashboard/_lib/cockpit/date-anchor.ts` exports `getWorkspaceToday(timezone)` using `Intl.DateTimeFormat`.

The new hook never looked for prior art. Per-file review (Phase 3 steward, supervisor) caught it as "follow-up"; code-trace (agent-coordinator) identified it as a trust-gate fail — docstring said "UI mirror" but the data pipeline wasn't connected.

## What We Learned

When a feature adds a NEW component/hook that describes itself as "mirror of X" or "client-side approximation of Y," the mandatory pre-merge check is:

1. **Grep for prior art on the same data input.** For timezone-aware code: grep `workspace.timezone` across `apps/web/src/` before writing `new Date()`. If an existing hook reads workspace TZ, consume it instead of rebuilding.
2. **If no prior art exists, the feature must plumb the data explicitly** — not default to browser-local with a comment apologizing for it.

Silent bypass of established infrastructure is invisible to grep-based audits, invisible to per-file review, but catches every time a code-tracer follows the data path.

## How to Apply

- **At briefing time:** any plan mentioning "mirror of DB", "client approximation", "matches server logic" must be flagged for a code-tracer review, not just a per-file review. Assign the Layer 4 capability-consumer trace mandatorily.
- **At commit time:** PRs adding new helpers whose name echoes a PG function (`is_*_locked`, `get_workspace_*`, `derive_*`) must cite the PG function location in the docstring AND cite the established workspace-context hook the helper consumes. If the hook doesn't use `useWorkspaceOptional()` / equivalent, reviewer must ask why.
- **In the trust gate:** the question "Do any new tools/capabilities make promises the data pipeline can keep today?" should be read as *"Does the new helper connect to the workspace-aware inputs its promise requires?"*

## Related

- ADR-0066 (temporal shift lock architecture) — canonical contract for this specific case
- L-0046 (triple-lens convergence) — this is an instance class
- ADR-0091 (governance-gate-placement) — Layer 4 trace discipline comes from here
