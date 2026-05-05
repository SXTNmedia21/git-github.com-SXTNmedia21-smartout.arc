---
title: "Required-status-checks listing PR-only-trigger workflows block direct push to preview forever — architectural inconsistency"
id: L_0197
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ../decisions/0265-enforced-deployment-pipeline.md
  - ./0196-canonical-ruleset-disable-api-put.md
  - ./0198-push-trigger-on-pr-context-workflow-exits-one.md
---

# L-0197: Required-status-checks listing PR-only-trigger workflows block direct push to preview forever — architectural inconsistency

## Why

After Scenario K (preview hard-reset), the agent investigated why the first force-push attempt was blocked by "2 expected" status checks that never fired. Full verification confirmed:

**Ruleset 15290760 (preview)** lists 14 required status check contexts, including:
- `Enforce branch flow` (from `pipeline-enforcement.yml`)
- `pgTAP Suites` (from `pgtap.yml`)

Both workflows trigger **only on `pull_request` events**:
- `pipeline-enforcement.yml`: `on: pull_request` with `types: [opened, edited, reopened, synchronize]`, `branches: [main, preview]`
- `pgtap.yml`: `on: pull_request` only (branches: [main, development, preview])

ADR-0265 mandates that the canonical path for promoting development → preview is `promote-preview.sh`, which performs a **direct fast-forward push** — no PR involved. This means:

- On every direct push to preview (including the ADR-0265-mandated HOP A FF push): `Enforce branch flow` and `pgTAP Suites` never fire.
- GitHub records their status as "2 expected" (required but no check-run exists for this SHA).
- The ruleset is permanently blocked for direct pushes unless those 2 contexts are removed.

This is an architectural inconsistency: ADR-0265 mandates FF-without-PR, and the ruleset requires checks that only run on PRs.

**B-phase verification** (RUNS.md 2026-05-04 L-0197 B-phase entry) confirmed this via:
1. File reads of both workflow YAML files (no push trigger present)
2. GitHub check-runs API for preview SHA `dcf0ebf1c` — neither check exists at all
3. GitHub check-runs API for dev SHA `cff8c5066` — same result

**Resolution:** Path A1 selected — remove `Enforce branch flow` and `pgTAP Suites` from ruleset 15290760's `required_status_checks`. These workflows continue to run and enforce on any PR to preview (a PR to preview is still subject to the checks); they simply stop being listed as required for direct pushes. Linear ticket queued: `ruleset-required-checks-cleanup`.

Note: `authority-seed-parity` is NOT in this bucket — it triggers on `push: branches: [development]`, and GitHub check-run results transfer by SHA. When dev SHA is FF-pushed to preview, the `authority-seed-parity` check-run record transfers automatically.

## How to apply

Before adding any workflow to a ruleset's required_status_checks:

1. Verify the workflow's trigger events: `grep -A 5 '^on:' .github/workflows/<name>.yml`
2. If trigger is `pull_request` only: the workflow CANNOT be listed as required for branches that receive direct pushes (preview via FF, development via direct commit)
3. If the workflow MUST run on both: add a `push:` trigger AND verify the workflow body handles both event types (see L-0198 — workflows that read `github.event.pull_request.*` will fail on push events)
4. Check-run result transfer: a SHA's check-run record follows the SHA, not the branch. A check that ran on `development` for SHA X will show as green on `preview` after FF-push to SHA X.

For ruleset design: `required_status_checks` should only list contexts that can physically fire on the branch's canonical push path.

## Pattern signature

- Ruleset lists required check N
- Workflow N triggers only on `pull_request`
- Branch receives pushes via `git push` or fast-forward (no PR)
- Required check N shows "expected" status permanently on that branch

When all four: remove context N from required_status_checks OR add a push trigger (with body fix per L-0198).

## References

- `.claude/agents/deploy-conductor/RUNS.md` — 2026-05-04 Scenario K entry + B-phase entry
- `.github/workflows/pipeline-enforcement.yml` — PR-only trigger (confirmed)
- `.github/workflows/pgtap.yml` — PR-only trigger (confirmed)
- `../decisions/0265-enforced-deployment-pipeline.md` — mandates FF-push (no PR) for HOP A
- `./0198-push-trigger-on-pr-context-workflow-exits-one.md` — L-0198: why Path A2 was rejected
