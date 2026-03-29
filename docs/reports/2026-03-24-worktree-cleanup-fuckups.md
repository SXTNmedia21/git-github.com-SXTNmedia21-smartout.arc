---
title: "Worktree Cleanup — Fuckups Report"
status: done
updated: 2026-03-24
created: 2026-03-24
module: meta
tags: [report, cleanup, process, fuckups]
---

# Worktree Cleanup — Fuckups Report

> Audit of patterns found during cleanup of 6 worktrees on 2026-03-24.
> Goal: identify recurring mistakes so we can fix the process.

---

## 1. Decision/Learning Logs Overwritten Per Branch

**Severity: HIGH**

Every feature branch replaced the entire `0000-decision-log.md` and `0000-learning-log.md` with its own entries, deleting all previous feature sections. When wt-2 (setup-flow-redesign) closed, it overwrote hms-phase-1 and cascade-foundation entries.

**Root cause:** The close-feature workflow creates feature-specific decision/learning logs but overwrites the file instead of appending. Each agent starts fresh and doesn't know about other features' entries.

**Fix:** Decision/learning logs must be APPEND-ONLY. The close-feature script should:

1. Read existing log content
2. Append new section at the bottom
3. Never replace the file header or existing sections

Also: the YAML frontmatter on these shared files keeps getting overwritten with feature-specific metadata (`module: hms`, `module: onboarding`). These are cross-cutting files — the frontmatter should be `module: cross-cutting`.

---

## 2. Duplicate Design Token Work Across Branches

**Severity: HIGH**

Both `development` (commit `87549730`) and `feat/setup-flow-redesign` (commits `ca9ea654`, `7a690b4b`, `e1bf4df8`) independently did design token replacement on overlapping files. This created 20+ merge conflicts.

**Root cause:** No coordination between agents working in parallel worktrees. Development got a Cursor-authored design token commit while wt-2 was doing the same work.

**Fix:**

1. Before starting design-token or refactoring work, check if another worktree is already doing it
2. `/status` command should flag overlapping file modifications across worktrees
3. Cross-cutting refactors (design tokens, linting, imports) should be done on `development` directly, not in feature branches

---

## 3. Stale Worktrees Left Running for Days

**Severity: MEDIUM**

- wt-1 (workspace-intelligence): merged but worktree never removed
- wt-5 (hms-phase-1): merged but worktree never removed
- wt-4 (vaktlista-view): 0 commits ahead, 983 files behind, had uncommitted planning docs

These occupied slots and drifted further from development daily, making future merges harder.

**Fix:**

1. `/close-feature` should remove the worktree as part of closure (or at minimum flag it)
2. `/status` should flag worktrees with 0 commits ahead as "stale — consider removal"
3. Set a rule: if a worktree has 0 commits ahead for 48+ hours, either commit something or remove it

---

## 4. Uncommitted Work in Worktrees

**Severity: MEDIUM**

- wt-6 had 6 staged (added) call components + a plan that were never committed
- wt-4 had uncommitted planning docs (PLAN + WORKLOG)

If these worktrees had been force-removed without checking, this work would be lost.

**Fix:**

1. `/close-feature` must run `git status` and warn about uncommitted changes
2. Never force-remove a worktree without checking `git status` first
3. Consider a pre-removal hook that copies uncommitted files to a salvage directory

---

## 5. Broken YAML Frontmatter in Shared Docs

**Severity: LOW**

Both `0000-decision-log.md` and `0000-learning-log.md` have broken YAML:

- Duplicate `module:` and `updated:` fields
- Feature-specific `module:` values floating mid-file outside YAML blocks
- Random `---` separators that look like YAML frontmatter but aren't

**Fix:**

1. These files should have ONE YAML header with `module: cross-cutting`
2. Feature sections should use markdown headers, not YAML blocks
3. Add a YAML frontmatter linter to the pre-commit hook

---

## 6. Junk Files in Working Directory

**Severity: LOW**

Found in the root of the main repo:

- `fix_comma.py`, `fix_invite.py`, `fix_invite_destructure.py`, `fix_other_files.py`, `fix_syntax.py`, `refactor_wizard.py`, `restore_and_fix.py`, `run_refactor_invite.py` — throwaway Python scripts from Cursor refactoring sessions
- `supabase/functions/Untitled` — empty/abandoned Edge Function

**Fix:**

1. Add `*.py` to `.gitignore` (we're a TypeScript-only project)
2. Delete these files
3. Add `supabase/functions/Untitled` to `.gitignore` or delete it

---

## 7. Duplicate Entries in Recent Closures

**Severity: LOW**

DASHBOARD.md had duplicate entries:

- `cascade-foundation` listed twice (2026-03-22)
- `hms-phase-1` listed twice (2026-03-22)

**Fix:** Dedup check in the `/close-feature` command before appending.

---

## Summary — Priority Actions

| #   | Action                                               | Priority | Effort  |
| --- | ---------------------------------------------------- | -------- | ------- |
| 1   | Make decision/learning logs append-only              | HIGH     | Small   |
| 2   | Add stale worktree detection to `/status`            | HIGH     | Small   |
| 3   | Add uncommitted-work check to `/close-feature`       | HIGH     | Small   |
| 4   | Cross-cutting refactors on development, not branches | HIGH     | Process |
| 5   | Fix YAML frontmatter on shared docs                  | MEDIUM   | Small   |
| 6   | Delete junk Python files + Untitled function         | LOW      | Tiny    |
| 7   | Dedup check in closure command                       | LOW      | Tiny    |
