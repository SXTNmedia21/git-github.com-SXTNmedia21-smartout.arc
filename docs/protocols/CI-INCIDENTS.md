---
title: CI Incidents — Protocol
status: canonical
updated: 2026-05-04
created: 2026-05-04
module: deployment
tags: [ci, incidents, automation, adr-0275]
---

# CI Incidents Protocol

**Canonical authority:** ADR-0275 (`docs/decisions/0275-ci-incident-response-agent.md`).
When this file contradicts ADR-0275, the ADR wins.

---

## Purpose

This protocol defines how failed CI/CD events are triaged, classified, escalated, and turned into curated knowledge by `ci-incident-conductor`. It is the operational counterpart to ADR-0275's architectural decisions.

Every failed `workflow_run`, `check_suite`, and `deployment_status` event on `development` and feature branches is routed through the triage pipeline. Deploy-class failures on `main` and `preview` are handed off to `deploy-conductor`.

---

## Authority

The `ci-incident-conductor` agent operates under **autonomous CI operating mode** (ADR-0275 § Autonomous CI Operating Mode, granted verbally 2026-05-04, recorded in `feedback_ci_domain_full_autonomy.md`).

This mode is a **scope-bounded override** of the general per-action approval rule (`feedback_no_unilateral_pipeline_actions.md`) — the override applies only to the CI domain actions listed in the ADR.

**Pause:** Issue label `ci-agent-pause` or PR comment `@ci-incident-conductor stop`.
**Resume:** Issue label `ci-agent-resume` or PR comment `@ci-incident-conductor resume`.

---

## Scope

### In scope

- Failed `workflow_run` events on any branch except `main` and `preview`.
- Flaky-job detection (`run_attempt > 1` with success after retry).
- Dependency and cache regressions (pnpm install, Turbo cache drift, lockfile divergence).
- Stale build-artifact bugs (e.g. `.next/types` after cherry-pick).
- GitHub Actions config bugs (YAML lint, action version pin drift, missing concurrency/timeout).
- CI-only test failures (lint, typecheck, vitest unit) on non-`main`/`preview` branches.
- Pattern mining across `ops/ci-incidents/log.jsonl` and weekly digest writing.

### Out of scope — explicit boundaries

#### Boundary 1 — vs `deploy-conductor` (ADR-0265)

The CI agent never touches:

- `infra/scripts/promote-preview.sh`, `smoke-probe.sh`, `drift-check.sh`, `sync-env-to-vercel.sh`, `sync-env-to-droplet.sh`.
- HOP A (development → preview) or HOP B (preview → main) execution.
- Any push to `preview` or `main`.
- The 14 required CI checks on a PR targeting `main`.
- Production smoke results or rollback decisions.

On a deploy-class failure or protected-branch event, the CI agent writes a handoff note to `ops/ci-incidents/log.jsonl` with `escalated_to: "deploy-conductor"` and stops.

#### Boundary 2 — vs Supabase GitHub App

Supabase App events are classified by `detailsUrl` fingerprinting:

| Signal | Classification | Action |
|--------|---------------|--------|
| `detailsUrl` contains `/settings/integrations` | `supersession` | `no-op` |
| Unique preview-branch ref + `FAILURE` | Real migration error | `suggest` (L-0042 reference to author) |
| Unique preview-branch ref + `CANCELLED` (abnormal) | Abnormal cancel | `escalate` |

The CI agent never edits `supabase/migrations/*`, re-timestamps migration files, adds runtime guards (`DO $$ IF NOT EXISTS`), or calls `npx supabase db reset` against any non-local environment.

#### Boundary 3 — vs `adr-contract-audit` and `drift-check`

The CI agent reads their outputs. It does not re-run them, duplicate their logic, or patch the artifacts they own. It cross-links in `related_audit` and `related_drift` fields.

#### Boundary 4 — vs author responsibility

The CI agent escalates (never auto-fixes):

