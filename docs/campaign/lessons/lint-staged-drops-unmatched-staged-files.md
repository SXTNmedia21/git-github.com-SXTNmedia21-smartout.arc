---
topic: lint-staged-drops-unmatched-staged-files
status: active
updated: 2026-06-01T02:05:00Z
created: 2026-06-01T02:05:00Z
supersedes:
metadata:
  type: reference
---

# Decision lesson — lint-staged-drops-unmatched-staged-files

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

**lint-staged 16.2.7 silently drops a staged file that matches NO configured glob**
in `.lintstagedrc.json` — the file stays modified in the working tree but never lands
in the commit (confirmed twice on `.prettierignore`, even as the sole staged file,
including across `git commit --amend`). No husky gate script mutates git; the cause is
lint-staged's partial-commit/stash mechanism, not the gates.

**Fix (root-cause, durable):** add a catch-all glob so dotfile-ignores are "handled":

```json
"*ignore": "prettier --ignore-unknown --write"
```

`*ignore` micromatches `.prettierignore` / `.eslintignore`; `prettier --ignore-unknown`
exits 0 on the unparseable file, so lint-staged keeps it staged and it commits.
Landed in `.lintstagedrc.json` alongside the eslint/prettier flat globs (commit
`9d2c7a1f4`).

**Diagnostic ritual:** after any commit, run `git show --stat HEAD` and compare the
file list to what you staged. If a staged file is missing, suspect a lint-staged
glob-miss before anything else. NEVER reach for `--no-verify` (CLAUDE.md hard rule) —
fix the config so the gate passes honestly.

## Why

While committing the durable lint-isolation for the frozen design source, the
`.prettierignore` modification kept vanishing from the commit while the sibling
`base.mjs` (matched by `*.{...mjs...}` → eslint) landed every time. The asymmetry
pinpointed glob-matching as the discriminator: matched files are committed, unmatched
staged files are dropped. Note the _actual_ husky-killer for the design source was
eslint on IIFE `.jsx`, fixed by the committed `base.mjs` ignore; `.prettierignore` was
durability-only (prettier reads the on-disk file at commit time regardless, but the
modification must be tracked to survive a reset). See
[[design-source-canonical-location]] and [[commit-early-untracked-is-vulnerable]].

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-06-01T02:05:00Z — initial: lint-staged 16.2.7 drops staged files matching no glob (`.prettierignore` vanished twice incl. amend); fixed with `"*ignore": "prettier --ignore-unknown --write"` catch-all in .lintstagedrc.json (commit 9d2c7a1f4); ritual = `git show --stat HEAD` vs staged set after every commit; never `--no-verify`.
