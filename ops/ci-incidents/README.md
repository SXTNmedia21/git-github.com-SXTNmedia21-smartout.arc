---
title: CI Incidents — Ops Landing Zone
status: canonical
updated: 2026-05-04
created: 2026-05-04
module: deployment
tags: [ci, incidents, ops, adr-0275]
---

# CI Incidents — Ops Landing Zone

This directory is the append-only operational record for CI incident triage by `ci-incident-conductor` (ADR-0275).

---

## Files in this directory

| File                  | Description                                         |
| --------------------- | --------------------------------------------------- |
| `log.jsonl`           | Append-only incident log (one JSON object per line) |
| `CRITICAL.md`         | Critical-severity incident register (append-only)   |
| `YYYY-WW-summary.md`  | Weekly digest (auto-generated, one per ISO week)    |
| `YYYY-WW-patterns.md` | Pattern file for recurrences ≥ 3 in the week        |
| `.gitkeep`            | Keeps directory tracked when log is empty           |

---

## Log schema (`log.jsonl`)

Each line is a JSON object with the following fields. Required fields are marked with `*`.

| Field                  | Type                    | Required | Description                                                                                                     |
| ---------------------- | ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `incident_id`          | string                  | \*       | Format: `CI-YYYY-MM-DD-NNN`. Monotonically increasing per day.                                                  |
| `ts_detected`          | ISO-8601 string         | \*       | When the triage run started.                                                                                    |
| `ts_resolved`          | ISO-8601 string or null |          | When the incident was resolved (auto or manual).                                                                |
| `trigger`              | string                  | \*       | GitHub event that fired: `workflow_run`, `check_suite`, `deployment_status`, `schedule`, `repository_dispatch`. |
| `branch`               | string                  | \*       | Head branch of the triggering run.                                                                              |
| `workflow`             | string                  |          | Workflow name from the triggering event.                                                                        |
| `job`                  | string or null          |          | First failed job name.                                                                                          |
| `run_id`               | string or null          |          | GitHub Actions run ID.                                                                                          |
| `run_attempt`          | integer                 |          | Attempt number (1 = first run, 2+ = rerun).                                                                     |
| `head_sha`             | string or null          |          | Git SHA at head of the triggering run.                                                                          |
| `failure_class`        | string                  | \*       | See taxonomy below.                                                                                             |
| `root_cause`           | string or null          |          | Technical root cause.                                                                                           |
| `confidence`           | float                   | \*       | 0.0–1.0. Triage model confidence.                                                                               |
| `action`               | string                  | \*       | `auto-fix`, `suggest`, `escalate`, `no-op`.                                                                     |
| `action_detail`        | string or null          |          | Description of action taken (PR URL, issue URL, etc.).                                                          |
| `validation`           | string or null          |          | Post-fix validation result.                                                                                     |
| `duration_impact_sec`  | integer or null         |          | Estimated developer time lost.                                                                                  |
| `recurrence_count_30d` | integer                 |          | Number of similar incidents in past 30 days.                                                                    |
| `is_known_pattern`     | boolean                 |          | True if matched a known pattern from triage prompt.                                                             |
| `memory_ref`           | string or null          |          | Memory file slug matched.                                                                                       |
| `related_audit`        | string or null          |          | Related `adr-contract-audit` run ID.                                                                            |
| `related_drift`        | string or null          |          | Related `drift-check` run ID.                                                                                   |
| `escalated_to`         | string or null          |          | Who received the escalation: `deploy-conductor`, `github-issue`, `linear`, `telegram`.                          |
| `severity`             | string                  | \*       | `info`, `medium`, `high`, `critical`.                                                                           |
| `follow_up`            | string or null          |          | Pending action for operator or author.                                                                          |
| `summary`              | string or null          |          | One-sentence human-readable summary.                                                                            |

---

## Querying with `jq`

