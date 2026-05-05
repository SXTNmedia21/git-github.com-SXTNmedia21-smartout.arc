---
title: Git/GitHub/Deploy Orchestration Map
status: done
created: 2026-05-03
updated: 2026-05-03
module: deployment
tags: [git, github, ci, deployment, pipeline, adr-0265, audit, orchestration]
---

# Git/GitHub/Deploy Orchestration Map — 2026-05-03

> Unified view of every component that affects Git handling, CI, and deployment in Smartout. Built from independent landscape sweep + cross-checked against ADR-0265, deploying skill, deploy-conductor agent, and live workflows.

## TL;DR

- **Branch model:** `main` (PR-only) ← `preview` (FF-only) ← `development` (direct push) ← `feat/*` / `campaign/*` / sub-sortie.
- **Authority chain (ADR-0265):** ADR → `deploying` skill → `deploy-conductor` agent → `infra/scripts/promote-preview.sh` + GH workflows + PR template.
- **State of truth:** generally consistent at the ADR + skill + script layer. Drift exists at protocol-doc + stale YAML layer.
- **Top fixes:** `DEPLOYMENT.md` says 11 required checks (should be 14); `DEPLOYMENT-DASHBOARD.md` orphaned despite ADR-0265 deletion order; 3 stale YAMLs in `.claude/`.

---

## 1. Branch Model + Hard Rules

| Branch | Acceptance | Rule | Source |
|---|---|---|---|
| `main` | PR from `preview` only | 14 required CI checks; PR template `preview-to-main.md`; never push directly | ADR-0265, ruleset 14797822 |
| `preview` | FF from `development` only | Never direct commit; never direct push (only Pontus promotes) | ADR-0265, ruleset 15290760 |
| `development` | Direct push allowed | Integration branch; bare ruleset 15290763 | CLAUDE.md §Git Workflow |
| `feat/*` | Sortie from main | `feat/<name>` → merge to development → delete | `/start-feature` |
| `campaign/*` | Long-lived | Merge-commit only (no squash); force-push forbidden; no `/close-feature` | ADR-0213 |
| `feat/<camp>-<sub>` | Sub-sortie inside campaign | Merge to campaign; sync development into campaign | `/start-feature` (path-aware) |
| `hotfix/*` | Direct from main | Branch from main → PR back → cherry-pick to development | CLAUDE.md |

**Recovery escape (ADR-0213).** Squash-merged campaign requires `git reset --hard origin/development` + cherry-pick + `push --force-with-lease`. No ruleset on `campaign/*` so force-with-lease works.

---

## 2. Authority Chain — ADR-0265

```
ADR-0265 (decision)
  └─ deploying skill (runbook + curated learnings)
      └─ deploy-conductor agent (executor + RUNS.md memory)
          ├─ infra/scripts/promote-preview.sh   (HOP A wrapper, 6 gates)
          ├─ infra/scripts/smoke-probe.sh       (gate 5 — post-FF probe)
          ├─ infra/scripts/drift-check.sh       (nightly env parity)
          ├─ .github/workflows/*                (14 required checks)
          └─ .github/PULL_REQUEST_TEMPLATE/preview-to-main.md (HOP B operator gate)
```

**HOP A** = `development → preview` (6 gates). **HOP B** = `preview → main` (14 CI + 6-item operator checklist).

---

## 3. GitHub Workflows

| Workflow | Trigger | Required-check name | Purpose |
|---|---|---|---|
| `ci.yml` | push/PR all branches | Lint, Type Check, Format Check, Vitest, Build Health, API Docs Go-Live Guard, 4× Docker Build, Build, Harness Invariants, Edge Functions, Migration State (main only) | Core gate; EF dry-run on PR, real on main push |
| `pgtap.yml` | PR to main/preview/development | **pgTAP Suites** | Auto-skip if no DB diff (still green) |
| `authority-seed-parity.yml` | PR + push main/preview/development | **authority-seed-parity** | ADR-0189/0190 capability literal vs seed parity |
| `pipeline-enforcement.yml` | PR to main/preview | **Enforce branch flow** | Blocks invalid head→base |
| `ai-eval.yml` | PR touching `packages/ai/`, `services/stage-engine/` | (informational) | Golden transcripts >80%. NOT in 14 required |
| `claude-code-review.yml` | PR open/sync/reopen | (informational) | Auto Claude review |
| `claude.yml` | issue/PR @claude mention | (informational) | On-demand Claude |

