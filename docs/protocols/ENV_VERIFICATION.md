---
title: Environment Variable Consistency Verification
status: canonical
updated: 2026-04-28
created: 2026-03-23
module: infrastructure
tags: [environment, verification, deployment]
---

# Environment Variable Verification Snapshot

**Date:** 2026-04-28
**Branch:** development
**Verifier:** Manual audit (Claude + grep)
**Cadence:** Refresh quarterly or after any env-touching merge.

---

## Summary

✅ **Status: CONSISTENT** — No critical mismatches found.

| Metric                                        | Value                              |
| --------------------------------------------- | ---------------------------------- |
| `op://` references in `.env.template`         | **76** (was 67 in 2026-03-23)      |
| Hardcoded plain values in `.env.template`     | 18                                 |
| Total declared variables in `.env.template`   | 94                                 |
| Web server vars validated in `apps/web/src/env.ts` | **28**                       |
| Web client vars validated                     | 11                                 |
| Landing server vars validated                 | 14                                 |
| Landing client vars validated                 | 6                                  |
| Vercel manifest entries (`sync-env-to-vercel.sh`) | **64** (41 web + 23 landing)   |
| Droplet manifest entries (`sync-env-to-droplet.sh`) | 15 vault + 3 static          |
| Edge Functions in `supabase/functions/`       | 57                                 |
| Vercel CI compatibility                       | ✅ All server validators `.optional()` |

---

## 1. `apps/web/src/env.ts` — server vars (28)

All `.optional()` — Vercel CI compatible.

| Group         | Variables                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| Database      | `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                               |
| Stripe        | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                              |
| Email/SMS     | `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`             |
| Auth          | `JWT_SECRET` (min 32), `SESSION_SECRET` (min 32)                          |
| AI            | `OPENROUTER_API_KEY` (min 1), `ULTRAVOX_API_KEY`                          |
| Cache         | `UPSTASH_REDIS_REST_URL` (url), `UPSTASH_REDIS_REST_TOKEN`                |
| Observability | `SENTRY_DSN` (url), `GITHUB_ERROR_TOKEN`, `GITHUB_ERROR_REPO`             |
| Contracts     | `DOCUSEAL_WEBHOOK_SECRET`, `CONTRACT_SERVICE_URL` (url), `CONTRACT_SERVICE_KEY` (min 16) |
| Scrapling     | `SCRAPLING_SERVICE_URL` (url), `SCRAPLING_AUTH_TOKEN` (min 1)             |
| Search        | `SERPER_API_KEY` (min 1)                                                  |
| Services      | `SHIFT_MCP_URL` (url), `STAGE_ENGINE_URL` (url), `STAGE_ENGINE_API_KEY` (min 16) |
| LiveKit       | `LIVEKIT_API_KEY` (min 1), `LIVEKIT_API_SECRET` (min 1), `LIVEKIT_WEBHOOK_SECRET` (min 1) |
| Runtime       | `NODE_ENV` (default `"development"`)                                      |

✅ All validators use `.optional()` — no Vercel CI breakage risk.

## 2. `apps/web/src/env.ts` — client vars (11)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`,
`NEXT_PUBLIC_POSTHOG_HOST` (default `https://eu.i.posthog.com`), `NEXT_PUBLIC_POSTHOG_PROJECT_ID`,
`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_ROOT_DOMAIN` (default `localhost`),
`NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_REVALIDATION_SECRET`,
`NEXT_PUBLIC_STAGE_ENGINE_URL`, `NEXT_PUBLIC_LIVEKIT_URL`.

## 3. `apps/landing/src/env.ts` — server vars (14)

`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (`startsWith("sk_")`),
`STRIPE_WEBHOOK_SECRET` (`startsWith("whsec_")`), `SENDGRID_API_KEY` (`startsWith("SG.")`),
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `JWT_SECRET` (min 32), `SESSION_SECRET` (min 32),
`ULTRAVOX_API_KEY`, `STAGE_ENGINE_URL` (url), `STAGE_ENGINE_API_KEY`,
`INTERVJU_MCP_WEBHOOK_SECRET`, `REVALIDATION_SECRET` (min 16), `NODE_ENV`.

## 4. `apps/landing/src/env.ts` — client vars (6)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WEB_APP_URL` (url),
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (default `https://eu.i.posthog.com`),
`NEXT_PUBLIC_LANDING_VARIANT` (enum B/E/T/K/A/F/S, default `B`).

---

## 5. Vercel Manifest Coverage

`infra/scripts/sync-env-to-vercel.sh` MANIFEST as of 2026-04-28:

| Project          | Shared (preview+prod) | Preview only | Production only | Total |
| ---------------- | --------------------- | ------------ | --------------- | ----- |
| smartout-web     | 33 (from prod vault)  | 4 (Branch DB)| 4 (prod Supabase)| 41   |
| smartout-landing | 15 (from prod vault)  | 4 (Branch DB)| 4 (prod Supabase)| 23   |

