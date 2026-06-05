---
title: "Handoff — sma-326-isoweek-datetime-fix"
feature: sma-326-isoweek-datetime-fix
branch: feat/sma-326-isoweek-datetime-fix
closed: 2026-05-13
module: payroll
tags: [handoff, payroll, deviation-checks, W03, W04, sma-326, l-0238]
status: done
created: 2026-05-13
updated: 2026-05-13
linear: https://linear.app/smartout/issue/SMA-326
---

# Handoff — sma-326-isoweek-datetime-fix

> Branch: `feat/sma-326-isoweek-datetime-fix` | Worktree: `~/wsl/smartout.ai-wt-4` | Module: payroll

## Summary

Fixed an NaN-returning concat bug in `isoWeek` + `isoYear` helpers (`packages/payroll-calculate/src/deviation-checks.ts:62-77`). Original ticket misdiagnosed the cause as undefined `effective_start`; actual root cause is full-ISO-datetime input concatenated with `"T12:00:00Z"` → invalid Date → NaN. Bug produced `payroll.deviation.details.week = "WNaN"` and "uke WNaN" in deviation messages (cosmetic UI display in `DeviationList.tsx:122`).

Sortie scope: 5-LOC fix + 3 regression tests. Coordinated by lead agent (Opus) per Pontus's 2026-05-13 directive — implementation delegated to specialized sub-agents, Council convened on architectural risk (R3 backfill scope).

## Journeys delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| w03-correct-weekly-aggregation | verified | `packages/payroll-calculate/__tests__/deviation-checks.test.ts:1056-1108` |
| w03-message-contains-real-week-number | verified | `:1110-1162` |
| w04-rolling-window-aggregation | verified | `:1164-1221` (strengthened in nit fix) |

## Decisions

| Decision | Reason | Impact |
|----------|--------|--------|
| Fix shape: `dateStr.slice(0, 10)` strip-to-date | Tolerates both YYYY-MM-DD and full ISO datetime; minimal change to surrounding logic; no type change | 2 helpers fixed, no API change |
| NO backfill migration | Council verdict: `payroll.deviation` is D6 derived state; `run-deviation-checks/route.ts:292-300` auto-DELETE-and-reinsert on next recalc recovers poisoned rows; UPDATE-in-place migration would duplicate TS derivation in PL/pgSQL (cascade anti-pattern, parallel mechanism). | Recovery is mechanical on next period recalc; no migration in this sortie or follow-up sortie |
| R3 reclassified CRITICAL → MEDIUM | Steward Phase 5 Self-Reversal: W03 = `severity: "warning"`, W04 = `severity: "info"` — neither blocks period approval per `lock-period:97-104` (filter is `severity="error" AND acknowledged_at IS NULL`). | Cosmetic UI display, no operator action blocked |
| Stay in original sortie scope | Supervisor: 4 of 4 prior comparable COUNCIL-LOG cases were split, but here split is unnecessary because auto-recovery handles data. Single-sortie discipline preserved. | No follow-up backfill sortie |

ADR-0303 NOT written (proto-ADR pending 2-3 more occurrences of derived-state-recovery pattern).

## Learnings

| Learning | Context |
|----------|---------|
| L-0238 (canonical) — Derived-state-table corruption recovers via canonical re-derivation, not migration | First occurrence of recovery-via-re-derivation pattern in council. Heuristic captured: check (1) table is derived state; (2) wipes-and-replaces entry point exists; (3) corruption blocks operator action right now; (4) acked rows protected. yes/yes/no/yes → trust recovery, no migration. |

Process learnings (not new files):
- Phase 2.5 fact-check missed `payroll_schema.sql` ALTER TYPE SET SCHEMA migration → claimed `payroll.deviation` doesn't exist. Coordinator re-verified inline. (Counter-example to pure-grep verification.)
- Chair Self-Reversal precedent: 6th codified L-0147 case. Pattern stable.
- Original Linear ticket diagnosis was wrong (TypeScript-enforced `InterpretedShift.effective_start` is never undefined — type system prevents the failure mode the ticket described). Corrected diagnosis posted as Linear comment.

