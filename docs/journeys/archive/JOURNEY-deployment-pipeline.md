---
title: "Journey — Deployment Pipeline"
status: done
updated: 2026-04-06
created: 2026-04-06
module: infra
tags: [journey, deployment, preview, release]
---

# Journey: Deployment Pipeline

## Journey: Admin — Release to Production

**Precondition:** Feature branches merged to `development`. All tests passing.

1. Admin fast-forwards `preview` to `development` → Vercel creates preview deploy + Supabase creates Branch DB
2. Supabase replays all migrations on Branch DB → Admin verifies migrations pass cleanly
3. Admin tests preview URL (Vercel) against Branch DB → Validates feature behavior
4. Admin fast-forwards `main` to `preview` → Vercel deploys to production, Supabase applies migrations to production DB
5. Admin runs `infra/scripts/deploy.sh` on DigitalOcean → Docker services rebuild with latest code + env vars

**Postcondition:** Production updated with validated code. All environments in sync.

**Error paths:**
- Migration fails on Branch DB → Fix migration, push to development, retry
- Preview URL shows errors → Debug against Branch DB, fix before promoting
- Docker health check fails → `health-check.sh --retry` polls for 120s, alerts on timeout

## Journey: Admin — Sync Environment Variables

**Precondition:** New secret or env var added to 1Password vault.

1. Admin adds var to `infra/scripts/sync-env-to-vercel.sh` manifest with op:// reference
2. Admin runs `sync-env-to-vercel.sh preview` → Script reads from 1Password, pushes to Vercel scoped to `preview` gitBranch
3. Admin runs `sync-env-to-vercel.sh production` → Script reads from `smartout_ai_prod` vault, pushes to Vercel production
4. For Docker: admin runs `sync-env-to-droplet.sh` → Script reads from `smartout_ai_prod`, writes to `infra/.env`

**Postcondition:** All environments have the new variable. No secrets in git.

**Error paths:**
- 1Password item missing → Script skips var, logs warning
- Vercel API rejects (duplicate key) → Manual delete via Vercel dashboard, re-run

## Journey: Admin — Hotfix Production

**Precondition:** Critical bug found in production.

1. Admin branches `fix/description` from `main`
2. Admin fixes bug, pushes, creates PR to `main`
3. Admin merges to `main` → Vercel deploys, Supabase applies migration
4. Admin cherry-picks commit back to `development` → Prevents drift

**Postcondition:** Production fixed, development has the fix too.

**Error paths:**
- Cherry-pick conflicts → Manual merge resolution on development
