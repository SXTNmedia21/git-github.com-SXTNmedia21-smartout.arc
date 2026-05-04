---
title: "deploy-conductor — Knowledge Bundle"
status: canonical
updated: 2026-05-04
---

# Knowledge Bundle

Everything deploy-conductor needs to know about Smartout's deployment surface, organized by layer. Read top-to-bottom on first session of the day.

---

## 1. Pipeline of record (ADR-0265 + ADR-0071)

```
development ──FF──▶ preview ──PR(rebase/squash)──▶ main
   (work)            (staging)                       (production)
```

| Branch | Vercel | Supabase | Docker |
|---|---|---|---|
| `development` | preview deploy (gated on `[deploy]` tag in commit message per ADR-0265) | local on dev box | none |
| `preview` | preview deploy (gated on `[deploy]` tag in commit message per ADR-0265) + ephemeral Branch DB env | ephemeral preview branch DB (created/torn down via `infra/scripts/branch-db.sh` per ADR-0270 proposed). Persistent branch `cibmhhgsrdmpnmcikalu` deleted 2026-05-04. | none |
| `main` | production deploy (auto on push) | prod `yljaglomadbhyqpcigff` (auto-apply migrations on main push) | manual via SSH `infra/scripts/deploy.sh` |

Surfaces in production:
- Vercel: `smartout-web` (`prj_CG6Gi7QE5jpz5fghbDUco16wG2ds`) + `smartout-landing` (`prj_6HUDlqfYfS0cfCXb603dc3eRej5y`). Team `team_bbtw5JnNxRkKlecAKQB7qqzG`.
- Supabase Cloud: prod `yljaglomadbhyqpcigff`, preview Branch `cibmhhgsrdmpnmcikalu`.
- DigitalOcean droplet: `root@164.92.176.42`, repo at `/root/dev/smartout.ai`, branch `main`.

---

## 2. The single sanctioned commands

```bash
# HOP A: development → preview
op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh

# HOP B: preview → main (operator action via GH UI)
gh pr create --base main --head preview --template preview-to-main.md

# Production smoke (post-merge)
op run --env-file=.env.template -- ./infra/scripts/smoke-probe.sh production

# Continuous drift review
./infra/scripts/drift-check.sh

# Droplet deploy (post-main, manual)
ssh root@164.92.176.42 "cd /root/dev/smartout.ai && ./infra/scripts/deploy.sh"

# Env sync to Vercel (after env.template changes)
op run --env-file=.env.template -- ./infra/scripts/sync-env-to-vercel.sh

# Env sync to droplet (after env.template changes)
op run --env-file=.env.template -- ./infra/scripts/sync-env-to-droplet.sh --remote
```

These are the only sanctioned entrypoints. Anything else is a deviation — flag to operator.

---

## 3. The 6 gates (HOP A wrapper)

| # | Gate | Purpose | Source of truth |
|---|---|---|---|
| 1 | branch-sync | Local development = origin/development | `git rev-parse` |
| 2 | ci-green | All 14 required GH Actions success on SHA | `gh run list --commit $SHA` |
| 3 | vercel-ready | smartout-web + smartout-landing READY for SHA | Vercel API `v6/deployments` |
| 4 | ff-possible | preview ancestor of development | `git merge-base --is-ancestor` |
| 5 | smoke-probe | preview surfaces respond | `infra/scripts/smoke-probe.sh preview` |
| 6 | lkg-tag | tag SHA as `lkg-preview-<short>`, push | `git tag` + `git push origin tag` |

Stage 1 (gates 1–4) lives in `~/.claude/scripts/promote-preview.sh` (global, shared across projects).
Stages 2–3 (gates 5–6) live in `infra/scripts/promote-preview.sh` (repo, Smartout-specific).
The repo wrapper calls the global script, then runs Stage 2–3.

---

## 4. Required CI checks (14)

Original 11 (since 2026-04-20):
- Format Check
- Lint
- Type Check
- Vitest (packages)
- Build Health
- Build
- API Docs Go-Live Guard
- Docker Build (stage-engine)
- Docker Build (shift-mcp)
- Docker Build (contract-service)
- Docker Build (scrapling)