- Migration files of any kind.
- Application logic in `apps/`, `packages/`, `services/`.
- Changes to `.github/rulesets/*` or branch protection.
- Any push to a ruleset-protected branch.
- Any force-push or `--no-verify` push.
- Dependency major bumps.
- Test deletion or skip without quarantine label + Linear ticket.
- Any vault, 1Password, or GitHub Secrets value (raw secrets are never quoted back).
- "Trigger commits" (empty commits to recompute pipeline state — anti-pattern).
- PR close+reopen, ruleset edit, workflow disable, tag ops, stash pop.

---

## Failure taxonomy

### Core classes

| Class | When | Examples |
|-------|------|---------|
| `app-bug` | Application logic error | Unit test assertion failed; type error in app code |
| `ci-config` | Workflow misconfiguration | YAML lint error; missing `concurrency`; stale action pin |
| `dep-cache` | Dependency or cache failure | pnpm install crash; lockfile hash mismatch; Turbo cache miss |
| `env-secrets` | Missing/expired env or secret | `OPENROUTER_API_KEY` not set; env-template drift |
| `flaky-test` | Intermittent test pass/fail | Network call timeout; non-deterministic snapshot |
| `deploy` | Deploy-class on main/preview | HOP A/B gate failure; promote-preview crash |
| `security` | Security scanner triggered | Leaked credential; SAST finding; HIGH vuln |

### Subclasses

| Subclass | Parent | When |
|----------|--------|------|
| `supabase-app` | `deploy` (on main/preview); `dep-cache` or `flaky` otherwise | Supabase GitHub App check event |
| `stale-artifact` | `ci-config` | Stale `.next/types` after cherry-pick; stale Turbo artifact |

---

## Severity tiers

| Tier | When | Example triggers |
|------|------|-----------------|
| `info` | Benign; no real failure | Supabase-app supersession; scheduled health check green |
| `medium` | Single job failed; recoverable; does not block development | Cache miss; single flaky test quarantined |
| `high` | Multiple jobs failed; blocks merge; recurrence > 2; migration fail | env-secrets; repeated pnpm lockfile divergence |
| `critical` | All CI red; deploy gate blocked; security scan triggered | Actions quota exhausted + all workflows failing; CVE detected |

---

## Escalation channels

| Severity | GitHub Issue | Telegram | Linear | CRITICAL.md | @-mention |
|----------|-------------|---------|--------|-------------|-----------|
| `info` | — | — | — | — | — |
| `medium` | `ci-incident` label | Yes | — | — | — |
| `high` | `ci-incident-urgent` label | Yes | OPS project ticket | — | — |
| `critical` | `ci-incident-urgent` label | Yes | OPS project ticket | Yes | @SXTNmedia21 |

Deploy-conductor handoff: Telegram alert (severity `deploy-handoff`) + `ops/ci-incidents/log.jsonl` entry + stop.

---

## Auto-fix allowlist

Only these operations execute without human approval (confidence ≥ 0.85 required):

1. Action version sha-pin bump (within minor bounds, last 7 days stable upstream).
2. pnpm install retry with `--frozen-lockfile` + cache clear.
3. Turbo cache-key bust when miss-rate > 30% for 3 consecutive days.
4. Stale `.next/types` purge step add (L-stale-types pattern).
5. Re-run a flaky job exactly once, then quarantine via skip-list PR if it fails again.
6. Workflow YAML lint fixes (whitespace, key order; no semantic change).
7. Concurrency-group add to prevent run pile-up.
8. `timeout-minutes` add to runaway jobs.

Every auto-fix produces a PR targeting `development`, labeled `ci-auto-fix`, with incident ID in the title. The CI agent self-merges after the PR's own CI is green (Phase 2+).

---

## Hard floors

These survive autonomous mode. No exception, no override:

- Never push directly to `main`.
- Never push directly to `preview`.
- Never bypass the 14 required CI checks.
- Never edit secrets (vault, GH Secrets, env-files). Raw secrets from user are redirected to `op://`; never quoted back.
- Never edit migration files (`supabase/migrations/*`).
- Never edit application code (`apps/`, `packages/`, `services/`) to fix an app bug.
- Never force-push `main`, `preview`, or `development`.
- Never edit branch protection rulesets (IDs: 14797822, 15290760, 15290763).
- Never auto-rollback. Propose only.
- Never use `--no-verify`.
- Never delete a Linear ticket opened during an incident (closure only).

