---
title: "Pipeline Consolidation v2 Implementation Plan"
status: dispatch_ready
created: 2026-05-04
updated: 2026-05-04
module: cross-cutting
tags: [plan, pipeline, ci-cd, deployment, env-vars, autonomous-deploy, ephemeral-branch]
---

# Pipeline Consolidation v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **Context for executor:** Tidligere session brente ~150 NOK på Vercel-bygg pga manglende cost-gating. Stop-phrase gate er nå installert (commit `421a01555`), Supabase auto-deploy er av, persistent preview branch slettet. Pipelinen er TRYGG nå — denne planen bygger den ferdig.

**Goal:** Bygg en cost-aware autonom deploy-pipeline der `/deploy` orchestrerer hele kjeden fra dev → preview → main, med ephemeral Supabase branch DB, full E2E-validering, og 1-tap Telegram-approval som eneste operator-touchpoint.

**Architecture:** Tier-basert pipeline (Tier 0-8). Inhouse Docker pre-push fanger 80%+ av feil før GitHub. Vercel + EF deploys gates på `[deploy]` tag i commit-msg (ALLEREDE INSTALLERT). Supabase migrations gates på manuell `db push` eller dedikert CI-job. Preview branch DB ephemeral (create på `/deploy`, teardown etter). E2E mot preview blokkerer prod-merge. ADR-0265 hard rules respekteres — ingen force-push til main.

**Tech Stack:** Next.js 16, Supabase (Postgres 17 + Edge Functions + Branching), Vercel (3 projects: web/landing/pwa), GitHub Actions (14 required CI checks + 3 nye sikkerhetslag), Husky pre-push hook, Playwright E2E, Turborepo, pnpm 9.15, 1Password CLI.

---

## Done before executor starts (don't redo)

