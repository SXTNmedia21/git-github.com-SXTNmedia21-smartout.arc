---
title: "Deployment Topology"
status: canonical
updated: 2026-04-28
created: 2026-03-29
module: cross-cutting
tags: [deployment, ci, vercel, supabase, docker]
---

# Deployment Topology

> **For step-by-step procedures**, use the `deploying` skill (auto-triggered on
> deploy-related work). This document is the static topology reference — what runs
> where, what env vars come from where, and what triggers what.

---

## 1. Surfaces

| Surface           | Host             | Branch trigger          | Source of env vars                         |
| ----------------- | ---------------- | ----------------------- | ------------------------------------------ |
| `apps/web`        | Vercel           | `main` (auto), `preview` (manual), `development` (manual) | Vercel project env (synced from `smartout_ai_prod` + `smartout_ai/Supabase Preview Branch`) |
| `apps/landing`    | Vercel           | Same as web             | Same as web (separate Vercel project)      |
| `apps/mobile`     | EAS / TestFlight | Manual `eas build`      | `apps/mobile/eas.json` env                 |
| Edge Functions    | Supabase Cloud   | `npx supabase functions deploy` | Supabase project secrets (set via `npx supabase secrets set`) |
| Stage Engine (prod) | DigitalOcean droplet (Docker) | `main` via `deploy.sh` | `/root/dev/smartout.ai/infra/.env` (synced from `smartout_ai_prod`) |
| Contract Service  | DigitalOcean droplet (Docker) | Same                | Same                                       |
| Shift MCP         | DigitalOcean droplet (Docker) | Same                | Same                                       |
| Scrapling         | DigitalOcean droplet (Docker) | Same                | Same                                       |
| N8N               | DigitalOcean droplet (Docker) | Same                | Same                                       |
| Database          | Supabase Cloud   | `npx supabase db push` from `main` | Managed by Supabase                |
| Branch DBs        | Supabase Cloud   | Created per long-lived branch | Same                                 |

---

## 2. Release Flow

```
development  →  preview  →  main
   (work)        (staging)   (production)
```

- **`development`** — integration branch, accepts direct commits and pushes
- **`preview`** — fast-forwarded from `development`; deploys to Vercel preview env
- **`main`** — only via PR from `preview`; deploys to Vercel production AND triggers
  droplet `deploy.sh` (manual SSH for now)

| Command                  | What                                                            |
| ------------------------ | --------------------------------------------------------------- |
| `/promote-preview`       | Fast-forward `development` → `preview` (Pontus only). Gated on CI green + Vercel READY + FF-ancestry. |
| Vercel preview deploy    | Manual: `vercel --target preview --yes`                          |
| Vercel main deploy       | Auto on push to `main`                                          |
| Droplet deploy           | SSH droplet, run `infra/scripts/deploy.sh` (pulls main, syncs env, rebuilds) |
| Edge Function deploy     | `npx supabase functions deploy <name>` (per function)           |
| DB migration             | `npx supabase db push` against production                       |

---

## 3. Env Variable Flow Per Surface

> Authoritative file: `docs/protocols/ENV_PROTOCOL.md`. Manifest sources of truth:
> `infra/scripts/sync-env-to-vercel.sh` and `infra/scripts/sync-env-to-droplet.sh`.

| Surface                 | Vault read       | Sync script                              | Trigger                              |
| ----------------------- | ---------------- | ---------------------------------------- | ------------------------------------ |
| Vercel preview (web/landing, non-Supabase) | `smartout_ai_prod` | `sync-env-to-vercel.sh` (target: shared) | Manual after env change             |
| Vercel preview (Supabase) | `smartout_ai/Supabase Preview Branch` | `sync-env-to-vercel.sh` (target: preview) | Manual                  |
| Vercel production       | `smartout_ai_prod` | `sync-env-to-vercel.sh` (target: shared + production) | Manual                |
| Droplet                 | `smartout_ai_prod` | `sync-env-to-droplet.sh`               | Auto via `deploy.sh`, or manual `--remote` |
| Edge Functions          | `smartout_ai_prod` | `npx supabase secrets set`             | Manual per env var                   |
| Local dev               | `smartout_ai`    | `op run --env-file=.env.template`        | Implicit via `pnpm dev`              |

---

## 4. CI Status Checks (required for `main` PRs)

Defined in GitHub Rulesets (`main` ruleset 14797822, `preview` ruleset 15290760).
**11 status checks required** to merge to `main`. `pgTAP Suites` and `Enforce branch flow`
are explicitly **not** required (PR-only triggers, would block FF-promote).

> See `docs/reference/GIT-WORKFLOW.md` for branch protection details.

---

## 5. Hard Rules

- ⛔ Never commit directly to `main`
- ⛔ Never commit directly to `preview` (FF only)
- ⛔ Never push `main`
- ⛔ Never push `preview`
- ⛔ Never edit Vercel env vars manually (next sync wipes them)
- ⛔ Never edit `infra/.env` on the droplet manually (next sync wipes it)
- ⛔ Never deploy a Branch DB into production by accident — always `--linked`/`--project-ref` to the right project
- ⛔ Never run a migration locally against production (Supabase Cloud)
- ⛔ Never run the global `~/.claude/scripts/promote-preview.sh` directly — always run the repo wrapper `./infra/scripts/promote-preview.sh` so smoke-probe + lkg-tag enforce (ADR-0262)
- ⛔ Never open a `preview → main` PR without using the `preview-to-main.md` template — required checklist enforces validated preview, smoke green, rollback target SHA (ADR-0262)
- ⛔ Never bypass the 14 required CI checks. As of 2026-05-03 (ADR-0262): the original 11 + `Enforce branch flow` + `pgTAP Suites` + `authority-seed-parity`
- ⛔ Never deploy Edge Functions outside CI on main push. Manual `supabase functions deploy` is only for emergency rollback; record in activity-log
- ⛔ Never ignore a `drift-check` heartbeat alert — it indicates env-var or migration drift between codebase and live deploy state

---

## 6. Operating Workflow

For every deploy-touching change, use the `deploying` skill (auto-loaded). It walks
through pre-flight checks, env sync, migrations, and post-deploy verification.

---

## 7. Related

| Document                                   | Purpose                                          |
| ------------------------------------------ | ------------------------------------------------ |
| `docs/protocols/ENV_PROTOCOL.md`           | Env var protocol (vaults, sync, validation)     |
| `docs/protocols/ENV_VERIFICATION.md`       | Current snapshot of env consistency              |
| `docs/protocols/SECURITY.md`               | Three Laws + Vault Naming + Preview security    |
| `docs/reference/GIT-WORKFLOW.md`           | Branch protection, ruleset IDs, FF rules        |
| `docs/reference/SECRET_MANAGEMENT_LIVE.md` | Runtime secret flow (Tiers 1/2/3)               |
| `infra/scripts/deploy.sh`                  | Droplet deploy script                            |
| `infra/scripts/sync-env-to-vercel.sh`      | Vercel env sync (NUKE-AND-REPLACE)               |
| `infra/scripts/sync-env-to-droplet.sh`     | Droplet env sync                                 |
| `.claude/commands/promote-preview.md`      | `/promote-preview` slash command                 |
