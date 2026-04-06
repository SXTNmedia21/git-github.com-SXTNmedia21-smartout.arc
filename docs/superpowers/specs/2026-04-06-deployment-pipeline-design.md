---
title: "Deployment Pipeline & Branch Strategy"
status: review
updated: 2026-04-06
created: 2026-04-06
module: cross-cutting
tags: [deployment, git, vercel, supabase, infrastructure, 1password]
---

# Deployment Pipeline & Branch Strategy

## Problem Statement

Current deployment is broken due to:

1. 1,311-commit gap between `development` and `main` with no release process
2. No pre-production verification — code goes from local dev straight to production
3. `contract-service` Dockerfile broken (`@smartout/utils` import path mismatch)
4. Env vars manually managed on DigitalOcean droplet via fragile symlink
5. 86 `CREATE INDEX` statements without `IF NOT EXISTS` risk Supabase Cloud/branching failures
6. `database.types.ts` was gitignored and 29 days stale (now tracked in git, regenerated)
7. `NEXT_PUBLIC_LIVEKIT_URL` missing from Vercel sync manifest
8. Vercel sync script hardcodes `gitBranch: 'development'` for preview — needs update for preview branch

### Clarified: Secrets NOT in git history

Council audit confirmed: `services/stage-engine/.env` and `.env.local` were **never committed** to git. Both are covered by `.gitignore`. No credential rotation or git history cleanup is needed. Files exist on disk for local dev only.

## Architecture

### Git Branch Flow

```
feat/* ──merge──→ development ──merge──→ preview ──PR──→ main
                      │                     │              │
                   Local dev            Staging          Production
```

| Branch        | Purpose                     | Merges from           | Deploy trigger                          |
| ------------- | --------------------------- | --------------------- | --------------------------------------- |
| `feat/*`      | Feature work in worktrees   | —                     | None                                    |
| `development` | Integration, all new code   | feat/\* branches      | None (no Vercel deploy)                 |
| `preview`     | Pre-production verification | development           | Vercel Preview + Supabase Branch DB     |
| `main`        | Production                  | preview (via PR only) | Vercel Production + Supabase Production |

**Hotfix fast-track:** `feat/hotfix-* → preview → main` (skip development). Mandatory backport to development after merge.

### Environment Matrix

| Environment  | Branch        | Supabase                   | Env vars                                                  | Vercel                |
| ------------ | ------------- | -------------------------- | --------------------------------------------------------- | --------------------- |
| Development  | `development` | Local (docker)             | `op run --env-file=.env.template` → `smartout_ai` vault   | None                  |
| Preview      | `preview`     | Branch DB (auto, isolated) | Supabase-Vercel integration (auto)                        | Preview deployment    |
| Production   | `main`        | Cloud (live)               | `sync-env-to-vercel.sh` → `smartout_ai_prod` vault        | Production deployment |
| DigitalOcean | `main`        | Cloud (live)               | `sync-env-to-droplet.sh` (new) → `smartout_ai_prod` vault | N/A (Docker)          |

### Accepted Asymmetry: Docker Services Have No Preview

Stage Engine (5010), Shift MCP (5011), Contract Service (5012), and Scrapling (8000) run on DigitalOcean, pinned to `main`. There is no preview tier for Docker services.

**Consequences:**

- Preview Vercel deployment + Supabase Branch DB gives isolated database testing
- But `ENGINE_URL`, `SCRAPLING_SERVICE_URL`, and other service URLs in preview point to **production Docker services**
- Agent features (Stage Engine), schedule features (Shift MCP), contract features, and scraping are tested against production services in preview
- This is an accepted limitation. Full Docker preview would require a second droplet or container orchestration — not justified at current scale

**Mitigation:**

- Docker services are stateless request handlers — they read/write to whatever Supabase they're pointed at
- The Vercel preview app uses Branch DB credentials, so even though it hits production Stage Engine, the Stage Engine's Supabase client uses its own (production) credentials — no cross-contamination of DB data
- Pure web features (UI, routing, components) get full preview isolation
- Agent/service features should be tested locally before pushing to preview

