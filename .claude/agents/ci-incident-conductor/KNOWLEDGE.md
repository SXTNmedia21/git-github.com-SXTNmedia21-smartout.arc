---
title: "ci-incident-conductor — Knowledge Bundle"
status: canonical
updated: 2026-05-04
---

# Knowledge Bundle

Everything ci-incident-conductor needs to know about Smartout's CI surface, failure taxonomy, escalation flow, and triage tooling. Read top-to-bottom on first session of the day.

---

## 1. ADR-0275 — governing decision

This agent's scope, boundaries, auto-fix allowlist, reflection contract, and autonomous operating mode are all defined in `docs/decisions/0275-ci-incident-response-agent.md`. When in doubt, the ADR wins over this file.

Key facts:
- Scope: failed `workflow_run` / `check_suite` / `deployment_status` events on any branch except `main` and `preview`.
- Sibling to `deploy-conductor` (ADR-0265) — explicit non-overlapping boundaries defined in ADR-0275 §§ Boundary 1-4.
- Auto-fix confidence threshold: ≥ 0.85.
- ADR-draft threshold: same root cause ≥ 3 occurrences in 30 days.
- Skill-emission threshold: L-0202 (≥ 5 occurrences with curated pattern).
- Logging schema: `ops/ci-incidents/log.jsonl` (append-only JSON-lines).
- Weekly digest: `ops/ci-incidents/YYYY-WW-summary.md`.
- Pattern file: `ops/ci-incidents/YYYY-WW-patterns.md` (recurrence ≥ 3).

---

## 2. Failure classification taxonomy

Every incident must be classified into exactly one class before any action is taken. Classification drives scenario selection in PLAYBOOK.md.

| Class | Code | Description | Auto-fix eligible |
|---|---|---|---|
| CI config | A | Workflow YAML syntax, action version drift, missing concurrency, missing timeout | YES |
| Dependency cache | B | pnpm install fail, Turbo cache key drift, lockfile divergence | YES |
| Flaky test | C | `run_attempt > 1` with success after retry; intermittent without code change | YES (one rerun; quarantine on second fail) |
| Stale artifact | D | `.next/types` stale after cherry-pick; build artifact mismatch | YES |
| Supabase App supersession | E | App CANCELLED + detailsUrl contains `/settings/integrations` (no preview-branch ref) | NO — no-op |
| Supabase App migration fail | F | App FAILURE + detailsUrl contains unique preview-branch ref | NO — diagnose + PR comment only |
| App bug test fail | G | Lint / typecheck / vitest / E2E failure due to application logic regression | NO — Linear ticket + stop |
| Deploy handoff | H | Failure class is `deploy` OR branch is `main`/`preview` | NO — hand off to deploy-conductor |
| Security warning | I | Dependabot alert, secret detected in diff, SAST finding | NO — escalate operator immediately |
| Read-only status query | J | Operator asks "what failed" / "where are we" with no active incident | NO — no reflection loop |
| Pause / resume | K | `ci-agent-pause` label or `@ci-incident-conductor stop` / `resume` comment | N/A — mode change |

**Classification steps (always in this order):**
1. Read branch name. If `main` or `preview` → class H immediately, no further classification.
2. Read trigger source. GitHub App check-run (no `runs-on`) vs GitHub Actions workflow_run (has `runs-on`).
3. If GitHub App: read `detailsUrl`. Classify E or F per URL fingerprint (see § 5 below).
4. If GitHub Actions: read workflow name + job name. Map to § 3 (workflow map).
5. Read error message and logs. Classify A–D or G per symptom table in PLAYBOOK.md.
6. Record `confidence` (0.0–1.0). If < 0.6 and no known-pattern match → escalate, do not auto-act.

---

## 3. The 14 required CI checks

Authoritative source: deploy-conductor KNOWLEDGE.md § 4 and GitHub ruleset IDs 14797822 (main) + 15290760 (preview, 12 contexts after L-0197 Path A1 fix 2026-05-04).

### Required on `main` ruleset (14797822) — 14 contexts

