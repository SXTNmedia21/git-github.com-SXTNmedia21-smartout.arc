---
title: "ci-incident-conductor — Verified State"
status: live
updated: 2026-05-06
last-verified: 2026-05-06T08:35Z
---

# Verified State

Current operational snapshot. Re-verify at session start. Counts drift; do not quote metric baselines without checking log.jsonl.

---

## Current phase

| Field | Value |
|---|---|
| **current_phase** | **0 — log-only** |
| phase_since | 2026-05-04 (bundle created) |
| phase_0_completion_target | 14 days after first incident logged |
| phase_1_unlock_criteria | 14 days + ≥ 5 incidents in log.jsonl |
| active_override | null |
| override_reason | null |
| override_since | null |

**Phase 0 is log-only.** No PR comments, no GitHub Issues, no Telegram alerts, no auto-fix PRs. Only `ops/ci-incidents/log.jsonl` entries and RUNS.md appends.

---

## Metric baselines (empty — will populate after Phase 0 observation period)

| Metric | Baseline | Verified | Target |
|---|---|---|---|
| failure_rate (actions) | — | not yet | establish in Phase 0 |
| failure_rate (supabase-app) | — | not yet | establish in Phase 0 |
| mttd (mean time to diagnosis) | — | not yet | < 15 min |
| mttr (mean time to recovery) | — | not yet | < 60 min for auto-fix classes |
| auto_fix_share | — | not yet | target 40–60% of A-D class failures |
| false_auto_fix_rate | — | not yet | < 5% (Phase 2 gate) |
| flaky_recurrence (count where recurrence > 1) | — | not yet | establish in Phase 0 |
| cache_hit_rate (Turbo + pnpm) | — | not yet | establish in Phase 0 |
| ci_duration_p50 | — | not yet | establish in Phase 0 |
| ci_duration_p95 | — | not yet | establish in Phase 0 |
| rerun_rate | — | not yet | establish in Phase 0 |
| classification_accuracy | — | not yet | ≥ 80% (Phase 1 gate) |

Metric baselines will be written to this table after the first 14-day observation period. Source of truth is always `ops/ci-incidents/log.jsonl` — run the jq queries in KNOWLEDGE.md § 10 to recompute.

---

## Known patterns

Patterns are promoted from RUNS.md once ≥ 2 entries share the same root cause. Each pattern here is a pointer to the relevant RUNS.md entries.

| Pattern ID | failure_class | root_cause_summary | first_seen | recurrence_count_30d | ADR_draft |
|---|---|---|---|---|---|
| P-001 | test-coevolution | Phase 2 impl rewrite shipped without updating test suite. Helligdagstillegg fixture must set non-zero baseRate. Saturday-evening stacking test must reflect weekday-gated §4-3 kveldstillegg. | 2026-05-05 | 2 (CI-001 + CI-001-FIX) | not yet — promote to ADR if 3rd occurrence |

---

## Active overrides

| Override | Value | Since | Reason |
|---|---|---|---|
| ci-agent-pause | null | — | — |
| phase-lock | null | — | — |

No active overrides. Agent operating at Phase 0 defaults.

---

## Phase transition history

| Date | From | To | Criteria met | Announced via |
|---|---|---|---|---|
| 2026-05-04 | N/A | 0 | bootstrap | RUNS.md bootstrap entry |
| 2026-05-05 | bootstrap | 0 (operational) | first real incident logged (CI-2026-05-05-001) | RUNS.md + log.jsonl |
| 2026-05-06 | 0 (operational) | 0 (post-repair) | log.jsonl integrity-repair, no phase change | RUNS.md repair entry |

---

## Incident log state

| Field | Value | Verified |
|---|---|---|
| log.jsonl exists | true | 2026-05-06 |
| total incidents logged | 82 (CI-2026-05-05-001 through -117, gaps from dedupe) | 2026-05-06 |
| incidents last 30 days | 82 | 2026-05-06 |
| last incident_id | CI-2026-05-05-117 | 2026-05-06 |
| last failure_class | unknown (79/82 from self-trigger loop incident 2026-05-05) | 2026-05-06 |
| open GitHub Issues (ci-incident) | 0 | 2026-05-06 |
| open Linear tickets (OPS, ci-incident) | 0 | 2026-05-06 |

