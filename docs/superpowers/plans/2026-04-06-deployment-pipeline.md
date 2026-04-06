# Deployment Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a 3-branch git flow (development → preview → main) with Supabase Branch DBs, automated env sync, and a working release process.

**Architecture:** Preview branch triggers Vercel preview + Supabase Branch DB. DigitalOcean Docker services stay pinned to main (accepted asymmetry). 1Password Service Account replaces manual env management.

**Tech Stack:** Git, Vercel (Pro), Supabase (Pro + Branching), 1Password CLI/Service Accounts, Docker Compose, Bash

**Spec:** `docs/superpowers/specs/2026-04-06-deployment-pipeline-design.md`

---

## File Map

| Action  | File                                                        | Responsibility                                                        |
| ------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Create  | `supabase/migrations/YYYYMMDDHHMMSS_idempotent_indexes.sql` | Add IF NOT EXISTS to 86 bare indexes                                  |
| Modify  | `infra/scripts/sync-env-to-vercel.sh:124,139`               | Change gitBranch from 'development' to 'preview'                      |
| Modify  | `infra/scripts/sync-env-to-vercel.sh` (manifest)            | Add NEXT_PUBLIC_LIVEKIT_URL entries                                   |
| Rewrite | `infra/scripts/deploy.sh`                                   | Branch pin, env sync, health polling                                  |
| Rewrite | `infra/scripts/health-check.sh`                             | Retry loop with backoff                                               |
| Create  | `infra/scripts/sync-env-to-droplet.sh`                      | 1Password → DigitalOcean SSH env sync                                 |
| Create  | `supabase/seed-preview.sql`                                 | Minimal seed for Branch DBs                                           |
| Modify  | `~/.claude/CLAUDE.md` (Git Workflow section)                | Add preview branch rules                                              |
| Delete  | `docs/DEPLOYMENT.md`                                        | Superseded by pipeline spec + deploying skill                         |
| Delete  | `docs/DEPLOY-RUNBOOK-infra-prod.md`                         | Superseded — documents pre-merge problem, not solution                |
| Modify  | `docs/protocols/SECURITY.md`                                | Add preview env, vault naming, migration idempotency, service account |
| Modify  | `docs/protocols/ENV_PROTOCOL.md`                            | Add service account section, preview env vars                         |
| Modify  | `docs/INDEX.md`                                             | Add ENV_PROTOCOL + AUTH_SECURITY entries                              |
| Modify  | `docs/decisions/0055-two-vault-environment-isolation.md`    | Mark superseded                                                       |

---

## Task 1: Migration Idempotency — Wrap 86 Bare Indexes

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_idempotent_indexes.sql`

This migration re-creates all 86 indexes with `IF NOT EXISTS`. It's safe — idempotent on existing DBs, and prevents failures on Supabase Branch DBs which replay all migrations.

- [ ] **Step 1: Generate the migration file**

```bash
# Get list of all CREATE INDEX without IF NOT EXISTS
grep -rn "CREATE INDEX" supabase/migrations/ | grep -v "IF NOT EXISTS" | grep -v "CREATE INDEX CONCURRENTLY"
```

Review the output. Each line shows a migration file and the index statement.

- [ ] **Step 2: Create the idempotent wrapper migration**

Create `supabase/migrations/20260406120000_idempotent_indexes.sql`.

For each of the 86 bare `CREATE INDEX` statements found in Step 1, add an equivalent `CREATE INDEX IF NOT EXISTS` statement. The pattern is:

```sql
-- Idempotent index re-creation
-- These indexes were originally created without IF NOT EXISTS guards.
-- This migration ensures they can be safely replayed on Supabase Branch DBs.

-- From 00006_notification_engine.sql
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON public.notification_outbox(status);

-- From 20260310150000_workspace_note.sql
CREATE INDEX IF NOT EXISTS idx_workspace_note_workspace ON public.workspace_note(workspace_id);

-- ... continue for all 86 indexes
```

Extract the exact index name, table, and column(s) from each original migration. Do NOT modify the original migrations — only add the new wrapper.

- [ ] **Step 3: Test locally**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260406120000_idempotent_indexes.sql
```

Expected: all 86 statements succeed (no errors, some "already exists" notices are fine).

- [ ] **Step 4: Regenerate types (no schema changes expected, but verify)**

