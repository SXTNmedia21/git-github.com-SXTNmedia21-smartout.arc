---
title: "Husky Branch Guard — Hook #7 + #8 + ADR-0075 v1.1"
status: done
updated: 2026-04-07
created: 2026-04-07
module: meta
tags: [husky, governance, adr-0075, council-retrospective]
---

# Husky Branch Guard — Hook #7 + #8 + ADR-0075 v1.1

> Mechanically enforces ADR-0075's worktree discipline. Implements council retrospective verdict from 2026-04-07. The "single most important action" per Steward.

---

## Journey: Developer attempts direct commit to development (the failure mode)

**Precondition:** A developer (or Claude session) is in the main repo on branch `development` and tries to commit a change directly without going through a feature branch.

1. Developer runs `git add .` and `git commit -m "..."`
   → husky pre-commit hook fires
   → Hook #7 checks: `current_branch=$(git symbolic-ref --short HEAD)` returns `development`
   → Hook #7 checks for `.git/MERGE_HEAD` (allows merge commits during integration)
   → No MERGE_HEAD found → this is a direct commit, not a merge
   → Hook prints error: `ERROR: Direct commits to 'development' are forbidden.`
   → Hook prints workflow instructions (use `new-feature.sh`, work in worktree, close via `close-feature.sh`)
   → Hook prints rationale: "ADR-0075 was violated by the commit that shipped ADR-0075. Cultural rules failed; mechanical guards do not."
   → `exit 1` blocks the commit

**Postcondition:** No commit lands. Working tree unchanged. Developer must create a feature branch and worktree to proceed. The exact failure mode of `cb7c7c60` (which was committed directly to development against ADR-0075's own resolution) is now mechanically impossible.

**Same protection applies to:** `preview` and `main` branches.

---

## Journey: Developer in a feature branch commits normally (the happy path)

**Precondition:** Developer is in a worktree on `feat/<name>` branch.

1. Developer runs `git add .` and `git commit -m "..."`
   → husky pre-commit hook fires
   → Hook #7 checks: `current_branch` returns `feat/<name>`, not `development`/`preview`/`main`
   → Hook #7 condition fails (branch is not protected) → hook is a no-op for this commit
   → Other hooks (#1-6, #8) run as normal
   → Commit succeeds

**Postcondition:** Commit lands on the feature branch. Normal workflow proceeds. Hook #7 is invisible to legitimate work.

---

## Journey: close-feature.sh merges feature branch to development (the integration path)

**Precondition:** Feature branch is ready, all gates pass, `close-feature.sh <wt-N>` is invoked.

1. Script runs all gate checks (decision log, journey, typecheck) — all pass
2. Script switches to main repo on `development` branch and runs `git merge feat/<name> --no-ff -m "feat(merge): ..."`
   → Git creates `.git/MERGE_HEAD` during the merge in progress
   → husky pre-commit hook fires (because the merge produces a commit)
   → Hook #7 checks: `current_branch` returns `development` (protected)
   → Hook #7 checks for `.git/MERGE_HEAD` → file exists → this IS a merge commit
   → Hook #7 condition allows the commit through
   → Other hooks run as normal
   → Merge commit lands on `development`
3. Script pushes `development` to origin

**Postcondition:** Feature is merged via the proper integration path. Hook #7 does NOT block legitimate merges. The dogfood test of this entire feature: `close-feature.sh 1` for `feat/husky-branch-guard` itself must succeed via this exact path.

---

## Journey: Developer edits ORIENTATION.md and accidentally removes ADR-0075 reference

**Precondition:** Developer is editing `docs/ORIENTATION.md` and removes the link to `decisions/0075-knowledge-system-consolidation.md`.

1. Developer runs `git add docs/ORIENTATION.md && git commit -m "..."`
   → Hook #8 checks: `git diff --cached --name-only` includes `docs/ORIENTATION.md`
   → Hook #8 greps for "0075" in the file → not found
   → Hook prints error: `ERROR: docs/ORIENTATION.md must reference ADR-0075`
   → `exit 1` blocks the commit

**Postcondition:** Commit blocked. Developer must restore the ADR reference. ORIENTATION.md cannot become an unanchored "North Star" detached from its source-of-authority ADR.

---

## Error paths

### Hook #7 mis-fires on a legitimate merge

**Symptom:** A `git merge` from a feature branch into development fails with "Direct commits to 'development' are forbidden."

**Root cause:** `.git/MERGE_HEAD` was not present when the hook fired. This can happen with `git merge --squash` (which does not create a merge commit and does not set MERGE_HEAD) or with rebase-and-merge workflows.

**Workaround:** Use `git merge --no-ff` (which is what `close-feature.sh` does) to ensure a real merge commit. Squash-merging directly to development is intentionally blocked because it bypasses the audit trail of the feature branch.

**If you really need to land a single commit on development without a feature branch** (rare, e.g. a hot-fix typo): the council retrospective explicitly considered this and decided the friction is the feature. Open a one-commit feature branch, close-feature it, done.

### Hook #8 false-positive on a planned ADR rename

**Symptom:** ADR-0075 gets renumbered (e.g. to ADR-0080 in a future cleanup), and ORIENTATION.md still references "0075".

**Root cause:** Hook #8 greps for the literal string "0075", which is brittle to renumbering.

**Mitigation:** If ADR-0075 is ever renumbered, update ORIENTATION.md AND Hook #8 in the same commit. The hook's grep pattern is one line and intentionally simple — easier to update than to make smart.

---

## Out of scope

Per the council retrospective, deferred to follow-up ADRs:
- **ADR-0076** (build-agent verification evidence contract) — `docs/templates/handoff.md`, raw-output requirement, close-feature.sh grep gate. Separate council-reviewed work.
- **ADR-0078** (dev-time agent infrastructure parity) — `dev_session` table, sealed envelope subagent prompts, `dev.*` telemetry family. Multi-day effort, own spec round.

---

## Verification (this feature)

| Check | How | Status |
|---|---|---|
| Hook #7 added to `.husky/pre-commit` | `grep "Branch guard" .husky/pre-commit` | ✅ |
| Hook #8 added | `grep "must reference ADR-0075" .husky/pre-commit` | ✅ |
| Hook #7 syntax correct | husky runs successfully on this very commit (in feat branch, hook #7 is no-op, but other hooks must pass) | ✅ proven by this commit landing |
| ADR-0075 v1.1 amendment present | `grep "v1.1 Amendment" docs/decisions/0075-knowledge-system-consolidation.md` | ✅ |
| ORIENTATION.md self-listed as tier 0 | `grep "0\\. \\*\\*This file" docs/ORIENTATION.md` | ✅ |
| ORIENTATION promoted in project CLAUDE.md | `grep "ORIENTATION.md" CLAUDE.md` | ✅ |
| ORIENTATION promoted in global CLAUDE.md | live edit (outside repo, not tracked here) | ✅ |
| **Dogfood test:** this very feature must close via `close-feature.sh 1` (which exercises the merge path through Hook #7) | run close-feature, observe Hook #7 allows merge via MERGE_HEAD check | pending — happens at closure |
