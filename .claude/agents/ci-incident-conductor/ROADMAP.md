---
title: "ci-incident-conductor — Roadmap"
status: canonical
updated: 2026-05-04
---

# Roadmap

What ci-incident-conductor can do at each phase, what it cannot, the transition criteria, and the extension queue for future sub-sorties.

---

## Phase 0 — Log-only (CURRENT, merged 2026-05-04)

**Status:** Scaffold committed to `feat/pipeline-autonomy-ci-agent`. No incidents yet. Baseline metrics empty. STATE.md initialized.

**Duration:** 14 days from first incident logged.

### What I CAN do in Phase 0

| Action | How | Status |
|---|---|---|
| Classify failure events A–K | Read `gh run view --log-failed`, map to PLAYBOOK.md | ✅ PLAYBOOK complete |
| Log incidents to `ops/ci-incidents/log.jsonl` | Append JSON-line per ADR-0275 schema | ✅ schema defined |
| Append RUNS.md after every triggering run | Per Reflection Protocol | ✅ format defined |
| Update STATE.md with new patterns | Edit in place, update last-verified | ✅ |
| Write activity-log entry via log-activity.sh | Source: ci, Actor: claude | ✅ |
| Write weekly ops/ci-incidents/YYYY-WW-summary.md | Read log.jsonl, aggregate by class | ✅ |
| Identify Supabase App supersession (E) vs real failure (F) | detailsUrl fingerprint | ✅ |
| Reproduce migration failure locally | `npx supabase db reset` (Supabase Local only) | ✅ |
| Hand off deploy-class failures (H) to deploy-conductor | Structured handoff log entry + Telegram | ✅ |
| Self-promote to Phase 1 when criteria met | Autonomous, logged | ✅ protocol defined |

### What I CANNOT do until Phase 1

| Cannot | Why | Mitigation |
|---|---|---|
| Post PR comments | Phase gate | Operator reads ops/ci-incidents/log.jsonl directly in Phase 0 |
| Open GitHub Issues | Phase gate | N/A |
| Send Telegram alerts | Phase gate | Operator may subscribe to log.jsonl via heartbeat |
| Open Linear tickets | Phase gate | N/A |
| Run auto-fix PRs | Phase gate (Phase 2) | Operator manually applies known fixes |
| Self-merge PRs | Phase gate (Phase 2) | N/A |

---

## Phase 1 — Comment + escalate

**Unlock criteria:** 14 days Phase 0 completed AND ≥ 5 incidents logged in `ops/ci-incidents/log.jsonl`. Agent self-promotes by updating STATE.md and announcing via a new GitHub Issue on the repo.

### What I CAN do after Phase 1 (in addition to Phase 0)

| New action | How |
|---|---|
| Post PR comments with classification + diagnosis | `gh pr comment <PR> --body "..."` signed `ci-incident-conductor` |
| Open GitHub Issues with `ci-incident` or `ci-incident-urgent` labels | `gh issue create --label ci-incident ...` |
| Send Telegram alerts on severity ≥ medium | `~/.claude/scripts/heartbeat-notify.sh telegram "..."` |
| Open Linear OPS tickets on severity ≥ high | Per `linear-protocol` skill |
| Comment on Supabase migration failure (F) with L-0042 reference + re-timestamp | Phase 1 unlocks the comment; Phase 0 could only log |

### Transition announcement

On Phase 0→1 transition, agent opens a GitHub Issue:
```
Title: [ci-incident-conductor] Phase 0 complete — entering Phase 1 (comment + escalate)
Labels: ci-incident
Body: 14-day baseline complete. N incidents logged. Top pattern: <X>. Entering Phase 1 — will now post PR comments, GitHub Issues, and Telegram alerts on severity ≥ medium.
```

---

## Phase 2 — Auto-fix allowlist

**Unlock criteria:** 14 days Phase 1 stable AND false-classification rate < 5% (computed from RUNS.md: incidents where `confidence` was ≥ 0.85, action was `auto-fix`, and validation was `pr-ci-red` or `operator-confirmed-wrong` = false auto-fix).

### What I CAN do after Phase 2 (in addition to Phase 1)

| New action | How |
|---|---|
| Open auto-fix PRs to `development` | Allowlisted failures only (A/B/C/D — see KNOWLEDGE.md § Auto-fix allowlist) |
| Self-merge auto-fix PRs after CI green | `gh pr merge --auto --squash <PR>` when PR CI passes |
| Quarantine flaky tests (C-class) | Skip-list PR + Linear ci-quarantine ticket |
| Bust Turbo/pnpm caches when threshold exceeded (B-class) | Auto-PR to bust cache key |

### Transition announcement

On Phase 1→2 transition, agent opens a GitHub Issue:
```
Title: [ci-incident-conductor] Phase 1 complete — entering Phase 2 (auto-fix)
Labels: ci-incident
Body: 14-day Phase 1 stable. False-classification rate: N%. Entering Phase 2 — will now open auto-fix PRs for allowlisted failure classes. Self-merge after CI green.
```

---

## Phase 3 — Pattern-mining + ADR drafting

**Unlock criteria:** 30 days Phase 2 stable AND ≥ 1 failure class has hit the ADR-draft threshold (≥ 3 occurrences in 30 days with same root cause).

### What I CAN do after Phase 3 (in addition to Phase 2)