### Supabase Branching (already configured)

- GitHub integration active: `SXTNmedia21/smartout.ai`
- Production branch: `main`
- Automatic branching: ON (all PRs, not just Supabase changes)
- Branch limit: 3
- On PR `preview → main`: Supabase creates isolated branch-DB, runs pending migrations, injects credentials into Vercel preview

### Branch DB Seed Strategy

Supabase Branch DBs replay all migrations from scratch but contain **no seed data**. This means empty tables for: `engine_missions`, `engine_stages`, `engine_authority_config`, `platform_api_key`, `agent_profile`, `service_config`.

**Strategy:** Create `supabase/seed-preview.sql` containing minimal test data:

- 1 test workspace + company + admin user
- Core engine_missions and engine_stages for onboarding flow
- Default engine_authority_config entries
- 1 test platform_api_key (test mode)
- Default service_config entries

This seed runs automatically if configured in Supabase Dashboard under "Branch settings", or manually via `psql` after branch creation.

### Go/No-Go Gate: Vault in Branch DBs

**MUST verify before Phase 2:** Do Supabase Branch DBs support `supabase_vault` / `pgsodium`? 55 migrations use `SECURITY DEFINER` functions, and Edge Functions call `get_secret()` RPC.

**Test:** Create a test PR to `main`, wait for branch-DB, then:

```sql
SELECT * FROM vault.secrets LIMIT 1;
SELECT get_secret('test-key');
```

If Vault is unavailable in branch DBs:

- Edge Functions using `get_secret()` will fail in preview
- Fallback: secrets.ts env-var fallback path handles this for Docker services
- Web app Edge Functions need `SECURITY DEFINER` functions to degrade gracefully
- Document as known limitation if Vault is unsupported

### 1Password Service Account

Required for CI/CD automation. Replaces interactive `eval "$(op signin)"`.

| Use case                | Current                                         | After                                         |
| ----------------------- | ----------------------------------------------- | --------------------------------------------- |
| Local dev               | `op run --env-file=.env.template` (interactive) | Same (no change)                              |
| Vercel env sync         | `eval "$(op signin)"` then run script           | Service account token                         |
| DigitalOcean env sync   | Manual `.env` file on droplet                   | `sync-env-to-droplet.sh` with service account |
| GitHub Actions (future) | N/A                                             | Service account for gated releases            |

Setup: Create in 1Password Admin Console → "Service Accounts" → grant read access to `smartout_ai` and `smartout_ai_prod` vaults.

### Vault Naming — Supersedes ADR-0055

ADR-0055 defined vault names `smartout_dev` / `smartout_prod`. Actual vaults in use (code + scripts + 1Password):

| Vault              | Environment | Used everywhere                              |
| ------------------ | ----------- | -------------------------------------------- |
| `smartout_ai`      | Dev/Preview | `.env.template`, sync script preview entries |
| `smartout_ai_prod` | Production  | sync script production entries               |

**Decision:** Keep `smartout_ai` / `smartout_ai_prod` (matches all existing code). Supersede ADR-0055 naming. Write new ADR to document.

## Implementation Plan

### Phase 0: Migration Idempotency (prerequisite)

86 `CREATE INDEX` statements lack `IF NOT EXISTS` guards. These risk failures during Supabase Branch DB creation (which replays all migrations).