| Item | Commit/Action |
|---|---|
| `[deploy]` stop-phrase gate i 3 vercel.json + ci.yml edge-functions job | Commit `421a01555` (origin/development) |
| Supabase Cloud git integration disconnected (Deploy to production OFF) | Operator action via Dashboard |
| Supabase Automatic branching OFF | Operator action via Dashboard |
| Persistent preview branch `cibmhhgsrdmpnmcikalu` deleted | Operator action via Dashboard |
| Plan v1 (deploy-conductor's `PLAN-cost-aware-inhouse-pipeline.md`) | Committed `54eeea521` (superseded by this v2) |
| Phase 0 cleanup (102 NTFS Zone.Identifier + research-typo + rapport) | Commit `54eeea521` |

---

## Ground truth at plan time (verified 2026-05-04 02:30)

| Branch | SHA | Notes |
|---|---|---|
| `main` | `1f5bf4807` | Prod, urørt siden 2026-05-03 |
| `development` | `421a01555` | Stop-phrase gate live |
| `preview` | `efd817005` | Pre-stop-phrase, vil oppgraderes ved neste promote |

| Surface | State |
|---|---|
| Vercel auto-deploy | Gated på `[deploy]` (verified: 2/3 grønt på 421a01555, smartout-pwa hadde ERROR — **scoped out**: Phase 5 acceptance = smartout-web + smartout-landing READY; smartout-pwa state captured in handoff for separate sortie per P0-12) |
| Supabase Cloud auto-apply migrations | Av |
| Supabase preview branch | Slettet, må oppstå ephemeral via `/deploy` |
| 14 required CI checks | Aktive på main + preview rulesets |
| Edge Functions deploy | Gated på `[deploy]` på main push (CI) |

| Metric | Value |
|---|---|
| Migrations på dev | 492 (verifiser dynamisk via `ls supabase/migrations/*.sql \| wc -l`) |
| Edge Functions | 60 (vs prod 56) |
| Vercel projects | 3 (smartout-web, smartout-landing, smartout-pwa) |
| Apps med PWA-config | apps/mobile (PWA-deployed, IKKE EAS) |
| Apps uten Vercel-prosjekt | apps/admin (subroute av web) |

---

## Locked decisions (do not re-litigate)

- ⛔ Path D (force-push dev→main) AVVIST — bryter ADR-0265
- ✅ Stop-phrase via `[deploy]` tag = gate mechanism (installert)
- ✅ Ephemeral preview branch (create på `/deploy`, teardown etter)
- ✅ 1-tap Telegram approval som eneste operator-touchpoint i `/deploy`
- ✅ Vercel-prosjekter heter `smartout-*` (IKKE `smartout-ai-*`)
- ✅ Pre-push hook tiered: `pre-push-fast` (90s, alltid) + `pre-push-full` (5-10 min, opt-in)
- ✅ §4 env-var-governance flyttes til `docs/protocols/ENV_PROTOCOL.md`
- ✅ Phase 0 = lukket, ikke i denne planen
- ✅ Migrations IKKE auto-applyer — krever manuell `db push` eller eksplisitt CI-trigger
- ✅ ADR-0269+ (bubble-migration claimed 0266-0268 lokalt)

---

## Architecture diagram

```
┌──────────────────── Developer (Windows + WSL2 + Docker) ────────────────────┐
│                                                                              │
│  Tier 0 — IDE: TypeScript LSP, ESLint, Prettier (live)                      │
│  Tier 1 — Husky pre-commit: lint-staged + commitlint                        │
│  Tier 2 — Husky pre-push-fast: typecheck + affected-only test (~90s)        │
│  Tier 2b — Husky pre-push-full (opt-in): replay migrations + E2E (5-10 min) │
│  Tier 2c — gitleaks scan (pre-commit, blocks secrets)                       │
│                                                                              │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │ git push origin development
                                     ▼
┌──────────────────── GitHub (development branch) ────────────────────────────┐
│                                                                              │
│  Tier 3 — 14 required CI checks (existing) + 3 new security jobs            │
│           ├─ NEW: pnpm-audit --prod (high+ blocks)                          │
│           ├─ NEW: gitleaks CI (defense-in-depth)                            │
│           └─ NEW: CodeQL (weekly cron, informational)                       │
│                                                                              │
│  No Vercel preview deploy unless [deploy] in commit (cost saving)            │
│                                                                              │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │ /deploy command (operator-triggered)
                                     ▼
┌──────────────────── /deploy orchestration ──────────────────────────────────┐
│                                                                              │
│  1. Pre-flight: 14 CI green på development HEAD?                            │
│  2. Detect changed surfaces (apps/web, apps/landing, apps/mobile,           │
│     services/*, supabase/functions/*, supabase/migrations/*)                │
│  3. Spin ephemeral Supabase branch DB                                       │
│  4. Apply delta migrations (dev ahead of prod) til branch DB                │
│     (Branching forks parent schema; `db push` er delta only, IKKE 492+)     │
│  5. Apply seed.sql                                                           │
│  6. Sync Vercel preview env-vars til branch DB connection string            │
│  7. Auto-PR development → preview (FF) — Vercel deployer preview            │
│     (commit-msg auto-tagged [deploy])                                       │
│  8. Smoke preview (4/4 must pass)                                           │
│  9. E2E preview (Playwright full suite must pass)                           │
│  10. Auto-PR preview → main (template auto-filled)                          │
│  11. Telegram alert: "preview READY, tap to merge: [URL]"                   │
│  12. ⏸ OPERATOR TAP — single approval                                       │
│  13. Merge preview → main — OPERATOR TAP (see step 12)                      │
│      ⚠️  CRITICAL: must override merge subject:                              │
│      `gh pr merge <N> --merge --subject "chore(release): preview → main [deploy]"` │
│      Without explicit [deploy] subject all 3 Vercel prod deploys skip.      │
│  14. Vercel production deploy (3 projects, gated on [deploy] in merge commit)│
│  15. CI Edge Functions deploy (since [deploy])                              │
│  16. CI Migration State verifies prod tail                                  │
│  17. Manual: operator runs `supabase db push --linked` if migrations new    │
│  18. Smoke production (4/4 must pass)                                       │
│  19. If ANY step red → auto-rollback + Telegram alert                       │
│  20. Tag lkg-prod-<sha> + teardown ephemeral branch                         │
│  21. Telegram: "deploy complete, 14m32s"                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 34 fixes catalogued + 21 council-rework additions (2026-05-04 v2 rework)

> V2 rework applied 11 P0 + 5 P1 + 5 P2 = 21 additional fixes on top of original 34. Plan is now dispatch-ready. Items struck or scoped are noted inline.

### P0 — dispatch-blocking (original 10 + 2 new = 12 items)

| # | Fix | Source |
|---|---|---|
| 1 | `supabase db reset --linked=false` invalid → use `npx supabase db reset` (no flag) | Council + Sideagent D2 |
| 2 | `--project=local-stack` doesn't exist in playwright.config.ts → use `--project=web` or omit | Council + Sideagent D3 |
| 3 | Migration count 495 → 492 dynamic via `ls supabase/migrations/*.sql \| wc -l` | Council + Sideagent D10 |
| 4 | `_meta_migration_state_rpc` → actual name is `migration_state_latest` (file: `20260503174428_migration_state_latest_rpc.sql`) | Council |
| 5 | `--no-verify` claim wrong — ruleset 15290763 (development) bare; local `--no-verify` works; push-side rulesets enforce | Council |
| 6 | Phase 4 trigger `workflow_run` won't fire on Vercel deploys — use `deployment_status` event OR `repository_dispatch` from `/deploy` | Council + Sideagent D1 |
| 7 | Add Phase 1D — GitHub ruleset update (14797822 + 15290760) for new required checks. Without this, new checks are advisory only | Council + Sideagent D11 |
| 8 | Hard-gate Phase 3 (Branching) on Phase 1B (Branching availability verification) — sequential, not parallel | Council + Sideagent D4 |
| 9 | ADR-0266 collision risk — bubble-migration HANDOFF claims 0266-0268. Verify via `git log --all` + reallocate. Use 0269+ as buffer | Council |
| 10 | Mark `/deploy` step 13 (auto-merge to main) OPERATOR ACTION ONLY (1-tap Telegram per ADR-0265) | Council + Sideagent D12 |
| 11 | branch-db.sh live test step before Phase 5 dispatch — prevents first /deploy failing mid-flight. Cost: ~$0.03. | Council v2 rework |
| 12 | smartout-pwa ERROR explicitly scoped out (not silent deferral) — Phase 5 acceptance = smartout-web + smartout-landing; pwa = separate sortie handoff. | Council v2 rework |

### P1 — scope/blocker (10 items)

| # | Fix | Source |
|---|---|---|
| 11 | Sequence Phase 3 as 3a (verify Branching), 3b (write branch-db.sh), 3c (integrate /deploy), 3d (test + ADR-0270) | Council |
| 12 | Tier pre-push hook: `pre-push-fast` (90s, lint+typecheck+affected-only test) vs `pre-push-full` (5-10 min, replay+seed+E2E, opt-in via env-var) | Council + Sideagent D6 |
| 13 | gitleaks pre-commit hook: append to existing `.husky/pre-commit` (not replace) — preserves lint-staged | Council + Sideagent D7 |
| 14 | Phase 4 acceptance test set must define what passes/fails. Specify: 5 critical user flows (login, onboarding, schedule, contracts, helpdesk) × 4 roles (owner/admin/manager/employee) | Council |
| 15 | Add Gate 4.7 to `/deploy`: env-var sync before FF push. Prevents deploy with stale Vercel env (per drift-check) | Council |
| 16 | Move §4 (env-vars) UT av plan-doc til `docs/protocols/ENV_PROTOCOL.md`. Plan beholder kun reference + summary | Council + Sideagent G6 |
| 17 | `pnpm audit --prod` med allowlist for kjente false positives. Block kun high+ severity | Council |
| 18 | CodeQL workflow må inkludere Python (lovsen MCP services) ikke kun TypeScript | Council |
| 19 | CodeQL kjøres weekly cron, IKKE per push. Reduserer CI minutes | Council |
| 20 | Lag `infra/scripts/sync-ef-secrets.sh` — automatiserer 37 secrets × 63 EFs (i dag manuelt per `npx supabase secrets set`) | Council |

### P2 — polish + sideagent unique (14 items)

| # | Fix | Source |
|---|---|---|
| ~~21~~ | ~~K1a/K1b cascade verification i Phase 1.5~~ — **STRUCK (P0-1)**: category error. Env-vars do not touch K1a/K1b runtime intelligence. No cascade verification in pipeline doc. | ~~Council~~ |
| 22 | Dependabot config med grouping (samle patches, ikke 10 PRs/uke) | Council |
| 23 | Script location: `scripts/` (ikke `scripts/dev/`) per repo convention | Council |
| 24 | §4.2 title rename: "Four channels" → "Six channels" (matcher tabell-content) | Council + Sideagent D9 |
| 25 | §4.5 decommission flow for env-vars (per secrets-protocol mandate) | Council + Sideagent G4 |
| 26 | drift-check check 5 (NY) — `SKIP_INHOUSE_VALIDATE=1` activity-log entries siste 7 dager (alerter hvis bypass blir vane) | Council |
| 27 | D8 Wave 2 ordering risk: Phase 2 (pre-push hook) → Phase 3 (Branching) sekvensielt, ikke parallelt — concurrent edits til samme dev workflow gir friksjon | Sideagent D8 |
| 28 | G1 cost-estimate per pipeline-element: branch DB ($0.01344/hr), CodeQL minutes (~5 min/uke), Playwright preview (~2 min/promote), Dependabot (gratis). Add §6.5 with monthly cap | Sideagent G1 |
| 29 | G2 SKIP_INHOUSE_VALIDATE accountability: krev `SKIP_INHOUSE_VALIDATE_REASON="..."` env, hook logger til activity-log via `~/.claude/scripts/log-activity.sh` | Sideagent G2 |
| 30 | G3 Phase 3 rollback playbook: hva hvis branch-db spin feiler mid-promote? Vercel kan ende halv-pointed at branch-db, halv at prod | Sideagent G3 |
| 31 | G5 Metrics for "≥80% caught locally": pre-push hook emitter metric til local SQLite/jsonl, monthly heartbeat aggregerer pre-push-blocked / total-pushes | Sideagent G5 |
| 32 | G7 Turborepo `--filter=...[origin/development]` for affected-only test (kutter pre-push 5-10x på små diffs) | Sideagent G7 |
| 33 | G8 Add `*:Zone.Identifier` permanent til `.gitignore` (hindrer recurring problem) | Sideagent G8 |
| 34 | DEPLOYMENT.md update: apps/mobile er PWA via Vercel (IKKE EAS som DEPLOYMENT.md sier i dag) | Sideagent observation |

---

## Phases

### Phase 0: Already done (do not redo)

Verified at top of plan. Skip.

---

### Phase 1: Doc-truth + Security baseline (parallel-able)

#### Task 1.1: Update DEPLOYMENT.md (fix C1, C2, C4, C5, C6, fix #34)

**Files:**
- Modify: `docs/protocols/DEPLOYMENT.md`

**Step 1: Read current state**

Run: `cat docs/protocols/DEPLOYMENT.md | head -100`
Expected: See "11 status checks" claim på line 78 og motsigelse på line 97.

**Step 2: Apply edits**

Update følgende:
- Line 78: "11 status checks required" → "14 status checks required" (ADR-0265 F2)
- §4.x: Add reference til Migration State CI gate
- §3 reference: Add `infra/scripts/drift-check.sh` (4-channel parity)
- Line 51: "Vercel preview deploy: Manual" → "via `/deploy` command (autonomous)"
- "EF deploy manual" → "auto via CI on main push when commit has [deploy] tag"
- Surface table for `apps/mobile`: change "EAS / TestFlight" → "Vercel (PWA)"
- Add §6.x: Stop-phrase gate documentation (`[deploy]` tag in commit-msg)

**Step 3: Verify**

Run: `pnpm docs:validate` (if exists, otherwise `grep -c "11 status\|11 required" docs/protocols/DEPLOYMENT.md`)
Expected: 0

**Step 4: Commit**

```bash
git add docs/protocols/DEPLOYMENT.md
git commit -m "docs(deploy): update DEPLOYMENT.md to match 14 required + stop-phrase gate"
```

---

#### Task 1.2: Delete DEPLOYMENT-DASHBOARD.md (fix C3)

**Files:**
- Delete: `docs/protocols/DEPLOYMENT-DASHBOARD.md`

**Step 1: Verify file exists + ADR-0265 ordered deletion**

Run: `ls -la docs/protocols/DEPLOYMENT-DASHBOARD.md`
Expected: File exists (1119 bytes per session 2026-05-04).

**Step 2: Delete + commit**

```bash
git rm docs/protocols/DEPLOYMENT-DASHBOARD.md
git commit -m "docs(deploy): remove DEPLOYMENT-DASHBOARD.md per ADR-0265"
```

---

#### Task 1.3: Archive stale journey (fix C7)

**Files:**
- Move: `docs/journeys/JOURNEY-deployment-pipeline.md` → `docs/journeys/archive/`

**Step 1: Verify both journeys exist**

Run: `ls docs/journeys/JOURNEY-{deployment,enforce}-pipeline.md`
Expected: Both files listed.

**Step 2: Move + commit**

```bash
mkdir -p docs/journeys/archive
git mv docs/journeys/JOURNEY-deployment-pipeline.md docs/journeys/archive/
git commit -m "docs(deploy): archive JOURNEY-deployment-pipeline (superseded by JOURNEY-enforce-pipeline)"
```

---

#### Task 1.4: Mark stale .claude/ YAMLs deprecated (fix C8)

**Files:**
- Delete: `.claude/pipeline.yaml`
- Delete: `.claude/workflow-state.yaml`
- Delete: `.claude/decisions.yaml`

**Step 1: Verify all 3 exist**

Run: `ls -la .claude/{pipeline,workflow-state,decisions}.yaml`
Expected: All three files exist.

**Step 2: Delete (replaced by ADR-0075 architecture: DASHBOARD.md + activity-log + claude-mem)**

```bash
git rm .claude/pipeline.yaml .claude/workflow-state.yaml .claude/decisions.yaml
git commit -m "chore(deploy): remove stale .claude/ YAMLs (superseded by ADR-0075)"
```

---

#### Task 1.5: Add Zone.Identifier to .gitignore (fix #33 / G8)

**Files:**
- Modify: `.gitignore`

**Step 1: Add patterns**

Append to `.gitignore`:
```
# Windows NTFS Alternate Data Streams (Mark of the Web)
*:Zone.Identifier

# Python venv binaries (lovsen MCP services)
services/lovsen-*/.venv/

# Ephemeral deploy state (P2-3 — never commit these)
.branch-db-id
.branch-db-project-ref
.branch-db-env-backup.json
.deploy-state.json
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore Zone.Identifier + lovsen .venv + deploy state files"
```

---

#### Task 1.6: Add Dependabot config (fix #22 / Council P1)

**Files:**
- Create: `.github/dependabot.yml`

**Step 1: Write config**

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    groups:
      production:
        dependency-type: "production"
        update-types: ["minor", "patch"]
      development:
        dependency-type: "development"
        update-types: ["minor", "patch"]
    open-pull-requests-limit: 5
    labels: ["dependencies"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

**Step 2: Commit**

```bash
git add .github/dependabot.yml
git commit -m "chore(security): add Dependabot config with grouped updates"
```

---

#### Task 1.6b: Build pnpm audit allowlist (P1-3) — run BEFORE Task 1.7

**Step 1: Audit current production deps**

```bash
pnpm audit --prod --audit-level=high 2>&1 | tee /tmp/pnpm-audit-baseline.txt
```

**Step 2: Document known false positives**

Review output. For each high+ advisory that is a known false positive (e.g. dev-only transitive, already patched upstream, not exploitable in our context), document in a comment block in the `security.yml` workflow or in `docs/protocols/SECURITY.md` §"Known pnpm audit false positives".

If `pnpm` supports `--ignore-path` or advisory ignore flags, use them. Otherwise add `continue-on-error: true` to the audit step with a inline comment listing known advisories + why tolerated.

```yaml
# In security.yml pnpm-audit job:
- name: Audit production deps (high+ blocks)
  run: pnpm audit --prod --audit-level=high
  # Known false positives (as of 2026-05-04): none documented yet.
  # Add: continue-on-error: true + advisory IDs as they are catalogued.
```

**Step 3: Zero-error target**

Goal: `pnpm audit --prod --audit-level=high` exits 0 on `development` HEAD before Task 1.7 commit. If it does not, fix the vulnerable dep first (or explicitly document the tolerance with an expiry date).

---

#### Task 1.7-pre: Build gitleaks allowlist (P1-2) — run BEFORE wiring hook

**Files:**
- Create: `.gitleaks.toml`

**Step 1: Audit current dev HEAD for false positives**

```bash
# Install gitleaks first if needed: sudo apt install gitleaks OR brew install gitleaks
gitleaks protect --staged --redact -v 2>&1 | tee /tmp/gitleaks-audit.txt
```

**Step 2: For each false positive, add allowlist entry to `.gitleaks.toml`**

Common false positives in this repo:
- `docs/protocols/SECURITY.md` — contains example credential patterns (documentation)
- `apps/web/src/env.ts` — contains Zod schema with key names that match secret patterns
- `supabase/seed.sql` — may contain test UUIDs that match token patterns

```toml
# .gitleaks.toml — allowlist for known false positives
[allowlist]
description = "False positive patterns"
paths = [
  "docs/protocols/SECURITY.md",         # documentation, not secrets
  "apps/web/src/env.ts",                # Zod schema key names, not values
]
regexes = [
  "op://[a-zA-Z0-9_/-]+",              # 1Password op:// references are NOT secrets
]
```

Inventory actual false positives from `/tmp/gitleaks-audit.txt` and extend as needed. Log findings in `docs/protocols/SECURITY.md` §"Known gitleaks false positives".

**Step 3: Commit allowlist**

```bash
git add .gitleaks.toml
git commit -m "chore(security): gitleaks allowlist for false positives (op:// refs, doc patterns)"
```

---

#### Task 1.7: Add gitleaks (fix #13 / D7)

**Files:**
- Modify: `.husky/pre-commit` (APPEND, do not replace)
- Create: `.github/workflows/security.yml`

**Step 1: Append to existing .husky/pre-commit**

Read current `.husky/pre-commit` first. Then append:
```bash
# gitleaks pre-commit secret scan
if command -v gitleaks &> /dev/null; then
  gitleaks protect --staged --redact -v || {
    echo "❌ Secret detected by gitleaks"
    echo "Use git-secrets-handling skill if false positive"
    exit 1
  }
else
  echo "⚠️  gitleaks not installed locally. Install: brew install gitleaks (or apt install gitleaks)"
fi
```

**Step 2: Create .github/workflows/security.yml**

```yaml
name: Security Scan
on:
  pull_request:
    branches: [main, development, preview]
  push:
    branches: [main]

jobs:
  gitleaks:
    name: gitleaks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  pnpm-audit:
    name: pnpm audit (production)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Audit production deps (high+ blocks)
        run: pnpm audit --prod --audit-level=high
```

**Step 3: Commit**

```bash
git add .husky/pre-commit .github/workflows/security.yml
git commit -m "chore(security): add gitleaks + pnpm audit baseline"
```

---

#### Task 1.8: Add CodeQL workflow (fix #18, #19)

**Files:**
- Create: `.github/workflows/codeql.yml`

**Step 1: Write workflow**

```yaml
name: CodeQL
on:
  schedule:
    - cron: "0 3 * * 1" # Mondays 03:00 UTC (weekly, NOT per push)

jobs:
  analyze:
    name: Analyze (${{ matrix.language }})
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    strategy:
      fail-fast: false
      matrix:
        language: ["typescript", "python"]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

**Step 2: Commit**

```bash
git add .github/workflows/codeql.yml
git commit -m "chore(security): add CodeQL weekly cron (TypeScript + Python)"
```

---

#### Task 1.9: Update GitHub rulesets for new required checks (fix #7 / D11)

**Files:**
- N/A — operator action via `gh api`

**Step 1: Document in handoff with inline PATCH examples (P0-10 / P2-4)**

Create `docs/handoffs/HANDOFF-pipeline-v2-ruleset-update.md`:

```markdown
# OPERATOR ACTION REQUIRED: Update GitHub rulesets

After Phase 1 merges to development, run the PATCH below for each ruleset.

## Current required checks (verify first)

\`\`\`bash
gh api repos/SXTNmedia21/smartout.ai/rulesets/14797822 \
  --jq '.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context'
\`\`\`

## Add new checks — full PATCH payload (not append-only; must include ALL existing checks)

**Strategy:** Get current check list first, then PATCH with existing + new appended.

\`\`\`bash
# Step 1: Get current checks for ruleset 14797822 (main)
CURRENT=$(gh api repos/SXTNmedia21/smartout.ai/rulesets/14797822 \
  --jq '[.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context]')

# Step 2: Append new checks and PATCH
# Add: "gitleaks", "pnpm audit (production)"
gh api repos/SXTNmedia21/smartout.ai/rulesets/14797822 \
  --method PATCH \
  --input - <<EOF
{
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": $(echo "$CURRENT" | jq '. + ["gitleaks","pnpm audit (production)"] | map({"context":.})')
      }
    }
  ]
}
EOF

# Repeat for ruleset 15290760 (preview) — same pattern
\`\`\`

## Verify after PATCH

\`\`\`bash
gh api repos/SXTNmedia21/smartout.ai/rulesets/14797822 \
  --jq '.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context' \
  | grep -E 'gitleaks|pnpm'
# Expected: 2 lines
\`\`\`

Operator must do this manually — script-based ruleset modification needs explicit "kjør" auth per ADR-0265.
```

**Step 2: Commit**

```bash
git add docs/handoffs/HANDOFF-pipeline-v2-ruleset-update.md
git commit -m "docs(deploy): operator ruleset PATCH with inline JSON for Phase 1 new checks"
```

---

### Phase 1.5: Env-var ground truth audit (operator-collaborative)

> Pontus's eksplisitte ask. Adresserer plattform-bytter-kaoset (Bubble→Next.js, Vercel-routing, Supabase-migrasjoner). Output: `docs/audits/2026-05-04-env-var-baseline.md`.

#### Task 1.5.1: Inventarliste — alle env-vars som leses i kode

**Files:**
- Create: `docs/audits/2026-05-04-env-var-baseline.md`

**Step 1: Generate authoritative list**

```bash
{
  echo "# Code-side env-var inventory"
  echo ""
  echo "## process.env.* in TypeScript/JavaScript"
  grep -rn "process\.env\." apps packages services --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" 2>/dev/null \
    | grep -oE "process\.env\.[A-Z_]+" | sort -u
  echo ""
  echo "## Deno.env.get() in Edge Functions"
  grep -rn "Deno\.env\.get" supabase/functions --include="*.ts" 2>/dev/null \
    | grep -oE "Deno\.env\.get\([\"'][A-Z_]+[\"']\)" | sort -u
} > docs/audits/2026-05-04-env-var-baseline.md
```

**Step 2: Append manifests for comparison**

Append to baseline:
- Content of `.env.template` (op-refs)
- Content of `apps/web/src/env.ts` Zod schema (extract keys)
- Content of `infra/scripts/sync-env-to-vercel.sh` manifest
- Content of `infra/scripts/sync-env-to-droplet.sh` manifest

**Step 3: Commit baseline doc**

```bash
git add docs/audits/2026-05-04-env-var-baseline.md
git commit -m "docs(audit): env-var ground truth baseline 2026-05-04"
```

---

#### Task 1.5.2: Live-state audit per channel

**Operator action — requires:**
- Vercel API access (env vars per project per environment)
- Supabase Cloud access (Edge Function secrets)
- Droplet SSH (read `infra/.env`)
- 1Password CLI (vault contents — names only, NEVER values)

**Step 1: Document procedure (don't execute live audit in plan-execution session — separate operator session)**

Append to `docs/audits/2026-05-04-env-var-baseline.md`:

```markdown
## Live-state audit procedure

Operator runs:

\`\`\`bash
# 1. Vercel preview env keys
op run --env-file=.env.template -- bash -c 'curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/prj_CG6Gi7QE5jpz5fghbDUco16wG2ds/env?teamId=team_bbtw5JnNxRkKlecAKQB7qqzG&decrypt=false" \
  | jq -r ".envs[] | select(.target[]==\"preview\") | .key" | sort'

# 2. Vercel production env keys (same, target=production)
# 3. Edge Function secrets via Supabase MCP (mcp__supabase__list)
# 4. Droplet env keys: ssh droplet "grep -E '^[A-Z_]+=' /root/dev/smartout.ai/infra/.env | cut -d= -f1 | sort"
# 5. 1Password vault keys (names only)
\`\`\`

Compare each list to code-side inventory (top of doc). Tag each var:
- ✅ OK (all channels match intent)
- ⚠️ Drift (channels diverge, sync needed)
- 🟡 Stale (not in code, candidate for decommission)
- 🔥 Missing (in code, missing from one+ channels)
- ❓ Unknown (operator decides)
```

**Step 2: Commit**

```bash
git add docs/audits/2026-05-04-env-var-baseline.md
git commit -m "docs(audit): env-var live-state audit procedure"
```

---

### Phase 2: Pre-push hook tiered (fix #12, #29, #31, #32)

#### Task 2.1: Write pre-push-fast script

**Files:**
- Create: `scripts/pre-push-fast.sh`

**Step 1: Write script**

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "→ pre-push-fast (~90s budget)"

# Skip if SKIP_INHOUSE_VALIDATE=1 with REASON
if [ "${SKIP_INHOUSE_VALIDATE:-}" = "1" ]; then
  if [ -z "${SKIP_INHOUSE_VALIDATE_REASON:-}" ]; then
    echo "❌ SKIP_INHOUSE_VALIDATE requires SKIP_INHOUSE_VALIDATE_REASON='...' for accountability"
    exit 1
  fi
  echo "⚠️  pre-push-fast SKIPPED — reason: $SKIP_INHOUSE_VALIDATE_REASON"
  # Guard: only log if ~/.claude/scripts exists (prevents hard exit on machines without it — P2-1)
  if [ -f "${HOME}/.claude/scripts/log-activity.sh" ]; then
    "${HOME}/.claude/scripts/log-activity.sh" system claude "pre-push bypass: $SKIP_INHOUSE_VALIDATE_REASON"
  else
    echo "⚠️  Activity log skipped (${HOME}/.claude/scripts not found on this machine)"
  fi
  exit 0
fi

# Affected-only test via Turborepo
echo "→ Lint (affected only)"
pnpm turbo run lint --filter=...[origin/development]

echo "→ Typecheck (affected only)"
pnpm turbo run typecheck --filter=...[origin/development]

echo "→ Test (affected only)"
pnpm turbo run test --filter=...[origin/development]

# Metric emit
echo "{\"timestamp\":\"$(date -Iseconds)\",\"action\":\"pre-push-fast\",\"result\":\"pass\"}" >> .git/pre-push-metrics.jsonl

echo "✅ pre-push-fast passed"
```

**Step 2: Make executable + commit**

```bash
chmod +x scripts/pre-push-fast.sh
git add scripts/pre-push-fast.sh
git commit -m "feat(pre-push): tier 2 fast hook (90s, affected-only test)"
```

---

#### Task 2.2: Write pre-push-full script (opt-in)

**Files:**
- Create: `scripts/pre-push-full.sh`

**Step 1: Write script**

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "→ pre-push-full (5-10 min budget) — opt-in via INHOUSE_FULL=1"

if [ "${INHOUSE_FULL:-}" != "1" ]; then
  echo "ℹ️  pre-push-full skipped (set INHOUSE_FULL=1 to enable)"
  exit 0
fi

# Verify Docker Supabase up (auto-start)
if ! docker ps | grep -q supabase_db_smartout; then
  echo "→ Starting Supabase Local"
  npx supabase start
fi

# Replay all migrations + seed
echo "→ Reset DB + replay migrations + seed"
npx supabase db reset

# Full test suite (NOT affected-only)
echo "→ Full typecheck + test"
pnpm turbo run typecheck test

# E2E against local stack
echo "→ Playwright E2E (project=web)"
pnpm playwright test --project=web

echo "{\"timestamp\":\"$(date -Iseconds)\",\"action\":\"pre-push-full\",\"result\":\"pass\"}" >> .git/pre-push-metrics.jsonl

echo "✅ pre-push-full passed"
```

**Step 2: Make executable + commit**

```bash
chmod +x scripts/pre-push-full.sh
git add scripts/pre-push-full.sh
git commit -m "feat(pre-push): tier 2b full hook (opt-in via INHOUSE_FULL=1)"
```

---

#### Task 2.4: Add drift-check check 5 — SKIP_INHOUSE_VALIDATE alerter (P0-8)

**Files:**
- Modify: `infra/scripts/drift-check.sh`

**Step 1: Add check 5**

Append to `infra/scripts/drift-check.sh` after existing check 4:

```bash
# Check 5 (NEW per P0-8): SKIP_INHOUSE_VALIDATE bypass frequency
echo "→ Check 5: SKIP_INHOUSE_VALIDATE entries last 7 days"
SKIP_COUNT=0
ACTIVITY_LOG="$HOME/dev/second-brain-v2/ops/activity-log.md"
if [ -f "$ACTIVITY_LOG" ]; then
  SKIP_COUNT=$(grep -c "pre-push bypass" "$ACTIVITY_LOG" 2>/dev/null || echo 0)
  # Filter to last 7 days (grep by date range approximate)
  CUTOFF=$(date -d "7 days ago" "+%Y-%m-%d" 2>/dev/null || date -v-7d "+%Y-%m-%d")
  SKIP_COUNT=$(awk "/$CUTOFF/,0" "$ACTIVITY_LOG" | grep -c "pre-push bypass" || echo 0)
fi
if [ "$SKIP_COUNT" -gt 3 ]; then
  echo "DRIFT: check 5 — $SKIP_COUNT bypass entries in last 7 days (threshold: 3)"
  DRIFT_FOUND=1
fi
echo "  bypass-entries-7d: $SKIP_COUNT"
```

**Step 2: Commit**

```bash
git add infra/scripts/drift-check.sh
git commit -m "feat(deploy): drift-check check 5 — SKIP_INHOUSE_VALIDATE frequency alerter"
```

---

#### Task 2.3: Wire hooks into .husky/pre-push (P0-9)

**Files:**
- Modify: `.husky/pre-push`

**Decision (P0-9):** Keep existing `pnpm lint` + `pnpm typecheck` AND add `scripts/pre-push-fast.sh`. Belt-and-braces approach. Rationale: existing commands run full-monorepo typecheck (belt); `pre-push-fast.sh` adds affected-only test + metric emit + SKIP accountability (braces). Do NOT replace — removing full typecheck would create a gap where affected-only misses cross-package type breaks.

Trade-off explicitly: `pre-push-fast.sh` affected-only is faster but may miss cross-package type errors that the full typecheck catches. Accepting this tradeoff is intentional: CI Tier 3 is the backstop for cross-package breaks.

**Step 1: Read current .husky/pre-push first**

```bash
cat .husky/pre-push
```

**Step 2: Append to existing pre-push (AFTER existing protected-branch + pnpm lint + pnpm typecheck)**

```bash
# Tier 2b: tiered inhouse validation (pre-push-fast always, pre-push-full opt-in)
bash scripts/pre-push-fast.sh
bash scripts/pre-push-full.sh
```

**Step 3: Commit**

```bash
git add .husky/pre-push
git commit -m "feat(pre-push): wire tiered inhouse validation into husky (belt+braces)"
```

---

### Phase 3: Supabase Branching ephemeral lifecycle (fix #11, #30)

#### Task 3.1: Verify Branching availability (fix #8 hard-gate)

**Step 1: Operator verifies via Supabase Dashboard**

Document in `docs/handoffs/HANDOFF-pipeline-v2-branching.md`:
- Confirm Pro plan or higher (Branching available)
- Confirm Branching feature enabled in project `yljaglomadbhyqpcigff`
- If NO: STOP this phase, redraft with shared-DB fallback

**Step 2: Commit handoff**

```bash
git add docs/handoffs/HANDOFF-pipeline-v2-branching.md
git commit -m "docs(deploy): operator handoff for Branching availability check"
```

---

#### Task 3.2: Write branch-db.sh (orchestrates create/reset/seed/teardown)

**Files:**
- Create: `infra/scripts/branch-db.sh`

**Step 1: Write script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-create}"
PROJECT_REF="yljaglomadbhyqpcigff"
BRANCH_NAME="${2:-preview-ephemeral}"

case "$ACTION" in
  create)
    # Spin via Supabase Management API
    BRANCH_ID=$(curl -s -X POST \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"branch_name\":\"$BRANCH_NAME\"}" \
      "https://api.supabase.com/v1/projects/$PROJECT_REF/branches" \
      | jq -r '.id')
    echo "$BRANCH_ID" > .branch-db-id
    # Wait for ACTIVE_HEALTHY — 120s max timeout (P0-5)
    ELAPSED=0
    TIMEOUT=120
    until curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      "https://api.supabase.com/v1/branches/$BRANCH_ID" | jq -e '.preview_project_status == "ACTIVE_HEALTHY"' > /dev/null 2>&1; do
      sleep 5
      ELAPSED=$((ELAPSED + 5))
      if [ $ELAPSED -ge $TIMEOUT ]; then
        ~/.claude/scripts/heartbeat-notify.sh telegram "branch-db timeout after ${TIMEOUT}s — branch_id: $BRANCH_ID. Tearing down."
        curl -s -X DELETE -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
          "https://api.supabase.com/v1/branches/$BRANCH_ID"
        echo "ERROR: branch DB did not reach ACTIVE_HEALTHY within ${TIMEOUT}s"
        exit 1
      fi
    done
    # Apply seed
    BRANCH_PROJECT_REF=$(curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      "https://api.supabase.com/v1/branches/$BRANCH_ID" | jq -r '.project_ref')
    npx supabase --project-ref "$BRANCH_PROJECT_REF" db push --include-seed
    echo "$BRANCH_PROJECT_REF" > .branch-db-project-ref
    ;;

  teardown)
    BRANCH_ID=$(cat .branch-db-id 2>/dev/null || echo "")
    if [ -n "$BRANCH_ID" ]; then
      curl -s -X DELETE -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        "https://api.supabase.com/v1/branches/$BRANCH_ID"
      rm -f .branch-db-id .branch-db-project-ref
    fi
    ;;

  *)
    echo "Usage: $0 {create|teardown} [branch-name]"
    exit 1
    ;;