**14 required checks** = ci.yml (11 jobs) + Enforce branch flow + pgTAP Suites + authority-seed-parity.

**Secrets used.** `OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROD_REF`, `SUPABASE_PROD_URL`, `SUPABASE_PROD_SERVICE_ROLE_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`.

**PR Templates.**
- `.github/PULL_REQUEST_TEMPLATE.md` — default for any→development.
- `.github/PULL_REQUEST_TEMPLATE/preview-to-main.md` — HOP B; 6-item operator checklist (preview validated, smoke green, LKG SHA identified, migration state OK, EF diff ack, drift-check green).

---

## 4. Skills

| Skill | Path | Role |
|---|---|---|
| `deploying` | `~/.claude/skills/deploying/SKILL.md` | ADR-0265 runbook + curated knowledge bank. NEW/CONFIRMED/STALE/DUPLICATE law. Auto-trigger on deploy keywords |
| `git-cleanup` | `~/.claude/skills/git-cleanup/SKILL.md` | Worktree+branch sprawl audit, FF-prep, ready-to-merge mapping |
| `post-merge-verify` | global | Verify formatter reverts + type/lint regressions after parallel merge |
| `preflight` | global | Dispatch readiness for parallel agents |
| `worktree` | global | Plan-file-first propagation rule |
| `secrets-protocol` | global | Two-vault credential law (smartout_ai + smartout_ai_prod) |
| `adr-contract-audit` | global | Weekly ADR coherence audit |
| `smartout-edge-function-guide` | global | EF auth + workspace-api gateway + scope guards |

---

## 5. Agent — deploy-conductor

**Location:** `apps/.claude/agents/deploy-conductor.md` + sub-folder `deploy-conductor/{KNOWLEDGE,PLAYBOOK,ROADMAP,RUNS,STATE}.md`.

**Role.** Tactical executor of the enforced pipeline. Triggers on deploy intent or heartbeat alerts. Loads `deploying` + 6 sibling skills.

**Hard rules.**
- Never push to `main`; only PRs from `preview`.
- Never push directly to `preview`; only FF wrapper.
- Never invoke `~/.claude/scripts/promote-preview.sh` directly — always repo wrapper.
- Never bypass 14 required CI checks.
- Never edit Vercel/Supabase/droplet env manually — sync scripts only.
- Never deploy EFs outside CI on main push (except emergency rollback, logged).
- Never paste raw secrets — `op://` reference only.
- Never auto-rollback — propose only.

**Reflection loop (mandatory after every triggering run).** Append RUNS.md → update STATE.md → propose curation back to `deploying` skill → log to activity-log.

**Phase 0 (today).** Can verify most gates. Cannot yet: migration RPC auto-check, EF config auto-check, E2E in CI, cron-canary, secret-rotation alerts (Phase 1-4 unlock).

---

## 6. Slash Commands

| Command | Calls | Notes |
|---|---|---|
| `/start-feature` | `~/.claude/scripts/new-feature.sh` | Path-aware: sortie from main, sub-sortie from campaign |
| `/start-campaign` | `~/.claude/scripts/new-campaign.sh` | Long-lived `campaign/<name>` |
| `/sync-campaign` | `~/.claude/scripts/sync-campaign.sh` | Merge `origin/development` → campaign |
| `/close-feature` | repo shim `scripts/close-feature.sh` → global `~/.claude/scripts/close-feature.sh` | Journey Guardian battery G-JE-1..6 |
| `/promote-preview` | `./infra/scripts/promote-preview.sh` (NEVER global) | Pontus only — ADR-0265 hard rule |
| `/status` | regenerates `docs/DASHBOARD.md` | Pure git state, no narrative |
| `/end-session` | `~/.claude/scripts/end-session.sh` | activity-log + claude-mem digest |

---

## 7. Scripts — Canonical vs Shadow

### Duplicate names (PATH ambiguity risk)