---

## Phase progression

The agent advances through phases autonomously, based on observed metrics. Each transition is logged to `ops/ci-incidents/log.jsonl` and announced via PR comment.

| Phase | Trigger | Capabilities |
|-------|---------|-------------|
| 0 — Log only | Workflow merged to development | Triage + log; no comments, no fixes, no external alerts |
| 1 — Comment + escalate | 14 days Phase 0 + ≥ 5 incidents logged | + PR comments + GitHub Issues + Telegram + Linear escalation |
| 2 — Auto-fix | 14 days Phase 1 stable + false-classification rate < 5% | + auto-fix allowlist + self-merge PRs to development |
| 3 — Pattern mining | 30 days Phase 2 + ≥ 1 recurrence at threshold | + ADR drafting + weekly pattern digest |
| 4 — Skill emission | First curated `ci-incident` skill candidate | + skill emission (`ci-incident` skill) |

Demotion: if a phase metric regresses, the agent demotes itself one phase and announces the demotion as an incident. No human approval needed.

---

## Pause and resume mechanism

**Pause** (agent goes read-only, back to Phase 0 behaviour):
- Open a GitHub Issue with label `ci-agent-pause`, or
- Comment `@ci-incident-conductor stop` on any open agent PR.

**Resume**:
- Open/edit an Issue with label `ci-agent-resume`, or
- Comment `@ci-incident-conductor resume` on any agent PR.

These are the only asynchronous controls. No other mechanism pauses the agent.

---

## Operator role under autonomous mode

1. Build features.
2. Push / merge / drop onto `development`.
3. Review and decide HOP B (`preview → main`) jointly with the agent.
4. Read incident summaries when curious (no obligation).

That is the entire human surface. CI mechanics belong to the agent.

**Operator decision required:**
- HOP B (`preview → main`) — agent prepares the PR; Pontus decides merge.
- Production rollback — agent proposes exact rollback command; Pontus confirms.
- Application-code change needed to fix CI — agent files Linear ticket and stops.
- Classification ambiguity where confidence < 0.6 and no known-pattern match.

---

## Reflection contract

After every triage, auto-fix attempt, escalation, or refusal to act:

1. Append `RUNS.md` entry in the agent bundle (format mirrors `deploy-conductor/RUNS.md`). Minimum one Learnings line (Learning Law: NEW / CONFIRMED / STALE / DUPLICATE).
2. Update `STATE.md` in place if anything verifiable changed.
3. Curate upward if NEW or STALE:
   - NEW recurring (≥ 2 RUNS.md entries with same finding) → propose addition to `ci-incident` skill. Tell operator before editing.
   - STALE → edit source; update `updated:` timestamp.
   - DUPLICATE → consolidate.
   - CONFIRMED → RUNS.md entry sufficient.
4. Write activity-log entry via `~/.claude/scripts/log-activity.sh ci claude "<message>"`.

Pattern → ADR rule: same root cause 3+ times in 30 days = mandatory ADR draft. Threshold per L-0202.

---

## Reference index

| Resource | Path |
|----------|------|
| ADR-0275 (authority) | `docs/decisions/0275-ci-incident-response-agent.md` |
| ADR-0265 (deploy-conductor) | `docs/decisions/0265-enforced-deployment-pipeline.md` |
| Deployment protocol | `docs/protocols/DEPLOYMENT.md` |
| Drift-check script | `infra/scripts/drift-check.sh` |
| ADR-contract-audit skill | `~/.claude/skills/adr-contract-audit/` |
| Ops landing zone | `ops/ci-incidents/README.md` |
| Triage prompt | `.github/scripts/ci-agent/triage-prompt.md` |
| Orchestration map | `docs/audits/2026-05-03-git-deploy-orchestration-map.md` |
| Telemetry registry | `packages/telemetry/src/registry.ts` |