```bash
# All incidents today
jq -c 'select(.ts_detected | startswith("2026-05-04"))' ops/ci-incidents/log.jsonl

# High and critical incidents
jq -c 'select(.severity == "high" or .severity == "critical")' ops/ci-incidents/log.jsonl

# Auto-fix actions only
jq -c 'select(.action == "auto-fix")' ops/ci-incidents/log.jsonl

# Recurrence > 1 in last 30 days
jq -c 'select(.recurrence_count_30d > 1)' ops/ci-incidents/log.jsonl

# By failure class
jq -c 'select(.failure_class == "stale-artifact")' ops/ci-incidents/log.jsonl

# Count by class
jq -r '.failure_class' ops/ci-incidents/log.jsonl | sort | uniq -c | sort -rn

# Count by severity
jq -r '.severity' ops/ci-incidents/log.jsonl | sort | uniq -c | sort -rn

# All known-pattern matches
jq -c 'select(.is_known_pattern == true)' ops/ci-incidents/log.jsonl

# Deploy-conductor handoffs
jq -c 'select(.escalated_to | strings | contains("deploy-conductor"))' ops/ci-incidents/log.jsonl

# Mean confidence
jq -r '.confidence' ops/ci-incidents/log.jsonl | awk '{s+=$1; n++} END {print s/n}'

# Incidents that generated PRs
jq -c 'select(.action_detail | strings | startswith("pr:"))' ops/ci-incidents/log.jsonl
```

---

## Weekly digest format (`YYYY-WW-summary.md`)

Auto-generated by `ci-incident-conductor` at end of each ISO week. Sections:

1. **Week summary** — total incidents, breakdown by class/severity/action.
2. **Metric baselines** — failure_rate, mttd, mttr, auto_fix_share, false_auto_fix_rate, flaky_recurrence, cache_hit_rate, ci_duration_p50/p95, rerun_rate.
3. **New patterns** — patterns that appeared this week but were not in the known-patterns list.
4. **Phase status** — current phase (0–4) and metric vs threshold.
5. **Follow-ups** — incidents with non-null `follow_up` field.
6. **Deploy-conductor handoffs** — incidents handed off this week.

---

## Pattern file format (`YYYY-WW-patterns.md`)

Generated when any pattern reaches recurrence ≥ 3 in a rolling 30-day window.

Sections per pattern:

- **Pattern name** — slug used in `memory_ref`
- **Occurrence count** — total in 30-day window
- **First seen** — `ts_detected` of earliest incident
- **Symptoms** — what the log_excerpt shows
- **Action taken** — what the agent did
- **ADR draft status** — pending / proposed / accepted (ADR trigger: 3rd recurrence)

---

## Severity reference

| Severity   | When triggered                                                  | Escalation channels                                 |
| ---------- | --------------------------------------------------------------- | --------------------------------------------------- |
| `info`     | Benign; supabase-app supersession; scheduled health check green | Log only                                            |
| `medium`   | Single job failed; recoverable; not blocking                    | GitHub Issue + Telegram                             |
| `high`     | Multi-job failure; blocks merge; recurrence > 2; env-secrets    | GitHub Issue (urgent label) + Telegram + Linear     |
| `critical` | All CI red; deploy gate blocked; security; unknown recurring    | All of above + `CRITICAL.md` + @SXTNmedia21 mention |

---

## Failure taxonomy reference

| Class            | Description                                      | Auto-fix eligible |
| ---------------- | ------------------------------------------------ | ----------------- |
| `app-bug`        | Application logic regression                     | No                |
| `ci-config`      | Workflow YAML misconfiguration                   | Yes (allowlist)   |
| `dep-cache`      | pnpm/Turbo dependency or cache failure           | Yes (allowlist)   |
| `env-secrets`    | Missing env var, expired key, env-template drift | No                |
| `flaky-test`     | Intermittent test failure                        | Yes (allowlist)   |
| `deploy`         | Deploy-class on main/preview                     | No — hand off     |
| `security`       | Leaked credential, SAST, vuln                    | No — escalate     |
| `supabase-app`   | Supabase GitHub App check event                  | No (suggest only) |
| `stale-artifact` | Stale build artifact corruption                  | Yes (allowlist)   |

---

## Reference

- **ADR:** [ADR-0275](../../docs/decisions/0275-ci-incident-response-agent.md)
- **Triage prompt:** [.github/scripts/ci-agent/triage-prompt.md](../../.github/scripts/ci-agent/triage-prompt.md)
- **Protocol:** [docs/protocols/CI-INCIDENTS.md](../../docs/protocols/CI-INCIDENTS.md)
- **Deploy conductor:** [docs/protocols/DEPLOYMENT.md](../../docs/protocols/DEPLOYMENT.md)
- **Drift check:** [infra/scripts/drift-check.sh](../../infra/scripts/drift-check.sh)