| Name | Canonical | Shadow | Resolution |
|---|---|---|---|
| `promote-preview.sh` | `infra/scripts/promote-preview.sh` (6 gates: sync, CI, Vercel READY, FF, smoke, lkg-tag) | `~/.claude/scripts/promote-preview.sh` (4 gates) | ADR-0265 hard rule: NEVER call global directly. Slash command uses full path |
| `close-feature.sh` | `~/.claude/scripts/close-feature.sh` (merge + worktree remove) | `scripts/close-feature.sh` (repo shim, journey guardian + self-test) | Repo shim runs first, delegates to global |
| `sync-campaign.sh` | `~/.claude/scripts/sync-campaign.sh` | (no repo wrapper) | No shadow risk |

### Repo infra scripts (`infra/scripts/`)

| Script | Purpose |
|---|---|
| `start.sh` | Dev boot: 1Password, docker, supabase start, workspace seed |
| `promote-preview.sh` | HOP A wrapper (6 gates) |
| `smoke-probe.sh` | Health probe (treats 401 as alive on SSO preview) |
| `drift-check.sh` | 4-channel parity audit; nightly heartbeat |
| `sync-env-to-vercel.sh` | 64 shared env vars → Vercel |
| `sync-env-to-droplet.sh` | 15 vars → DigitalOcean droplet (n8n + auth bridge) |
| `health-check.sh` | Status snapshot (not in promote pipeline) |
| `backup.sh` + `backup-cron.sh` | Supabase Local DB → S3 |
| `setup.sh` | Initial repo setup |
| `deploy.sh` | Droplet deploy (n8n + auth bridge), NOT used for Vercel/Supabase |

### Repo journey scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `close-feature.sh` | Smartout entry point — delegates to global, can self-test gates without worktree |
| `close-feature-journey-guardian.sh` | G-JE-1..6: decision log, journey frontmatter, typecheck, ADR sync |
| `journey-runner.ts` / `journey-runner` | Journey execution harness |

### Global scripts (`~/.claude/scripts/`) — non-deploy utility

`new-feature.sh`, `new-campaign.sh`, `sync-campaign.sh`, `close-feature.sh`, `promote-preview.sh`, `end-session.sh`, `scan-docs.sh`, `log-activity.sh`, `heartbeat-notify.sh`, `heartbeat-session-start.sh`, `log-vault-write.sh`, `log-session-stop.sh`, `session-start-worktree-status.sh`, `claude-mem-worker-ensure.sh`, `wake-sixten.sh`, `log.sh`, `close-feature-backup.sh` (DEPRECATED).

---

## 8. ADRs Governing The Pipe

| ADR | Status | Rule | Enforcement |
|---|---|---|---|
| **0265** | accepted (2026-05-03) | 14 required CI + 6 promote gates + drift-check + lkg-tag. Single skill ownership | `infra/scripts/promote-preview.sh` + GH rulesets + `deploying` skill + heartbeat |
| **0213** | accepted (2026-04-27) | Campaign-PRs use merge-commit, never squash; force-push forbidden | Branch protection (Pontus); recovery = delete+recreate |
| **0075** | accepted v1.1 (2026-04-07) | DASHBOARD.md = git state only. SESSION.md deleted. activity-log = audit. claude-mem = memory | Husky hooks #7 + #8 |
| **0034** | accepted (2026-03-01) | ADR ↔ 0000-decision-log consistency. Plan frontmatter | `pnpm docs:validate` |
| **0059** | accepted (2026-03-28) | Platform admin pipeline separate from employee | stage-engine routes |
| **0222** | accepted (2026-04-28) | 5-op journey skill pipeline | `journey-protocol` skill |

---

## 9. Hooks + Settings + State Files

### Hooks (none directly fire on git/deploy)

| Hook | Event | Behavior |
|---|---|---|
| `preflight-json.sh` (repo) | SessionStart | Bundle diagnostics. Warn-only |
| `skill-trigger-reminder.sh` (repo) | UserPromptSubmit | Inject MUST-LOAD hint for matching domain |
| `typecheck.sh` (repo) | PostToolUse Edit/Write | Scoped `pnpm --filter` typecheck. **BLOCKS on exit 2** + asyncRewake |
| `heartbeat-session-start.sh` (global) | SessionStart | Due-job + drift alerts |
| `session-start-worktree-status.sh` (global) | SessionStart | Worktree inventory |
| `log-session-stop.sh` (global) | Stop | activity-log narrative |
| `log-vault-write.sh` (global) | PostToolUse Vault | activity-log file writes |
| `contract-e2e-memory-write.sh` (repo) | Stop | Persist 80-line snapshot |

