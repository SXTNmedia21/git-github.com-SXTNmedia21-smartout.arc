---
title: "Plans containing deferred operator-action steps go stale within hours — tag OPERATOR-ACTION inline"
id: L_0189
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ../decisions/0265-enforced-deployment-pipeline.md
---

# L-0189: Plans containing deferred operator-action steps go stale within hours — tag OPERATOR-ACTION inline

## Why

Pipeline Consolidation v1 plan was written with several steps worded as "next session will commit/push X" or "operator will do Y before Phase N." Within hours of the plan being written, those implicit dependencies had shifted: some were done out of order, some were superseded by concurrent work, and some had preconditions that changed.

When the v2 re-review council read the plan, reviewers had to mentally subtract the "already done" steps from the scope — and could not reliably tell which steps were blocking, which were done, and which were truly deferred. This created ambiguity that added to the council's fix count (L-0187) and forced the plan to carry explicit status markers retroactively.

The root cause is that plans written during a session capture the state of the world at that instant. Any step that depends on an operator action outside the agent's execution window is a time-bomb: it will be stale by the time the plan is re-read.

This was then confirmed by the HANDOFF-2026-05-04-pipeline-session-end.md itself: line 107 notes "next agent should formalize learnings" — already-deferred framing that becomes a staleness vector for the next reader.

## How to apply

- In any plan document, mark every step that requires human/operator action with `[OPERATOR-ACTION]` inline before the step description. Example:
  ```
  3. [OPERATOR-ACTION] Set PREVIEW_E2E_KEY secret in GitHub Actions repo settings
  ```
- At the top of the plan, add a `Prerequisites` section listing all `[OPERATOR-ACTION]` items with current status (`pending | done | blocked`).
- When re-reading a plan before dispatch: scan for `[OPERATOR-ACTION]` tags first. Verify each one is resolved before dispatching agents to dependent phases.
- When handing off a plan mid-session: include a `## Operator follow-up` section listing outstanding `[OPERATOR-ACTION]` items with their blockers.

Applied in `docs/plans/2026-05-04-pipeline-consolidation-v2.md`: all operator-action steps are explicitly tagged. Operator follow-up table included in task 6.3 and in HANDOFF-2026-05-04-pipeline-session-end.md §Operator actions remaining.

## Pattern signature

- Plan was written > 2h ago and has been partially executed
- Plan contains steps with language like "next session", "operator will", "before Phase N do X externally"
- Re-reader cannot determine which steps are done vs pending without out-of-band knowledge

When all three are true: scan the plan for implicit dependencies and tag them `[OPERATOR-ACTION]` before re-dispatch.

## References

- `docs/plans/2026-05-04-pipeline-consolidation-v2.md` — v2 applies `[OPERATOR-ACTION]` tagging
- `docs/handoffs/HANDOFF-2026-05-04-pipeline-session-end.md` — operator follow-up table
- `docs/decisions/0265-enforced-deployment-pipeline.md` — pipeline this plan governs
