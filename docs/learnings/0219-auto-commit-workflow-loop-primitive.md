---
title: "if: always() + auto-commit + watched branch = loop primitive"
id: LEARNING_0219
status: canonical
layer: learning
created: 2026-05-06
updated: 2026-05-06
tags: [learning, ci, github-actions, loop, ci-incident-conductor]
---

# Learning-0219: if: always() + auto-commit + watched branch = loop

## Reference (for grep)

- 2026-05-05 ci-incident-conductor self-trigger loop incident
- `docs/audits/2026-05-06-ci-pipeline-audit-extended.md` § F-05, L-07/L-09
- Memory: `learning_self_trigger_loop_deployment_status.md`

## The loop primitive

Three properties combined produce an infinite loop:

1. Workflow has broad triggers (e.g. `deployment_status: {}`, `check_suite: {}`)
2. Workflow has a step with `if: always()` that pushes to git
3. Push target is a branch the workflow ALSO watches

Each push triggers downstream workflows on the watched branch. Those
emit deployment_status / workflow_run events. Original workflow re-fires.
Self-detection guards (`workflow_run.name != self`) only catch direct
recursion via `workflow_run`, NOT via `deployment_status` or `check_suite`
since those have no workflow-run name.

## 2026-05-05 incident

`ci-incident-conductor` had:
- `on: deployment_status: {}` (every state transition: pending/in_progress/success/failure)
- 4 Vercel projects = ~12 deployment_status events per dev push
- `if: always()` on commit step pushing `chore(ci-agent): append incident log` to development
- Each commit triggered 12 more events → 12 more agent runs → 12 more commits

Result: 80+ commits in 5 minutes. 320+ Vercel builds queued. Email storm.
`gh workflow disable` was the only working stop.

## Generalisation: triggers are read like permissions

When auditing a workflow, the `on:` block is the attack surface. Bare
broad triggers like `deployment_status: {}` open the workflow to ANY
external state change. Combine with `permissions: contents: write` and a
`git commit` step → the workflow can author state on the same branch it
watches.

Audit checklist for any workflow with `permissions: contents: write`:

1. Are triggers narrow enough that the workflow's own commits CAN'T re-fire it?
2. If the commit-step has `if: always()`, is the commit target a branch
   NOT in the workflow's `on:` block? (e.g. push to `audit-logs` branch
   that's not in CI watch-list)
3. Is there explicit self-commit short-circuit? (e.g. detect commit
   message starting with `chore(<self>):` and exit early)

If any answer is "no" — there's a latent loop.

## Fixes applied

1. Filter `deployment_status` to failure/error states only (not pending/success):
   ```yaml
   if: >
     !(github.event_name == 'deployment_status' &&
       github.event.deployment_status.state != 'failure' &&
       github.event.deployment_status.state != 'error')
   ```
2. Same for `check_suite` (failure/timed_out only)
3. Added `pause_guard` step: detects own commits via `git log -1 --format='%s'`
   matching `chore(ci-agent):` and exits early
4. Added `pause_guard` step: queries `gh issue list --label ci-agent-pause`
   for soft-pause via Issue label

## Anti-pattern

Never combine `permissions: contents: write` + `if: always()` commit step
+ broad triggers without explicit self-commit guard. Smaller-blast
alternatives:

- Push log/audit data to a SIBLING branch with `paths-ignore` on watch
- Upload as artifact via `actions/upload-artifact` instead of committing
- Push to a separate audit repo with its own narrow triggers

## Detection

```bash
# Workflows with write permissions that commit-back
grep -l "contents: write" .github/workflows/*.yml | while read f; do
  if grep -q "git commit\|git push" "$f"; then
    echo "AUDIT: $f has write+commit"
    grep -A 1 "^on:" "$f"  # show triggers
  fi
done
```

## Related

- L-0218 (bash output anti-patterns — same incident)
- ADR-0275 (ci-incident-response-agent scope + boundaries)
- L-0066 (default-allow CVE class — different domain, same "silent failure" theme)
