---
title: Lint-Staged Stash-Restore Drops Bundle Edits When Mix Of Staged + Unstaged
status: accepted
updated: 2026-05-14
created: 2026-05-14
module: tooling
tags: [husky, lint-staged, commit-hygiene]
---

# L-0265 — Lint-Staged Stash-Restore Drops Bundle Edits When Mix of Staged + Unstaged

**Date observed:** 2026-05-14 (commit `0f901a637` — contracts sub-routes polish)
**Class:** tooling / commit-bundle integrity
**Related:** L-0259 (hook emit location drift), husky pre-commit chain

## What happened

Commit `0f901a637` ("feat(polish): contracts sub-routes") was supposed to include 3 `page.tsx` edits that mounted Botsson-tools bridges in the contracts sub-routes. Bundle contained staged `_tools/` directories (new files) AND `page.tsx` deltas (partially staged, partially unstaged on same hunks). Lint-staged ran prettier on `_tools/` files, formatted them, stashed unstaged deltas, restored stash — **but the unstaged deltas on `page.tsx` did not survive the restore**. Commit landed with `_tools/` files only; `page.tsx` wirings dropped silently.

Detection was post-commit: `git status` showed the 3 `page.tsx` files unstaged again. The bridges were never imported on the pages. Restored in commit `8b7976a37` ("feat(polish): billing sub-routes + contracts page wiring restore") by explicitly staging the 3 files before committing.

## Root cause

Lint-staged's stash strategy assumes hunks within a file are either fully staged or fully unstaged. When the same file has partially-staged hunks, the stash-restore can lose unstaged portions because conflict resolution defaults to "drop unstaged".

## Mitigation

Post-commit verification check:

```bash
# After any polish-wave commit, before pushing
git status --short
# Expect: empty (or only files explicitly intended to remain unstaged)
# If unexpected unstaged files appear: stage them, amend or follow-up commit
```

For polish-wave commits specifically: stage ALL changes (`git add -A` on the relevant paths) before commit, or use `git add -p` to ensure no partial-hunk states reach lint-staged.

## Promote to skill

`smartout-page-polish` skill — already has Common Mistakes entry from this session. No additional promotion needed; entry exists.

## References

- Handoff: `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md` (commit table notes the restore)
- Commits: `0f901a637` (drop), `8b7976a37` (restore)
