---
title: "Enforced Deployment Pipeline (single-purpose gates + continuous review)"
id: ADR_0262
status: accepted
created: 2026-05-03
updated: 2026-05-03
module: cross-cutting
tags: [deployment, ci, vercel, supabase, edge-functions, droplet, enforcement, review]
supersedes: []
related: [ADR_0071, ADR_0186, ADR_0189, ADR_0190]
---

# ADR-0262 — Enforced Deployment Pipeline

## Context

The 3-branch pipeline `development → preview → main` (ADR-0071) is structurally
correct, but enforcement is inconsistent: pgTAP, pipeline-enforcement, and
authority-seed-parity workflows run on every PR but are not part of the required
status checks. Edge Functions deploy manually with no manifest. Production
migration state is not polled — `MIGRATIONS_FAILED` can sit silent.
Promote-preview.sh has no post-promote smoke probe and no last-known-good tag.
Result: every promote attempt finds a new failure mode, and nothing in CI
catches drift between deploy artefacts and the codebase.

This ADR consolidates **all deploy enforcement into one pipeline that cannot be
bypassed** and adds a **continuous review function** that runs nightly to
detect drift before it bites production.

## Decision

### 1. Required status checks expanded from 11 to 14

Three workflows that already run on every PR but do not block merge are added
to the `main` and `preview` rulesets:

| Workflow | Today | After |
|---|---|---|
| `Enforce branch flow` (pipeline-enforcement.yml) | green but advisory | required |
| `pgTAP Suites` (pgtap.yml) | path-filtered, advisory | required when `supabase/**` paths change |
| `authority-seed-parity` (authority-seed-parity.yml) | green but advisory | required |

### 2. CI gains two new jobs

- **`Edge Functions`** — new job in `ci.yml`. On PR with `supabase/functions/**`
  paths, runs `supabase functions deploy --dry-run` against every changed
  function. On `main` push, deploys for real. Closes the orphan tier.
- **`Migration State`** — new job in `ci.yml`. On `main` push, queries the
  production project for the last applied migration timestamp and asserts
  it equals the latest local file. Catches `MIGRATIONS_FAILED` immediately.

### 3. Promote-preview gains smoke probe + last-known-good tag

After Gate 4 (FF possible) and successful push, `promote-preview.sh` runs
`infra/scripts/smoke-probe.sh preview`. If green, the preview SHA is tagged
`lkg-preview-<sha>` and pushed. The tag is the rollback target for HOP B.

### 4. Continuous review — `infra/scripts/drift-check.sh`

A single script runs four parity checks against the live deploy state:

1. `.env.template` op-refs vs Vercel env-var manifest count
2. Vercel env-var keys vs `apps/web/src/env.ts` Zod schema
3. `Deno.env.get()` keys in `supabase/functions/**` vs Supabase secrets list
4. Droplet `infra/.env` keys vs `sync-env-to-droplet.sh` manifest

Output: pass/fail per check, with the first divergent key. Runs locally
(`./infra/scripts/drift-check.sh`), nightly via heartbeat job
`drift-check`, and as `make drift` shortcut. Failure in heartbeat sends a
Telegram alert + appends to activity-log + opens a Linear task tagged
`deploy-drift`.

### 5. preview→main PR template (decision-of-record)

`.github/PULL_REQUEST_TEMPLATE/preview-to-main.md` enforces a checklist:

- preview URL validated by operator
- `smoke-probe.sh preview` green
- last-known-good rollback target SHA referenced
- migration state matches prod (CI green)
- no Edge Function diff OR EF deploy queued

PRs created via `gh pr create --base main --head preview` use this template
when invoked with `?template=preview-to-main.md`. The skill `deploying` is
updated to use this URL form.

### 6. Documentation single source of truth

- `docs/protocols/DEPLOYMENT.md` — static topology + hard rules (this ADR
  becomes a hard rule)
- skill `deploying` — runbook + curated learnings + post-promote steps
- `docs/journeys/JOURNEY-enforce-pipeline.md` — three flows: HOP A, HOP B,
  drift response
- `DEPLOYMENT-DASHBOARD.md` is **deleted** (it was abandoned 2026-03-24 and
  conflicts with the live-dashboard role the skill expects)

## Consequences

**Positive:**
- Promote cannot succeed if any of 14 checks red. No human "looks green"
  judgement.
- Edge Functions tracked + deployed from CI, not manual SSH-equivalent.
- Migration drift surfaces in next CI run, not next month.
- Drift in env-var landscape detected nightly, alerted, ticketed.
- One less doc file (DEPLOYMENT-DASHBOARD.md) — fewer overlapping sources of
  truth.
- Every deploy attempt logged to `activity-log` with smoke result.

**Negative:**
- Adding three workflows to required-checks means a flaky workflow blocks
  merge. Mitigation: existing three workflows have been green for ≥ 1 sprint
  on development.
- Smoke probe adds ~30 s to promote-preview. Acceptable.
- Edge Function dry-run requires `SUPABASE_PROJECT_REF` in CI secrets.

**Neutral:**
- No new services, no new database tables, no operator dashboard. The harness
  is the existing scripts + workflows, with the gates flipped on and two new
  scripts added.

## Implementation

| Move | File | Effort |
|---|---|---|
| 1 | Vercel token in both vaults | manual, secrets-protocol |
| 2 | Required checks update | `gh api PUT rulesets/...` (operator action) |
| 3 | EF deploy job | `.github/workflows/ci.yml` |
| 4 | Migration state job | `.github/workflows/ci.yml` + `supabase/migrations/_meta_migration_state_rpc.sql` |
| 5 | Smoke probe | `infra/scripts/smoke-probe.sh` + `~/.claude/scripts/promote-preview.sh` patch |
| 6 | PR template | `.github/PULL_REQUEST_TEMPLATE/preview-to-main.md` |
| 7 | Drift check | `infra/scripts/drift-check.sh` + heartbeat job |
| 8 | Docs | `docs/protocols/DEPLOYMENT.md` rule + skill update |

## Hard rules (enforced through this ADR + CI)

- ⛔ Promote-preview without all 14 required checks green = blocked at husky pre-push + GitHub ruleset
- ⛔ Merge to main without preview→main template checklist filled = blocked by branch protection
- ⛔ Edge Function changes without dry-run-deploy CI step = blocked
- ⛔ Production migration drift = CI red on next main push
- ⛔ Env-var landscape drift unreviewed for ≥ 7 days = Linear ticket auto-created

## Related

- ADR-0071 — preview environment architecture (parent)
- ADR-0186 — guardian bus pg-notify (cross-cutting telemetry)
- ADR-0189/0190 — authority-seed-parity (one of the now-required checks)
- skill `deploying` — runbook owner
- skill `secrets-protocol` — vault rules used by drift-check
- skill `post-merge-verify` — runs after every merge