### Permissions

`~/.claude/settings.json` pre-allows git/npm/docker/supabase. Denies `rm -rf /*`, `sudo`, mkfs, dd. **No deploy-specific gating** — `promote-preview.sh` runs outside Claude under `op run`.

### State files

| File | Status | Use |
|---|---|---|
| `docs/DASHBOARD.md` | LIVE — `/status` regenerates | Pure git state |
| `docs/STATE-SUMMARY.md` | semi-live (last 2026-04-20) | Priorities snapshot |
| `docs/STATE.md` | reference (817 lines) | Deep dive |
| `.claude/pipeline.yaml` | **STALE** (2026-03-06) | Ignore |
| `.claude/workflow-state.yaml` | **STALE** (2026-04-10) | Legacy session memory; superseded by activity-log + claude-mem (ADR-0075) |
| `.claude/decisions.yaml` | **STALE** (only 20 of 163 ADRs) | Ignore — canonical = `docs/decisions/0000-decision-log.md` |

---

## 10. Conflicts, Duplication, Gaps

| # | Issue | Where | Action |
|---|---|---|---|
| C1 | DEPLOYMENT.md says "11 required checks" | `docs/protocols/DEPLOYMENT.md §4` | Update to 14 |
| C2 | DEPLOYMENT.md references `~/.claude/scripts/deploy.sh` (not existing) | `docs/protocols/DEPLOYMENT.md §2` | Remove; canonical = `infra/scripts/promote-preview.sh` |
| C3 | `DEPLOYMENT-DASHBOARD.md` still on disk | `docs/protocols/DEPLOYMENT-DASHBOARD.md` | Delete per ADR-0265 |
| C4 | DEPLOYMENT.md says EF deploy is "manual `npx supabase functions deploy`" | conflicts with new `Edge Functions` job in ci.yml | Update protocol — CI auto-deploys on main push |
| C5 | DEPLOYMENT.md silent on `Migration State` job | new gate added 2026-05 | Add §4.x note |
| C6 | DEPLOYMENT.md silent on drift-check | not mentioned anywhere except ADR | Add §3 reference |
| C7 | `JOURNEY-deployment-pipeline.md` (old) coexists with `JOURNEY-enforce-pipeline.md` (new) | `docs/journeys/` | Archive old |
| C8 | `pipeline.yaml`, `workflow-state.yaml`, `decisions.yaml` all stale | `.claude/` | Mark `# DEPRECATED — see ADR-0075` or delete |
| C9 | `ai-eval.yml` not in 14 required | `.github/workflows/ai-eval.yml` | Add or document as informational |
| C10 | `build-health-artifact` upload has no consumer | `ci.yml:114-119` | Verify or remove |
| C11 | `claude-code-review.yml` + `claude.yml` overlap | both invoke `anthropics/claude-code-action@v1` | Document distinct triggers |
| O1 | `deploying` skill says "orchestrator edits skill in-place"; `deploy-conductor` says "propose to operator first" | tension | Align skill text to deploy-conductor (more conservative) |
| O2 | Vercel CANCELED-state recovery — who re-triggers? | not specified | Add to deploy-conductor PLAYBOOK Scenario X |
| O3 | post-merge-verify skill not explicitly loaded in deploy-conductor Scenario G | gap | Add explicit load |
| O4 | git-cleanup not loaded when pipeline-gap > 200 | gap | Add to deploy-conductor Scenario A pre-checks |
| G1 | No pre-commit branch-name validation | pipeline-enforcement only blocks invalid flow | Optional husky hook |
| G2 | `supabase/migrations/_meta_migration_state_rpc.sql` referenced in ADR not found | possible incomplete impl | Verify or remove ref |

---

## 11. Decisions The Orchestrator Must Make

1. Update `DEPLOYMENT.md` — 14 checks, drift-check section, EF auto-deploy, Migration State, drop `deploy.sh` reference. Or supersede entirely → point to ADR-0265 + `deploying` skill.
2. Delete `DEPLOYMENT-DASHBOARD.md` per ADR-0265.
3. Archive `JOURNEY-deployment-pipeline.md` (superseded by `JOURNEY-enforce-pipeline.md`).
4. Mark stale `.claude/` YAMLs deprecated. Or delete.
5. Resolve skill ↔ agent curation tension — adopt deploy-conductor's "propose first" rule into `deploying` skill text.
6. Decide ai-eval required or formally informational; update PR template.
7. Verify `_meta_migration_state_rpc.sql` exists or remove ADR reference.
8. Document duplicate-script-name SHADOWING explicitly in `deploying` skill.

