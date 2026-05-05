---
title: CI Pipeline Audit — ci-incident-conductor self-loop incident
status: done
updated: 2026-05-05
created: 2026-05-05
module: meta
tags: [ci, post-incident, audit, deploy-pipeline, ci-incident-conductor]
incident_id: CI-INCIDENT-2026-05-05
severity: high
duration_min: ~12
---

# CI Pipeline Audit — 2026-05-05 ci-incident-conductor self-loop

## TL;DR

ci-incident-conductor entered self-trigger loop. 80+ commits to `development` and 320+ Vercel build events in ~5 minutes before workflow was manually disabled. Three independent bugs combined: a bash parameter-expansion quirk, a missing env var, and an over-broad GitHub Actions trigger. All three landed within 24 h of agent activation; none surfaced in dev runs because they only fire on the actual production trigger surface (real `deployment_status` events from Vercel, real `check_suite` failures).

## Timeline

| Time (UTC) | Event |
|---|---|
| ~17:30 | PR #324 merged to main; ci-incident-conductor begins triggering on real events. |
| ~20:02 | First reported failure: `escalate.sh: line 105: HEAD_SHA: unbound variable` + `jq: parse error: Unmatched '}' at line 1, column 827`. |
| ~20:07 | Fix #1 pushed (commit `bdcbad5bf`): added HEAD_SHA to handoff env, replaced `${VAR:-{}}` with empty-default + null-fallback in log.sh + escalate.sh. |
| ~20:10 | Fix #1 landed via rebase. Loop continues — every Vercel deploy_status event still triggers the agent; LLM step now fails on prose-not-JSON response. |
| ~20:11 | Triage step starts spamming dev with "append incident log" commits at ~10/sec. |
| ~20:17 | Fix #2 written (filter triggers + JSON-fallback). Push race-condition with agent's auto-commits. After 3 race-retries, fix lands at `fb659204a`. |
| ~20:18 | Workflow disabled manually via `gh workflow disable 271012811`. Queued runs cancelled. |
| ~20:19 | Empty `[skip ci]` commit pushed to bump head pointer (Vercel supersession). |
| ~20:20 | Pontus reports Vercel email storm. Queue drains over next 5–15 min via "Ignored Build Step". |

## Root causes

### Bug 1 — bash parameter-expansion brace trap

**Location:** `.github/scripts/ci-agent/log.sh:16,17`, `.github/scripts/ci-agent/escalate.sh:39`

**Code:**
```bash
CTX="${CTX_JSON:-{}}"
TRIAGE="${TRIAGE_JSON:-{}}"
```

**Bug:** Bash parses `${VAR:-{}}` as `${VAR:-{}` (default = `{`) followed by a literal `}`. Result: when `VAR` is set, the substitution returns the value, then the literal `}` is appended → `<value>}`. When the value is JSON, jq sees a trailing extra `}` and dies with `Unmatched '}' at column N` where N = original length.

**Local repro:**
```bash
$ X='{"a":1}' bash -c 'echo "${X:-{}}"' | wc -c
9    # Should be 8 (7 + newline). Extra char is the bug.
$ X='{"a":1}' bash -c 'echo "${X:-{}}"'
{"a":1}}
```

**Fix:**
```bash
CTX="${CTX_JSON:-}"
[[ -z "$CTX" ]] && CTX="{}"
```

Empty string default works correctly; null-fallback to literal `{}` happens via the test command, where braces are unambiguous.

### Bug 2 — missing HEAD_SHA in handoff step

**Location:** `.github/workflows/ci-agent.yml:138-151`

**Bug:** The "Handle deploy-conductor handoff" step did not pass `HEAD_SHA` (or `TELEGRAM_CHAT_ID`, `REPOSITORY`) into `escalate.sh`. The script runs `set -euo pipefail` and references `${HEAD_SHA}` in the issue-body template (line 92), Telegram message (line 196), and CRITICAL.md fallback (line 259). With `set -u`, unbound variable = exit 1.

**Why missed:** The non-handoff escalate step (line 116) passes HEAD_SHA correctly. Two paths into the same script, only one was wired.

**Fix:** Added `HEAD_SHA: ${{ steps.collect.outputs.head_sha }}` plus `TELEGRAM_CHAT_ID` and `REPOSITORY` to the handoff step's `env:` block.

### Bug 3 — over-broad `deployment_status` trigger + auto-commit

**Location:** `.github/workflows/ci-agent.yml:14`

**Bug:**
```yaml
on:
  deployment_status: {}
```

This fires on every Vercel state transition: `pending → in_progress → queued → ready/error`. With 4 Vercel projects (`smartout-web`, `smartout-landing`, `smartout-admin`, `smartout-pwa`), each push generates ~12 deployment_status events. The workflow's "Skip deploy-class on protected branches" guard only short-circuits the triage step — `Log incident` and `Commit log to development` always run (`if: always()`).

Each ci-agent run committed `chore(ci-agent): append incident log CI-XXX` to development. That commit triggered a new round of Vercel deploys → new deployment_status events → new ci-agent runs. The "Never triage self" guard at line 35 only checks `github.event.workflow_run.name != 'CI Incident Agent'` — does not apply when the trigger is `deployment_status` (no workflow_run name to match).

