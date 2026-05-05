---
title: "Plan-file ephemerality — uncommitted plan in pruned worktree leaves council verdict orphaned"
id: LEARNING_0212
status: canonical
layer: learning
created: 2026-05-05
updated: 2026-05-05
tags: [worktree, plan-file, council, knowledge-capture, plan-on-plan]
---

# Learning-0212: Plan-file ephemerality — uncommitted plan + pruned worktree = orphan verdict

## Context

Pipeline Consolidation Plan Council 2026-05-04. Plan file `docs/plans/PLAN-pipeline-consolidation-2026-05-04.md` lived in worktree `~/dev/smartout.ai/.claude/worktrees/serene-mcnulty-468859/`. Council ran full 5-phase protocol against the plan (3 reviewers, REJECT verdict, 24 must-fix items).

By Phase 8 (knowledge capture) the next session day:

```bash
$ git worktree list
/home/sxtnl/dev/smartout.ai                       3945cf6f6 [development]
/home/sxtnl/dev/smartout.ai/.claude/worktrees/admiring-haibt-e44165  ... prunable
# serene-mcnulty-468859 absent — pruned

$ git log --all --oneline -- '*PLAN-pipeline-consolidation*'
# (empty — never committed)

$ git stash list | grep -i pipeline
# (empty — never stashed)

$ find /home/sxtnl/dev/smartout.ai* -name 'PLAN-pipeline-consolidation*'
# (empty)
```

Plan file is gone. Worktree pruned. Council verdict survives only as text in conversation transcript + memory.

## Failure mode

1. User opens worktree for plan-drafting
2. Plan file written to worktree
3. Council runs against plan (Phase 1-6 successful)
4. User does NOT run `git add docs/plans/PLAN-...` + `git commit` in the worktree
5. Worktree pruned (auto or manual) — claude-code session-end pruning, `git worktree prune`, OS reset
6. Phase 8 knowledge capture finds no plan to reference
7. Verdict captured but actionable rewrite has no source-of-truth to revise

## Pattern

This is the inverse shape of L-0206 (stashed-ADR pattern). L-0206 = ADR drafted in stash, pre-Phase-8 stash-pop required. L-0212 = plan drafted in pruned worktree, no recovery possible without re-creation from transcript.

### Difference from L-0042 (parallel-worktree migration timestamps)
L-0042 = file committed on a different branch, conflict at merge-time. L-0212 = file never committed, lost entirely.

### Difference from L-0078 (plan-file decay)
L-0078 = plan committed but stale relative to code state. L-0212 = plan never committed, no state to decay against.

## Hard rule

**Council Phase 1 INTAKE: verify plan file is committed (or stashed) BEFORE Phase 2 brief dispatch.**

```bash
# Phase 1 intake check (mandatory)
PLAN_PATH="docs/plans/PLAN-<feature>-<date>.md"
git ls-files --error-unmatch "$PLAN_PATH" 2>/dev/null \
  || git stash list | grep -q "$PLAN_PATH" \
  || { echo "BLOCKER: plan file not committed and not stashed"; exit 1; }
```

If neither committed nor stashed: chair flags as Phase 1 prerequisite blocker. User commits plan to feature branch BEFORE council proceeds. No exceptions — even draft plans go to a `feat/plan-<name>` branch.

### Why "even draft plans get committed"
- Worktrees prune unpredictably (claude-code session-end, OS reset, manual cleanup)
- Memory/transcript capture is lossy (transcripts paginate, memory has 200-line cap, claude-mem digest summarizes)
- Council verdict references plan section numbers + line numbers — without source plan, references unverifiable

## Application precedent

This council (2026-05-04 pipeline-consolidation) is 1st observed occurrence. No prior data points. Single occurrence = noise per L-0147 promotion threshold (3+).

**Promotion status:** advisory only. Track recurrence. If observed again, escalate to mandatory Phase 1 gate.

### Suggested counter-test for next council
Phase 1 INTAKE adds one bash check (above). If check fails, treat as advisory warning for now ("plan not committed — consider committing before Phase 3"). Promote to hard block on 3rd occurrence.

## Recovery (when this happens)

1. Council verdict + Phase 5 synthesis are the only surviving source
2. User must re-create plan v2 from synthesis directly (cannot diff against v1)
3. Re-run council on v2 (Phase 3 light pass — synthesis becomes implicit baseline)
4. Capture this incident as data point (this learning)

## Related

- L-0042 (parallel-worktree migration timestamps — different shape, same root cause class: worktree state vs git state divergence)
- L-0078 (plan-file decay — plan exists but stale)
- L-0206 (stashed-ADR pattern — pre-Phase-8 stash-pop required)
- Council Skill Phase 1 INTAKE
- Worktree skill (plan-file propagation rule)

## Why this matters

Councils are expensive (3-5 reviewers, 30-90 min, ~$2-5 in API spend). Producing a verdict against an ephemeral plan loses the actionable component. Worktree workflow is now mature enough that pruning is automatic + frequent — relying on uncommitted worktree files is increasingly fragile.

The fix is cheap: 1 bash command in Phase 1. The cost of skipping is high: full council protocol orphaned.
