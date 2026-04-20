---
title: "PLAN-file decay: status field drifts while code ships"
id: L-0078
status: accepted
layer: learning
module: meta
created: 2026-04-20
updated: 2026-04-20
tags: [learnings, docs, state-summary, plan-files, process-decay]
---

# Learning-0078: PLAN files decay silently — status field lags reality

## What Happened

Council 2026-04-20 briefing cited `PLAN-cascade-gate-write.md` (status: `exploration`) as a blocker for Cascade Phase E. Phase 2.5 fact-check found:

- `supabase/migrations/20260512100000_cascade_gate_write.sql` exists (RPC shipped)
- `supabase/migrations/20260512100200_cascade_gate_write_assert.sql` exists
- `packages/supabase/src/gate-client.ts:183` calls the RPC successfully
- Production call sites: `apps/web/src/app/dashboard/setup/_actions/season-actions.ts`, `apps/web/src/app/dashboard/people/_actions/people-actions.ts`

WP2 had shipped. `STATE-SUMMARY.md` inherited the stale plan claim ("Phase E not started") and propagated it into every boot-sequence session start.

This is the **4th observed occurrence** of the pattern: a plan file describes what was true at authoring time, code ships, nobody edits the plan file, and readers treat the plan as the authority. The prior occurrences are logged under "audit inflation pattern" in memory.

## What We Learned

**PLAN files are not the system of record for what has shipped. Code and migrations are.** But humans treat plan files as authoritative because they were written most recently when the topic was active.

Without a lifecycle mechanism, plan files become archaeological artifacts. They should have exactly three valid states relative to shipped reality:

- `exploration` → nothing shipped yet; plan is exploratory
- `approved` → council approved; ready to start
- `in_progress` → branch exists, commits landing
- `done` → shipped + handoff written + plan moved to `docs/plans/completed/`

Missing: a state between "in_progress" and "done" that means "some WPs shipped, plan decayed." That is the decay hole.

## How to Apply

- **At merge time:** any PR that lands code referenced by a PLAN file should update the PLAN's status or add a "shipped WPs" note. Enforcement: pre-commit hook or reviewer checklist.
- **At session start (boot sequence):** if STATE-SUMMARY references a plan with status `exploration` or `approved`, spot-check for shipped code before citing the plan as authoritative. 30-second grep.
- **Process fix (proposed for HEARTBEAT):** weekly job that greps each `docs/plans/PLAN-*.md` for referenced functions/tables/routes, checks if they exist in `supabase/migrations/` or `apps/web/src/app/`, and emits `ops/reports/plan-drift-YYYY-MM-DD.md` flagging any stale-seeming status field. Does not auto-update — flags only.
- **STATE-SUMMARY hygiene:** when STATE-SUMMARY references a plan, it must cite the plan by path AND state what the plan claims AND a line about whether that claim was verified (`verified 2026-MM-DD` or `last-verified stale, pending refresh`).

## Related

- L-0042 (migration dependency audit at schema layer)
- L-0043 (column→table identity claims must be verified)
- Memory: "audit-inflation-pattern" in `learning_audit_inflation_pattern.md`
- `docs/protocols/DOCUMENTATION.md` source-of-truth hierarchy
