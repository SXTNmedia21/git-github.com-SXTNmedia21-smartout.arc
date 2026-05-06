---
title: "Sub-sortie commits orphaned by remote-branch-delete after batched merge"
id: LEARNING_0220
status: canonical
layer: learning
created: 2026-05-06
updated: 2026-05-06
tags: [learning, git, sub-sortie, recovery, sortie-hygiene]
---

# Learning-0220: Sub-sortie orphan after "merged" delete

## Reference (for grep)

- 2026-05-06 cleanup of merged feat-branches
- Memory: `learning_sub_sortie_orphan_pattern.md`
- Recovery commit: cf681f609 (T1.6-T1.9 onboarding bodies) → re-merged via PR #342

## The trap

When a sub-sortie merges into its campaign branch, the merge commit has
the feat-branch tip as one parent. Commits made AFTER that merge stay
on the feat-branch only. If the campaign later merges to dev, those
post-merge commits are NOT carried — they're stranded on the orphan
feat-branch.

The naive check `git merge-base --is-ancestor BRANCH origin/development`
returns true for the BRANCH ref because git evaluates whether ANY commit
reachable from that ref is on dev — but in fact only the EARLIER commits
are. Latest commits aren't.

## 2026-05-06 incident

I deleted `feat/botsson-arena-voice-plane-consolidation` (merged into
campaign 2026-05-04 via `581300cae feat(merge): voice-plane-consolidation
→ campaign/botsson-arena`). The campaign then merged to dev via PR #336.

But cf681f609 (`feat(onboarding): T1.6-T1.9 tool bodies + alias +
telemetry registry`) was authored 2026-05-04 AFTER the campaign merge.
It was on the feat-branch only. After remote delete, the SHA was
preserved only by:
- Local worktree HEAD pointer
- Reflog (90-day grace)

64 lines of capability tool implementations almost lost.

## Detection: count unique commits, not ancestor

Before `git push --delete origin feat/X`:

```bash
# WRONG — passes false-positive when branch has been merged at LEAST
# once but has commits added after.
git merge-base --is-ancestor "origin/feat/X" origin/development \
  && echo "safe"

# RIGHT — checks for any unique commits on the branch.
UNIQUE=$(git log --oneline origin/development..origin/feat/X | wc -l)
if [[ "$UNIQUE" -gt 0 ]]; then
  echo "$UNIQUE unique commit(s) — DO NOT DELETE without merging"
  git log --oneline origin/development..origin/feat/X
else
  echo "safe to delete"
fi
```

For sub-sorties whose work merged via campaign: the relevant comparison
is also against the campaign's merge commit, not just dev.

## Recovery pattern

If the branch has been deleted but the SHA is reachable in any local
worktree or reflog, push to a recovery branch immediately:

```bash
# In the worktree that has the orphan SHA at HEAD
git push origin "HEAD:feat/X-recovery"
```

The new remote ref preserves the SHA from GC. Then:

1. Open PR `feat/X-recovery → development` (or → campaign/Y)
2. Merge dev INTO recovery (in worktree) to resolve drift conflicts
3. Push merge commit
4. Merge PR via merge-commit per ADR-0213
5. Delete worktree + recovery branch

This was the path used to land cf681f609 via PR #342 on 2026-05-06.

## Anti-pattern

Never run `git push --delete origin feat/X` based on `is-ancestor` alone.
Always count unique commits via `git log dev..feat/X`. Zero unique = safe.
Non-zero unique = need explicit merge before delete.

## Related

- L-0216 (stash-orphan migration — same family of "orphaned artifacts")
- ADR-0213 (campaign merge-commit, no squash — preserves ancestry)
- Recovery PR #342 (canonical example of recovery pattern in action)