**Fix:** Narrow the trigger filter at job level:
```yaml
if: >
  !(
    github.event_name == 'deployment_status' &&
    github.event.deployment_status.state != 'failure' &&
    github.event.deployment_status.state != 'error'
  ) &&
  !(
    github.event_name == 'check_suite' &&
    github.event.check_suite.conclusion != 'failure' &&
    github.event.check_suite.conclusion != 'timed_out'
  )
```

### Bug 4 — triage LLM returns prose, script exits

**Location:** `.github/scripts/ci-agent/triage.sh:60-65`

**Bug:** When OpenRouter returns text instead of JSON (LLM disobedience or model swap), triage.sh fails the JSON validation and exits 1. The Log step then has empty `TRIAGE_JSON` env var. Combined with Bug 1, this triggered the jq parse fail. Even after Bug 1 fix, triage failure still propagates through the pipeline.

**Fix:** Three-tier parsing fallback:
1. Direct parse of cleaned content
2. Extract first `{...}` block from prose
3. Synthesise minimal escalate-medium triage object so log step always succeeds

## Damage assessment

- **Commits to development:** ~80 incident-log commits in 5 min. All append-only to `ops/ci-incidents/log.jsonl`. Cosmetic clutter; reverts not needed.
- **Vercel:** ~320 deploys queued (80 commits × 4 projects). Most cancelled by "Ignored Build Step". User received notification email storm.
- **Open PRs:** Five PRs (#336, #337, #338, #339, others) had their head SHAs evolved by the spam commits but were not blocked.
- **Production:** No production deploys triggered. Loop ran on `development` only.
- **Cost:** OpenRouter API calls × ~10 = small but wasted tokens.

## Lessons

### L-01 — Auto-commit workflows must have ultra-narrow triggers

Any workflow that writes back to the repo (logs, generated files, status updates) must filter triggers narrowly enough that its own commits CAN'T re-trigger it. Bare `deployment_status: {}` is dangerous.

**Generalisation:** if `permissions: contents: write` is in a workflow, audit triggers immediately. The combination "broad triggers + write contents + commit step" is a loop in waiting.

### L-02 — Bash brace-defaults are silently wrong for JSON

`${VAR:-{}}` is the natural-feeling pattern but the parser doesn't agree. Document this in CI script style guide. Add a shellcheck rule or grep gate to prevent regressions.

### L-03 — Strict-mode (`set -euo pipefail`) requires every env path validated

When `set -u` is on, unset variables are fatal. Multi-path scripts (escalate.sh handoff vs non-handoff) must propagate ALL env vars to ALL invocation sites. A code-review checklist for CI scripts: "if script is invoked from multiple workflow steps, do all steps pass the same env vars?"

### L-04 — LLM triage needs synthetic-fallback path

Any LLM-driven CI step must assume occasional non-conformance. Hard-fail on parse error means the step fails, the loop runs, the agent never recovers. Always synthesise a minimal valid output as the last fallback.

### L-05 — `gh workflow disable` is the canonical kill-switch

Issue-label-based pause (referenced in agent docs) is documented as a feature but was NOT implemented in the workflow. Without implementation, only `gh workflow disable <id>` (or via UI) actually stops the agent. Build the label-check into the if-guard before relying on it operationally.

### L-06 — Race conditions between fix push and auto-commit are real

Pushing a fix while the loop is active is a race. Pre-emptive `gh workflow disable` BEFORE pushing the fix would have made push trivial. Lesson: when an agent is misbehaving, disable first, fix second.

## Remediation status

| Bug | Fix commit | Status |
|---|---|---|
| 1. brace-default trap | `f5bcb8f0f` | shipped |
| 2. missing HEAD_SHA | `f5bcb8f0f` | shipped |
| 3. over-broad triggers | `fb659204a` | shipped |
| 4. LLM JSON-fallback | `fb659204a` | shipped |
| Workflow disabled | `gh workflow disable 271012811` | active |
| Pause-by-label feature | not implemented | open |

## Recommendations (open work)

1. **Implement `ci-agent-pause` label check** in workflow `if:` so memory-documented pause path actually works. Currently only `gh workflow disable` works.
2. **Add shellcheck gate to CI scripts** — would have caught bug 1 (SC2086 + SC2295 family).
3. **Audit all auto-commit workflows** for the same loop pattern. Search: `permissions: contents: write` + `git commit` + broad `on:` triggers.
4. **Vercel notification settings** — Pontus may want to opt out of "build canceled" emails to reduce future incident noise.
5. **Re-enable workflow only after** verifying the 4 fixes hold under real load. Test by triggering a deliberate CI failure and observing ONE agent run, ONE incident log commit, ZERO further triggers.
6. **Consider cleanup commit** that squashes/reverts the 80+ noise commits. Trade-off: rewrites dev history (force-push, breaks open PR ancestry). Recommendation: leave them; they are an honest audit trail of the incident.

## References

- Original ADR for ci-incident-conductor: `docs/decisions/0275-ci-incident-response-agent.md`
- Memory: `learning_bash_brace_default_trap.md` (L-01 generalisation)
- Memory: `learning_self_trigger_loop_deployment_status.md` (L-02 generalisation)
- Issue: #341 (PAUSE ci-incident-conductor)
- Workflow: `.github/workflows/ci-agent.yml`
- Scripts: `.github/scripts/ci-agent/{log,triage,escalate,collect}.sh`
