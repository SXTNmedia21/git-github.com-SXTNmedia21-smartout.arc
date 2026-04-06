---
title: "ADR-0071: Preview Environment Architecture"
status: accepted
updated: 2026-04-06
created: 2026-04-06
module: infra
tags: [deployment, preview, branching, architecture]
---

# ADR-0071: Preview Environment Architecture

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
| `preview` | Staging. Fast-forward from development when ready to release | Preview deploy (gitBranch scoped) | Branch DB (via PR) | None |
| `main` | Production. Fast-forward from preview after validation | Production deploy | Production DB | Production services |

### Asymmetry: Docker Services

DigitalOcean Docker services (n8n, contract-service, stage-engine, shift-mcp, scrapling) have **no preview tier**. They run against production only. This is accepted because:

1. These services are internal — no customer-facing preview needed
2. Adding a second Droplet doubles infra cost for minimal benefit
3. Edge Functions (Supabase) handle all external API surface

### Supabase Branch DBs

- Created automatically when a PR targets `preview` or `main`
- Replay ALL migrations from scratch — requires idempotent migrations (IF NOT EXISTS)
- Migration ordering matters: no forward references to tables created by later migrations
- REST/Auth services start slow (~30s) — cosmetic, not blocking

### Env Var Sync

- `infra/scripts/sync-env-to-vercel.sh` — 1Password → Vercel, scoped to `preview` gitBranch
- `infra/scripts/sync-env-to-droplet.sh` — 1Password → DigitalOcean (production only)
- 1Password vaults: `smartout_ai` (dev/preview), `smartout_ai_prod` (production)

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