esac
```

**Step 2: Make executable + commit**

```bash
chmod +x infra/scripts/branch-db.sh
git add infra/scripts/branch-db.sh
git commit -m "feat(deploy): branch-db.sh — ephemeral Supabase branch lifecycle"
```

**Step 3: Live test against Supabase Management API (P0-11) — run before Phase 5 dispatch**

```bash
# Cost: ~$0.01-0.03. Without this, first /deploy fails mid-flight.
op run --env-file=.env.template -- bash infra/scripts/branch-db.sh create "test-$(date +%s)"
# Verify ACTIVE_HEALTHY reached (script exits 0 if yes, 1 if timeout)
echo "branch-db-id: $(cat .branch-db-id)"
echo "branch-db-project-ref: $(cat .branch-db-project-ref)"
# Teardown immediately after verification
op run --env-file=.env.template -- bash infra/scripts/branch-db.sh teardown
# Verify files cleaned up
ls -la .branch-db-id .branch-db-project-ref 2>&1 || echo "Clean — files removed"
```

Expected: create exits 0 with valid UUID in `.branch-db-id`, teardown exits 0, files removed. If timeout fires → check `SUPABASE_ACCESS_TOKEN` scope (needs `projects.branches:write`).

---

#### Task 3.2b: Write sync-branch-db-env.sh (P0-4)

**Files:**
- Create: `infra/scripts/sync-branch-db-env.sh`

Syncs Vercel preview environment to point at the ephemeral branch DB connection string. Saves previous values for teardown revert.

**Step 1: Write script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# sync-branch-db-env.sh — swap Vercel preview env to ephemeral branch DB
# Usage: sync-branch-db-env.sh {apply|revert}
#   apply  — reads .branch-db-project-ref, patches Vercel preview env-vars
#   revert — restores env-vars from .branch-db-env-backup.json

ACTION="${1:-apply}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID_WEB}"       # from op run context
VERCEL_TEAM_ID="${VERCEL_TEAM_ID}"                 # from op run context
BACKUP_FILE=".branch-db-env-backup.json"

case "$ACTION" in
  apply)
    BRANCH_REF=$(cat .branch-db-project-ref 2>/dev/null || { echo "No .branch-db-project-ref"; exit 1; })
    BRANCH_DB_URL="postgresql://postgres:...@db.${BRANCH_REF}.supabase.co:5432/postgres"
    # NOTE: actual connection string fetched from Supabase Management API
    BRANCH_DB_URL=$(curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      "https://api.supabase.com/v1/projects/${BRANCH_REF}" | jq -r '.db_host' | \
      xargs -I {} echo "postgresql://postgres:${SUPABASE_DB_PASSWORD}@{}:5432/postgres")

    # Backup current preview value
    curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
      "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}&target=preview" \
      | jq '[.envs[] | select(.key | startswith("SUPABASE_") or startswith("DATABASE_"))]' \
      > "$BACKUP_FILE"
    echo "Backup saved to $BACKUP_FILE"

    # Patch SUPABASE_DB_URL for preview target
    ENV_ID=$(jq -r '.[] | select(.key=="DATABASE_URL") | .id' "$BACKUP_FILE")
    if [ -n "$ENV_ID" ]; then
      curl -s -X PATCH \
        -H "Authorization: Bearer $VERCEL_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"value\":\"${BRANCH_DB_URL}\",\"target\":[\"preview\"]}" \
        "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${ENV_ID}?teamId=${VERCEL_TEAM_ID}"
      echo "Vercel preview DATABASE_URL updated to branch DB"
    else
      echo "WARNING: DATABASE_URL env-var not found in Vercel preview — check manifest"
    fi
    ;;

  revert)
    if [ ! -f "$BACKUP_FILE" ]; then
      echo "No backup file found — cannot revert"
      exit 1
    fi
    echo "Restoring Vercel preview env from $BACKUP_FILE"
    jq -c '.[]' "$BACKUP_FILE" | while read -r var; do
      ENV_ID=$(echo "$var" | jq -r '.id')
      ORIG_VALUE=$(echo "$var" | jq -r '.value')
      curl -s -X PATCH \
        -H "Authorization: Bearer $VERCEL_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"value\":\"${ORIG_VALUE}\"}" \
        "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${ENV_ID}?teamId=${VERCEL_TEAM_ID}"
    done
    rm -f "$BACKUP_FILE"
    echo "Vercel preview env restored to production values"
    ;;

  *)
    echo "Usage: $0 {apply|revert}"
    exit 1
    ;;
esac
```