Added 2026-05-03 per ADR-0265 (operator must flip via GH UI):
- Enforce branch flow (pipeline-enforcement.yml)
- pgTAP Suites (pgtap.yml)
- authority-seed-parity (authority-seed-parity.yml)

Not required (deliberately):
- AI Eval (golden-transcripts) — only on packages/ai + services/stage-engine paths
- Edge Functions (new in ADR-0265) — only on supabase/functions paths
- Migration State (new in ADR-0265) — only on main push

Required checks live on rulesets:
- main: `14797822`
- preview: `15290760`
- development: `15290763` (deliberately bare — only deletion + non_fast_forward)

---

## 5. Skills inventory

### Owned by deploy-conductor (load every session)

| Skill | Path | Role |
|---|---|---|
| `deploying` | `~/.claude/skills/deploying/SKILL.md` | Runbook + curated learnings + ADR-0265 enforcement section |

### Loaded on trigger

| Skill | Path | Trigger |
|---|---|---|
| `secrets-protocol` | `.claude/skills/secrets-protocol/SKILL.md` | Token, vault, env-var changes |
| `smartout-edge-function-guide` | `.claude/skills/smartout-edge-function-guide/SKILL.md` | EF deploy, config.toml, verify_jwt |
| `smartout-database-guide` | `.claude/skills/smartout-database-guide/SKILL.md` | Migration drift, MIGRATIONS_FAILED |
| `post-merge-verify` | `~/.claude/skills/post-merge-verify/SKILL.md` | After every merge into dev or preview |
| `adr-contract-audit` | `~/.claude/skills/adr-contract-audit/SKILL.md` | Weekly compliance OR drift-check passes but feels off |
| `git-cleanup` | `~/.claude/skills/git-cleanup/SKILL.md` | Pipeline gap > 200 commits before promote |
| `preflight` | `~/.claude/skills/preflight/SKILL.md` | Before dispatching parallel verifiers |

### Awareness-only (mention, don't load)

| Skill | Why awareness only |
|---|---|
| `botsson-harness-builder` | Builds capabilities; deploy-conductor doesn't build code |
| `walkai-bridge-builder` | Same |
| `frontend-designer` | Same |
| `run-council` | Architectural review, not deploy review |

---

## 6. Scripts inventory

### Repo (versioned, edit via PR)

| Script | Purpose | LKG-tested 2026-05-03 |
|---|---|---|
| `infra/scripts/promote-preview.sh` | HOP A wrapper, 3 stages | ✅ syntax + smoke green |
| `infra/scripts/smoke-probe.sh` | Post-deploy reachability | ✅ prod green --skip-droplet |
| `infra/scripts/drift-check.sh` | 4-channel parity | ✅ green on baseline 64 |
| `infra/scripts/sync-env-to-vercel.sh` | NUKE-AND-REPLACE Vercel env | last sync 2026-05-06 (per memory) |
| `infra/scripts/sync-env-to-droplet.sh` | Droplet env via SSH | called by deploy.sh |
| `infra/scripts/deploy.sh` | Droplet pull+rebuild | called by Pontus on main merge |
| `infra/scripts/health-check.sh` | Droplet 6-service health | called by deploy.sh and smoke-probe |
| `infra/scripts/setup.sh` | Droplet first-time bootstrap | run-once |
| `infra/scripts/start.sh` | Local infra docker compose with op env | dev convenience |
| `infra/scripts/backup.sh` + `backup-cron.sh` | Droplet backups | cron on droplet |
| `scripts/setup-vault.sh` | Bootstrap 1Password from env.template | run on new vars |

### Global (~/.claude/scripts, shared across projects)

| Script | Purpose |
|---|---|
| `promote-preview.sh` | 4-gate FF executor (Stage 1 of repo wrapper) |
| `log-activity.sh` | Append to second-brain activity-log |
| `heartbeat-notify.sh` | Telegram + file + email-draft channels |
| `new-feature.sh` | Create sortie worktree |

