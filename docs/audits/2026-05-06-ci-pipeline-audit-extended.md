---
title: Extended CI Pipeline Audit — full sweep of workflows + scripts
status: done
updated: 2026-05-06
created: 2026-05-06
module: meta
tags: [ci, audit, workflows, ci-incident-conductor, deploy-pipeline]
parent_incident: docs/audits/2026-05-05-ci-pipeline-audit.md
severity: high
scope: ".github/workflows/*.yml + .github/scripts/**/*.sh + Vercel triggers + auto-commit chains"
---

# Extended CI Pipeline Audit — 2026-05-06

> Follow-up to the 2026-05-05 incident report. This one widens the lens: instead of only documenting what blew up, it audits **every workflow and every script** for the same class of bugs and adjacent risks.

## Method

- Inventory: 8 workflows + 6 shell scripts
- Cross-reference: each script's declared `Inputs (env)` vs the workflow `env:` block that invokes it
- Trigger audit: every `on:` block × `permissions:` × commit-back paths
- Bug pattern sweep: `${VAR:-{}}` brace trap; `grep -c | echo 0` multi-output; `set -u` env gaps; LLM JSON contract; `if: always()` on commit steps
- Post-incident verification: confirm bugs from yesterday's report are actually shipped

## Inventory

### Workflows (8)

| Workflow | Triggers | Commits back? | Risk |
|---|---|---|---|
| ai-eval.yml | `pull_request` (path-filtered) | no | LOW |
| authority-seed-parity.yml | PR + push to dev + workflow_dispatch | no | LOW |
| **ci-agent.yml** | `workflow_run` + `check_suite` + `deployment_status` + cron + repo_dispatch | **yes** (`git push origin development`) | **HIGH** |
| ci.yml | push + PR (main/dev/preview) | no | LOW |
| claude-code-review.yml | `pull_request` | comments only | LOW |
| claude.yml | issue/PR comments | comments only | LOW |
| pgtap.yml | `pull_request` | no | LOW |
| pipeline-enforcement.yml | `pull_request` (main/preview) | no | LOW |

Only one workflow (ci-agent.yml) writes back to git. It is the only workflow that can self-loop. Yesterday's incident exposed exactly that capability; the rest of the pipeline is structurally safe.

### Scripts (6)

| Script | Lines | Inputs declared | Inputs validated against workflow env? |
|---|---|---|---|
| collect.sh | 147 | implicit (uses GitHub Actions ENV defaults + secrets) | partial — see findings |
| triage.sh | ~110 | OPENROUTER_API_KEY, CTX_JSON | ✅ |
| apply-fix.sh | ~ | GH_TOKEN, TRIAGE_JSON, INCIDENT_ID, BRANCH, HEAD_SHA | ✅ |
| post-comment.sh | ~ | GH_TOKEN, TRIAGE_JSON, INCIDENT_ID, HEAD_SHA, BRANCH | ✅ |
| escalate.sh | ~270 | GH_TOKEN, TELEGRAM_*, LINEAR_*, CTX, HEAD_SHA, REPOSITORY, INCIDENT_ID, BRANCH | ✅ both invocation paths (post-fix) |
| log.sh | ~115 | INCIDENT_ID, CTX_JSON, TRIAGE_JSON, ACTION_DETAIL, GUARD_SKIP, GUARD_REASON, BRANCH | ✅ |

## Findings

### F-01 — collect.sh: `grep -c | echo 0` produces multi-line value, breaks arithmetic

**Severity:** HIGH (causes `set -e` exit; agent never runs on first incident of the day).

**Location:** `.github/scripts/ci-agent/collect.sh:21`

```bash
today_count=$(grep -c "\"ts_detected\":\"${today}" "$log_file" 2>/dev/null || echo 0)
```

**Bug:** When `grep -c` finds zero matches, it prints `0` then exits 1. `|| echo 0` then prints another `0`. Result: `today_count` = `"0\n0"`. Subsequent `$((today_count + 1))` on line 24 fails with `syntax error in expression (error token is "0")` because bash arithmetic does not accept multi-line values. With `set -e`, this kills the script. Effect: every "first incident of the day" call to collect.sh exits before producing output, breaking downstream steps.

**Local repro:**
```bash
$ today_count=$(grep -c "xxx" /etc/hosts 2>/dev/null || echo 0)
$ printf "[%s]" "$today_count"
[0
0]
$ printf "%03d" $((today_count + 1))
bash: line 1: 0
0: syntax error in expression (error token is "0")
```