## Known issues / debt

- **Production data state unknown** — code is on `origin/main` via PR #369 + #381 (first prod release shipped 2026-05-13). If any customer triggered `run-deviation-checks` between deploy and SMA-326 deploy, poisoned rows exist in `payroll.deviation`. Recovery is automatic on next period recalc.
- **Optional immediate cleanup** — if Pontus wants to wipe poisoned rows without waiting for natural recalc, run via admin SQL pad (NOT a migration):
  ```sql
  DELETE FROM payroll.deviation
  WHERE details->>'week' = 'WNaN'
    AND acknowledged_by IS NULL;
  ```
- **DB has no CHECK constraint** preventing future "WNaN" values. Fix is at source (deviation-checks.ts) only. If a different code path ever computes weekStr via different helper, the same bug could recur. Promote ADR if pattern repeats.

## Council protocol used

Topic: SMA-326 R3 backfill scope decision. 3-reviewer council (Steward chair + Supervisor + Agent-coord). Skipped: frontend-designer (no UI), botsson-harness-builder (not Botsson harness — payroll module backend), narrator (orchestrator inline synthesis).

- Phase 1: INTAKE — identified bug-fix-with-data-impact topic; prior-verdict check found 2026-04-23 Journey Engine 4-phase remediation as sibling pattern
- Phase 2: BRIEF — pre-loaded all relevant file contents into each reviewer's prompt
- Phase 2.5: FACT-CHECK — found one schema-mismatch claim error in Track A's initial report; corrected inline
- Phase 3: REVIEW — 3 agents in parallel, each with Layer-assigned scope (3, 2+4, scope-guard)
- Phase 4: REPORT — orchestrator inline (narrator skipped)
- Phase 5: SYNTHESIS — Chair Self-Reversal (R3 reclassified)
- Phase 6: USER CONFIRM — Pontus approved
- Phase 7: DOC UPDATE — L-0238 + COUNCIL-LOG + this HANDOFF
- Phase 8: KNOWLEDGE CAPTURE — L-0238 logged
- Phase 9: SELF-IMPROVE — see council_meta.md update

## Implementation log

| Track | Agent | Model | Output |
|---|---|---|---|
| A. Pre-flight | Explore | haiku | Mapped 2 callers + 3 persistence vectors; R3 framed CRITICAL (later corrected) |
| B. Build | general-purpose | sonnet | Commit `d69045c35` — 5-LOC fix + 3 regression tests; 38/38 + 58/58 green |
| C. Code review | feature-dev:code-reviewer | sonnet | APPROVE WITH NITS — 2 nits enumerated |
| Track C nits | general-purpose | haiku | Commit `22731ea92` — W04 strengthened to `expect(w04).toBeUndefined()`; week-number comments corrected |
| D. Linear update | task-assistant | haiku | Comment posted https://linear.app/smartout/issue/SMA-326#a0dc4eac-a203-4d6b-9df4-ac1f70e58d9d |
| E. Knowledge capture | self | opus | L-0238 + COUNCIL-LOG + this HANDOFF (commit `5a4b56407`) |
| F. Closure | self | opus | DASHBOARD + close-feature.sh (pending) |

## Next steps

- **Pontus reviews + closes ticket** on SMA-326 (Linear) after merge to development → preview → main
- **Optional cleanup** of production `payroll.deviation` if any rows exist (admin SQL pad command above)
- **Pattern watch:** if another derived-state-recovery case lands within next 30 days, promote L-0238 → ADR (candidate name: "Derived-state-table corruption recovery via canonical re-derivation"). Wait for 2-3 more occurrences across different derivation tables (e.g. `shift_cost_snapshot`, `daily_reconciliation`, `payroll_calculation_line`).