Action: Create a single migration that wraps the 86 problematic indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_name ON table(column);
```

This is safe to run — `IF NOT EXISTS` is a no-op if the index already exists.

### Phase 1: Fix Broken Infrastructure (day 1)

#### 1.1 Fix contract-service Dockerfile

File: `services/contract-service/Dockerfile` lines 55-61

Problem: `packages/utils/package.json` has `"main": "src/index.ts"` but container only has `dist/`. The `sed` patch is fragile.

Fix: This is a separate task — isolate as its own PR. Add proper `exports` field to `packages/utils/package.json` with conditional exports for source (dev) and dist (prod). Verify no import breakage across monorepo.

#### 1.2 database.types.ts — now tracked in git

Done: Removed gitignore entry (line 71), regenerated from latest local migrations. 16,304 lines. Will be committed with this spec update.

#### 1.3 Add NEXT_PUBLIC_LIVEKIT_URL to Vercel manifest

Add to `infra/scripts/sync-env-to-vercel.sh`:

```
smartout-web|preview|NEXT_PUBLIC_LIVEKIT_URL|op://smartout_ai/livekit/wss-url|false
smartout-web|production|NEXT_PUBLIC_LIVEKIT_URL|op://smartout_ai_prod/livekit/wss-url|false
```

#### 1.4 Update Vercel sync script gitBranch

Current: hardcodes `gitBranch: 'development'` for preview environment.
Fix: Change to `gitBranch: 'preview'` after preview branch is created.

### Phase 2: Branch Architecture (days 2-3)

**Prerequisite:** Phase 3.1 (the big merge) must complete first. Preview branch forks from a merged, verified main.

#### 2.0 Go/no-go: Test Supabase Branching + Vault

Create a test PR against main. Verify:

- Branch DB creates successfully with all 250 migrations
- Vault extension works (`SELECT get_secret('test')`)
- Custom schemas exist (payroll, websites, timesheet)
- Edge Functions can reach branch DB

If Vault fails → document limitation, proceed without Vault in preview.
If migrations fail → fix blockers (Phase 0), retry.

#### 2.1 Create preview branch (AFTER big merge)

```bash
git checkout main          # main now has all development commits
git checkout -b preview
git push origin preview
```

#### 2.2 Configure Vercel

In Vercel Dashboard for `smartout-web`:

- Production Branch: `main` (already set)
- Preview branches: ensure `preview` triggers preview deployments
- Verify Supabase integration syncs env vars for preview deployments

For `smartout-landing`:

- Same configuration (already syncs Supabase vars)

#### 2.3 Set up 1Password Service Account

1. Go to 1Password Admin Console → Service Accounts
2. Create `smartout-ci` service account
3. Grant read access to `smartout_ai` vault (dev/preview)
4. Grant read access to `smartout_ai_prod` vault (production)
5. Store service account token securely (GitHub Secrets for future CI)
6. Test: `OP_SERVICE_ACCOUNT_TOKEN=<token> op read "op://smartout_ai/Supabase/url"`

#### 2.4 Create sync-env-to-droplet.sh

Mirror of `sync-env-to-vercel.sh` but targets DigitalOcean:

- Reads from `smartout_ai_prod` vault via 1Password Service Account
- Writes to `infra/.env` on the droplet via SSH
- Replaces fragile symlink approach
- Validates all required vars are present before writing

#### 2.5 Fix deploy.sh

Rewrite deploy script:

```bash
1. Branch check: abort if not on main
2. sync-env-to-droplet.sh (fetch latest secrets FIRST)
3. git pull origin main
4. docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
5. Health check with retry loop (max 120s, 5s intervals)
```

Replaces current `sleep 5` approach. Env sync BEFORE deploy prevents stale-credentials window.

#### 2.6 Create seed-preview.sql

Minimal seed for Branch DBs (see "Branch DB Seed Strategy" section above).

### Phase 3: First Release (days 4-5)

#### 3.1 The big merge

```bash
# Ensure main is up to date
git fetch origin main

# Merge main into development first (resolve any conflicts)
git checkout development
git merge origin/main --no-edit
git push origin development

