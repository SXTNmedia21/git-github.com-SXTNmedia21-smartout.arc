---
title: "CI Incident-Response Agent — scope, boundaries, and reflection contract"
id: ADR-0275
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
---

# ADR-0275: CI Incident-Response Agent — scope, boundaries, and reflection contract

## Context and Problem Statement

CI/CD failures in the Smartout monorepo are currently triaged ad-hoc. There is no single first-responder for failed GitHub Actions runs, flaky jobs, cache regressions, Supabase migration failures, or stale-artifact bugs. Pontus has lost full sessions to undiagnosed CI red, and recurring patterns (e.g. stale `.next/types`, migration-timestamp ordering per L-0042, dependency cache misses, GitHub Actions quota traps) keep being re-discovered manually.

We already have `deploy-conductor` for deployment pipeline ownership (ADR-0265), `adr-contract-audit` for ADR coherence, `drift-check.sh` for env parity, and the Supabase GitHub App for managed preview branching. These domains overlap when a CI run fails: any new agent must declare boundaries against each, or it will collide with the existing harness.

We need a new agent — the `ci-incident-conductor` — whose job is failed-CI triage, classification, low-risk auto-fix, escalation, and continuous improvement of the CI surface. This ADR fixes its scope, hard boundaries, and reflection contract before any code or workflow ships.

## Decision Drivers

- Pipeline already owned by `deploy-conductor` (ADR-0265). Anything touching `main`, `preview`, `promote-preview.sh`, or production smoke is out of scope for the CI agent.
- Supabase GitHub App is not a GitHub Actions workflow. App-level `CANCELLED` typically means stack supersession, not regression (audit `AUDIT-supabase-preview-ci-2026-04-15.md`). Misclassifying it as failure would page the operator unnecessarily.
- Migration-ordering bugs (L-0042) are author-responsibility, not auto-fix territory. Runtime-guard masking is forbidden by `smartout-database-guide`.
- Pontus' explicit preference: no unilateral pipeline actions. Every destructive or shared-state action requires per-action approval (memory `feedback_no_unilateral_pipeline_actions.md`).
- Recurring incident patterns must accumulate into curated knowledge with a reflection loop equivalent to `deploy-conductor`'s RUNS.md model — same Learning Law (NEW / CONFIRMED / STALE / DUPLICATE), same propose-before-edit posture.
- Heartbeat already covers env drift daily; CI agent must read those alerts, not duplicate them.
- ADR-contract audit already covers ADR coherence weekly; CI agent must hand off, not re-implement.

## Considered Options

1. **Single mega-agent** — extend `deploy-conductor` to also handle non-deploy CI failures.
   - Reject: violates single-responsibility; deploy-conductor already loaded with HOP A/B + drift + smoke + rollback.
2. **Sibling agent with shared bundle layout** — new `ci-incident-conductor` with the same `{KNOWLEDGE,PLAYBOOK,ROADMAP,RUNS,STATE}.md` structure and reflection contract, distinct trigger surface and boundaries.
   - Recommend: reuses proven pattern, isolates blast radius, makes the boundary lines explicit.
3. **Workflow-only automation (no agent)** — pure GitHub Actions + scripts, no Claude agent.
   - Reject: loses synthesis, classification, and pattern-mining; same bug rediscovered every incident.

## Decision Outcome

Chosen option: **Option 2 — sibling agent `ci-incident-conductor`**, because it inherits the proven reflection-loop and skill-curation discipline from `deploy-conductor` while keeping the trigger surface, boundaries, and metrics independent and auditable.

### Scope — what the CI agent OWNS

- Failed `workflow_run` events for any branch except `main` and `preview` (those are deploy-conductor territory once the failure is deploy-class).
- Flaky-job detection (`run_attempt > 1` with success after retry).
- Dependency / cache regressions (pnpm install fail, Turbo cache key drift, lockfile divergence).
- Stale build-artifact bugs (e.g. `.next/types` after cherry-pick — memory `learning_stale_next_types_blocks_typecheck.md`).
- GitHub Actions config bugs (YAML lint, action version pin drift, missing concurrency, missing timeout).
- CI-only test failures (lint, type-check, vitest unit) on non-`main`/`preview` branches.
- Pattern mining across `ops/ci-incidents/log.jsonl` and weekly digest writing.

### Scope — explicit boundaries against existing harness