```bash
npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260406120000_idempotent_indexes.sql packages/supabase/src/database.types.ts
git commit -m "fix(db): add IF NOT EXISTS guards to 86 bare indexes

Prevents Supabase Branch DB creation failures when replaying
all migrations from scratch.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add NEXT_PUBLIC_LIVEKIT_URL to Vercel Manifest

**Files:**

- Modify: `infra/scripts/sync-env-to-vercel.sh` (manifest section)

- [ ] **Step 1: Find the manifest section**

Open `infra/scripts/sync-env-to-vercel.sh` and find the `MANIFEST=` block. Look for where other `NEXT_PUBLIC_*` preview/production entries are defined.

- [ ] **Step 2: Add LiveKit entries**

Add these two lines to the manifest (next to other NEXT_PUBLIC entries):

```
smartout-web|preview|NEXT_PUBLIC_LIVEKIT_URL|op://smartout_ai/livekit/wss-url|false
smartout-web|production|NEXT_PUBLIC_LIVEKIT_URL|op://smartout_ai_prod/livekit/wss-url|false
```

- [ ] **Step 3: Verify no duplicates**

```bash
grep "LIVEKIT" infra/scripts/sync-env-to-vercel.sh
```

Expected: exactly 2 lines (the ones you just added).

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/sync-env-to-vercel.sh
git commit -m "fix(infra): add NEXT_PUBLIC_LIVEKIT_URL to Vercel sync manifest

LiveKit WebSocket URL was missing from preview and production
environments, causing voice features to fail after deployment.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Rewrite deploy.sh with Branch Pin + Health Polling

**Files:**

- Rewrite: `infra/scripts/deploy.sh`
- Rewrite: `infra/scripts/health-check.sh`

- [ ] **Step 1: Rewrite deploy.sh**

Replace the full content of `infra/scripts/deploy.sh` with:

```bash
#!/bin/bash
# ============================================
# deploy.sh — Pull latest code, sync env, rebuild, verify
# Run on the DigitalOcean Droplet.
# Connected to: infra/docker-compose.yml + docker-compose.prod.yml
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$INFRA_DIR")"

echo "=== Smartout Deploy ==="
echo "Repo: $REPO_DIR"
echo "Infra: $INFRA_DIR"
echo ""

# Step 0: Verify we're on main
cd "$REPO_DIR"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERROR: Droplet must be on main branch. Current: $CURRENT_BRANCH"
  echo "Run: git checkout main"
  exit 1
fi

# Step 1: Sync env vars from 1Password (if script exists and OP is available)
if [ -f "$SCRIPT_DIR/sync-env-to-droplet.sh" ]; then
  echo "Syncing environment variables..."
  "$SCRIPT_DIR/sync-env-to-droplet.sh" || {
    echo "WARNING: Env sync failed. Continuing with existing .env"
  }
else
  echo "SKIP: sync-env-to-droplet.sh not found. Using existing .env"
fi

# Step 2: Pull latest code
echo "Pulling latest code from main..."
git pull origin main

# Step 3: Rebuild and restart services
cd "$INFRA_DIR"
echo "Rebuilding and restarting..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Step 4: Health check with retry
echo "Waiting for services to become healthy..."
"$SCRIPT_DIR/health-check.sh" --retry

echo ""
echo "=== Deploy complete ==="
```

- [ ] **Step 2: Rewrite health-check.sh with retry support**

Replace the full content of `infra/scripts/health-check.sh` with:

```bash
#!/bin/bash
# ============================================
# health-check.sh — Ping all service health endpoints
# Run after deploy or to verify stack health.
# Usage: health-check.sh [--retry]
#   --retry: poll up to 120s with 5s intervals
# Connected to: infra/docker-compose.yml (service definitions)
# ============================================

set -euo pipefail

RETRY_MODE=false
MAX_WAIT=120
INTERVAL=5
[[ "${1:-}" == "--retry" ]] && RETRY_MODE=true

SERVICES=(
  "Caddy|http://localhost:80"
  "Stage Engine|http://localhost:5010/health"
  "Shift MCP|http://localhost:5011/health"
  "Contract Service|http://localhost:5012/health"
  "Scrapling|http://localhost:8000/health"
)

check_all() {
  local failed=0
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name url <<< "$entry"
    if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
      echo "  OK    $name"
    else
      echo "  FAIL  $name ($url)"
      failed=1
    fi
  done
  return $failed
}