# Merge development into main via PR
# Create PR: development → main (one-time catch-up)
# Review, verify Vercel preview, merge
```

This is a 1,311-commit merge. Expect conflicts in lock files and generated files. Resolution strategy:

- `pnpm-lock.yaml`: regenerate with `pnpm install`
- `database.types.ts`: keep development version (freshly generated)
- Other conflicts: keep development version (it's newer)

#### 3.2 Create preview branch (see Phase 2.1)

After 3.1 completes and main is verified.

#### 3.3 Clean up git

- Remove finished worktrees (verify which are actually stale first — don't assume)
- Delete stale remote branches already merged into development
- Decide on unmerged feature branches (park, merge, or close)

#### 3.4 Establish release cadence

- Weekly: merge development → preview (Monday)
- Review preview deployment (Monday-Tuesday)
- Merge preview → main (Wednesday) if green
- Hotfixes: `feat/hotfix-* → preview → main` (fast-track, backport to development after)

#### 3.5 Update CLAUDE.md

Add `preview` to Git Workflow section:

```markdown
### Branches

- `main` — production. Only from preview PRs.
- `preview` — pre-production staging. Merges from development only.
- `development` — integration branch, all features merge here
- `feat/short-description` — one branch per feature/task
- `feat/hotfix-*` — fast-track: preview → main, backport to development
```

## Verification Checklist

- [ ] Phase 0: 86 indexes wrapped with IF NOT EXISTS
- [ ] Phase 1.1: contract-service Dockerfile fixed (separate PR)
- [ ] Phase 1.2: database.types.ts tracked in git, freshly generated
- [ ] Phase 1.3: NEXT_PUBLIC_LIVEKIT_URL in Vercel manifest
- [ ] Phase 1.4: Vercel sync gitBranch updated
- [ ] Phase 2.0: Supabase Branching + Vault tested (go/no-go)
- [ ] Phase 2.1: `preview` branch exists on origin
- [ ] Phase 2.2: Vercel configured for preview deployments
- [ ] Phase 2.3: 1Password Service Account created and tested
- [ ] Phase 2.4: `sync-env-to-droplet.sh` works end-to-end
- [ ] Phase 2.5: `deploy.sh` rewritten with env sync + health polling
- [ ] Phase 2.6: seed-preview.sql created and tested
- [ ] Phase 3.1: development merged to main successfully
- [ ] Phase 3.3: Stale worktrees and branches cleaned up
- [ ] Phase 3.5: CLAUDE.md updated with preview branch rules
- [ ] ADR written: Preview Environment Architecture
- [ ] ADR written: Vault naming (supersedes ADR-0055)

## Risk Assessment

| Risk                                    | Severity | Mitigation                                                                       |
| --------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| Vault unavailable in branch DBs         | High     | Test in Phase 2.0. Fall back to env-var-only preview.                            |
| Preview hits production Docker services | Medium   | Accepted asymmetry. Services are stateless handlers. DB isolation via Branch DB. |
| Empty branch DB breaks preview testing  | Medium   | seed-preview.sql with minimal test data.                                         |
| 1,311-commit merge has conflicts        | Medium   | Resolve systematically: lockfiles regenerate, types keep dev version.            |
| Branch limit (3) exceeded               | Low      | Only preview→main PRs create branches. Close stale PRs.                          |
| Env var drift between preview/prod      | Low      | Parameterize sync script. CI check.                                              |

## Decisions Made

| Decision                                          | Rationale                                                | ADR needed         |
| ------------------------------------------------- | -------------------------------------------------------- | ------------------ |
| 3 branches (development → preview → main)         | Catches migration + runtime errors before production     | Yes                |
| No preview for Docker services                    | Accepted asymmetry — not justified at current scale      | Yes (same ADR)     |
| Track database.types.ts in git                    | Vercel builds need it; agents need it for typecheck      | No (operational)   |
| 1Password Service Account                         | Enables automation; removes human error from env sync    | No (operational)   |
| All PRs get branch-DB (not Supabase changes only) | Prevents preview from accidentally writing to production | No (config change) |
| Weekly release cadence                            | Prevents 1,311-commit gaps from recurring                | No (process)       |
| Vault names: smartout_ai / smartout_ai_prod       | Matches all existing code, supersedes ADR-0055           | Yes                |
| Hotfix fast-track: feat/hotfix → preview → main   | Production emergencies need < 3 hops                     | Yes (same ADR)     |
| Branch DB seed strategy                           | Empty schema insufficient for preview testing            | No (operational)   |