---

## 12. Recommended Consolidation Plan

### Phase 1 — Doc truth (1 sortie, low risk, ~30 min)
- Rewrite `DEPLOYMENT.md` to defer to `deploying` skill + ADR-0265; keep only env/topology reference
- Delete `DEPLOYMENT-DASHBOARD.md`
- Archive `JOURNEY-deployment-pipeline.md`
- Mark stale YAMLs `# DEPRECATED — see ADR-0075`
- Land in 1 PR to development

### Phase 2 — Agent/skill alignment (1 sortie)
- Update `deploying` skill curation rule → match deploy-conductor "propose first"
- Add explicit skill-load triggers in deploy-conductor PLAYBOOK (Scenario A: git-cleanup if gap>200; Scenario G: post-merge-verify after merge)
- Add Vercel CANCELED scenario to PLAYBOOK

### Phase 3 — CI hardening (1 sortie)
- Decide ai-eval required vs informational; update PR template
- Verify `_meta_migration_state_rpc.sql` exists; ship if missing
- Verify build-health-artifact consumer; otherwise remove
- Document claude-action workflow boundaries

### Phase 4 — Single source enforcement (continuous)
- Heartbeat job: cross-check ADR-0265 ↔ DEPLOYMENT.md ↔ skill ↔ scripts (extend `adr-contract-audit` to scripts)
- drift-check stays nightly
- Auto-Linear ticket on >7d unresolved drift (already in ADR-0265)

---

## 13. Reference Index

| Topic | Path |
|---|---|
| Pipeline ADR | `docs/decisions/0265-enforced-deployment-pipeline.md` |
| Campaign merge ADR | `docs/decisions/0213-campaign-prs-use-merge-commit-not-squash.md` |
| State system ADR | `docs/decisions/0075-knowledge-system-consolidation.md` |
| Doc enforcement ADR | `docs/decisions/0034-documentation-enforcement-pipeline.md` |
| Platform admin ADR | `docs/decisions/0059-platform-admin-pipeline.md` |
| Journey skill ADR | `docs/decisions/0222-journey-protocol-op-pipeline.md` |
| Skill | `~/.claude/skills/deploying/SKILL.md` |
| Agent main | `apps/.claude/agents/deploy-conductor.md` |
| Agent sub-files | `apps/.claude/agents/deploy-conductor/{KNOWLEDGE,PLAYBOOK,ROADMAP,RUNS,STATE}.md` |
| Promote wrapper | `infra/scripts/promote-preview.sh` |
| Smoke probe | `infra/scripts/smoke-probe.sh` |
| Drift check | `infra/scripts/drift-check.sh` |
| Env sync (Vercel) | `infra/scripts/sync-env-to-vercel.sh` |
| Env sync (droplet) | `infra/scripts/sync-env-to-droplet.sh` |
| HOP B template | `.github/PULL_REQUEST_TEMPLATE/preview-to-main.md` |
| CI core | `.github/workflows/ci.yml` |
| Branch flow gate | `.github/workflows/pipeline-enforcement.yml` |
| pgTAP | `.github/workflows/pgtap.yml` |
| Authority parity | `.github/workflows/authority-seed-parity.yml` |
| Live state | `docs/DASHBOARD.md`, `docs/STATE-SUMMARY.md`, `docs/STATE.md` |
| Latest audit synthesis | `docs/audits/2026-05-02-adr-contract-validation/00-SYNTHESIS.md` |
| Activity log (vault) | `~/dev/second-brain-v2/ops/activity-log.md` |
| DEPLOYMENT.md (PARTIALLY STALE) | `docs/protocols/DEPLOYMENT.md` |
| DEPLOYMENT-DASHBOARD.md (ORPHAN) | `docs/protocols/DEPLOYMENT-DASHBOARD.md` |
| Journey enforce (canonical) | `docs/journeys/JOURNEY-enforce-pipeline.md` |
| Journey deployment (stale) | `docs/journeys/JOURNEY-deployment-pipeline.md` |

---

**End of map.**
