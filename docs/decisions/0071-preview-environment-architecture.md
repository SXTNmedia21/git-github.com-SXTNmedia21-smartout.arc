---
title: "ADR-0071: Preview Environment Architecture"
status: accepted
updated: 2026-05-17
created: 2026-04-06
module: infra
tags: [deployment, preview, branching, architecture]
amended_by: [ADR-0360]
---

# ADR-0071: Preview Environment Architecture

> **AMENDED 2026-05-17 by [ADR-0360](0360-preview-tier-without-persistent-branch-db.md)** — preview tier no longer maintains a persistent Supabase Branch DB. Sections referencing `cibmhhgsrdmpnmcikalu` / `rrjfrisxvrrhyzzitlxd` are SUPERSEDED. Preview smoke = Vercel-only; Edge Function + RLS pre-main testing routes through CI workflow_dispatch or post-merge prod smoke. See ADR-0360 for rationale (4-day-revealed-preference + zero recurring cost + drift-surface reduction).

## Context

Smartout lacked a staging/preview tier between development and production. Features merged to development were either tested locally or went straight to main. This created risk for production releases and made it impossible to verify Supabase migrations, Edge Functions, and Vercel deployments before they hit production.

## Decision

Adopt a 3-branch git flow with asymmetric preview infrastructure:

```
development → preview → main
   (work)      (staging)   (production)
```

### Branch Roles

| Branch | Purpose | Vercel | Supabase | Docker (DO) |
|--------|---------|--------|----------|-------------|
| `development` | Integration. All feature branches merge here | Preview deploys | Local only | None |
| `preview` | Staging. Fast-forward from development when ready to release | Preview deploy (target=preview) | ~~Persistent Branch DB~~ → **None** (ADR-0360 amendment; Vercel-only smoke). Edge Function + RLS testing via CI workflow_dispatch or post-merge prod smoke. | Shared production droplet |
| `main` | Production. Fast-forward from preview after validation | Production deploy | Production DB (`yljaglomadbhyqpcigff`) | Shared production droplet |

### Asymmetry: Docker Services

DigitalOcean Docker services (n8n, contract-service, stage-engine, shift-mcp, scrapling) have **no preview tier**. They run against production only. This is accepted because:

1. These services are internal — no customer-facing preview needed
2. Adding a second Droplet doubles infra cost for minimal benefit
3. Edge Functions (Supabase) handle all external API surface

### Supabase Persistent Branch (preview)

The preview environment uses a **Persistent Branch DB** (`cibmhhgsrdmpnmcikalu`), not ephemeral PR branches. Rationale:

- Stable URL and credentials over time — Vercel preview env vars stay valid
- Migrations replay tested once when branch is created/reset, not per-PR
- Connected to git branch `preview`, syncs migrations on push
- Created via Supabase Dashboard, persists until manually destroyed

PRs targeting `main` may still create ephemeral branches for migration testing, but the canonical preview environment is the persistent one.

**Migration requirements** (still apply):
- Idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS before CREATE POLICY)
- No forward references to later migrations
- Unique timestamps (no duplicate `YYYYMMDDHHMMSS_` prefixes)

### Env Var Sync — Shared-First Model

- `infra/scripts/sync-env-to-vercel.sh` — 1Password → Vercel, **nuke-and-replace**, shared-first
- `infra/scripts/sync-env-to-droplet.sh` — 1Password → DigitalOcean (production only)

**Vault rule:**
- `smartout_ai` = **localhost URLs**, dev keys → for `op run` local dev + preview Supabase Branch DB ONLY
- `smartout_ai_prod` = **production URLs** (`*.smartout.ai`), prod keys → ALL Vercel vars + droplet

**Manifest structure** (verified against `apps/web/src/env.ts` and `apps/landing/src/env.ts`):
- `shared` target = sets `["preview","production"]` in one Vercel API call (48 vars)
- `preview` target = Supabase Branch DB credentials only (8 vars)
- `production` target = Supabase prod DB credentials only (8 vars)
- Total: 64 manifest entries (web 41 + landing 23)

**Why nuke-and-replace:** Vercel's list API paginates (limit=20 default). Per-key removal missed entries. Always delete ALL env vars from project before re-adding.

### Hotfix Path

```
main ← hotfix/description (cherry-pick back to development)
```

Hotfixes bypass preview when urgency requires it. Always cherry-pick back to development to prevent drift.

### Release Cadence

No fixed cadence. Merge development → preview when a release candidate is ready. Merge preview → main after validation. Both merges are fast-forwards (no merge commits on preview/main).

## Consequences

- **Positive:** Production releases are validated against real Supabase Branch DBs before merge
- **Positive:** Vercel preview deploys give stakeholders a URL to test before production
- **Positive:** Migration issues caught early (8 iterations needed to fix legacy ordering issues)
- **Negative:** Docker services have no preview — bugs in service changes only surface in production
- **Negative:** Branch DB creation adds ~2min to PR workflow
- **Accepted:** 1Password Service Account needed for CI/CD env sync (manual setup required)
