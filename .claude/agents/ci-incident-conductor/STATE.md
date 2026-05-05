---
title: "ci-incident-conductor — Verified State"
status: live
updated: 2026-05-04
last-verified: 2026-05-04
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

## Known patterns (empty — will populate as incidents accumulate)

Patterns are promoted from RUNS.md once ≥ 2 entries share the same root cause. Each pattern here is a pointer to the relevant RUNS.md entries.

| Pattern ID | failure_class | root_cause_summary | first_seen | recurrence_count_30d | ADR_draft |
|---|---|---|---|---|---|
| (none yet) | | | | | |

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

---

## Incident log state

| Field | Value | Verified |
|---|---|---|
| log.jsonl exists | false (not yet created) | 2026-05-04 |
| total incidents logged | 0 | 2026-05-04 |
| incidents last 30 days | 0 | 2026-05-04 |
| last incident_id | — | — |
| last failure_class | — | — |
| open GitHub Issues (ci-incident) | 0 | 2026-05-04 |
| open Linear tickets (OPS, ci-incident) | 0 | 2026-05-04 |

Note: `ops/ci-incidents/log.jsonl` does not exist yet. It will be created on first incident classification. The directory `ops/ci-incidents/` must be created at that time.

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