> Note: `SUPABASE_DB_PASSWORD` is not exposed via Management API. **OPERATOR-DECISION**: either store branch DB password in 1Password as `op://smartout_ai/supabase-branch-db/password` (rotates per branch), or use the connection string from branch creation API response directly. Document chosen approach in ADR-0271 §2 addendum.

**Step 2: Make executable + commit**

```bash
chmod +x infra/scripts/sync-branch-db-env.sh
git add infra/scripts/sync-branch-db-env.sh
git commit -m "feat(deploy): sync-branch-db-env.sh — patch Vercel preview to ephemeral branch DB"
```

---

#### Task 3.3: Write rollback playbook (fix #30 / G3)

**Files:**
- Create: `docs/playbooks/PLAYBOOK-deploy-rollback.md`

**Step 1: Document rollback per failure mode**

```markdown
# Deploy Rollback Playbook

## Failure: branch-db spin fails mid-promote

Symptoms: `infra/scripts/branch-db.sh create` exits non-zero.

Recovery:
1. Run `infra/scripts/branch-db.sh teardown` (idempotent)
2. Vercel preview env-vars NOT yet updated (Gate 4.7 happens after)
3. No prod impact

## Failure: Vercel preview deploy fails

Symptoms: Vercel API reports deployment state ERROR.

Recovery:
1. branch-db is up but unused — teardown
2. Inspect build logs via Vercel dashboard
3. Fix code, re-run /deploy

## Failure: E2E preview red

Symptoms: e2e-preview.yml fails.

Recovery:
1. /deploy stops (does not auto-PR to main)
2. Telegram alert with failing test names
3. Fix code on development, re-run /deploy

## Failure: Production smoke red after main merge

Symptoms: smoke-probe production reports non-200 on critical surfaces.

Recovery:
1. Vercel rollback to lkg-prod-<previous-sha> tag (auto if configured)
2. Telegram alert
3. Investigate via Sentry + Vercel logs
```