`ops/ci-incidents/log.jsonl` repaired 2026-05-06: stripped 357 git conflict markers, deduped 124→82 records (commit-collision aftermath of self-trigger loop). Backup at `log.jsonl.bak.2026-05-06`. 79 of 82 records have `failure_class:"unknown"` — junk emitted by self-looping ci-agent during incident 2026-05-05 (memory `learning_self_trigger_loop_deployment_status.md`). Treat as one logical incident for metrics: 3 real incidents (001/002/003) + 1 mass-loop event. Phase 1 unlock criteria: 14 days + ≥ 5 incidents — threshold met by record count, but operator should re-baseline before phase advance because junk records will skew metrics.

---

## Known doc-drift bugs (divergence from ADR-0275)

| ID | Source doc | ADR says | Reality | Flagged |
|---|---|---|---|---|
| DRIFT-001 | ADR-0275 Reflection Protocol | `log-activity.sh` source value: `ci` | Script rejects `ci`; valid: session, heartbeat, migration, research, ingest, memory, git, user, system | 2026-05-05 |
| DRIFT-002 | agent .md line 137 | "Never touch `infra/scripts/promote-preview.sh`" | Same agent line 172 + ADR-0275:216 grant HOP A execution of that script as operator-proxy. Wording self-conflict. Resolution: distinguish "never modify" (boundary) from "execute when 6 gates green" (operator-proxy). | 2026-05-06 |
| DRIFT-003 | log.jsonl integrity invariant | Append-only audit trail, never edit | Self-trigger loop 2026-05-05 caused 357 git conflict markers + duplicate commits (3× CI-2026-05-05-116, 2× -117). Repaired 2026-05-06 (markers stripped, deduped 124→82). Need jsonl-lint pre-commit hook to prevent recurrence. | 2026-05-06 |

---

## Known-bad action versions (empty — will populate as drift detected)

| Action | Current pin | Bad version | Detected | Notes |
|---|---|---|---|---|
| (none yet) | | | | |

---

## Self-verification commands (run on session start)

```bash
# Check current phase
grep "current_phase" .claude/agents/ci-incident-conductor/STATE.md

# Count incidents in log (Phase 0+)
[ -f ops/ci-incidents/log.jsonl ] && wc -l ops/ci-incidents/log.jsonl || echo "log.jsonl not yet created"

# Check active overrides (GitHub Issues with ci-agent-pause label)
gh issue list --label ci-agent-pause --state open

# Check last weekly summary
ls ops/ci-incidents/ 2>/dev/null | sort | tail -1

# Verify Supabase App check detailsUrl fingerprint still works (sanity check)
gh api repos/SXTNmedia21/smartout.ai/commits/HEAD/check-runs --jq '.check_runs[] | select(.app.slug == "supabase") | {conclusion: .conclusion, details_url: .details_url}' 2>/dev/null || echo "No Supabase App check-runs on HEAD"

# Confirm required-check counts still match STATE.md expectations
gh api repos/SXTNmedia21/smartout.ai/rulesets/14797822 --jq '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks | length' 2>/dev/null
gh api repos/SXTNmedia21/smartout.ai/rulesets/15290760 --jq '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks | length' 2>/dev/null
```

If self-verification reveals a discrepancy: update this file before starting any triage run. Stale state is a classification risk.

---

## Boundary verification (sanity checks — verify if uncertain)

These confirm the hard floors from ADR-0275 are still in effect:

| Boundary | How to verify | Status |
|---|---|---|
| main ruleset in force | `gh api repos/.../rulesets/14797822 --jq .enforcement` = active | not verified yet |
| preview ruleset in force | `gh api repos/.../rulesets/15290760 --jq .enforcement` = active | not verified yet |
| development ruleset (bare) | `gh api repos/.../rulesets/15290763 --jq '.rules | length'` = low | not verified yet |
| No ci-agent-pause label on open issues | `gh issue list --label ci-agent-pause --state open` = empty | not verified yet |

---

## Last verified — full verification sequence

Run these on session start every time:

```bash
# 1. Phase check
head -20 .claude/agents/ci-incident-conductor/STATE.md

# 2. Incident count
[ -f ops/ci-incidents/log.jsonl ] && cat ops/ci-incidents/log.jsonl | jq -s 'length' || echo "0 incidents"

# 3. Active pause check
gh issue list --label ci-agent-pause --state open

# 4. Required checks still correct on main (expect 14)
gh api repos/SXTNmedia21/smartout.ai/rulesets/14797822 --jq '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks | length'

# 5. Required checks still correct on preview (expect 12)
gh api repos/SXTNmedia21/smartout.ai/rulesets/15290760 --jq '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks | length'
```

If any verification surfaces a failure or discrepancy: update STATE.md before proceeding with any triage action.