if [ "$RETRY_MODE" = true ]; then
  elapsed=0
  while [ $elapsed -lt $MAX_WAIT ]; do
    echo "Health check (${elapsed}s / ${MAX_WAIT}s)..."
    if check_all; then
      echo ""
      echo "All services healthy."
      exit 0
    fi
    echo "  Retrying in ${INTERVAL}s..."
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done
  echo ""
  echo "ERROR: Services not healthy after ${MAX_WAIT}s"
  exit 1
else
  echo "Checking services..."
  if check_all; then
    echo ""
    echo "All services healthy."
  else
    echo ""
    echo "Some services failed health check!"
    exit 1
  fi
fi
```

- [ ] **Step 3: Make both executable**

```bash
chmod +x infra/scripts/deploy.sh infra/scripts/health-check.sh
```

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/deploy.sh infra/scripts/health-check.sh
git commit -m "fix(infra): rewrite deploy.sh with branch pin and health polling

- Pin droplet to main branch (abort if wrong branch)
- Call sync-env-to-droplet.sh before git pull (when available)
- Replace sleep 5 with retry-based health check (120s max, 5s interval)
- Remove n8n from health checks (not deployed)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Create sync-env-to-droplet.sh

**Files:**

- Create: `infra/scripts/sync-env-to-droplet.sh`

This script reads production secrets from 1Password `smartout_ai_prod` vault and writes them to `infra/.env` on the DigitalOcean droplet via SSH. Mirrors the Vercel sync script's manifest approach.

- [ ] **Step 1: Create the script**

Create `infra/scripts/sync-env-to-droplet.sh`:

```bash
#!/bin/bash
# ============================================
# sync-env-to-droplet.sh — 1Password → DigitalOcean env sync
#
# Reads production secrets from smartout_ai_prod vault and writes
# infra/.env on the droplet. Can run locally (via SSH) or on the
# droplet directly (if 1Password Service Account is configured).
#
# Usage:
#   ./infra/scripts/sync-env-to-droplet.sh              # write to local infra/.env
#   ./infra/scripts/sync-env-to-droplet.sh --remote      # write to droplet via SSH
#   ./infra/scripts/sync-env-to-droplet.sh --dry-run     # preview only
#
# Prerequisites:
#   - OP_SERVICE_ACCOUNT_TOKEN set, OR eval "$(op signin)"
#   - SSH access to droplet (for --remote mode)
# ============================================

set -euo pipefail

DRY_RUN=false
REMOTE=false
DROPLET_HOST="root@164.92.176.42"
DROPLET_ENV_PATH="/root/dev/smartout.ai/infra/.env"

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --remote) REMOTE=true ;;
  esac
done

# Verify 1Password access
if ! op whoami >/dev/null 2>&1; then
  echo "ERROR: 1Password not authenticated."
  echo "Set OP_SERVICE_ACCOUNT_TOKEN or run: eval \"\$(op signin)\""
  exit 1
fi
echo "1Password: authenticated"

# Production env var manifest
# Format: KEY|op://vault/item/field
MANIFEST=(
  "SUPABASE_URL|op://smartout_ai_prod/Supabase/url"
  "SUPABASE_ANON_KEY|op://smartout_ai_prod/Supabase/anon_key"
  "SUPABASE_SERVICE_ROLE_KEY|op://smartout_ai_prod/Supabase/service_role_key"
  "ENGINE_URL|op://smartout_ai_prod/Stage-Engine/url"
  "STAGE_ENGINE_API_KEY|op://smartout_ai_prod/Stage-Engine/api_key"
  "ULTRAVOX_API_KEY|op://smartout_ai_prod/Ultravox/api_key"
  "OPENROUTER_API_KEY|op://smartout_ai_prod/OpenRouter/api_key"
  "SCRAPLING_AUTH_TOKEN|op://smartout_ai_prod/Scrapling/auth_token"
  "SERPER_API_KEY|op://smartout_ai_prod/Serper/api_key"
  "CONTRACT_SERVICE_KEY|op://smartout_ai_prod/SmartOut/contract_service_key"
  "DOCUSEAL_API_KEY|op://smartout_ai_prod/DocuSeal/api_key"
  "DOCUSEAL_WEBHOOK_SECRET|op://smartout_ai_prod/DocuSeal/webhook_secret"
  "N8N_ENCRYPTION_KEY|op://smartout_ai_prod/n8n/encryption_key"
  "N8N_BASIC_AUTH_USER|op://smartout_ai_prod/n8n/basic_auth_user"
  "N8N_BASIC_AUTH_PASSWORD|op://smartout_ai_prod/n8n/basic_auth_password"
)