---

## 7. CI workflows

| File | Triggers | Required? |
|---|---|---|
| `ci.yml` | push + PR on main/dev/preview | YES (11 of its 11 jobs) |
| `pipeline-enforcement.yml` | PR on main/preview | will be required after ADR-0265 flip |
| `pgtap.yml` | PR on main/dev/preview, paths `supabase/**` | will be required after ADR-0265 flip |
| `authority-seed-parity.yml` | PR + push on dev | will be required after ADR-0265 flip |
| `ai-eval.yml` | PR on `packages/ai/**` + `services/stage-engine/**` | NOT required (path-scoped) |
| `claude.yml` | manual | not deploy-related |
| `claude-code-review.yml` | PR labeled review | not deploy-related |

`ci.yml` jobs (after ADR-0265 unmerged additions):
- lint, typecheck, format, vitest, build-health, build, api-docs-go-live-guard
- docker-build (4 services in matrix)
- harness-invariants
- **edge-functions** (NEW, ADR-0265)
- **migration-state** (NEW, main-push only, ADR-0265)

---

## 8. Hooks (project)

| Hook | Type | Purpose |
|---|---|---|
| `.husky/pre-commit` | git pre-commit | 13 secret patterns, ADR-collision, branch-guard, page-polish, ORIENTATION-anchor, SESSION.md-resurrection-block, lint-staged |
| `.husky/pre-push` | git pre-push | preview FF-ancestry check, full lint, full typecheck |
| `.husky/commit-msg` | git commit-msg | commitlint conventional + 100-char header limit + kebab scope |
| `.claude/hooks/typecheck.sh` | PostToolUse | Per-package scoped typecheck after Edit/Write |
| `.claude/hooks/skill-trigger-reminder.sh` | UserPromptSubmit | Reminds to load skills on domain triggers |
| `.claude/hooks/contract-e2e-memory-write.sh` | Stop | Logs contract E2E orchestration state |

---

## 9. Vault architecture (secrets-protocol)

```
1Password
├── smartout_ai          (legacy name = dev vault)
│   ├── localhost URLs, dev/test keys
│   ├── "Supabase Preview Branch" item (Branch DB credentials)
│   ├── "Vercel" item (API token, credential field) — used by promote-preview Gate 3
│   └── "PostgreSQL preview" item (Branch DB connection string)
└── smartout_ai_prod
    ├── production URLs (*.smartout.ai)
    ├── live keys (Stripe live, SendGrid prod, etc.)
    ├── "Vercel" item — mirror of dev vault token (per two-vault rule)
    ├── "Supabase" item (prod URL, anon, service_role)
    └── droplet service credentials (n8n, Stage-Engine prod, livekit)
```

**HARD RULE:** dev vault has localhost URLs. NEVER use it for Vercel production-targeted vars except Supabase Preview Branch.

---

## 10. Activity-log convention

Every deploy event MUST be logged to `~/dev/second-brain-v2/ops/activity-log.md` via:

```bash
~/.claude/scripts/log-activity.sh <source> <actor> "<message>"
```

Sources used by deploy-conductor:
- `git` — promote-preview, FF push, tag push
- `system` — drift-check, audit results
- `migration` — Supabase migration state changes

Actor:
- `pontus` — Pontus initiated
- `claude` — agent performed
- `system` — automated hook

---

## 11. ADRs that govern deploy

| ADR | Status | Subject |
|---|---|---|
| 0020 | accepted | Vercel hosting strategy |
| 0039 | accepted | workspace-api gateway (replaces standalone EFs) |
| 0055 | superseded by 0071 | (old vault-naming) |
| 0071 | accepted | Preview environment architecture (3-branch pipeline) |
| 0072 | accepted | Vercel multi-service rejected (bounds Vercel surface) |
| 0186 | accepted | Guardian bus pg-notify (telemetry across stage-engine) |
| 0189 | accepted | Authority-seed-parity (CI gate) |
| 0190 | accepted | Cascade-gate-write entity-type-coverage (CI gate) |
| 0213 | accepted | Campaign branches must merge-commit, never squash |
| 0265 | accepted (2026-05-03) | Enforced deployment pipeline |