**Step 2: Commit**

```bash
git add docs/playbooks/PLAYBOOK-deploy-rollback.md
git commit -m "docs(deploy): rollback playbook per failure mode"
```

---

#### Task 3.4: Draft ADR-0270 (Ephemeral preview branch lifecycle)

**Files:**
- Create: `docs/decisions/0270-ephemeral-preview-branch-lifecycle.md`

**Step 1: Write ADR (status: proposed)**

Use template per `docs/templates/decision.md`. Key sections:
- Context: persistent branch cost ($10/mo) + accumulated state risk
- Decision: ephemeral pattern via `branch-db.sh create/teardown`
- Consequences: lower cost, fresh state per /deploy, requires Branching enabled

**Step 2: Register in decision log + commit**

```bash
# Register in docs/decisions/0000-decision-log.md
git add docs/decisions/0270-ephemeral-preview-branch-lifecycle.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr): ADR-0270 ephemeral preview branch lifecycle (proposed)"
```

---

### Phase 4: E2E mot preview (fix #6, #14)

> **GATE (P0-6):** Phase 4 cannot be dispatched until `PREVIEW_E2E_KEY` is provisioned. See Task 4.0 below.

#### Task 4.0: Provision PREVIEW_E2E_KEY (P0-6) — OPERATOR-ACTION