# Resolve all values
echo "Resolving ${#MANIFEST[@]} variables from smartout_ai_prod vault..."
ENV_CONTENT="# Generated by sync-env-to-droplet.sh — $(date -Iseconds)\n# DO NOT EDIT MANUALLY. Re-run this script to update.\n"
FAILED=0

for entry in "${MANIFEST[@]}"; do
  IFS='|' read -r key op_ref <<< "$entry"
  value=$(op read "$op_ref" 2>/dev/null) || {
    echo "  FAIL  $key ($op_ref)"
    FAILED=1
    continue
  }
  echo "  OK    $key"
  ENV_CONTENT+="${key}=${value}\n"
done

# Static values (not in vault)
ENV_CONTENT+="NODE_ENV=production\n"
ENV_CONTENT+="LOG_LEVEL=info\n"
ENV_CONTENT+="APP_URL=https://app.smartout.ai\n"

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "ERROR: Some variables failed to resolve. Aborting."
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "=== DRY RUN — would write: ==="
  echo -e "$ENV_CONTENT" | sed 's/=.*/=<redacted>/'
  exit 0
fi

if [ "$REMOTE" = true ]; then
  echo ""
  echo "Writing to droplet: $DROPLET_HOST:$DROPLET_ENV_PATH"
  echo -e "$ENV_CONTENT" | ssh "$DROPLET_HOST" "cat > $DROPLET_ENV_PATH"
  echo "Done. Restart services with: ssh $DROPLET_HOST '/root/dev/smartout.ai/infra/scripts/deploy.sh'"
else
  LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env"
  echo ""
  echo "Writing to local: $LOCAL_PATH"
  echo -e "$ENV_CONTENT" > "$LOCAL_PATH"
  echo "Done."
fi
```

- [ ] **Step 2: Make executable**

```bash
chmod +x infra/scripts/sync-env-to-droplet.sh
```

- [ ] **Step 3: Test dry-run (requires 1Password auth)**

```bash
cd infra && ./scripts/sync-env-to-droplet.sh --dry-run
```

Expected: all 15 variables resolve OK, output shows `<redacted>` values.

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/sync-env-to-droplet.sh
git commit -m "feat(infra): add sync-env-to-droplet.sh for DigitalOcean env sync

Reads production secrets from smartout_ai_prod vault via 1Password
and writes infra/.env on the droplet. Supports --remote (SSH) and
--dry-run modes. Replaces fragile symlink approach.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create seed-preview.sql for Branch DBs

**Files:**

- Create: `supabase/seed-preview.sql`

Minimal seed data so Supabase Branch DBs have enough content for preview testing. Based on the existing `seed.sql` structure but stripped to essentials.

- [ ] **Step 1: Create the seed file**

Create `supabase/seed-preview.sql`:

```sql
-- Smartout Preview Branch DB Seed
-- ================================================================
-- Minimal data for Supabase Branch DB preview environments.
-- Run after branch creation to enable basic feature testing.
--
-- Based on supabase/seed.sql but reduced to essentials:
-- 1 company, 1 workspace, 1 admin user, core agent config.
-- ================================================================

-- 1. Company
INSERT INTO public.company (company_id, name, legal_name, org_number, country, industry)
VALUES ('a0000000-0000-0000-0000-000000000000', 'Preview Corp', 'Preview Corporation', '999000111', 'NO', 'hospitality')
ON CONFLICT (company_id) DO NOTHING;

