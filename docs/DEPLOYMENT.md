---
title: Deployment Guide
status: done
updated: 2026-03-19
created: 2026-03-19
module: infra
tags: [deployment, production, droplet, vercel, supabase]
---

# Deployment Guide

> How to deploy Smartout to production. Simple, step-by-step.

---

## Architecture Overview

| Component             | Where               | URL                                               |
| --------------------- | ------------------- | ------------------------------------------------- |
| Web Dashboard         | Vercel              | `app.smartout.ai`                                 |
| Landing Page          | Vercel              | `smartout.ai`                                     |
| Stage Engine          | DO Droplet (Docker) | `engine.smartout.ai`                              |
| Shift MCP             | DO Droplet (Docker) | `schedule-mcp.smartout.ai`                        |
| Contract Service      | DO Droplet (Docker) | `contract.smartout.ai`                            |
| Scrapling             | DO Droplet (Docker) | `scrape.smartout.ai`                              |
| n8n                   | DO Droplet (Docker) | `n8n.smartout.ai`                                 |
| Caddy (reverse proxy) | DO Droplet (Docker) | Handles TLS for all above                         |
| Database              | Supabase Cloud      | `yljaglomadbhyqpcigff.supabase.co`                |
| Edge Functions        | Supabase Cloud      | `yljaglomadbhyqpcigff.supabase.co/functions/v1/*` |

---

## 1. Deploy Docker Services (DO Droplet)

### Prerequisites

- SSH access: `ssh root@164.92.176.42`
- Repo at `/opt/smartout/` on `development` branch
- `infra/.env` with all required env vars (see section 4)

### Steps

```bash
# 1. SSH in
ssh root@164.92.176.42

# 2. Pull latest code
cd /opt/smartout
git pull origin development

# 3. Remove dev override (IMPORTANT — prevents localhost config from leaking into prod)
rm -f infra/docker-compose.override.yml

# 4. Rebuild and restart all containers
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 5. Wait ~30s, then verify all 6 containers are healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 6. Smoke test (from local machine)
curl -s https://engine.smartout.ai/health
curl -s https://scrape.smartout.ai/health
curl -s https://contract.smartout.ai/health
```

### Quick deploy (one-liner from local machine)

```bash
ssh root@164.92.176.42 "cd /opt/smartout && git pull origin development && rm -f infra/docker-compose.override.yml && cd infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
```

### Rollback

```bash
ssh root@164.92.176.42 "cd /opt/smartout && git log --oneline -5"
# Find the commit to roll back to, then:
ssh root@164.92.176.42 "cd /opt/smartout && git checkout <commit> && rm -f infra/docker-compose.override.yml && cd infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
```

---

## 2. Deploy Web Apps (Vercel)

Vercel deploys automatically when code is pushed to `main`. Since we work on `development`, deployment requires a merge.

### Steps

```bash
# 1. Ensure development is clean
pnpm typecheck && pnpm lint

# 2. Push development
git push origin development

# 3. Merge to main (from local)
git checkout main
git pull origin main
git merge development
git push origin main

# 4. Switch back to development
git checkout development
```

Vercel will auto-build and deploy both `apps/web` (app.smartout.ai) and `apps/landing` (smartout.ai).

### Preview deployments

Every push to a non-main branch creates a Vercel preview. Check in Vercel dashboard or:

```bash
vercel ls
```

---

## 3. Deploy Edge Functions (Supabase)

Edge Functions deploy independently from the web app.

### Deploy a single function

```bash
npx supabase functions deploy <function-name> --project-ref yljaglomadbhyqpcigff
```

### Deploy all functions

```bash
npx supabase functions deploy --project-ref yljaglomadbhyqpcigff
```

### Apply database migrations

```bash
npx supabase db push --project-ref yljaglomadbhyqpcigff
```

---

## 4. Environment Variables

### Where env vars live

| System         | Location                   | How to set                                                              |
| -------------- | -------------------------- | ----------------------------------------------------------------------- |
| Droplet Docker | `/opt/smartout/infra/.env` | SSH + edit file                                                         |
| Supabase EF    | Supabase secrets           | `npx supabase secrets set KEY=VALUE --project-ref yljaglomadbhyqpcigff` |
| Vercel Web     | Vercel env vars            | `vercel env add KEY production` (in `apps/web/`)                        |
| Vercel Landing | Vercel env vars            | `vercel env add KEY production` (in `apps/landing/`)                    |

### Adding a new env var

When you add a new env var to the codebase:

1. **Add to `.env.template`** (root) — this is the single source of truth
2. **Add to `apps/web/src/env.ts`** or `apps/landing/src/env.ts` if used by Next.js (Zod validation)
3. **Set in the right places:**