#### Boundary 1 — vs `deploy-conductor` (ADR-0265)

The CI agent **never** touches:

- `infra/scripts/promote-preview.sh`, `smoke-probe.sh`, `drift-check.sh`, `sync-env-to-vercel.sh`, `sync-env-to-droplet.sh`.
- HOP A (development → preview) or HOP B (preview → main) execution.
- Any push to `preview` or `main`.
- Any of the 14 required CI checks on a PR targeting `main`.
- Production smoke results.
- Rollback decisions.

If a triaged failure has class `deploy` or branch is `main` / `preview`, the CI agent **hands off** by:
1. Writing a structured handoff note to `ops/ci-incidents/log.jsonl` with `escalated_to: "deploy-conductor"`.
2. Posting a Telegram alert via `heartbeat-notify.sh` with severity `deploy-handoff`.
3. Stopping further auto-fix attempts on that incident.

The CI agent never invokes `deploy-conductor` directly. Operator decides.

#### Boundary 2 — vs Supabase GitHub App (managed preview branching)

The Supabase GitHub App is **not** a GitHub Actions workflow. It does not appear in `.github/workflows/`. Its check states render in PR check-runs but follow App semantics, not Actions semantics.

Triage rules:

- App `CANCELLED` with `detailsUrl` containing `/settings/integrations` (no preview-branch ref) = **stack supersession**, not regression. Classify `supersession`, **no-op**, log as `CONFIRMED` if observed before.
- App `CANCELLED` with `detailsUrl` containing a unique preview-branch ref = abnormal cancel; investigate.
- App `FAILURE` with unique preview-branch ref = real migration apply error. Classify `migration` (subclass of `supabase-app`).
- App `SUCCESS` with unique preview-branch ref = healthy preview branching.

The CI agent **never**:

- Modifies `supabase/migrations/*` files.
- Re-timestamps a migration file to fix ordering.
- Adds runtime guards (`DO $$ IF NOT EXISTS …`) to mask ordering bugs (per `smartout-database-guide` § Migration Timestamp Ordering, L-0042).
- Calls `npx supabase db reset` against any non-local environment.
- Calls `mcp__plugin_supabase_supabase__*` write APIs.

Allowed actions on `supabase-app` failures:

- Run `npx supabase db reset` locally (Supabase Local only) on the failing PR's HEAD to reproduce.
- Compare migration timestamps against repo tip and dependency-creation timestamps; produce a diagnosis.
- Comment on the PR with the L-0042 reference and the specific re-timestamp the author should apply.
- Escalate to author of the offending migration.

Migration ordering is **author-responsibility, no-auto-fix-zone**. The CI agent diagnoses and reports.

#### Boundary 3 — vs `adr-contract-audit` skill and heartbeat `drift-check`

These run on their own schedules and own their own logging. The CI agent:

- **Reads** their alerts via the activity-log + Telegram channel.
- **Does not** re-run them as part of triage.
- **Cross-links** in the incident log: `related_audit: "<audit-run-id>"` or `related_drift: "<drift-check-id>"` when relevant.
- **Hands off** any ADR-drift finding (`adr-contract-audit` owner) or env-parity finding (`drift-check` owner) without acting on it.

If `drift-check` is red and a CI failure is suspected to share root cause, the CI agent escalates to operator with both incident IDs linked. It does not patch env-template, env.ts, EF secrets, or droplet env directly.

#### Boundary 4 — vs author responsibility (L-0042 + L-stale-types pattern + Pontus' approval rule)

The CI agent is **diagnostic**, not omnipotent. It must escalate (not auto-fix) any of the following:

- Migration files of any kind (`supabase/migrations/*`).
- Application logic in `apps/`, `packages/`, `services/`.
- Any change to `.github/rulesets/*` or branch protection.
- Any push to a branch protected by ruleset (main, preview).
- Any force-push, anywhere.
- Any `--no-verify` push.
- Any dependency major bump.
- Any test deletion or skip without quarantine label + Linear ticket.
- Any vault, 1Password, or GitHub Secrets value (raw secrets must be redirected to `op://` references; never quoted back).
- Any "trigger commit" (empty commit pushed solely to recompute pipeline state) — anti-pattern per `feedback_no_unilateral_pipeline_actions.md`.
- Any PR close+reopen, ruleset edit, workflow disable, tag op, or stash pop.