`PREVIEW_E2E_KEY` authenticates E2E runner against Vercel preview deployment (bypasses Vercel deployment protection). This is a **Vercel Protection Bypass token**.

**Decision:** Use Vercel's built-in `x-vercel-protection-bypass` header mechanism.

**OPERATOR steps (run once before Task 4.2 dispatch):**

1. Generate bypass secret:
   ```bash
   openssl rand -hex 32
   ```
2. Add to Vercel project settings → Protection Bypass for Automation (for `smartout-web` project).
3. Store in 1Password: `op://smartout_ai/preview-e2e-key/password`
4. Add to `.env.template`:
   ```
   PREVIEW_E2E_KEY=op://smartout_ai/preview-e2e-key/password
   ```
5. Add to GitHub Actions secrets: `PREVIEW_E2E_KEY`
6. Add to `apps/web/src/env.ts` server schema (optional — only needed if server-side).

**Verification:** `grep PREVIEW_E2E_KEY .env.template` must return 1 line.

**Used in e2e-preview.yml** (Task 4.2) as `${{ secrets.PREVIEW_E2E_KEY }}` → passed as `x-vercel-protection-bypass` header in Playwright config.

---

#### Task 4.1: Verify Playwright config has `web` project

**Files:**
- Read: `apps/e2e/playwright.config.ts`

**Step 1: Confirm projects**