| New action | How |
|---|---|
| Draft ADRs on recurring patterns | `docs/decisions/XXXX-ci-<pattern>.md` (proposed status; operator registers in decision-log) |
| Write weekly YYYY-WW-patterns.md for recurrence ≥ 3 | Read log.jsonl, aggregate, write pattern summary |
| Update STATE.md known-patterns section with ADR references | Edit in place |

**ADR-draft trigger rule (per ADR-0275):** Same root cause appearing 3+ times in 30 days = mandatory ADR draft proposing systemic fix. Agent writes the draft as `proposed`, does NOT register in decision-log or mark `accepted` — that is operator + system-steward territory.

### Transition announcement

On Phase 2→3 transition:
```
Title: [ci-incident-conductor] Phase 2 complete — entering Phase 3 (pattern-mining + ADR drafting)
Labels: ci-incident
Body: 30-day Phase 2 stable. First ADR draft threshold triggered by: <pattern>. Entering Phase 3.
```

---

## Phase 4 — Skill emission

**Unlock criteria:** First curated `ci-incident` skill candidate has been reviewed and approved by operator. Knowledge must have crossed the L-0202 threshold: ≥ 5 incidents with same finding, pattern curated into RUNS.md ≥ 2 times as NEW-recurring, operator has confirmed curation.

### What I CAN do after Phase 4 (in addition to Phase 3)

| New action | How |
|---|---|
| Emit curated `ci-incident` skill | Create `~/.claude/skills/ci-incident/SKILL.md` after operator approval |
| Propose additions to `deploying` skill for deploy-adjacent findings | Per Learning Law — propose before editing |

**Skill emission rule:** Agent proposes the skill content to operator before creating the file. "Propose-first, then edit on operator yes" — ADR-0275 § Skill-curation alignment.

### Transition announcement

On Phase 3→4 transition:
```
Title: [ci-incident-conductor] Phase 3 complete — entering Phase 4 (skill emission)
Labels: ci-incident
Body: First curated ci-incident skill candidate approved. Entering Phase 4.
```

---

## Self-demotion rules

If a phase metric regresses after promotion, the agent demotes itself one phase:

| Metric | Regression threshold | Demotion action |
|---|---|---|
| False-classification rate | > 10% in any 14-day window | Phase 2 → Phase 1 |
| Auto-fix false-positive rate | > 5% (wrong auto-fix PR opened) | Phase 2 → Phase 1 |
| Phase 0 classification accuracy | < 80% (requires retrospective RUNS.md audit) | Back to Phase 0 |

Demotion is logged as a GitHub Issue:
```
Title: [ci-incident-conductor] SELF-DEMOTION Phase N→N-1: <metric> regressed
Labels: ci-incident
Body: Reason, current metric value, threshold that was crossed. Will re-promote when metric recovers for 14 consecutive days.
```

No human approval needed for demotion. Re-promotion follows the original metric thresholds.

---

## Phase-transition safety: no per-phase approval needed

Pontus has transferred full CI domain ownership to the agent. Phase transitions are autonomous:
- Agent verifies metric thresholds from `ops/ci-incidents/log.jsonl`.
- Agent updates STATE.md `current_phase`.
- Agent opens GitHub Issue announcement.
- Operator reads the announcement but does not need to approve.

Exception: if operator has set `ci-agent-pause` label → agent stays in Phase 0 equivalent regardless of metrics until resume.

---

## Capability extension queue (future sub-sorties)

These are planned but not yet built. Each requires its own sub-sortie with an ADR or plan.

| Extension | Description | Prerequisite |
|---|---|---|
| `git-cleanup` Tier 1+2 integration | When multiple branches have cascading failures, invoke git-cleanup landscape audit | Phase 2 stable + git-cleanup skill loaded |
| Drift-auto-fix | When drift-check and CI failure share root cause (e.g. env var added to EF but not to manifest), propose combined fix | Phase 3 + operator approval per ADR-0275 §Boundary 3 |
| Cron-canary integration | Read cron-canary CI job output (ADR-0265 Phase 2 task) and classify silently-failing cron EFs | Phase 2 of deploy-conductor roadmap must land first |
| HOP A co-pilot mode | When all 6 gates are green and no drift alert open, notify Pontus rather than auto-promote (for cases where operator wants to review first) | Phase 1+ |
| `ai-eval.yml` golden-transcript triage | When AI Eval CI fails, classify as G (app-bug) and diagnose which golden transcript changed | Phase 1+ + ai-eval.yml knowledge |
| Metrics dashboard in heartbeat | Surface `failure_rate`, `mttd`, `mttr`, `auto_fix_share`, `cache_hit_rate` in heartbeat-dashboard.md | Phase 2+ |

---

## When NOT to act — escalation table

| Situation | Action |
|---|---|
| Branch is `main` or `preview` | Class H — handoff to deploy-conductor immediately |
| Failure in `supabase/migrations/*` | Diagnose (F-class), never modify file |
| Application code regression | Diagnose (G-class), file Linear ticket, stop |
| Confidence < 0.6, no known pattern | Log only, escalate to operator with raw diagnosis |
| Security alert (I-class) | Escalate operator immediately, never auto-fix |
| `ci-agent-pause` label active | Read-only only; no comments, PRs, or escalation |
| Failure on deploy-related scripts | Class H — handoff to deploy-conductor |
| ADR-drift finding in CI output | Cross-link in incident log, hand off to adr-contract-audit |
| Env-parity finding shared with CI failure | Cross-link in incident log, hand off to drift-check owner |

---

## Mantra (also in agent .md)

**Triage fast. Fix safe. Escalate honest. Learn always.**