**Fix:** Either swap to `wc -l`, or guard the count differently:
```bash
today_count=0
if [[ -f "$log_file" ]]; then
  today_count=$(grep -c "\"ts_detected\":\"${today}" "$log_file" || true)
fi
```

`|| true` swallows the non-zero exit without producing extra output.

### F-02 — collect.sh: same multi-output bug at line 95

**Severity:** MEDIUM (only fires if python3 not present in runner).

**Location:** `.github/scripts/ci-agent/collect.sh:95`

```bash
LOG_EXCERPT_ESCAPED=$(printf '%s' "$LOG_EXCERPT" | python3 -c '...' 2>/dev/null || echo '""')
```

Same class of bug. If `python3` exits non-zero, the `|| echo '""'` adds output AFTER python's partial output. JSON-embed downstream may concat to invalid JSON.

**Fix:** Guard with explicit if-else:
```bash
if command -v python3 >/dev/null 2>&1; then
  LOG_EXCERPT_ESCAPED=$(printf '%s' "$LOG_EXCERPT" | python3 -c '...' 2>/dev/null) || LOG_EXCERPT_ESCAPED='""'
else
  LOG_EXCERPT_ESCAPED='""'
fi
```

### F-03 — collect.sh: incident_id format collision when log.jsonl missing or shallow clone

**Severity:** LOW (fallback to `001`, but could collide if multiple agent runs race the same day).

**Location:** `.github/scripts/ci-agent/collect.sh:14-26`

`generate_incident_id` uses `grep -c` against `ops/ci-incidents/log.jsonl`. If log file is missing (fresh clone) it returns `0` which means `001`. Multiple parallel runs (which DID happen yesterday — 12 events per push) can each compute the same `001` value because they each read pre-write state.

**Mitigation:** Acknowledge in the audit; the field is for human readability, not uniqueness. Real uniqueness is the SHA + run_id. Not a blocker.

### F-04 — RECENT_COMMITS JSON injection on commit subjects with `"` characters

**Severity:** LOW–MEDIUM (one specific commit subject pattern would inject; jq would then fail downstream).

**Location:** `.github/scripts/ci-agent/collect.sh:64`

```bash
RECENT_COMMITS=$(git log -3 --pretty='format:{"sha":"%H","short":"%h","author":"%an","subject":"%s"}' 2>/dev/null | paste -sd',' | sed 's/$/]/' | sed 's/^/[/' || echo "[]")
```

Builds JSON via string concat. If a commit subject contains `"`, `\`, or newline, the resulting JSON is malformed. jq downstream (`--argjson recent_commits`) dies. With `set -e`, kills agent.

Yesterday's CTX value at column 827 ended in `nonEmpty() (NonEmptyString brand)"` — close call. Parens are JSON-safe but a literal `"` in the subject would have broken everything earlier.

**Fix:** Use jq to construct the array properly:
```bash
RECENT_COMMITS=$(git log -3 --pretty='format:%H%x09%h%x09%an%x09%s' 2>/dev/null \
  | jq -Rs 'split("\n") | map(select(length > 0) | split("\t") | {sha:.[0], short:.[1], author:.[2], subject:.[3]})' \
  || echo "[]")