Run: `grep -A 2 "name:" apps/e2e/playwright.config.ts | head -20`
Expected: `landing`, `web`, `mobile`, `mobile-pwa` (no `local-stack` per fix #2)

If `web` project missing, add it before continuing.

---

#### Task 4.2: Create e2e-preview.yml workflow

**Files:**
- Create: `.github/workflows/e2e-preview.yml`

**Step 1: Write workflow using deployment_status (fix #6)**

```yaml
name: E2E Preview
on:
  deployment_status:

jobs:
  e2e:
    if: github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'preview'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium
      - name: Run E2E against preview deploy
        env:
          PREVIEW_URL: ${{ github.event.deployment_status.target_url }}
          PREVIEW_API_KEY: ${{ secrets.PREVIEW_E2E_KEY }}
        run: pnpm playwright test --project=web
      - name: Upload report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/e2e/playwright-report/
          retention-days: 7
```

**Step 2: Commit**

```bash
git add .github/workflows/e2e-preview.yml
git commit -m "feat(e2e): preview deploy E2E via deployment_status trigger"
```

---

#### Task 4.3: Define E2E acceptance criteria (fix #14)

**Files:**
- Create: `docs/acceptance/E2E-PREVIEW-CRITERIA.md`

**Step 1: Document required test coverage**

```markdown
# E2E Preview Acceptance Criteria

For a preview deploy to be promoted to main, ALL of these must pass:

## Critical user flows (5)
1. Login (email + password)
2. Onboarding wizard completion (10 sections)
3. Schedule creation (admin role)
4. Contract send + sign flow
5. Helpdesk thread creation + reply

## Per role coverage (4)
- Owner
- Admin
- Manager
- Employee

## Total: 5 flows × 4 roles = 20 test cases minimum

## Performance budgets
- Login → dashboard: < 3s
- Onboarding step transition: < 1s
- Schedule render (50 shifts): < 2s

## Failure tolerance
- 0 failures on critical flows
- Up to 5% flake-rate acceptable on Tier 2 tests (informational)
```

**Step 2: Commit**

```bash
git add docs/acceptance/E2E-PREVIEW-CRITERIA.md
git commit -m "docs(e2e): define preview acceptance criteria (5 flows × 4 roles)"
```

---

### Phase 5: Autonomous /deploy command (fix #10, all of §3 architecture)

#### Task 5.1: Write /deploy slash-command spec

**Files:**
- Create: `.claude/commands/deploy.md`

**Step 1: Write command spec**

```markdown
---
description: Autonomous deploy from development → preview → main with 1-tap approval
---

# /deploy

Triggers full pipeline:

1. Pre-flight: 14 CI green på development HEAD?
2. Detect changed surfaces (apps/*, services/*, supabase/*)
3. Spin ephemeral Supabase branch DB via `infra/scripts/branch-db.sh create`
4. Apply migrations + seed
5. Sync Vercel preview env-vars to branch DB
6. FF dev → preview (auto-tag commit-msg with [deploy])
7. Vercel deploys preview
8. Smoke preview (4/4)
9. E2E preview (per E2E-PREVIEW-CRITERIA.md)
10. Auto-PR preview → main (template auto-filled)
11. Telegram: "preview READY, tap to merge: <URL>"
12. ⏸ OPERATOR TAP via Telegram
13. Merge preview → main — OPERATOR-ONLY, 1-tap via Telegram
    ⚠️ CRITICAL: n8n webhook MUST override merge commit subject:
    `{"merge_method":"merge","commit_title":"chore(release): preview → main [deploy]"}`
    Without [deploy] in merge commit subject, all 3 Vercel prod deploys silently skip.
    Verification after merge: `gh api repos/SXTNmedia21/smartout.ai/commits/HEAD --jq '.commit.message' | grep -c '\[deploy\]'` must return 1.
14. Vercel production deploy (3 projects, gated on [deploy] in merge commit)
15. CI EF deploy (gated on [deploy])
16. Operator runs `supabase db push --linked` if migrations new
17. Smoke production (4/4)
18. Tag lkg-prod-<sha> + teardown ephemeral branch + delete .deploy-state.json
19. Telegram: success or failure with actionable info

If any gate red → auto-rollback (Vercel traffic only, per ADR-0265) + Telegram alert.

Operator-only: step 13 (1-tap merge to main).
```

**Step 2: Commit**

```bash
git add .claude/commands/deploy.md
git commit -m "feat(deploy): /deploy slash-command spec (autonomous + 1-tap)"
```

---

#### Task 5.2: Draft ADR-0271 (Autonomous /deploy)

**Files:**
- Create: `docs/decisions/0271-autonomous-deploy-command.md`

**Step 1: Write ADR**

Status: `pending` (transitions to `accepted` after first successful `/deploy` run, per operator confirmation).

Key sections:
- Context: manual /promote-preview + manual PR-merge = 2 operator touchpoints, error-prone
- Decision: 1 operator trigger (`/deploy`) + 1 operator tap (Telegram) = full lifecycle
- ADR-0265 hard rule preserved (operator approves prod merge)

**Required sub-specs (include as §§ inside ADR-0271 body):**

**§1 Execution model:**
`/deploy` slash-command invokes `deploy-conductor` agent (Claude Code session), which calls `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh` for HOP A and `gh pr create ... | gh pr merge ...` for HOP B. No standalone shell script — the agent owns orchestration, scripts own individual steps. Rationale: agent handles retry-logic, per-gate reporting, and state persistence that a shell script cannot span across human pauses.

**§2 Tap handshake contract:**
n8n webhook at `https://n8n.smartout.ai/webhook/<uuid>` receives Telegram inline-button callback. n8n credential holds GitHub PAT (scope: `repo`). n8n calls `POST /repos/SXTNmedia21/smartout.ai/pulls/<N>/merge` with body `{"merge_method":"merge","commit_title":"chore(release): preview → main [deploy]"}`. On success n8n posts confirmation to Telegram + calls `~/.claude/scripts/heartbeat-notify.sh file "tap-confirmed: PR#<N>"`.
**OPERATOR-DECISION:** n8n webhook UUID must be provisioned by operator. Add to `.env.template` as `DEPLOY_TAP_WEBHOOK_URL=op://smartout_ai/n8n/deploy-tap-webhook-url`. Break-glass: operator runs `gh pr merge <N> --merge --subject "chore(release): preview → main [deploy]"` from terminal (documented in `docs/playbooks/PLAYBOOK-deploy-rollback.md`).

**§3 State persistence schema:**
`.deploy-state.json` (gitignored) — fields:
```json
{
  "pr_number": 0,
  "branch_db_id": "",
  "branch_db_project_ref": "",
  "invocation_sha": "",
  "started_at": "",
  "step": ""
}
```
Written by agent at each gate transition. Allows recovery if agent session interrupted.

**§4 TTL + timeout:**
Operator tap deadline = 6 hours (working day). If `.deploy-state.json` `started_at` + 6h elapsed without merge, n8n cron fires teardown: calls `infra/scripts/branch-db.sh teardown`, deletes `.deploy-state.json`, posts Telegram alert "deploy window expired — branch DB torn down, re-run /deploy to restart".

**§5 Rollback scope:**
Rollback = Vercel traffic promotion to prior deployment (via Vercel API `POST /v9/projects/<id>/promote`). NOT git revert. Per ADR-0265 hard rule. Git state is NOT reverted — operator decides if code rollback needed separately. Deploy conductor proposes, operator confirms.

**§6 Concurrency guard:**
On `/deploy` invocation, agent checks for `.deploy-state.json`. If exists AND `branch_db_id` non-empty, agent refuses with: "Deploy already in flight (started_at: <ts>, step: <step>). Run `rm .deploy-state.json` and re-run if previous deploy is abandoned." Never silently overwrite.

**Step 2: Commit**

```bash
git add docs/decisions/0271-autonomous-deploy-command.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr): ADR-0271 autonomous /deploy with 1-tap approval (pending)"
```

---

#### Task 5.3: Write ADR-0265 → ADR-0271 transition handoff (P2-5)

**Files:**
- Create: `docs/handoffs/HANDOFF-pipeline-adr0265-to-adr0271-transition.md`

One-page runbook for operator covering the gap period between "ADR-0265 installed" and "ADR-0271 first successful /deploy":

```markdown
# ADR-0265 → ADR-0271 Transition Runbook

## Status
- ADR-0265: ACCEPTED (enforced pipeline, stop-phrase gate, HOP A/B)
- ADR-0271: PENDING (autonomous /deploy, 1-tap approval)

## What works NOW (ADR-0265 only)
- `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh` for HOP A
- `gh pr create --base main --head preview --template preview-to-main.md` for HOP B
- Vercel gated on [deploy] tag
- 14 required CI checks on main + preview rulesets

## What is NOT yet wired (ADR-0271 pending)
- /deploy slash-command: not dispatched yet (Phase 5 of this plan)
- n8n tap webhook: OPERATOR-DECISION required (DEPLOY_TAP_WEBHOOK_URL)
- branch-db.sh: written in Phase 3 but live test in Task 3.2 Step 3
- PREVIEW_E2E_KEY: OPERATOR-ACTION in Task 4.0

## Operator actions before first /deploy
1. Task 4.0: provision PREVIEW_E2E_KEY (30 min)
2. ADR-0271 §2: provision n8n webhook + DEPLOY_TAP_WEBHOOK_URL in 1Password (20 min)
3. Task 3.2 Step 3: live test branch-db.sh create + teardown (5 min + $0.03)
4. Task 1.9: PATCH GitHub rulesets to add gitleaks + pnpm-audit required checks (10 min)

## Break-glass (if n8n tap fails)
Run from terminal: `gh pr merge <N> --merge --subject "chore(release): preview → main [deploy]"`
```

```bash
git add docs/handoffs/HANDOFF-pipeline-adr0265-to-adr0271-transition.md
git commit -m "docs(deploy): ADR-0265→0271 transition runbook for operator"
```

---

### Phase 6: Capture knowledge (4 learnings + ADR-0269 + council log)

#### Task 6.1a: Write L-0186 — Renumber Pattern as hard rule

**File:** `docs/learnings/0186-renumber-pattern-as-hard-rule.md`

**L-0186 (5th occurrence):** Multiple parallel sessions claim ADR numbers locally without pushing. Solution: always verify via `git log --all` AND check pending sortie handoffs before allocating. Buffer = take next + 3. Cross-link: ADR-0266 collision (bubble-migration), ADR-0262→0265 renumber, payroll 0260-0261, lovsen 0256-0259, kanaler 0160-0163.

```bash
git add docs/learnings/0186-renumber-pattern-as-hard-rule.md docs/learnings/0000-learning-log.md
git commit -m "docs(learnings): L-0186 renumber pattern as hard rule (5th occurrence)"
```

---

#### Task 6.1b: Write L-0187 — Wall-clock divergence as quality signal

**File:** `docs/learnings/0187-wall-clock-divergence-quality-signal.md`

**L-0187:** Original plan estimated 4-5h. Council + sideagent surfaced 34 fixes that pushed real estimate to 2-3 days. Divergence > 5x = red flag the original author scoped only happy path. Any plan estimate with divergence > 5x must trigger mandatory second-reviewer before dispatch.

```bash
git add docs/learnings/0187-wall-clock-divergence-quality-signal.md docs/learnings/0000-learning-log.md
git commit -m "docs(learnings): L-0187 wall-clock divergence as quality signal"
```

---

#### Task 6.1c: Write L-0188 — Asymmetric reviewer coverage

**File:** `docs/learnings/0188-asymmetric-reviewer-coverage.md`

**L-0188 (demoted from "load-bearing" per P1-5):** Council caught 7 unique items sideagent missed. Sideagent caught 10 unique items council missed. Asymmetric coverage = observation, not a formal rule yet. If pattern recurs in next 2+ councils, promote to formal requirement. Cross-link: Gate-Client Wave 2 council (same pattern observed).

```bash
git add docs/learnings/0188-asymmetric-reviewer-coverage.md docs/learnings/0000-learning-log.md
git commit -m "docs(learnings): L-0188 asymmetric reviewer coverage (observational)"
```

---

#### Task 6.1d: Write L-0189 — Plan-on-plan staleness

**File:** `docs/learnings/0189-plan-on-plan-staleness.md`

**L-0189:** Plan v1 referenced "next session will commit/push" steps that became stale within hours. Future plans: mark all steps requiring operator-side action with `OPERATOR-ACTION` tag in-line. Makes staleness obvious on re-read. Applied to this v2 plan.

```bash
git add docs/learnings/0189-plan-on-plan-staleness.md docs/learnings/0000-learning-log.md
git commit -m "docs(learnings): L-0189 plan-on-plan staleness pattern"
```

---

#### Task 6.1e: Write new learnings L-0190, L-0191, L-0192 (council-added)

**Files:**
- `docs/learnings/0190-deploy-tag-merge-subject-override.md`
- `docs/learnings/0191-slash-command-external-state-machine.md`
- `docs/learnings/0192-council-chair-single-chair-insufficient.md`

**L-0190:** `[deploy]` tag does not propagate through `gh pr merge --merge` default subject. Must override with explicit `--subject "chore(release): preview → main [deploy]"`. Consequence: all 3 Vercel prod deploys silently skip without explicit subject. Cross-link: ADR-0265.

**L-0191:** Slash-command workflows >10min wall-time require external state machine (n8n webhook, state file, GitHub Actions continuation). Single-shot slash-commands cannot span human pauses. `/deploy` uses `.deploy-state.json` + n8n webhook to bridge the operator-tap pause. Cross-link: ADR-0271.

**L-0192 (5th documented chair self-reversal in System Council):** Chair-meta-blockers + code-tracer-mechanics-blockers both required for plans touching multiple subsystems. Single-chair Phase 3 structurally insufficient. Cross-link: L-0147.

```bash
git add docs/learnings/0190-*.md docs/learnings/0191-*.md docs/learnings/0192-*.md docs/learnings/0000-learning-log.md
git commit -m "docs(learnings): L-0190..L-0192 deploy-tag, state-machine, council-chair patterns"
```

---

#### Task 6.2: Draft ADR-0269 (Pre-PR Quality Gate Architecture)

**Files:**
- Create: `docs/decisions/0269-pre-pr-quality-gate-architecture.md`

**Step 1: Write ADR**

Key sections:
- Context: pre-PR quality var ad hoc, no formal architecture
- Decision: Tier 0-3 architecture (IDE → pre-commit → pre-push-fast → pre-push-full → CI) med eksplisitt cost/feedback budgett per tier
- Consequences: GitHub CI green direkte (~80% av tiden), Vercel-credits brent kun ved /deploy

**Step 2: Commit**

```bash
git add docs/decisions/0269-pre-pr-quality-gate-architecture.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr): ADR-0269 pre-PR quality gate architecture (proposed)"
```

---

#### Task 6.3: Append council log entry

**Files:**
- Modify: `docs/council/COUNCIL-LOG.md`

**Step 1: Append entry**

```markdown
## 2026-05-04: Pipeline consolidation v2 review

**Reviewers:** Steward (chair, opus), Supervisor (opus), Security/CI Specialist (sonnet), independent sideagent (sonnet)

**Verdict:** REJECT v1 — REWRITE BEFORE DISPATCH. 24 council fixes + 10 sideagent fixes = 34 total.

**Outcome:** This plan (v2) incorporates all 34 fixes. Phase 0 (cleanup) already closed. Phases 1-6 ready for execution.

**Cross-pollination value:** Asymmetric reviewer coverage caught issues neither set saw alone (see L-0188).
```

**Step 2: Commit**

```bash
git add docs/council/COUNCIL-LOG.md
git commit -m "docs(council): log 2026-05-04 pipeline-v2 review verdict"
```

---

## Acceptance criteria — Done definition

This pipeline is "100% validated" when ALL of these are true:

1. ✅ All Phase 1 tasks merged to development (doc-truth + security baseline)
2. ✅ Phase 1.5 env-var baseline committed + reviewed by operator
3. ✅ Phase 2 pre-push hooks installed + tested (3 scenarios pass)
4. ✅ Phase 3 branch-db.sh works end-to-end (create + teardown)
5. ✅ Phase 4 e2e-preview.yml triggers on preview deploy
6. ✅ Phase 5 /deploy command runs full lifecycle once successfully
7. ✅ ADR-0269/0270/0271 all merged (status: accepted after first successful /deploy)
8. ✅ 7 learnings registered (L-0186..L-0192)
9. ✅ Council log entry appended
10. ✅ Operator runs /deploy → 1 Telegram tap → production live + smoke green
11. ✅ Next push to development WITHOUT [deploy] → 0 Vercel builds (verified via deployment list)
12. ✅ Drift-check reports 0 drift across all 4 channels (5 channels including new check 5)
13. ✅ Rulesets 14797822 (main) + 15290760 (preview) verified to require gitleaks + pnpm-audit checks via:
    ```bash
    gh api repos/SXTNmedia21/smartout.ai/rulesets/14797822 --jq '.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context' | grep -E 'gitleaks|pnpm'
    gh api repos/SXTNmedia21/smartout.ai/rulesets/15290760 --jq '.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context' | grep -E 'gitleaks|pnpm'
    ```
    Both commands must return at least 2 lines.

---

## Skill orchestration

| Skill | Used in phase |
|---|---|
| `worktree` | Plan execution worktree setup |
| `dispatching-parallel-agents` | Phase 1 task dispatch (Tasks 1.1-1.9 mostly independent) |
| `verification-before-completion` | Each task completion |
| `linear-protocol` | Issue per phase, 👀 → 📌 → ✅ |
| `secrets-protocol` | Phase 1.5, Task 1.7 |
| `smartout-edge-function-guide` | Task 5.1 (deploy command) |
| `deploying` | Reference runbook |
| `deploy-conductor` agent | Phase 5 execution + verification |

---

## Open questions for operator

| # | Question | Default if unanswered |
|---|---|---|
| Q1 | GHAS push-protection cost ($49/user/mo)? | Use gitleaks-only (free) |
| Q2 | 18-doc archive scope from rapport — separate sortie? | Linear ticket, not blocking |
| Q3 | 30-agent parallel session ADR — codify? | Linear ticket, not blocking |
| Q4 | Branch DB shared vs per-developer? | Shared (single ephemeral, cost-aware) |
| Q5 | Webhook testing (Stripe, DocuSeal) on preview? | Out of scope this sortie |
| Q6 | E2E required immediately or after stability period? | Informational 2 weeks → required |
| Q7 | Mobile (PWA) E2E coverage scope? | Tier 2 (informational) initially |

---

## Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Branching not on Pontus's plan | Low (Pro plan confirmed) | Phase 3a verifies; fallback = shared preview DB |
| Pre-push hook adds friction (>3 min) | Medium | Tiered architecture; SKIP_REASON override |
| E2E flakiness blocks preview→main PR | Medium | Mark informational first 2 weeks |
| New CI jobs flaky | Low | Mark informational first week, then required |
| ADR collision (third instance) | Medium | This plan reserves 0269/0270/0271; Sirena verifies before commit |
| Branch DB cost overrun | Low | Ephemeral pattern + teardown after each /deploy = ~$0.03/cycle |

---

## Related

- ADR-0265 — Enforced Deployment Pipeline (parent)
- ADR-0213 — Campaign PRs use merge-commit not squash
- ADR-0075 — Knowledge System Consolidation
- ADR-0269 (proposed in this plan)
- ADR-0270 (proposed in this plan)
- ADR-0271 (proposed in this plan)
- `docs/audits/2026-05-03-git-deploy-orchestration-map.md` — verified state inventory
- `docs/plans/PLAN-cost-aware-inhouse-pipeline.md` — superseded by this plan
- `~/.claude/skills/deploying/SKILL.md` — runbook
- `.claude/agents/deploy-conductor/` — operational executor