-- 2. Workspace
INSERT INTO public.workspace (workspace_id, company_id, name, slug, description, currency, language, country, onboarding_completed)
VALUES ('b0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'Preview Workspace', 'preview-ws', 'Branch DB preview', 'NOK', 'no', 'NO', true)
ON CONFLICT (workspace_id) DO NOTHING;

-- 3. Location
INSERT INTO public.location (location_id, workspace_id, name, slug, location_type)
VALUES ('c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Preview Location', 'preview-loc', 'main')
ON CONFLICT (location_id) DO NOTHING;

-- 4. Department
INSERT INTO public.department (department_id, workspace_id, name, slug, sort_order)
VALUES ('d0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Service', 'service', 0)
ON CONFLICT (department_id) DO NOTHING;

-- 5. Admin user (test only — email @preview.local)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
) VALUES (
  'e0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin@preview.local',
  crypt('preview123', gen_salt('bf')), now(),
  '{"first_name": "Preview", "last_name": "Admin"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- 6. Default engine_authority_config (read_only baseline)
INSERT INTO public.engine_authority_config (workspace_id, capability, authority_level)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'schedule', 'read_only'),
  ('b0000000-0000-0000-0000-000000000000', 'training', 'read_only'),
  ('b0000000-0000-0000-0000-000000000000', 'operations', 'read_only')
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

Note: `engine_missions`, `engine_stages`, and `agent_profile` seeds depend on exact schema — verify column names against `database.types.ts` before adding. Start with the core tables above; expand as needed.

- [ ] **Step 2: Test locally**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/seed-preview.sql
```

Expected: all inserts succeed (or "DO NOTHING" on conflicts).

- [ ] **Step 3: Commit**

```bash
git add supabase/seed-preview.sql
git commit -m "feat(db): add seed-preview.sql for Supabase Branch DBs

Minimal seed data for preview environments: 1 company, 1 workspace,
1 admin user, default authority config. Uses ON CONFLICT DO NOTHING
for idempotency.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Update Vercel Sync Script gitBranch

**Files:**

- Modify: `infra/scripts/sync-env-to-vercel.sh:124,139`

This change should be done AFTER the preview branch exists on origin (Phase 2.1 in spec). Until then, keep targeting 'development'.

- [ ] **Step 1: Update line 124 (fallback payload)**

In `infra/scripts/sync-env-to-vercel.sh`, find line 124:

```python
    'gitBranch': 'development' if '$env_target' == 'preview' else None
```

Replace with:

```python
    'gitBranch': 'preview' if '$env_target' == 'preview' else None
```

- [ ] **Step 2: Update line 139 (active payload)**

Find line 139:

```python
    obj['gitBranch'] = 'development'
```

Replace with:

```python
    obj['gitBranch'] = 'preview'
```

- [ ] **Step 3: Verify**

```bash
grep -n "gitBranch" infra/scripts/sync-env-to-vercel.sh
```

Expected: both references now say `'preview'`.

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/sync-env-to-vercel.sh
git commit -m "fix(infra): update Vercel sync gitBranch from development to preview

Preview environment variables now target the preview branch
instead of development, matching the new 3-branch architecture.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Update CLAUDE.md with Preview Branch Rules

**Files:**