| Check name | Workflow file | Notes |
|---|---|---|
| Format Check | `ci.yml` | `pnpm format --check` |
| Lint | `ci.yml` | `pnpm lint` |
| Type Check | `ci.yml` | `pnpm turbo typecheck` |
| Vitest (packages) | `ci.yml` | `pnpm turbo test` |
| Build Health | `ci.yml` | `pnpm build:health` |
| Build | `ci.yml` | `pnpm turbo build` |
| API Docs Go-Live Guard | `ci.yml` | `pnpm api:docs:go-live` |
| Docker Build (stage-engine) | `ci.yml` | matrix job |
| Docker Build (shift-mcp) | `ci.yml` | matrix job |
| Docker Build (contract-service) | `ci.yml` | matrix job |
| Docker Build (scrapling) | `ci.yml` | matrix job |
| Enforce branch flow | `pipeline-enforcement.yml` | PR-only; on main ruleset only (L-0197) |
| pgTAP Suites | `pgtap.yml` | PR-only; on main ruleset only (L-0197) |
| authority-seed-parity | `authority-seed-parity.yml` | fires on push to development + PR |

### Required on `preview` ruleset (15290760) — 12 contexts (post L-0197 Path A1)

Same as main EXCEPT: `Enforce branch flow` and `pgTAP Suites` removed (2026-05-04, L-0197 Path A1). Both are PR-only-trigger workflows, incoherent on direct FF-push to preview.

### Not required (path-scoped or main-push-only)

| Check | Why not required |
|---|---|
| AI Eval (golden-transcripts) | `ai-eval.yml` — path-scoped to `packages/ai/**` + `services/stage-engine/**` |
| Edge Functions | `ci.yml` job — main-push-only per ADR-0265 |
| Migration State | `ci.yml` job — main-push-only per ADR-0265 |

---

## 4. GitHub Actions workflows inventory

| File | Triggers | CI-agent scope? |
|---|---|---|
| `ci.yml` | push + PR on main/dev/preview | YES — primary triage surface |
| `pipeline-enforcement.yml` | PR on main/preview only | YES — but diagnose only (PR-only trigger) |
| `pgtap.yml` | PR on main/dev/preview; paths `supabase/**` | YES — diagnose only (path-scoped) |
| `authority-seed-parity.yml` | PR + push on development | YES |
| `ai-eval.yml` | PR on `packages/ai/**` + `services/stage-engine/**` | YES — app-bug class if failing |
| `claude.yml` | manual | NO — CI agent does not triage manual triggers |
| `claude-code-review.yml` | PR labeled `review` | NO — not a CI failure |

`ci.yml` jobs (all in-scope for triage):
- `lint`, `typecheck`, `format`, `vitest`, `build-health`, `build`, `api-docs-go-live-guard`
- `docker-build` (matrix: stage-engine, shift-mcp, contract-service, scrapling)
- `harness-invariants`
- `edge-functions` (path-scoped: `supabase/functions/**`)
- `migration-state` (main-push only)

---

## 5. Supabase GitHub App — URL fingerprint classification

The Supabase GitHub App is NOT a GitHub Actions workflow. Its check-run states appear in PR check-runs but follow App semantics. Never confuse with Actions workflow_run events.

| App check state | `detailsUrl` contains | Classification | Action |
|---|---|---|---|
| CANCELLED | `/settings/integrations` (no preview-branch ref) | E — stack supersession | no-op; log CONFIRMED if seen before |
| CANCELLED | unique preview-branch ref (e.g. `/branches/feat-xxx`) | Abnormal cancel | investigate; classify F if migration error in logs |
| FAILURE | unique preview-branch ref | F — migration apply error | diagnose; PR comment with L-0042 + re-timestamp |
| SUCCESS | unique preview-branch ref | Healthy | no action |

Stack supersession (E): when a newer Supabase preview deploy supersedes an older one mid-flight, the older check is CANCELLED. This is expected behavior, not regression. Misclassifying it as failure would page the operator unnecessarily.

The CI agent **never** modifies `supabase/migrations/*`. Diagnosis only. For F-class, run `npx supabase db reset` locally (Supabase Local only) to reproduce, then post the L-0042 reference and exact re-timestamp on the PR.

---

## 6. Auto-fix allowlist (confidence ≥ 0.85 required)

Auto-fix is enabled from Phase 2 onward. Each auto-fix produces a PR to `development` (never directly to `main` or `preview`), labeled `ci-auto-fix`, with the incident ID in the title.

