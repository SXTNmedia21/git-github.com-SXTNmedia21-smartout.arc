---
title: WSL Strips Exec Bit on .husky Hooks After Edit
status: accepted
updated: 2026-05-14
created: 2026-05-14
module: tooling
tags: [husky, wsl, git, file-mode]
---

# L-0266 — WSL Strips Exec Bit on .husky Hooks After Edit

**Date observed:** 2026-05-14 (commit `fe1b26dcc` shipped strand 1 hook content; commit `332da9c13` restored exec bit)
**Class:** tooling / WSL filesystem quirk
**Related:** strand 1 grep gate (`.husky/pre-commit` §10)

## What happened

After editing `.husky/pre-commit` to add the Nordic Split + motion-token drift gate (§10) via WSL editor, the file mode silently lost its executable bit. Subsequent `git commit` runs emitted advisory:

> hint: The '.husky/pre-commit' hook was ignored because it's not set as executable.

The hook was effectively silently disabled despite content shipping in commit `fe1b26dcc`. Detection was via the advisory text + manual test (committed a file that should have triggered §10 — gate did not fire).

## Root cause

WSL2 filesystem (drvfs / 9P) under default mount options does not preserve POSIX executable bits when files are edited through Windows-side editors. Git records file mode based on inode metadata; when WSL re-saves the file via a Windows editor (VS Code on Windows + WSL extension is a common path), the mode drops to `0644`.

## Mitigation

After any edit to a hook file, restore exec bit and commit the mode change:

```bash
chmod +x .husky/pre-commit
git update-index --chmod=+x .husky/pre-commit
git commit -m "chore(husky): restore exec bit on pre-commit"
```

`git update-index --chmod=+x` is required (not just `chmod`) because the mode change must enter the index — otherwise the next clone or worktree-create will receive a `0644` file.

## Verification

```bash
ls -la .husky/pre-commit
# Expect: -rwxr-xr-x ...
git ls-files --stage .husky/pre-commit
# Expect: 100755 <hash> 0  .husky/pre-commit (NOT 100644)
```

## Promote to skill

Add to onboarding-engineer-environment notes (if such doc exists) under WSL gotchas. Also add to `.husky/README.md` or top-of-file comment in `.husky/pre-commit` warning future editors.

## References

- Commit `fe1b26dcc` — shipped §10 content with mode `0644` (silently disabled)
- Commit `332da9c13` — restored mode to `0755`, committed mode change
