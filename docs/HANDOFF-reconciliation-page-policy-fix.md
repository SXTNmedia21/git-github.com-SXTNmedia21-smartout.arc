---
title: "Handoff — reconciliation-page-policy-fix"
feature: reconciliation-page-policy-fix
branch: feat/reconciliation-page-policy-fix
closed: 2026-05-15
module: dashboard
tags: [handoff, polish, page-policy, reconciliation]
---

# Handoff — reconciliation-page-policy-fix

## Summary

First operationalized run of the new **Page Policy** (`docs/design/page-policy.md`, shipped to development as `1c9508d18` on 2026-05-15). The policy enforces canonical `/dashboard` (WebDayControl) patterns on four axes — padding, colors, cards, menu — via grep-based audit protocol. This sortie was the policy's first audit target: `/dashboard/reconciliation` had drifted (12 findings: 2 P0, 3 P1, 5 P2, 2 P3) and never adopted the pattern despite being listed as "bygges neste" in `dashboard-page-pattern.md` from 2026-04-29. 5 build agents (A1-A5) running in parallel closed all 11 fix-tasks (T1-T11) across 6 files. Code-reviewer A6 verified 9/9 grep gates green; coordinator confirmed `tsc --noEmit` exit 0. Journey flipped from draft to verified. Visual smoke (G5) is Pontus's manual gate pending pre-merge.

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| admin-uses-compliant-reconciliation | verified | none (manual visual sammenligning gjenstår som G5-gate) |

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Operationalize existing `dashboard-page-pattern.md` as enforceable Page Policy with grep-based audit protocol | Pattern doc existed since 2026-04-29 but had no enforcement mechanism; reconciliation drifted silently | New audit-template at `docs/design/page-policy-audits/YYYY-MM-DD-<page>.md` becomes the per-page report format. Future polish sorties start from a generated audit, not ad-hoc inspection. |
| File-ownership map for parallel agent dispatch (1 file → 1 agent) | Earlier polish-waves hit Stop-hook SIGTERM cascade (L-0244) from concurrent typechecks on shared files | 5 agents parallel-safe. Pattern reusable for future page-polish sorties. |
| Defer CounterTile → KpiAccentTile migration | Bigger refactor than P2 scope warrants — would have touched semantics, not just visuals | Logged as follow-up in plan. Sorted into separate sortie when needed. |
| Use `motionTokens.springSnappy` for PreflightGate (was 35/24/2.3) | Closer to spec `springSnappy` (45/24/2) on damping=24 axis + matches "snappy feedback" semantic of blocker UI | Audit-doc's nearest-preset rule established for future motion-token migrations. |

No new ADRs. This sortie was pattern-compliance, not architectural decision.

## Learnings

| Learning | Context |
|----------|---------|
| `dashboard-page-pattern.md` doc-only policy → silent drift | Reconciliation page was explicitly listed as "bygges neste" in pattern doc 2026-04-29 but never adopted it. Doc without enforcement = wishful thinking. Page Policy's grep-based audit closes that gap. |
| `feature-dev:code-reviewer` agent has read-only tools | Can grep + verify, cannot run shell. Coordinator must run typecheck. Brief future code-reviewer dispatches to expect "BLOCKED on shell-execution gates — coordinator runs". |
| Stop-hook SIGTERM cascade still active (exit 143) | `pnpm --filter web typecheck` from worktree root SIGTERM'd. Direct `tsc --noEmit` from `apps/web` succeeded. L-0244 still load-bearing — prefer direct tsc when other typechecks may be running. |
| ReconciliationView.tsx is dual-surface (in-shell variant) | Motion fix in `apps/web/src/components/dashboard/ReconciliationView.tsx` affects BOTH `/dashboard?adminView=reconciliation` (variant tab) AND any consumer. Agent A5 was warned explicitly; future dispatches touching shared dashboard components should include surface-impact note. |
| `tracking-[-0.02em]` is reconciliation-only pattern, not canon | Canon uses `leading-tight tracking-tight`. The `[-0.02em]` variant snuck in pre-2026-04-29 and survived because no grep checked it. Added to Page Policy verification spec as P3 check. |

## Known Issues / Debt

- **SMA-371** (Medium, Backlog): `ReconciliationView.tsx:159` `profileId` stale-closure in `decide` useCallback. Missing from dep array. Pre-existing — not introduced by this sortie. Surfaced by A6 code-reviewer (confidence 80). 1-line fix.
- **CounterTile → KpiAccentTile migration**: Deferred from T5. CounterTile in `DayList.tsx:391` now compliant on shape (rounded-2xl + shadow-sm) but is a standalone primitive when canon prescribes `<KpiAccentTile>` from `@smartout/ui`. Larger semantic refactor — own sortie.
- **G5 visual smoke pending**: No automated E2E test for visual consistency between `/dashboard` and `/dashboard/reconciliation`. Manual gate only. Future: add Playwright spec that screenshot-diffs the two surfaces.

## Next Steps

- Pontus runs G5 visual smoke before merge (open both routes in dev, confirm no shifts).
- After merge to development: SMA-371 fixed as hotfix or in next polish sortie.
- Page Policy can now be applied to next drifted dashboard page. Candidates from `dashboard-page-pattern.md` §11 "Bygges neste": `/dashboard/people`, `/dashboard/schedule`. Both still pre-policy.
- Update `dashboard-page-pattern.md` §11 to mark reconciliation as ✅ canonical once merged.

## Files Touched

```
docs/design/page-policy.md                                        (+) on development
docs/design/page-policy-audits/2026-05-15-reconciliation.md       (+) on development
apps/web/src/app/dashboard/reconciliation/_components/
  reconciliation-page-client.tsx                                  (M) T1, T9, T10
  DayList.tsx                                                     (M) T4, T5, T11
  DayDetail.tsx                                                   (M) T2, T3, T6, T11
  ReconciliationRightRail.tsx                                     (M) T7 (3 sections)
  PreflightGate.tsx                                               (M) T3
apps/web/src/components/dashboard/ReconciliationView.tsx          (M) T3, T8
docs/plans/PLAN-reconciliation-page-policy-fix.md                 (+)
docs/journeys/JOURNEY-reconciliation-page-policy-fix-*.md         (+)
```

## Commit Chain

```
7b4f18550  A1  fix(reconciliation): T1+T9+T10 page-shell compliance
2e40ef9a0  A2  fix(reconciliation): T4+T5+T11 DayList card-shape + header
b7b150842  A3  fix(reconciliation): T2+T3+T6+T11 DayDetail compliance
64a1fa99e  A4  fix(reconciliation): T7 RightRail card-shape
ef26a0b33  A5  fix(reconciliation): T3+T8 motion-token compliance
5c6d5315d  C   docs(reconciliation-page-policy-fix): journey verified + plan closed
```

## Linear

- SMA-368 (motion-token migration) → ✅ Done. Comment on issue with commit ref.
- SMA-371 (profileId stale-closure) → Backlog, Medium, TypeScript label.