| Fix | Trigger condition | Confidence requirement |
|---|---|---|
| GitHub Action version sha-pin bump | Last 7 days stable upstream; action within minor-bump bounds | 0.90 |
| pnpm install retry with frozen lockfile + cache clear | pnpm install exit non-zero with lockfile-integrity or network error | 0.85 |
| Turbo cache-key bust | Miss-rate > 30% for 3 consecutive days | 0.90 |
| Stale `.next/types` purge step | Known L-stale-types pattern (memory `learning_stale_next_types_blocks_typecheck.md`): TS2307 on phantom import after `git rm` on App Router file | 0.95 |
| Flaky test one rerun | `run_attempt == 1`, same job passed at `run_attempt == 2` within prior 30d, no code change on that file | 0.85 |
| Flaky test quarantine (after second fail) | Same test failed ≥ 2 reruns in 30d | 0.95 |
| Workflow YAML lint fix | Whitespace, key order; no semantic change to job logic | 0.95 |
| Concurrency group add | Workflow has no `concurrency:` and shows queue pile-up in logs | 0.90 |
| `timeout-minutes` add to runaway job | Job has no timeout and has exceeded 30 min in ≥ 2 runs | 0.90 |

**Forbidden from auto-fix, always:**
- Dependency major bumps.
- Test deletion or skip without quarantine label + Linear ticket.
- Any change to `.github/rulesets/*` or workflow `permissions` blocks.
- Any application code (`apps/`, `packages/`, `services/`).
- Any migration file (`supabase/migrations/*`).

---

## 7. Escalation flow — by severity tier

| Severity | Criteria | Phase 0 | Phase 1+ |
|---|---|---|---|
| Low | E (supersession), known pattern first occurrence | log-only | PR comment only |
| Medium | B/C/D first occurrence unknown; A first occurrence | log-only | PR comment + GitHub Issue (ci-incident) + Telegram |
| High | F (migration fail), G (app-bug regression), I (security), ≥ 3 recurrences, confidence < 0.6 | log-only | PR comment + GitHub Issue (ci-incident-urgent) + Telegram + Linear OPS ticket |
| Deploy-handoff | H class (main/preview branch, deploy-class failure) | log + handoff note | handoff note only (no escalation to Pontus directly — deploy-conductor receives it) |

### Telegram alert format

```bash
~/.claude/scripts/heartbeat-notify.sh telegram "CI-incident [<severity>] <incident_id>: <failure_class> on <branch>/<workflow>/<job>. Root cause: <one-line>. Action: <taken or proposed>."
```

### Linear ticket format (severity ≥ high, Phase 1+, load `linear-protocol` skill first)

- Project: OPS
- Title: `[CI] <failure_class>: <workflow>/<job> on <branch> — <root-cause-summary>`
- Labels: `ci-incident` + `ci-incident-urgent` (if high)
- Body: incident_id, branch, run_id, failure_class, root_cause, confidence, action taken/proposed, link to PR comment or GitHub Issue
- Emoji convention per `linear-protocol`: 👀 (investigating) → 📌 (known, tracked) → ❌ (blocked) → ✅ (resolved) → 🔥 (on-fire/urgent)

---

## 8. GitHub Issue label vocabulary

| Label | Created by | Meaning |
|---|---|---|
| `ci-incident` | Agent (Phase 1+) | Medium-severity incident, tracked |
| `ci-incident-urgent` | Agent (Phase 1+) | High-severity incident, needs operator attention |
| `ci-auto-fix` | Agent (Phase 2+) | PR opened by agent for allowlisted auto-fix |
| `ci-quarantine` | Agent (Phase 2+) | Flaky test quarantined via skip-list PR |
| `ci-agent-pause` | Operator | Puts agent into read-only (Phase 0 equivalent) |
| `ci-agent-resume` | Operator | Resumes agent from pause |

---

## 9. Incident log schema (ops/ci-incidents/log.jsonl)

Every incident appended as a single JSON-line object. Schema is fixed in ADR-0275 § Logging schema:

```jsonc
{
  "incident_id": "ci-YYYYMMDD-NNN",   // e.g. ci-20260504-001
  "ts_detected": "2026-05-04T14:23:00Z",
  "ts_resolved": "2026-05-04T14:45:00Z",   // null until resolved
  "trigger": "workflow_run",               // workflow_run | check_suite | deployment_status | manual
  "branch": "feat/my-feature",
  "workflow": "ci.yml",
  "job": "typecheck",
  "run_id": "123456789",
  "run_attempt": 1,
  "head_sha": "abc1234",
  "failure_class": "D",                    // A-K from taxonomy
  "root_cause": "stale .next/types after git rm on app router page",
  "confidence": 0.95,
  "action": "auto-fix",                    // log-only | pr-comment | auto-fix | quarantine | escalate | handoff | no-op
  "action_detail": "PR #342 opened: ci-auto-fix/ci-20260504-001",
  "validation": "pr-ci-green",             // null | pr-ci-green | pr-ci-red | operator-confirmed
  "duration_impact_sec": 420,
  "recurrence_count_30d": 2,
  "is_known_pattern": true,
  "memory_ref": "learning_stale_next_types_blocks_typecheck.md",
  "related_audit": null,                   // ref to adr-contract-audit run-id if relevant
  "related_drift": null,                   // ref to drift-check run-id if relevant
  "escalated_to": null,                    // "deploy-conductor" | "operator" | null
  "follow_up": "Phase 2: add .next/types purge as standard post-cherry-pick step"
}
```

