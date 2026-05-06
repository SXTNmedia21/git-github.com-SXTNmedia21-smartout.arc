# ci-incident-conductor — Operator Runbook

> Quick reference for stopping, re-enabling, and debugging the
> `CI Incident Agent` workflow (`.github/workflows/ci-agent.yml`).

## Kill-switch (highest priority)

If the agent is misbehaving — looping, false-triggering, or otherwise
flooding the repo or downstream systems — **stop it first, diagnose
second.**

### Option A — `gh workflow disable` (canonical)

```bash
# Disable by ID (most reliable; survives workflow renames)
gh workflow disable 271012811

# Verify
gh workflow list --all | grep "CI Incident Agent"
# → CI Incident Agent  disabled_manually  271012811
```

This stops new runs immediately. In-flight runs continue but don't
spawn new ones. The workflow re-appears at the bottom of the GitHub
Actions UI tagged `Disabled manually`.

### Option B — `ci-agent-pause` Issue label

Open any Issue with the label `ci-agent-pause`. The agent's
`pause_guard` step (added in commit `5fc58432e`, F-06 fix) checks
for open issues with that label as the first step in the workflow
and halts the entire job before any side effect.

```bash
gh issue create \
  --title "PAUSE ci-incident-conductor — <reason>" \
  --label "ci-agent-pause" \
  --body "Reason: <one-line>"
```

This is the soft-pause: workflow remains enabled but each invocation
short-circuits. Useful when you want the agent paused for a brief
investigation but expect to resume soon.

### Option C — emergency: cancel all in-flight runs

```bash
# List currently running runs
gh run list --workflow=271012811 --status=in_progress --json databaseId

# Cancel each
gh run cancel <run_id>
```

Combine with Option A to fully halt. Use only if Option A's "in-flight
continues" behaviour is unacceptable (e.g., during an active loop).

---

## Re-enable

After confirming the issue is fixed:

```bash
# 1. Validate fixes in place — typecheck + linter
pnpm turbo typecheck --filter=web
bash .github/scripts/migration-lint.sh  # if migration-related

# 2. Trigger a deliberate test failure on a sandbox branch + verify
#    the agent runs ONCE, commits ONCE, then pause_guard short-circuits
#    on the auto-commit's downstream events.

# 3. Re-enable
gh workflow enable 271012811

# 4. Watch first 10 runs
gh run list --workflow=271012811 --limit 10
```

**Do not re-enable** if any P0 audit findings are still open. See
`docs/audits/2026-05-06-ci-pipeline-audit-extended.md` § Recommendations.

---

## Architecture

The agent runs in three phases inside one job:

1. **`pause_guard`** — checks open `ci-agent-pause` issues + last-commit
   subject for `chore(ci-agent):` self-commit detection. Halts entire
   job if either condition triggers (F-05/F-06).
2. **`collect.sh`** — gathers run context (failed jobs, recent commits,
   recurrence count). Outputs JSON to `$GITHUB_OUTPUT.ctx_json`.
3. **`triage.sh` → `apply-fix.sh` / `post-comment.sh` / `escalate.sh`**
   — LLM-based classification, then dispatch to one of three actions.
   Falls back to synthetic escalate-medium triage if LLM returns
   non-JSON (F-04).
4. **`log.sh` + `Commit log to development`** — append-only audit
   to `ops/ci-incidents/log.jsonl`. Both gated on
   `pause_guard.halt != 'true'` to prevent loop reactivation.

---

## Known traps

### `${VAR:-{}}` parses as `${VAR:-{}` + literal `}` in bash

Adds an extra `}` to the value, breaks JSON downstream. Fixed in
log.sh + escalate.sh + collect.sh (commits `f5bcb8f0f`, `5fc58432e`).
Use empty default + null-fallback instead:

```bash
VAR="${ENV:-}"
[[ -z "$VAR" ]] && VAR="{}"
```

### `grep -c | echo 0` produces multi-line value

`grep -c` prints `0` then exits 1; `|| echo 0` prints another `0`.
Result: `"0\n0"`, breaks `$((var + 1))` arithmetic under `set -e`.
Fixed in collect.sh (`5fc58432e`). Use `|| true` instead.

### Direct `git log -1 --pretty='format:{...}' | paste`

String-concat of JSON breaks if commit subject has `"` or `\`. Build
JSON with `jq -Rs split`. Fixed in collect.sh (`5fc58432e`).

### `if: always()` on commit step + auto-commit + watched branch = loop

The agent's commit step runs on `if: always()` to log even on triage
failure. Auto-commit on `development` triggers downstream workflows
that re-invoke the agent. `pause_guard` self-commit detection now
short-circuits this (F-05). Without it, any path that pushes to
the watched branch creates a loop.

---

## References

- ADR-0275 — agent scope, hard boundaries, autonomous operating mode
- ADR-0265 — enforced deployment pipeline (deploy-conductor sibling)
- `docs/audits/2026-05-05-ci-pipeline-audit.md` — original incident report
- `docs/audits/2026-05-06-ci-pipeline-audit-extended.md` — extended audit
- `docs/audits/2026-05-06-supabase-migration-audit.md` — migration audit
- Issue #341 (closed) — first activation of pause-by-label flow
- Memory: `learning_bash_brace_default_trap.md`
- Memory: `learning_self_trigger_loop_deployment_status.md`