- Modify: `~/.claude/CLAUDE.md` (user's global CLAUDE.md, Git Workflow section)

- [ ] **Step 1: Update the Branches section**

Find the `### Branches` section in `~/.claude/CLAUDE.md` and replace:

```markdown
- `main` — production. ⛔ NEVER merge to main. NEVER push to main. Only Pontus does production releases.
- `development` — integration branch, all features merge here
```

With:

```markdown
- `main` — production. ⛔ NEVER merge to main. NEVER push to main. Only from preview PRs. Only Pontus merges.
- `preview` — pre-production staging. Merges from development only. Triggers Vercel Preview + Supabase Branch DB. Never direct pushes.
- `development` — integration branch, all features merge here
```

- [ ] **Step 2: Add hotfix rule to Hard rules section**

Add to the `### ⛔ Hard rules` section:

```markdown
- Hotfix fast-track: `feat/hotfix-* → preview → main` (skip development, backport after)
```

- [ ] **Step 3: Commit**

```bash
# This is in the user's home directory, not the repo — no git commit needed
```

Note: `~/.claude/CLAUDE.md` is not in the repo. This is a manual update the user applies.

---

## Task 8: Go/No-Go — Test Supabase Branching + Vault

**Files:** None (verification only)

This is a manual test that must pass before creating the preview branch.

- [ ] **Step 1: Create a test PR**

```bash
git checkout main
git checkout -b test/supabase-branching
echo "-- test" >> supabase/seed.sql
git add supabase/seed.sql
git commit -m "test: verify Supabase branching compatibility"
git push origin test/supabase-branching
gh pr create --base main --head test/supabase-branching --title "TEST: Supabase branching verification" --body "Temporary PR to verify Branch DB creation. Will be closed after verification."
```

- [ ] **Step 2: Wait for Supabase bot comment on PR**

```bash
# Poll for Supabase bot comment (check every 30s, max 5 min)
PR_NUM=$(gh pr list --head test/supabase-branching --json number --jq '.[0].number')
gh api repos/SXTNmedia21/smartout.ai/issues/$PR_NUM/comments --jq '[.[] | select(.user.login=="supabase[bot]")] | last | .body' | head -30
```

Look for: Branch DB URL, migration status, any errors.

- [ ] **Step 3: Test Vault in Branch DB (if branch created)**

Use the branch DB URL from the Supabase bot comment:

```bash
# Connect to the branch DB and test vault
psql "postgresql://postgres:<password>@<branch-db-host>:5432/postgres" -c "SELECT get_secret('test-nonexistent-key');"
```

Expected outcomes:

- If function exists and returns NULL → Vault works, proceed
- If "function does not exist" → Vault migrations failed, BLOCKER
- If connection fails → Branch DB not ready yet, retry

- [ ] **Step 4: Verify custom schemas exist**

```bash
psql "postgresql://..." -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('payroll', 'websites', 'timesheet');"
```

Expected: all 3 schemas present.

- [ ] **Step 5: Close test PR and clean up**

```bash
gh pr close $PR_NUM
git checkout development
git branch -D test/supabase-branching
git push origin --delete test/supabase-branching
```

- [ ] **Step 6: Document result**

If Vault works → proceed to Task 9.
If Vault fails → document in spec as known limitation, add env-var fallback plan.

---

## Task 9: Create Preview Branch + First Release

**Prerequisite:** Task 8 passes (Supabase branching works).

This is the big merge. 1,311 commits from development → main, then create preview branch.

- [ ] **Step 1: Ensure all previous tasks are committed and pushed**

```bash
git checkout development
git status  # must be clean (for our changes)
git push origin development
```

- [ ] **Step 2: Merge main into development (resolve any divergence)**

```bash
git fetch origin main
git log --oneline origin/main..development | wc -l  # confirm commit count
git merge origin/main --no-edit
```

If conflicts:

- `pnpm-lock.yaml` → delete and run `pnpm install`
- `database.types.ts` → keep development version
- Other → keep development version (newer)

Push: `git push origin development`

- [ ] **Step 3: Create PR development → main**

```bash
gh pr create --base main --head development --title "Release: deployment pipeline + branch architecture" --body "$(cat <<'EOF'
## Summary
- 1,311 commits from development to main
- New 3-branch architecture: development → preview → main
- Migration idempotency fixes (86 indexes)
- deploy.sh rewrite with health polling
- sync-env-to-droplet.sh for automated DigitalOcean env management
- seed-preview.sql for Supabase Branch DBs
- database.types.ts now tracked in git

## Test plan
- [ ] Vercel preview deploys successfully
- [ ] Supabase bot shows green migration status
- [ ] No typecheck errors in preview build

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for CI, review, merge**

Monitor Vercel + Supabase bots on the PR. Fix any issues. Pontus merges when green.

- [ ] **Step 5: Create preview branch from merged main**

After PR is merged:

```bash
git checkout main
git pull origin main
git checkout -b preview
git push origin preview
```

- [ ] **Step 6: Verify Vercel recognizes preview branch**

Check Vercel Dashboard → smartout-web → Deployments. A new preview deployment should trigger for the `preview` branch.

---

## Task 10: Write ADR — Preview Environment Architecture

**Files:**

- Create: `docs/decisions/NNNN-preview-environment-architecture.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Determine next ADR number**

```bash
ls docs/decisions/ | grep -v "0000" | sort -n | tail -1
```

Use the next number.

- [ ] **Step 2: Write the ADR**

Use `docs/templates/decision.md` as template. Key decisions to document:

1. 3-branch architecture (development → preview → main)
2. Docker services have no preview (accepted asymmetry)
3. Vault naming: smartout_ai / smartout_ai_prod (supersedes ADR-0055)
4. Hotfix fast-track path: feat/hotfix → preview → main
5. All PRs to main get Supabase Branch DB (not just Supabase changes)
6. database.types.ts tracked in git
7. Weekly release cadence

- [ ] **Step 3: Register in decision log**

Add entry to `docs/decisions/0000-decision-log.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/
git commit -m "docs(decisions): add ADR for preview environment architecture

Documents 3-branch flow, Docker preview asymmetry, vault naming
(supersedes ADR-0055), hotfix fast-track, and release cadence.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Protocol Alignment + Security Hardening

**Files:**

- Delete: `docs/DEPLOYMENT.md`
- Delete: `docs/DEPLOY-RUNBOOK-infra-prod.md`
- Modify: `docs/protocols/SECURITY.md`
- Modify: `docs/protocols/ENV_PROTOCOL.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/decisions/0055-two-vault-environment-isolation.md`

This task aligns all security and deployment docs with the new pipeline architecture.

- [ ] **Step 1: Delete superseded deployment docs**

```bash
git rm docs/DEPLOYMENT.md
git rm docs/DEPLOY-RUNBOOK-infra-prod.md
```

Rationale:

- `DEPLOYMENT.md` (2026-03-19): Manual process, no preview branch, no service account. Fully superseded by pipeline spec + deploying skill.
- `DEPLOY-RUNBOOK-infra-prod.md` (2026-03-26): Documents the pre-merge problem (1,311-commit gap). The pipeline spec IS the solution. No longer needed.

- [ ] **Step 2: Harden SECURITY.md — Add preview environment section**

Open `docs/protocols/SECURITY.md`. Add a new section after the existing deployment checklist (around line 450):

```markdown
## §16 Preview Environment Security

### Branch Database Isolation

Preview deployments use Supabase Branch DBs — isolated copies of the production schema.

**Rules:**

- Branch DBs are ephemeral — created on PR, destroyed on merge
- Branch DBs contain NO production data (schema only + seed-preview.sql)
- Branch DB credentials are injected by Supabase-Vercel integration (never manual)
- Edge Functions in preview still point to production Supabase — branch isolation is Vercel-side only

### Docker Service Asymmetry (Accepted)

Docker services (Stage Engine, Shift MCP, Contract Service, Scrapling) have no preview tier. Preview Vercel apps hit production Docker services.

**Mitigations:**

- Services are stateless request handlers — they use their own Supabase credentials (production)
- No cross-contamination: preview app uses Branch DB credentials, Docker services use production credentials
- Agent features must be tested locally before preview deployment

### Vault in Branch DBs

Supabase Vault (`pgsodium`) availability in Branch DBs is verified during pipeline setup (Phase 2.0 go/no-go). If unavailable, `secrets.ts` falls back to environment variables.
```

- [ ] **Step 3: Harden SECURITY.md — Add migration idempotency rule**

Find §6 (Migrations section) in SECURITY.md. Add:

```markdown
### Migration Idempotency (Supabase Branching)

All `CREATE INDEX` and `CREATE TABLE` statements MUST use `IF NOT EXISTS`. Supabase Branch DBs replay all migrations from scratch — non-idempotent statements cause branch creation failures.

**Rule:** Never write `CREATE INDEX idx_name ON table(col)` without `IF NOT EXISTS`.
**Enforcement:** Phase 0 of deployment pipeline wrapped all 86 existing bare indexes.
```

- [ ] **Step 4: Harden SECURITY.md — Add vault naming decision**

Find the vault/secrets section in SECURITY.md. Add or update:

```markdown
### Vault Naming (Supersedes ADR-0055)

| Vault              | Environment           | Purpose                                 |
| ------------------ | --------------------- | --------------------------------------- |
| `smartout_ai`      | Development / Preview | Local dev, Vercel preview, Docker local |
| `smartout_ai_prod` | Production            | Vercel production, DigitalOcean droplet |

ADR-0055 defined `smartout_dev` / `smartout_prod` — these names were never used. All code, scripts, and 1Password items use `smartout_ai` / `smartout_ai_prod`.
```

- [ ] **Step 5: Harden SECURITY.md — Add 1Password Service Account rules**

Add to the secrets management section:

```markdown
### 1Password Service Account (CI/CD)

For automated pipelines (env sync, future GitHub Actions), use a 1Password Service Account instead of interactive `op signin`.

| Context                 | Method                                              |
| ----------------------- | --------------------------------------------------- |
| Local development       | `op run --env-file=.env.template` (interactive CLI) |
| Vercel env sync         | Service account token (`OP_SERVICE_ACCOUNT_TOKEN`)  |
| DigitalOcean env sync   | Service account token via `sync-env-to-droplet.sh`  |
| GitHub Actions (future) | Service account token in GitHub Secrets             |

**Rules:**

- Service account has READ-ONLY access to both vaults
- Token stored in GitHub Secrets, never in code or docs
- Local dev continues using interactive `op run` (no change)
```

- [ ] **Step 6: Update SECURITY.md frontmatter**

Update the `updated:` field to `2026-04-06`.

- [ ] **Step 7: Update ENV_PROTOCOL.md — Add service account + preview section**

Open `docs/protocols/ENV_PROTOCOL.md`. Add after the "Running the app" section:

````markdown
## Service Account for CI/CD

Local development uses interactive `op run`. Automated pipelines use a 1Password Service Account.

```bash
# Local (interactive)
op run --env-file=.env.template -- pnpm run dev

# CI/CD (service account)
OP_SERVICE_ACCOUNT_TOKEN=<token> op run --env-file=.env.template -- <command>
```
````

The service account has read-only access to `smartout_ai` and `smartout_ai_prod` vaults.

## Preview Environment Variables

Preview deployments (Vercel) receive Supabase Branch DB credentials automatically via the Supabase-Vercel integration. No manual env var configuration needed for preview.

Non-Supabase env vars for preview are synced by `infra/scripts/sync-env-to-vercel.sh` with `gitBranch: 'preview'`.

````

Update `updated:` to `2026-04-06`.

- [ ] **Step 8: Update docs/INDEX.md — Add missing protocol entries**

Find the Protocols table in `docs/INDEX.md`. Add:

```markdown
| PROTO_ENV           | protocols/ENV_PROTOCOL.md  | Environment variables, vault, op run |
| PROTO_AUTH          | protocols/AUTH_SECURITY.md  | Auth flows, OTP, rate limiting, sandbox |
````

Remove any references to `docs/DEPLOYMENT.md` or `docs/DEPLOY-RUNBOOK-infra-prod.md` if they appear in INDEX.md.

- [ ] **Step 9: Mark ADR-0055 as superseded**

Open `docs/decisions/0055-two-vault-environment-isolation.md`. Change frontmatter:

```yaml
status: superseded
superseded_by: "Deployment Pipeline Spec (2026-04-06) — vault naming decision"
```

Update the decision log `docs/decisions/0000-decision-log.md` — mark ADR-0055 as superseded.

- [ ] **Step 10: Commit**

```bash
git add docs/DEPLOYMENT.md docs/DEPLOY-RUNBOOK-infra-prod.md docs/protocols/SECURITY.md docs/protocols/ENV_PROTOCOL.md docs/INDEX.md docs/decisions/
git commit -m "docs(security): align protocols with deployment pipeline architecture

- Delete DEPLOYMENT.md and DEPLOY-RUNBOOK (superseded by pipeline spec)
- Harden SECURITY.md: preview env, migration idempotency, vault naming,
  1Password service account
- Update ENV_PROTOCOL.md: service account, preview env vars
- Update INDEX.md: add ENV_PROTOCOL + AUTH_SECURITY entries
- Mark ADR-0055 as superseded (vault naming)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Execution Order

Tasks 1-5 and 11 can run in parallel (no dependencies between them).
Task 6 depends on preview branch existing (after Task 9 Step 5).
Task 7 is a manual CLAUDE.md update (no git dependency).
Task 8 is a go/no-go gate before Task 9.
Task 9 depends on Tasks 1-5 being merged and Task 8 passing.
Task 10 can run anytime after Task 9.

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Task 1   │  │ Task 2   │  │ Task 3   │  │ Task 4   │  │ Task 5   │  │ Task 11  │
│ Indexes  │  │ LiveKit  │  │ deploy.sh│  │ droplet  │  │ seed-    │  │ Protocol │
│          │  │ env var  │  │ rewrite  │  │ sync     │  │ preview  │  │ alignment│
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │             │             │
     └─────────────┴──────┬──────┴─────────────┴─────────────┴─────────────┘
                          │
                    ┌─────▼─────┐
                    │ Task 8    │
                    │ Go/No-Go  │
                    │ Vault test│
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ Task 9    │
                    │ Big merge │
                    │ + preview │
                    └──┬────┬───┘
                       │    │
                 ┌─────▼┐  ┌▼──────┐
                 │Task 6│  │Task 10│
                 │Sync  │  │ADR    │
                 │script│  │       │
                 └──────┘  └───────┘

Task 7 (CLAUDE.md) — anytime, manual
```