When in doubt about a behavior, check the ADR that governs it.

---

## 12. Where docs live

| Doc | Purpose |
|---|---|
| `docs/protocols/DEPLOYMENT.md` | Static topology + 14 hard rules (updated 2026-05-04) |
| `docs/protocols/ENV_PROTOCOL.md` | 506 lines, env-var lifecycle |
| `docs/protocols/SECURITY.md` | Three Laws + vault naming |
| `docs/journeys/JOURNEY-enforce-pipeline.md` | 3 flows: HOP A, HOP B, drift response |
| `docs/journeys/archive/JOURNEY-deployment-pipeline.md` | Original release flow (archived 2026-05-04, superseded) |
| `docs/decisions/0265-enforced-deployment-pipeline.md` | ADR-0265 full text |
| `docs/HANDOFF-enforce-pipeline.md` | Sortie wt-4 close-out + operator follow-up |
| `~/.claude/skills/deploying/SKILL.md` | Runbook + curated learnings |
| `.claude/agents/deploy-conductor/` | This bundle |

---

## 14. Telegram-tap protocol (ADR-0271 §2 pending)

ADR-0271 status: `pending` (until first successful /deploy validates).

Mechanism: Telegram inline button → n8n webhook (`op://smartout_ai/n8n/deploy-tap-webhook-url`) → GitHub API `gh pr merge` with explicit `--subject "[deploy]"` for tag propagation per L-0190.

State persistence: `.deploy-state.json` at repo root (`.gitignored`). Schema: `pr_number`, `branch_db_id`, `invocation_sha`, `started_at`, `step`. Cleaned on /deploy step 20.

Operative from: Task 5.1 onward. Sub-specs §§1-6 are live instructions for deploy-conductor even while ADR is `pending`. Status transitions to `accepted` via separate ADR-update commit after first successful run logged in RUNS.md.

Break-glass: if `DEPLOY_TAP_WEBHOOK_URL` not provisioned, agent must NOT send /deploy step 11 Telegram message. Refuse and tell operator: "Telegram-tap mechanism not provisioned. /deploy step 11 cannot fire. Provision URL or run HOP A + HOP B manually."

Concurrency guard: refuse `/deploy` invocation if `.deploy-state.json` exists with live `branch_db_id`. Operator must run `/deploy cleanup` or teardown before re-invoking.

Re-entry: if Claude session interrupted post-tap (steps 14-20), re-invocation reads `.deploy-state.json`, detects `step >= post-merge`, routes to PLAYBOOK Scenario G.

---

## 13. Self-learning loop — RUNS.md + curation

After every triggering run (see `./deploy-conductor.md` § "Reflection Protocol" for full trigger list), execute the four-step loop:

1. **Append entry to `./deploy-conductor/RUNS.md`** — exact format mandatory. Minimum: timestamp, scenario letter, gates table, drift/smoke/CI snapshot, outcome paragraph, Learnings line(s), curation summary, activity-log mirror.
2. **Update `./deploy-conductor/STATE.md`** for any changed numbers (last LKG tag, pipeline gap, EF count, drift baseline). Update `last-verified:` timestamp.
3. **Curate upward** if Learnings include NEW recurring (≥ 2 RUNS entries with same finding) → propose addition to `~/.claude/skills/deploying/SKILL.md`. STALE → edit in place. DUPLICATE → consolidate. CONFIRMED → no action.
4. **Write activity-log entry** via `~/.claude/scripts/log-activity.sh` mirroring the RUNS.md outcome.

Pattern detection after ≥ 5 runs: same gate failing → propose ROADMAP phase adjustment. Same drift recurring → propose new check. Same boundary-hit recurring → confirm with operator before softening.

The loop is the self-learning mechanism. Skipping = its own NEW learning (audited on next run).