**Total: 64 entries.** All resolved from 1Password. Sync is NUKE-AND-REPLACE — manual
edits in Vercel UI will be wiped on next sync.

✅ Manifest covers every required var in both `env.ts` files.

---

## 6. Droplet Manifest Coverage

`infra/scripts/sync-env-to-droplet.sh` resolves 15 vars from `smartout_ai_prod`:

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENGINE_URL`,
`STAGE_ENGINE_API_KEY`, `ULTRAVOX_API_KEY`, `OPENROUTER_API_KEY`, `SCRAPLING_AUTH_TOKEN`,
`SERPER_API_KEY`, `CONTRACT_SERVICE_KEY`, `DOCUSEAL_API_KEY`, `DOCUSEAL_WEBHOOK_SECRET`,
`N8N_ENCRYPTION_KEY`, `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`.

Plus 3 static values appended at write time: `NODE_ENV=production`, `LOG_LEVEL=info`,
`APP_URL=https://app.smartout.ai`.

Output: `/root/dev/smartout.ai/infra/.env` on droplet `164.92.176.42`.

---

## 7. Cross-Reference Analysis

### Intentional separations

Vars in `.env.template` but NOT in `apps/web/src/env.ts`:

- Client-side (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`) — validated separately
- Docker-only (`N8N_*`, `DOCUSEAL_API_URL`, `SMARTOUT_*`, `PLATFORM_*`,
  `GENERIC_TIMEZONE`) — used by infra services, not the web app
- Database bootstrap (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`) —
  client-side equivalents are validated; server reads via `process.env` directly
- Edge Function bearer tokens (`WATCHDOG_CRON_SECRET`, `PROCESS_NOTIFICATIONS_SECRET`,
  `MORNING_DIGEST_SECRET`, `PUSH_DISPATCH_SECRET`, `HEALTH_CHECK_SECRET`,
  `REVALIDATION_SECRET`) — read in Edge Functions or middleware via `process.env`

Vars in `apps/web/src/env.ts` but NOT in droplet manifest:

- `STRIPE_*`, `SENDGRID_API_KEY`, `TWILIO_*` — only Vercel/Edge Functions use them
- `UPSTASH_REDIS_*`, `SENTRY_DSN`, `LIVEKIT_*` — Vercel-only
- `CONTRACT_SERVICE_URL`, `SHIFT_MCP_URL` — web app calls these services, doesn't run them

✅ Each layer (web app, landing, Vercel preview, droplet) has its own scope. No leaks.

---

## 8. Drift Check (manual reproduction)

Run from repo root after any env-touching change:

```bash
grep -rhoP 'process\.env\.\K[A-Z_]+' apps/ packages/ services/ \
  --include="*.ts" --include="*.tsx" | sort -u > /tmp/used.txt

grep -oP '^[A-Z_]+' .env.template | sort -u > /tmp/declared.txt

# Missing from template (must be added):
comm -23 /tmp/used.txt /tmp/declared.txt

# Declared but unused (cleanup candidates — verify before removing):
comm -13 /tmp/used.txt /tmp/declared.txt
```

---

## 9. Production Deployment Checklist

For Vercel:

- [ ] All 64 manifest entries resolve in 1Password (`op run` no errors)
- [ ] `SKIP_ENV_VALIDATION` is **unset** in production
- [ ] `NODE_ENV=production` is implicitly set by `next build`
- [ ] Run `./infra/scripts/sync-env-to-vercel.sh --dry-run` to preview
- [ ] After sync, redeploy from Vercel dashboard (sync alone doesn't trigger build)

For DigitalOcean droplet:

- [ ] All 15 manifest entries resolve in `smartout_ai_prod`
- [ ] `infra/.env` is generated by `sync-env-to-droplet.sh` (never edited manually)
- [ ] `infra/scripts/deploy.sh` runs sync + git pull + docker compose up
- [ ] N8N service uses defaults where vault is empty (e.g., `DOCUSEAL_API_URL`)

For Edge Functions:

- [ ] Bearer tokens (`WATCHDOG_CRON_SECRET`, etc.) deployed via
      `npx supabase secrets set` from `smartout_ai_prod`
- [ ] `verify_jwt = false` set in `supabase/functions/config.toml` for cron-only EFs

---

## 10. Changelog

| Date       | Change                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| 2026-04-28 | Refreshed snapshot. 67→76 op:// refs, 23→28 web server vars, manifest = 64.  |
| 2026-03-23 | Initial verification (env-checker agent).                                    |

---

## 11. Related

- `docs/protocols/ENV_PROTOCOL.md` — protocol (rules + procedures)
- `docs/reference/ENV_VARS.md` — per-app variable list
- `docs/reference/SECRET_MANAGEMENT_LIVE.md` — runtime secret flow (Tiers 1/2/3)
- `infra/scripts/sync-env-to-vercel.sh` — Vercel manifest source of truth
- `infra/scripts/sync-env-to-droplet.sh` — Droplet manifest source of truth
