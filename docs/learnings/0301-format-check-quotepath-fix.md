---
title: L-0301 — Format Check exit 123 on non-ASCII filenames
status: accepted
updated: 2026-05-17
created: 2026-05-17
module: ci
tags: [ci, prettier, git, format-check, hop-b, quotepath]
related:
  - L-0299 (pipe-mask) — sibling: workflow exit-code drops
  - ADR-0359 (CI Coverage Mandate)
  - PR #398 (HOP B preview → main)
---

# L-0301 — Format Check exit 123 on non-ASCII filenames

## What happened

PR #398 (HOP B preview → main, 572 commits) failed CI Format Check with exit 123.
Local `pnpm ci:local` passed format-check before opening PR.

## Root cause

`git diff --name-only` C-escapes non-ASCII paths by default. For two ADR files:

```
docs/decisions/0310-§14-6-rule-table-driven-aml-validation.md
docs/decisions/0312-gdpr-§13-retention-clock-regnskapsårets-slutt.md
```

git emits:

```
"docs/decisions/0310-\302\24714-6-rule-table-driven-aml-validation.md"
"docs/decisions/0312-gdpr-\302\24713-retention-clock-regnskapsårets-slutt.md"
```

xargs passes the literal escape-string to prettier. prettier fails ENOENT
(file `0310-\302\247...` does not exist on disk; actual file is `0310-§...`).
xargs exits 123 (any child returned 1-125).

## Why ci:local skipped it

`format_check_changed()` diffs `merge-base(origin/development, HEAD)..HEAD`.
On preview branch, preview == development → diff = 0 files → "No formattable
files changed — skipping prettier" → gate passes.

CI Format Check on PR-event diffs `pull_request.base.sha...HEAD`. For
preview → main, base = main HEAD (`9a1b9109`), HEAD = preview tip (`a4d96b83`)
= 572 commits = 1006 files including the two `§` ADRs.

**Coverage gap:** ci:local on preview branch cannot exercise format-check
against the eventual HOP B diff (vs main), only vs development.

## Fix

`git -c core.quotepath=false diff --name-only` emits raw UTF-8 bytes.
xargs default whitespace-split passes them correctly to prettier.

Applied to both:
- `.github/workflows/ci.yml` Format Check step
- `scripts/ci-local.sh` `format_check_changed()`

Verified locally on 1006-file diff (`origin/main...origin/preview`): exit 0.

## Encoding

- New row in `ci-local.sh` `learning_cross_check()`:
  - `L-format-check-quotepath-fix`: grep `core\.quotepath=false`
- `COVERAGE_MAPPING_VERSION` bumped 2 → 3 (invalidates old markers)

## Residual coverage gap

ci:local cannot detect format-check failures that depend on the HOP B
base (main) until preview branches off. Options for future:

1. Add HOP A pre-flight that runs format-check against `origin/main` diff —
   blocks promote if non-ASCII / xargs-hostile filenames present.
2. Always use `core.quotepath=false` + `-z` + xargs `-0` regardless of
   filename content (defensive). Tried first — bash command substitution
   `$(...)` strips NUL bytes, breaks `-z`. Need `mapfile -d ''` or pipe
   directly without command substitution.

Deferred — current fix sufficient for L-0301 trigger filenames.

## Related sibling

L-0299 (pipe-mask) — same family: workflow exit-code drops to outer layer
that doesn't propagate. There: `op run … | tee` swallowed wrapper exit;
here: xargs `-d ' '` default split mismatched git's default output encoding.

Pattern: **default behavior of cli tools at integration boundaries is the
trap class.** Verify byte-level fidelity end-to-end.
