---
title: "Bash `|| true` on git push swallows pre-push hook failures"
id: LEARNING_0261
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
tags: [git, bash, husky, pre-push, close-feature, script]
---

# Learning-0261: Bash `|| true` on git push swallows pre-push hook failures

## Context

During sub-sortie closures via `close-feature.sh`, the script reached line 295 (project-local) / line 315 (global):

```bash
git push origin "$BRANCH" 2>/dev/null || true
```

This pattern was intended as a "best-effort push" before the merge step. In practice, when Husky's pre-push hook fails (e.g. due to stale `@smartout/telemetry` dist or missing pnpm symlinks in a fresh worktree), the exit code is silently absorbed by `|| true`. The script continued to the MERGE step, producing a remote branch that lacked the latest commits — but the operator saw no error.

Surfaced as the 8th L-0147 Chair Self-Reversal precedent in the 2026-05-14 close-feature pipeline traps Council. Steward Phase 3 initially missed this variant; Phase 5 reversed on falsifying evidence from on-disk line verification.

## Discovery

`git push origin "$BRANCH" 2>/dev/null || true` always returns exit code 0. The `2>/dev/null` suppresses Husky's error output to stderr; `|| true` converts any non-zero exit code to zero. Together they make push failures completely invisible.

The same trap exists in operator-driven form: `git push origin <branch> | tail -10` returns tail's exit code (always 0), not git's. Both variants mask real failures.

## Impact

Replaced with an explicit `if ! git push origin "$BRANCH"; then ... exit 1; fi` block in both global (`~/.claude/scripts/close-feature.sh:315`) and project-local (`apps/web/.claude/scripts/close-feature.sh:295`) scripts as of 2026-05-14. Gate 0 (workspace freshness — pnpm symlinks + telemetry/ai dist rebuild) added upstream of the push to eliminate the root-cause pre-push failures.

Operator pattern: never pipe critical pushes. Use `git push origin <branch>; echo "EXIT: $?"` or unpiped form, then verify with `git ls-remote origin refs/heads/<branch>`.

## References

- close-feature.sh (global) line 315 — surfaced site
- close-feature.sh (project-local) line 295 — surfaced site
- L-0147 (Chair Self-Reversal Protocol — 8th codified precedent, 2026-05-14)
- Memory: `learning_sortie_closure_blockers_2026_05_05` — sibling class (different blockers, same script)
- Council 2026-05-14 — close-feature pipeline traps, post-implementation verdict APPROVE WITH CHANGES

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