```

### F-05 — `Commit log to development` step has `if: always()` AND broad-trigger inheritance

**Severity:** HIGH (this is the actual loop mechanism; even after yesterday's fixes, it's still possible to loop via `workflow_run` on CI failures).

**Location:** `.github/workflows/ci-agent.yml:181-211`

The commit step runs on `if: always()`, meaning even if every other step fails, this one fires and pushes `chore(ci-agent): append incident log` to `development`. The push triggers CI workflow on dev. If CI fails on that commit (unlikely for pure JSONL append, but not impossible — Husky pre-push hooks, lint gates), ci-agent re-fires, commits again, loops.

**The current trigger filter (post-yesterday) handles `deployment_status` and `check_suite` paths, but NOT the `workflow_run` trigger from CI on auto-commits.** Self-trigger guard (`workflow_run.name != 'CI Incident Agent'`) only helps if CI is the WORKFLOW_RUN actor — which it is when CI fails. So the self-guard catches "CI failure I caused" only if CI's workflow name is something like "CI Incident Agent" (which it isn't). The guard at line 35 fires only when ci-agent triggers itself (which can't happen via `workflow_run` per GitHub's rules).

So the actual loop-guard relies entirely on **CI staying green for ci-agent's auto-commits**. If anything in CI is flaky on a JSONL-only commit, the loop comes back.

**Fix recommendations:**
1. **Skip ci-agent on its own auto-commits.** Detect via commit message in collect.sh: if `git log -1 --format=%s` starts with `chore(ci-agent):`, exit 0 immediately and write a no-op incident.
2. **Move the JSONL log to a separate file path that has a `paths-ignore: 'ops/ci-incidents/**'` filter on CI workflow.** Then CI does not trigger on log commits.
3. **Or: stop committing logs from CI.** Append-only audit log inside the workflow can use `actions/upload-artifact` instead, with an external uploader or weekly batch consolidation.

Recommendation 1 is the smallest change. Recommendation 2 is the most defensive.

### F-06 — Pause-by-label feature documented but not implemented

**Severity:** MEDIUM (operational, not a code bug).

**Location:** `docs/decisions/0275-ci-incident-response-agent.md` (referenced in memory `feedback_ci_domain_full_autonomy.md`).

The ADR documents a `ci-agent-pause` Issue label as the canonical pause mechanism. The workflow does not check for it. Yesterday I created an Issue with that label expecting it to pause the agent — it did nothing. Had to use `gh workflow disable` instead.

**Fix:** Add to ci-agent.yml job-level `if:`:

```yaml
if: >
  (existing conditions) &&
  !contains(github.event.issue.labels.*.name, 'ci-agent-pause') &&
  fromJSON(steps.check_pause_label.outputs.is_paused) != true
```

But `github.event.issue.labels` is only populated for issue-event triggers. Better: a dedicated step that calls `gh issue list --label ci-agent-pause --state open --json number` and short-circuits if any are returned.

### F-07 — `deployment_status` filter is correct but verbose

**Severity:** LOW (cosmetic — filter works, just hard to read).

**Location:** `.github/workflows/ci-agent.yml:34-52`

The job-level `if:` is now a 7-clause boolean. Easy to break in a refactor. Consider extracting:
```yaml
on:
  deployment_status:
    types: [error]