---

## 10. Triage script and tooling reference

| Tool / Script | Purpose | Notes |
|---|---|---|
| `gh pr checks <PR>` | Read check-run states on a PR | First-reach tool for PR-triggered failures |
| `gh run list --branch <branch> --limit 10` | List recent workflow runs | Use `--json status,conclusion,name,workflowName` |
| `gh run view <run-id> --log-failed` | Read failed job logs | Pipe to `head -200` to avoid token bloat |
| `gh api repos/{owner}/{repo}/commits/{sha}/check-runs` | All check-runs for a SHA | Use for push-triggered failures without PR |
| `npx supabase db reset` | Reproduce migration fail locally | Supabase Local ONLY. Never against Cloud. |
| `pnpm turbo typecheck` | Local typecheck repro | Run with `--filter <package>` to scope |
| `pnpm --filter web typecheck` | Web-specific typecheck | Use after stale .next/types purge |
| `rm -rf apps/web/.next/types` | Purge stale .next/types | L-stale-types fix step 1 of 2 |
| `~/.claude/scripts/log-activity.sh ci claude "<msg>"` | Write to activity-log | Source: `ci`, Actor: `claude` |
| `~/.claude/scripts/heartbeat-notify.sh telegram "<msg>"` | Telegram alert | Medium+ severity |

---

## 11. Orchestration map cross-reference

Full deployment orchestration context: `docs/audits/2026-05-03-git-deploy-orchestration-map.md`.

CI agent reads from this map:
- O1: skill-curation alignment with `deploying` skill (propose-first posture)
- O2: which branches trigger which workflows (scope verification)
- O3: 6 HOP-A gates (agent acts as operator-proxy when all 6 green)

The CI agent does not modify the orchestration map. It reads it on session start when the map has been updated (check last modified date vs STATE.md last-verified).

---

## 12. ADRs relevant to CI surface

| ADR | Status | Subject |
|---|---|---|
| 0265 | accepted | Enforced deployment pipeline — defines 14 required checks and gate structure |
| 0275 | proposed (upgrading to accepted on registration) | CI incident-response agent — this agent's governing ADR |
| 0189 | accepted | Authority-seed-parity CI gate |
| 0190 | accepted | Cascade-gate-write entity-type-coverage CI gate |
| 0071 | accepted | Preview environment architecture (3-branch pipeline) |
| 0213 | accepted | Campaign branches must merge-commit, never squash |

L-0042: Migration timestamp ordering is author-responsibility. The CI agent diagnoses ordering bugs but never modifies migration files.

L-stale-types (memory: `learning_stale_next_types_blocks_typecheck.md`): `tsconfig.json` includes `.next/types/**/*.ts` but `validator.ts` is regenerated only by `next dev`/`next build`, not `tsc --noEmit`. After cherry-pick deletes of `page.tsx`/`route.ts`, pre-push fails with TS2307 on phantom imports. Fix: `rm -rf apps/web/.next/types && pnpm --filter web typecheck`.

---

## 13. Where docs live

| Doc | Purpose |
|---|---|
| `docs/decisions/0275-ci-incident-response-agent.md` | ADR-0275 — this agent's governing decision |
| `docs/decisions/0265-enforced-deployment-pipeline.md` | ADR-0265 — 14 required checks, HOP A/B gates |
| `docs/audits/2026-05-03-git-deploy-orchestration-map.md` | Full orchestration map |
| `ops/ci-incidents/log.jsonl` | Append-only incident log |
| `ops/ci-incidents/YYYY-WW-summary.md` | Weekly digest (written by agent Phase 0+) |
| `ops/ci-incidents/YYYY-WW-patterns.md` | Pattern file for recurrence ≥ 3 (Phase 3+) |
| `~/.claude/skills/deploying/SKILL.md` | Deploy runbook — CI agent reads deploy-adjacent sections |
| `.claude/agents/ci-incident-conductor/` | This bundle |
