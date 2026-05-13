---
title: "L-0242 — Commit-message-template reuse mimics lint-staged collision but is different pattern"
id: L-0242
status: accepted
created: 2026-05-13
updated: 2026-05-13
module: dev-process
tags: [git, commits, lint-staged, scope, sortie-4]
related: [L-0237, ADR-0213]
---

# L-0242: Commit-message-template reuse mimics lint-staged collision but is a different pattern

## Trigger

Sortie 4 (mobile-kalender-task-wire) shipped two commits:
- `46643dc03` at 15:37:36 — `-13` lines in `apps/mobile/app/(app)/(home)/operations.tsx`. Message: `feat(mobile): AIFab gesture surface — tap+two-stage-swipe (ADR-0298 Sortie 4)`
- `dd2effc2e` at 15:44:17 — `+288/-242` across 4 calendar files (AIFab + _layout + TabBar + AIFab.test). Message: IDENTICAL.

Initial diagnosis in Sortie 4 HANDOFF: "lint-staged race collided Agent A + Agent B work into single SHA."

Supervisor council 2026-05-13 forensic re-analysis: timestamps 7 minutes apart, message-text identical, **diff content disjoint**. This is NOT a parallel-agent collision — those produce a single commit with merged diffs.

Real pattern: agent reused commit-message-template across two separate Edit+commit cycles. The earlier commit (46643dc03) was a scope-violation cleanup (operations.tsx deletion that didn't belong to AIFab work). Agent then continued AIFab work + committed again with the same message template still in memory.

## Pattern

Parallel-agent dispatch + lint-staged + repeated commit cycle creates the SHAPE of a collision (two commits, same message) without the underlying race. Easy to misdiagnose because the symptom (duplicate messages) IS the lint-staged race signature.

Falsification: lint-staged race produces ONE commit with merged diffs OR TWO commits seconds apart with the SAME author + race-window. 7-minute gap rules out race.

## Rule

Before diagnosing "lint-staged collision":
1. **Check timestamps.** Race window is <30 seconds. Anything more is sequential.
2. **Diff the two commits.** Race produces overlapping diffs (one branch lost). Sequential produces disjoint diffs (one is cleanup, other is feature).
3. **Check author identity.** Race needs concurrent worktrees. Sequential is one worktree, one author, two cycles.

If timestamps >30s + disjoint diffs: real pattern is **commit-message-template reuse + agent forgot to reset message buffer**. Mitigation: agent should clear message buffer between distinct work units OR use distinct messages for scope-cleanup vs feature commits.

## Mitigation

CLAUDE.md addition under "Commits":

> When committing a scope-cleanup (deleting dead code, removing stale TODOs) alongside or before feature work, use a distinct commit message. Reusing the feature message for a cleanup commit creates "phantom collision" signatures that mislead future audits.

Example:
- ❌ Both commits: `feat(mobile): AIFab gesture surface`
- ✅ Cleanup: `chore(mobile): remove stale operations.tsx Sortie 4 TODO`
- ✅ Feature: `feat(mobile): AIFab gesture surface — tap+two-stage-swipe`

## Sibling references

- ADR-0213 (campaign merge-commit pattern — also about commit-history hygiene)
- L-0237 (forgeable identity — same class: signature looks correct, mechanism wrong)