| If used by...    | Set it in...                                         |
| ---------------- | ---------------------------------------------------- |
| Docker service   | Droplet `infra/.env`                                 |
| Edge Function    | `npx supabase secrets set ...`                       |
| Web app (server) | `vercel env add ... production`                      |
| Web app (client) | Must be `NEXT_PUBLIC_*`, set via Vercel              |
| Landing (server) | `vercel env add ... production` (in landing project) |

4. **For secrets:** Always use `op read 'op://smartout_ai/...'` to get the value. Never type secrets directly.

### Changing a Droplet env var

```bash
ssh root@164.92.176.42
nano /opt/smartout/infra/.env   # Edit the value
cd /opt/smartout/infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d  # Restart to pick up
```

### Changing a Supabase secret

```bash
npx supabase secrets set KEY=newvalue --project-ref yljaglomadbhyqpcigff
# Edge Functions pick up new secrets automatically on next cold start
```

### Changing a Vercel env var

```bash
cd apps/web  # or apps/landing
vercel env rm KEY production    # Remove old
vercel env add KEY production   # Set new (paste value when prompted)
vercel --prod                   # Redeploy to pick up
```

---

## 5. URL / Domain Changes

### Current domains

| Domain                     | Points to       | Managed by                    |
| -------------------------- | --------------- | ----------------------------- |
| `smartout.ai`              | Vercel          | GoDaddy DNS → Vercel          |
| `app.smartout.ai`          | Vercel          | GoDaddy DNS → Vercel          |
| `engine.smartout.ai`       | Droplet (Caddy) | GoDaddy DNS → `164.92.176.42` |
| `scrape.smartout.ai`       | Droplet (Caddy) | GoDaddy DNS → `164.92.176.42` |
| `contract.smartout.ai`     | Droplet (Caddy) | GoDaddy DNS → `164.92.176.42` |
| `schedule-mcp.smartout.ai` | Droplet (Caddy) | GoDaddy DNS → `164.92.176.42` |
| `n8n.smartout.ai`          | Droplet (Caddy) | GoDaddy DNS → `164.92.176.42` |

### Adding a new subdomain for a Docker service

1. **GoDaddy:** Add A record → `164.92.176.42`
2. **Caddyfile:** Add reverse proxy block in `infra/Caddyfile`
3. **docker-compose.yml:** Expose the service on the internal network
4. **Deploy:** Push + pull + rebuild on Droplet
5. Caddy auto-provisions TLS via Let's Encrypt

### Changing the Droplet IP

If you migrate to a new server:

1. Update ALL A records in GoDaddy (engine, scrape, contract, schedule-mcp, n8n)
2. Update `SCRAPLING_SERVICE_URL` in Supabase secrets and Vercel
3. Update `STAGE_ENGINE_URL` / `ENGINE_URL` in Supabase secrets and Vercel
4. Update `CONTRACT_SERVICE_URL` in Vercel
5. Update `SHIFT_MCP_URL` in Vercel

### Changing Vercel domains

Managed in Vercel dashboard → Project Settings → Domains. DNS must point to Vercel (CNAME or A record).

---

## 6. Pre-deploy Checklist

Before any production deploy:

```
[ ] pnpm typecheck      → 0 errors
[ ] pnpm lint           → 0 errors
[ ] git push origin development
[ ] All tests passing (if applicable)
```

Before Droplet deploy:

```
[ ] No uncommitted changes on Droplet (check: ssh root@164.92.176.42 "cd /opt/smartout && git status")
[ ] override.yml removed after pull
[ ] All 6 containers healthy after rebuild
[ ] Smoke test health endpoints
```

---

## 7. Monitoring

### Container logs

```bash
# All services
ssh root@164.92.176.42 "cd /opt/smartout/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50"

# Single service
ssh root@164.92.176.42 "cd /opt/smartout/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50 stage-engine"
```

### Vercel logs

```bash
cd apps/web && vercel logs --prod
```

### Supabase logs

```bash
npx supabase functions logs <function-name> --project-ref yljaglomadbhyqpcigff
```

---

## Quick Reference

| Action                 | Command                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deploy Docker services | `ssh root@164.92.176.42 "cd /opt/smartout && git pull origin development && rm -f infra/docker-compose.override.yml && cd infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"` |
| Deploy web to prod     | Merge `development` → `main`, push `main`                                                                                                                                                                          |
| Deploy Edge Function   | `npx supabase functions deploy <name> --project-ref yljaglomadbhyqpcigff`                                                                                                                                          |
| Set Supabase secret    | `npx supabase secrets set KEY=VALUE --project-ref yljaglomadbhyqpcigff`                                                                                                                                            |
| Set Vercel env var     | `cd apps/web && vercel env add KEY production`                                                                                                                                                                     |
| Check Droplet health   | `curl -s https://engine.smartout.ai/health`                                                                                                                                                                        |
| View Droplet logs      | `ssh root@164.92.176.42 "cd /opt/smartout/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50 <service>"`                                                                      |
