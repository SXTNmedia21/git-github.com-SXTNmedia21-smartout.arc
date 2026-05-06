---
title: "Adding push trigger to a workflow reading github.event.pull_request.* variables causes silent EXIT 1 on every direct push"
id: L_0198
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ./0197-required-checks-pr-only-trigger-blocks-direct-push.md
  - ../decisions/0265-enforced-deployment-pipeline.md
---

# L-0198: Adding push trigger to a workflow reading github.event.pull_request.* variables causes silent EXIT 1 on every direct push

## Why

L-0197 established that `pipeline-enforcement.yml` and `pgtap.yml` trigger only on `pull_request` and therefore cannot serve as required status checks for direct pushes to preview. The naive fix — Path A2 — would be to add `push:` to their trigger list. The B-phase analysis showed this is HARMFUL for `pipeline-enforcement.yml`.

The shell script in `pipeline-enforcement.yml` reads branch names using GitHub Actions context variables:

```bash
BASE_BRANCH="${{ github.event.pull_request.base.ref }}"
HEAD_BRANCH="${{ github.event.pull_request.head.ref }}"
```

On a `pull_request` event: these resolve to the PR's base and head branch names (e.g. `main` and `preview`).

On a `push` event: `github.event.pull_request` is undefined. Both variables expand to empty strings.

The script then evaluates the base/head combination to enforce the allowed branch flow (e.g. "preview → main only, development → preview only"). With empty strings, the script finds no allowed combination and exits 1. The workflow job FAILS.

This means: adding `push:` to `pipeline-enforcement.yml` would replace "2 expected — never fires" (the Scenario K symptom) with "2 failing — fails on every direct push to preview." Neither state allows a clean direct push. The fix would be strictly worse than the current state because now the pushes aren't just blocked — they actively fail CI, triggering notifications and requiring investigation.

B-phase analysis caught this by reading the workflow file body (not just the trigger metadata). A trigger-metadata-only analysis would have missed it.

**Confirmed B-phase verdict:** Path A1 (remove 2 PR-only contexts from ruleset required_status_checks) is the correct fix. Path A2 for `pipeline-enforcement.yml` requires a script rewrite to handle push context separately before adding a push trigger — out of scope for the `ruleset-required-checks-cleanup` Linear ticket.

## How to apply

When evaluating whether to add a `push:` trigger to an existing `pull_request`-only workflow:

1. Search the workflow body for `github.event.pull_request.*` references: `grep -n "github.event.pull_request" .github/workflows/<name>.yml`
2. For every reference: determine what value that variable would have on a push event (usually empty string or null).
3. Trace the code path that would execute with empty/null values — does it produce a false failure, a no-op, or correct behavior?
4. If any code path produces a false failure: the workflow body MUST be patched to handle the push event context BEFORE adding the trigger. The fix is non-trivial (requires reading branch names from `github.ref` or `github.event.push.*` instead).
5. If the workflow uses only `github.ref` or `github.sha` (not `github.event.pull_request.*`): adding a push trigger is likely safe.

**Verification of workflow content is mandatory before changing trigger semantics.** Reading the trigger block alone (the `on:` section) is insufficient.

The `pgtap.yml` workflow was found to use `BASE="HEAD~1"` fallback for non-PR context — it would be technically safe to add a push trigger (but has separate chicken-and-egg issues with Scenario K sequencing). The two workflows must be treated independently.

## Pattern signature

- Workflow is PR-only
- Plan proposes adding `push:` trigger to make it fire on direct pushes
- Workflow body reads `github.event.pull_request.base.ref` or `.head.ref` or similar PR-context variables
- No fallback handling for empty variables

When all four: Path A2 (add push trigger) is HARMFUL without body fix. Use Path A1 (remove from required_status_checks) instead, or fix the body first.

## References

- `.github/workflows/pipeline-enforcement.yml` — reads `github.event.pull_request.base.ref` + `.head.ref`
- `.claude/agents/deploy-conductor/RUNS.md` — 2026-05-04 B-phase entry, Path A2 HARMFUL analysis
- `./0197-required-checks-pr-only-trigger-blocks-direct-push.md` — L-0197: the parent problem
- `../decisions/0265-enforced-deployment-pipeline.md` — pipeline governance