```

Wait — GitHub Actions does not document `types` for `deployment_status`. It does for `check_suite`. Verify before refactor; if not supported, leave the verbose filter.

### F-08 — claude.yml + claude-code-review.yml use `claude-code-base-action@beta`

**Severity:** LOW (informational).

Two workflows reference `anthropics/claude-code-base-action@beta`. Beta tags can drift. Pin to a specific commit SHA for stability. Same applies to `actions/checkout@v4` (Node 20 deprecation warnings on every run since 2026-05-05).

### F-09 — No timeout on commit step

**Severity:** LOW (could hang under network failure).

The "Commit log to development" inline script has no `timeout-minutes:`. Job-level timeout is 10 min (line 31). If `git push` hangs, eats the budget. Add `timeout-minutes: 2` to that step.

### F-10 — Yesterday's fixes verified shipped

| Bug | Commit | On main? | Status |
|---|---|---|---|
| brace-default trap (log.sh, escalate.sh) | `f5bcb8f0f` | yes (development) | shipped |
| missing HEAD_SHA in handoff | `f5bcb8f0f` | yes | shipped |
| over-broad deployment_status trigger | `fb659204a` | yes | shipped |
| LLM JSON-fallback | `fb659204a` | yes | shipped |
| workflow disabled | manual via `gh workflow disable 271012811` | active | active |

All four code fixes confirmed in the working tree at `8d1613ef..ebbb03214`. Workflow remains disabled pending operator decision.

## Adjacent risks (broader pipeline)

Beyond ci-agent, the deployment pipeline has these contributing factors:

### A-01 — 4 Vercel projects on every push to dev

`smartout-web`, `smartout-landing`, `smartout-admin`, `smartout-pwa` all watch `development`. Each push fires 3 deployment_status events × 4 projects = 12 events. This is Vercel-side concurrency, not GitHub-side. Yesterday's loop went 80 commits × 4 projects = 320 builds queued. Vercel's "Ignored Build Step" canceled most, but the email storm came from Vercel's notification system.

**Mitigation options:**
- Move admin/pwa to their own branches (so they don't deploy on dev push)
- Add `paths-ignore` on Vercel for `ops/**` and `docs/**` so JSONL log commits don't trigger
- Configure Vercel notification settings: opt out of "deployment canceled" emails

### A-02 — `if: always()` on commit step inherited from a working pattern

The "always commit log" pattern is used by other audit workflows in the ecosystem (e.g., `n8n` workflow runs, `secrets-scan` actions). Generally safe when:
- The commit is to a branch the workflow does NOT run on (e.g., `audit-logs` branch)
- OR the workflow has narrow `paths` filter excluding the commit's files
- OR the workflow has a self-detection short-circuit

ci-agent has none of these. It commits to the same branch it watches.

### A-03 — pre-push hooks vs ci-agent commits

ci-agent uses GitHub's Actions runner shell, not a developer machine. Husky pre-push hooks run in the runner only if installed by `actions/checkout`'s post-step or explicit `pnpm install`. Yesterday's runs DID succeed in pushing — meaning either Husky wasn't installed in the agent's runner, or it was bypassed. Worth confirming: do agent commits respect the pre-push gate? If not, ci-agent can push code that would be blocked from a developer.

### A-04 — Vercel 4-project monorepo deploy noise

Same root: 4 projects × every dev push = high deploy event volume. Even without ci-agent, every campaign merge or hotfix triggers 12 deployment_status events. Each event is processed by anything subscribed. ci-agent was just the loudest subscriber.

## Recommendations (prioritised)

### P0 — must do before re-enabling ci-agent

1. **Fix F-01** (grep multi-output bug). Without this fix, agent fails on first run of any new day when log.jsonl exists but lacks today's date. Easy fix, high impact.
2. **Fix F-05** (commit step loop guard). Either:
   - Skip if last commit subject starts with `chore(ci-agent):` (smallest change)
   - Or move log file out of CI's watch path (defensive)
3. **Implement F-06** (pause-by-label). The ADR-documented pause mechanism must work, otherwise next incident requires Pontus or me to manually `gh workflow disable`.

### P1 — soon, but not blocking

4. Fix F-02, F-04 (output-injection bugs in collect.sh).
5. Add F-09 timeouts.
6. Audit other workflows for `${VAR:-{}}` pattern (zero hits today, but add a CI gate / shellcheck rule).
7. Pin `@beta` tags + Node 20 actions.

### P2 — operational hygiene

8. Vercel notification settings: opt out of "build canceled" emails.
9. Add a self-test workflow that triggers a deliberate CI failure on a sandbox branch and verifies ci-agent runs ONCE, commits ONCE, then stops. Run weekly.
10. Document the `gh workflow disable` runbook in `.github/scripts/ci-agent/README.md` so anyone (not just the original author) can stop a misbehaving agent.

### P3 — strategic

11. Decide: do we want ci-agent to commit at all? An alternative is to upload incident logs as artifacts to a dedicated repo (e.g., `smartout-ops`) where the commit-back can't loop the source repo. Same audit value, no loop risk.

## What we learned

Beyond the post-incident L-01..L-06 in yesterday's report:

### L-07 — `if: always()` is a loop primitive when paired with auto-commit

Whenever a workflow has `if: always()` on a step that pushes to a branch the workflow watches, you have a loop. This is true regardless of how narrow the rest of the trigger filters are, because `if: always()` overrides the failure-skip on the steps before it. The commit step CANNOT be `if: always()` if it pushes to the watched branch. Either gate it on success of prior steps, or push to a different branch.

### L-08 — `grep -c | echo 0` is a third bash anti-pattern

Same family as `${VAR:-{}}` and unguarded `printf | python3`: shell utilities that print on failure THEN run the OR-fallback that ALSO prints. Result is multi-line value where caller expects single-line. Add to lint gate.

### L-09 — Audit triggers are read like permissions

When auditing a workflow, the trigger list is the attack surface. `deployment_status: {}`, `check_suite:`, `workflow_run:`, `repository_dispatch:` are all "external triggers" that the workflow author can't fully control. If the workflow has any commit-back, every external trigger is a potential loop driver.

## Sign-off

This audit was performed in ~30 minutes by the same conductor who handled yesterday's incident. Findings are based on grep + read of the 8 workflows + 6 scripts. Has NOT been verified by code-execution against a live runner. P0 fixes should be paired with a sandbox test before re-enabling the agent.

Next milestone: fix P0 (3 items), test against deliberate failure, then re-enable workflow with operator approval.

## References

- Yesterday's report: `docs/audits/2026-05-05-ci-pipeline-audit.md`
- Memory: `learning_bash_brace_default_trap.md`, `learning_self_trigger_loop_deployment_status.md`
- ADR: `docs/decisions/0275-ci-incident-response-agent.md`
- Issue: #341 (PAUSE ci-incident-conductor — open until pause-feature lands)
- Workflow: `.github/workflows/ci-agent.yml` (disabled)
- Scripts: `.github/scripts/ci-agent/{collect,triage,apply-fix,post-comment,escalate,log}.sh`