For all of the above, the CI agent **proposes a fix in the PR comment or Linear ticket** and waits for explicit per-action approval from operator before executing anything. Per-action means: one yes unlocks one specified action; not a session-level grant.

### Auto-fix allowlist (low-risk only, confidence ≥ 0.85)

- Action version sha-pin bump when last 7 days show stable upstream.
- pnpm install retry with frozen lockfile + cache clear.
- Turbo cache-key bust when miss-rate > 30 % for 3 consecutive days.
- Stale `.next/types` purge step add (known L-stale-types pattern).
- Re-run a flaky job exactly once, then quarantine via skip-list with PR if it fails again.
- Workflow YAML lint fixes (whitespace, key order; no semantic change).
- Concurrency-group add to prevent run pile-up.
- `timeout-minutes` add to runaway jobs.

Each auto-fix produces a PR to `development` (never directly to `main` or `preview`), labeled `ci-auto-fix`, with the incident ID in the title.

### Reflection contract — mandatory after every triggering run

Mirrors `deploy-conductor`'s reflection protocol exactly:

1. **Append `RUNS.md` entry** in the agent bundle with format matching `deploy-conductor/RUNS.md` § "Format". Minimum one Learnings line (Learning Law: NEW / CONFIRMED / STALE / DUPLICATE).
2. **Update `STATE.md`** in place if anything verifiable changed (new pattern, new metric baseline, new known-bad action version).
3. **Curate upward** if NEW or STALE:
   - NEW recurring (≥ 2 RUNS.md entries with same finding) → propose addition to a new `ci-incident` skill (or to `deploying` skill if deploy-adjacent). Tell operator before editing.
   - STALE → edit source in place; update `updated:` timestamp.
   - DUPLICATE → consolidate to one canonical location.
   - CONFIRMED → no action; RUNS.md entry is sufficient.
4. **Write activity-log entry** via `~/.claude/scripts/log-activity.sh system claude "<message>"` (use actor `pontus` if operator initiated). Source value: `system` (the script rejects `ci` — it is not in the valid-sources allowlist; tracked as DRIFT-001 in STATE.md, resolved 2026-05-06).

The reflection loop fires after: every triage, every auto-fix attempt, every escalation, every refusal-to-act. It does NOT fire on read-only status queries or on heartbeat-driven runs (heartbeat already logs).

### Pattern → ADR rule

Same root cause appearing 3+ times in 30 days = mandatory ADR draft proposing systemic fix. Threshold inherited from L-0202 (5th occurrence promoted "ADD COLUMN beats sibling-table" to ADR-class learning).

### Logging schema

Append-only JSON-lines. Schema fields fixed in this ADR:

`incident_id`, `ts_detected`, `ts_resolved`, `trigger`, `branch`, `workflow`, `job`, `run_id`, `run_attempt`, `head_sha`, `failure_class`, `root_cause`, `confidence`, `action`, `action_detail`, `validation`, `duration_impact_sec`, `recurrence_count_30d`, `is_known_pattern`, `memory_ref`, `related_audit`, `related_drift`, `escalated_to`, `follow_up`.

**Transport (amended 2026-05-06):** Per-run JSON-lines uploaded as GitHub Actions artifact `ci-incident-${INCIDENT_ID}` with 90-day retention. Operator aggregates into the persistent `ops/ci-incidents/log.jsonl` via `gh run download <run-id> -n ci-incident-<INCIDENT_ID>`. Earlier design committed each entry to `development` directly; this triggered a Vercel preview build per incident ("Blocked" entries) and surfaced merge conflicts on the log file. The artifact transport eliminates both side-effects while preserving the schema and the append-only invariant. The persistent file is operator-managed.

Weekly digest at `ops/ci-incidents/YYYY-WW-summary.md`. Pattern file at `ops/ci-incidents/YYYY-WW-patterns.md` for recurrence ≥ 3.

### Metrics — proof of improvement

Computed daily, surfaced in heartbeat dashboard:

- `failure_rate` (split by source: `actions` vs `supabase-app`).
- `mttd` (mean time to diagnosis).
- `mttr` (mean time to recovery).
- `auto_fix_share` and `false_auto_fix_rate` (target: false rate < 5 %).
- `flaky_recurrence` (count where `recurrence_count_30d > 1`).
- `cache_hit_rate` (Turbo + pnpm).
- `ci_duration_p50` and `ci_duration_p95` (per workflow).
- `rerun_rate`.
- `deploy_success_rate` (read-only mirror from deploy-conductor's source).

Improvement claim valid only when a metric trends in the goal direction for 4+ consecutive weeks.

### Skill-curation alignment with `deploying` skill

Per orchestration map § O1 (`docs/audits/2026-05-03-git-deploy-orchestration-map.md`): the existing `deploying` skill text says "orchestrator edits skill in-place" while `deploy-conductor` says "propose to operator first". This ADR adopts the more conservative posture for the new CI surface: **propose first, then edit on operator yes**. Same rule for `ci-incident` skill if/when created. The looser `deploying` skill text gets a follow-up sortie to align (out of scope here, tracked as an ADR-0265 follow-up).

### Autonomous CI Operating Mode (added 2026-05-04)

Pontus has explicitly transferred full ownership of CI mechanics to the agent (verbal grant, 2026-05-04 session, recorded in memory `feedback_ci_domain_full_autonomy.md`). This section documents the resulting autonomous operating mode, which **scope-bounded overrides** the per-action approval rule from `feedback_no_unilateral_pipeline_actions.md` for the CI domain only.

**Operator role under autonomous mode:**

1. Builds features.
2. Pushes / merges / drops onto `development`.
3. Reviews and decides HOP B (`preview → main`) jointly with the agent.
4. Reads incident summaries when curious (no obligation).

That is the entire human surface. Everything else in the CI domain belongs to the agent.

**Agent autonomous actions (no per-action yes required):**

- Diagnose any failed `workflow_run`, `check_suite`, or `deployment_status` event on any branch except `main` and `preview`.
- Open auto-fix PRs targeting `development` from the §"Auto-fix allowlist" set.
- Self-merge auto-fix PRs to `development` after the PR's own CI is green and the change is whitelisted (no human approval gate inside the CI domain).
- Quarantine flaky tests via skip-list PR + matching Linear ticket.
- Bust Turbo / pnpm caches when miss-rate threshold exceeded.
- Pin / unpin GitHub Action versions within minor-bump bounds.
- Add `concurrency`, `timeout-minutes`, and YAML lint fixes to workflows.
- Comment on PRs with diagnosis (own voice, signed `ci-incident-conductor`).
- Open GitHub Issues with label `ci-incident` (severity ≥ medium) or `ci-incident-urgent` (severity ≥ high).
- Send Telegram alerts via `@sixtenclaw_bot` on severity ≥ medium.
- Open Linear OPS-prosjekt tickets on severity ≥ high, following `linear-protocol` emoji conventions (👀 / 📌 / ❌ / ✅ / 🔥).
- Run **HOP A** (`development → preview`) via `infra/scripts/promote-preview.sh` when **all 6 gates green** and no drift-check alert is open. Agent acts as operator-proxy under ADR-0265.
- Read drift-check + ADR-contract-audit outputs and cross-link in incident log.
- Run `npx supabase db reset` locally for migration-failure reproduction (Supabase Local only).
- Mine patterns weekly; draft ADRs on 3rd recurrence; emit a `ci-incident` skill once curated knowledge stabilizes.

**Agent must STOP and seek operator decision:**

- HOP B (`preview → main`) — agent prepares the PR with template, but Pontus decides merge.
- Production rollback — agent proposes the exact rollback command per surface; Pontus confirms.
- Any escalation requiring application-code change — agent files the Linear ticket and stops.
- Any classification ambiguity where confidence < 0.6 AND no known-pattern match.

**Hard floors that survive autonomous mode (non-negotiable, sikkerhets-grunnet):**

- ⛔ Never push directly to `main`.
- ⛔ Never push directly to `preview` (FF wrapper only, via deploy-conductor handoff or HOP A criteria above).
- ⛔ Never bypass any of the 14 required CI checks.
- ⛔ Never edit secrets — values from 1Password vault, GH Secrets, or env-files. Raw secrets pasted by user are redirected to `op://` references; never quoted back.
- ⛔ Never edit migration files (`supabase/migrations/*`). L-0042 author-responsibility stands.
- ⛔ Never edit application code (`apps/`, `packages/`, `services/`) to "fix the bug". CI agent diagnoses application bugs; humans fix them.
- ⛔ Never force-push `main`, `preview`, or `development`.
- ⛔ Never edit branch protection rulesets (14797822, 15290760, 15290763) or workflow `permissions` blocks.
- ⛔ Never auto-rollback. Proposes only.
- ⛔ Never use `--no-verify` push (per CLAUDE.md hard rule, no exception).
- ⛔ Never delete a Linear ticket created during incident (closure only).

**Phase progression — autonomous, no per-phase approval:**

The agent flips its own phases based on observed metrics, with each transition logged to `ops/ci-incidents/log.jsonl` and announced via PR-comment on the prior phase's PR:

| Phase | Trigger | Capabilities |
|---|---|---|
| 0 | Workflow merged to development | log-only, no comments, no fixes |
| 1 | 14 days Phase 0 + ≥ 5 incidents logged | + PR comments + GitHub Issues + Telegram + Linear escalation |
| 2 | 14 days Phase 1 stable + false-classification rate < 5 % | + auto-fix allowlist + self-merge PRs to development |
| 3 | 30 days Phase 2 + ≥ 1 recurrence at threshold | + ADR drafting + pattern-mining digest |
| 4 | First curated `ci-incident` skill candidate | + skill emission |

If a phase metric regresses, the agent **demotes itself** one phase and announces the demotion as an incident. No human approval needed for demotion. Re-promotion follows the original metric threshold.

**Override mechanism (operator-controlled):**

Pontus can pause autonomous mode at any time via:

- Issue with label `ci-agent-pause` → agent goes read-only (back to Phase 0) within next triage cycle.
- Comment `@ci-incident-conductor stop` on any open agent-PR → same effect.
- Resume via `ci-agent-resume` label or `@ci-incident-conductor resume` comment.

These are the **only** asynchronous controls. Pontus is not expected to micro-manage; pause is the safety brake, not the routine.

**Status of this section:** This addendum upgrades ADR-0275 from `proposed` to `accepted` upon registration in the decision log. The autonomous-mode contract is now load-bearing for all subsequent phases.

## Rules & Consequences

- **Good, because** failed CI gets a single, named first-responder with explicit non-overlapping scope against deploy-conductor, Supabase App, ADR audit, and drift-check.
- **Good, because** the reflection loop turns every incident into curated knowledge instead of one-off heroics.
- **Good, because** auto-fix is bounded to a small, audited allowlist; everything risky escalates per Pontus' "no unilateral pipeline actions" rule.
- **Good, because** boundaries are written down before code ships; no agent-collision surprises after dispatch.
- **Bad, because** another agent bundle to maintain (offset by reusing the deploy-conductor pattern verbatim).
- **Bad, because** classification depends on URL-fingerprinting Supabase App checks, which is fragile if the App ever changes its `detailsUrl` schema (mitigation: pattern is verified at runtime against a small allowlist; mismatch → escalate, never silently auto-classify).
- **Agent Impact:**
  - Build agents: when CI goes red, do NOT manually re-trigger or push fix-up commits. Wait for the CI agent's triage entry in `ops/ci-incidents/log.jsonl` and act on its diagnosis (or escalate if the agent escalated).
  - Migration authors: migration-ordering bugs are still your responsibility. The CI agent will diagnose with L-0042 reference and the exact re-timestamp to apply, but it will not edit your file.
  - `deploy-conductor`: receives explicit handoffs (`escalated_to: "deploy-conductor"` in incident log) — must read the incident log on every promote-preview run.
  - `adr-contract-audit` and `drift-check`: unchanged; the CI agent reads their outputs but does not invoke or modify them.
  - Pontus: receives Telegram alerts only on escalation severity ≥ medium; auto-fix runs land as PRs to `development` for review.

## Implementation phases (out of scope for this ADR — informational)

- Phase 0 — log-only, no auto-fix. CI agent triages and writes `ops/ci-incidents/log.jsonl` only. Two weeks baseline metrics.
- Phase 1 — comment + escalate. Agent posts diagnosis comments on failed runs/PRs and escalates to Telegram on medium+ severity.
- Phase 2 — auto-fix allowlist enabled. Workflow YAML lint fixes, action sha-pin bumps, concurrency-group adds.
- Phase 3 — pattern-mining + ADR drafting at recurrence threshold.
- Phase 4 — skill emission (`ci-incident` skill) once curated knowledge crosses the L-0202 threshold.

Each phase ships as a separate sortie with its own PR.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
