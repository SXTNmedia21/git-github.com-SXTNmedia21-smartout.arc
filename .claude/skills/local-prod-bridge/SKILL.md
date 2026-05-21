---
name: local-prod-bridge
description: |
  How to run apps/web as a production build on localhost wired to the LIVE Supabase Cloud project, make direct production-infrastructure changes (DB migrations, Edge Functions, auth config, secrets) that are live immediately, then ship the code change through the normal pipeline to main. Use during the no-customer hotfix phase to reproduce and fix production bugs fast.

  Triggers (English): local prod, prod parity, local-prod, hotfix loop, reproduce prod bug, live supabase from localhost, direct prod change, prod infrastructure change, apply migration to prod, deploy edge function to prod, prod auth config, next start prod build, cookie domain bug, app.smartout.ai locally.

  Triggers (Norwegian): lokal prod, prod-paritet, repro prod-bug, live supabase lokalt, endre prod-infrastruktur, kjør migrasjon på prod, prod auth-config, hotfix-loop, fikse prod-feil raskt, direkte prod-endring.

  Triggers (files/paths): infra/scripts/local-prod.sh, .env.local-prod.template.

  ALWAYS load before running local-prod.sh, before applying any change directly to the live Supabase Cloud project (yljaglomadbhyqpcigff), or when reproducing a production-only bug locally.
---

# Local-Prod Bridge — fast production hotfix loop

> **Phase gate:** this is a **no-customer-phase** fast lane (Pontus decision 2026-05-21).
> It deliberately bends two CLAUDE.md rules: "never develop against prod Supabase"
> and the dev→preview→main discipline for *infra* changes. It does NOT bend the
> code-deploy rule — web code still ships through the normal pipeline to main.
> **Re-tighten everything (§7) before the first customer goes live.**

---

## 1. What this is

Two independent surfaces, one goal — change production and see it instantly:

| Surface | Tool | When it's live |
|---------|------|----------------|
| **Web/Next.js runtime** (middleware, routes, RSC, cookies) | `infra/scripts/local-prod.sh` — prod build on localhost against live Supabase | Local only. Real deploy = **pipeline** (Vercel builds on main push). |
| **DB schema / data** | Supabase MCP `apply_migration`, `execute_sql` on `yljaglomadbhyqpcigff` | **Instantly live on prod DB.** |
| **Edge Functions** | Supabase MCP `deploy_edge_function` | **Instantly live on prod.** |
| **Auth config / redirect URLs / providers** | Supabase dashboard or management API | **Instantly live on prod.** |
| **Secrets** | `op` → `smartout_ai_prod` vault → host (Vercel) / Supabase Vault | Live on next read (runtime) or redeploy (build). |

**Mental model:** infra changes (DB, EF, auth, secrets) can be applied *directly* to
prod and are live immediately. Web code can only be *previewed* locally — it reaches
prod through the pipeline. So: iterate code locally with prod-parity, apply infra
directly when needed, then land code via the normal pipe.

---

## 2. Live production project

| | |
|---|---|
| Project ref | `yljaglomadbhyqpcigff` (name: `smartout-live`, region eu-west-1) |
| URL | `https://yljaglomadbhyqpcigff.supabase.co` |
| Vault | `smartout_ai_prod` (1Password) |
| Anon key (public) | via MCP `get_publishable_keys` |
| Root domain | `smartout.ai` |

> The older project `hcmhwsewrcjmldjezaqk` ("SmartOut Production", 2025-10) is **not**
> live — do not target it unless explicitly asked.

---

## 3. The harness (how it's set up)

Two committed files (op:// refs only — no secrets):

- **`.env.local-prod.template`** — copy of `.env.template` with all `op://smartout_ai/`
  refs swapped to `op://smartout_ai_prod/`. Regenerate after `.env.template` changes:
  ```bash
  sed 's#op://smartout_ai/#op://smartout_ai_prod/#g' .env.template > .env.local-prod.template
  # verify: grep -c 'op://smartout_ai/' .env.local-prod.template   # must be 0
  ```
- **`infra/scripts/local-prod.sh`** — prod build + `next start` on localhost, op-injected
  prod env. Two modes.

### Cookie-domain gotcha (load-bearing)
Prod vault sets `NEXT_PUBLIC_ROOT_DOMAIN=smartout.ai`. The SSR server client then writes
auth cookies with `domain=.smartout.ai`. **A browser on `localhost` rejects a `.smartout.ai`
cookie → the session never persists.** Hence two modes:

| Mode | ROOT_DOMAIN | URL | Cookies | Reproduces |
|------|-------------|-----|---------|------------|
| `localhost` (default) | forced to `localhost` | http://localhost:3060 | host-scoped, persist ✓ | middleware/prefetch/logic bugs, the verifier-nuke. **Not** the `.smartout.ai` dual-domain collision. |
| `domain` | `smartout.ai` | https://app.smartout.ai | `.smartout.ai`-scoped ✓ | **everything**, incl. domain collision. Needs hosts + HTTPS proxy. |

---

## 4. Run it

```bash
eval $(op signin)                                   # if not signed in
# match deployed code first — run from main (or hotfix/* off main):
git fetch origin main && git switch main            # ASK Pontus before switching branch

./infra/scripts/local-prod.sh localhost             # build + boot, http://localhost:3060
SKIP_BUILD=1 ./infra/scripts/local-prod.sh localhost # faster on rebuilds
```

Build is heavy on WSL2 — OOM risk (L-0316). If `next build` is killed (exit 143/SIGTERM),
run with `TURBO_CONCURRENCY=1` and/or stop other dev servers first.

### Mode `domain` (full parity — only for cookie-domain bugs)
1. hosts: `127.0.0.1  app.smartout.ai` (Windows: `C:\Windows\System32\drivers\etc\hosts`, admin).
   Add `*.smartout.ai` slugs you test.
2. local HTTPS proxy `:443 → 127.0.0.1:3060` with a trusted CA:
   `caddy reverse-proxy --from app.smartout.ai --to localhost:3060`
3. `./infra/scripts/local-prod.sh domain`
4. **Revert the hosts entry when done** — otherwise this machine can't reach the real prod site.

---

## 5. Verifying browser/auth behaviour (no secrets)
Drive the prod build headless with Playwright (the repo has chromium). Pattern that
caught the verifier-nuke (worked example):
- launch chromium → load `/login` or `/reset-password`
- start the flow (`signInWithOAuth` / `resetPasswordForEmail`), capture `context.cookies()`
  → confirm `sb-...-code-verifier` is set, with which domain
- seed a fresh context with **only** the verifier cookie → navigate to a protected route
  (`/dashboard`) → assert the verifier survives and you are not bounced to `/login`

Backend-side diagnosis (read-only, fast): MCP `get_logs(service:"auth")`,
`execute_sql` on `auth.audit_log_entries` + `auth.flow_state` (look for
`auth_code_issued_at` set + consumed). If GoTrue issues sessions but the user lands on
`/login`, the bug is the SSR cookie layer, not the backend.

---

## 6. Applying a change directly to prod, coherently

Direct infra changes are live instantly — but the pipeline also runs migrations/EF deploys
on main push. Keep them **coherent** so the later main deploy is a no-op, not a conflict.

### DB migration (live now + pipeline-safe)
1. Write the migration file in `supabase/migrations/<YYYYMMDDHHMMSS>_desc.sql` (forward-only).
2. Apply it to prod **with the same name** so `schema_migrations` matches the repo:
   - MCP `apply_migration(project_id:"yljaglomadbhyqpcigff", name:"<YYYYMMDDHHMMSS>_desc", query:<sql>)`
3. Commit the file. When it later flows to main, CI's `supabase db push` sees it already
   applied → no-op. **Mismatched name/timestamp = double-apply or drift-check alert** (ADR-0388,
   migration coherence). Never apply ad-hoc SQL schema changes you don't also commit.

### Edge Function (live now + pipeline-safe)
1. Edit `supabase/functions/<name>/index.ts`.
2. MCP `deploy_edge_function` to prod → live instantly.
3. Commit the source so the main-push CI deploy matches.

### Auth config / redirect allowlist
- For localhost-mode OAuth/reset to work you must add `http://localhost:3060/api/auth/callback`
  to the prod project's Auth → URL Configuration redirect list (and Google console).
- This loosens prod auth slightly. **Remove it before customers** (§7).

### Secrets
- Add/rotate in `smartout_ai_prod` vault, then reference via `op://`. Never paste raw values.
  Follow `secrets-protocol`.

---

## 7. Then ship code the normal way (pipeline → main)

`local-prod.sh` never deploys web code. When the fix is verified locally:

```bash
# commit on a branch (hotfix/* off main, or development), open PR — never push main directly
op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh   # HOP A: dev → preview
gh pr create --base main --head preview --template preview-to-main.md   # HOP B: preview → main
```

Pipeline rules stay in force (ADR-0265): 14 required checks, `preview-to-main.md` template,
no `--no-verify`, no direct push/merge to main. Only Pontus promotes.

### Re-tighten before first customer (exit the no-customer phase)
- [ ] Remove `localhost:3060` redirect URL from prod Auth config + Google console.
- [ ] Revert any hosts-file `app.smartout.ai` mapping.
- [ ] Confirm every directly-applied migration / EF has a committed, merged-to-main counterpart
      (run `./infra/scripts/drift-check.sh`).
- [ ] Stop running `local-prod.sh` against live data; switch dev back to Supabase Local.

---

## 8. Safety rails (always)
- **`local-prod.sh` writes to LIVE prod data** — test users/rows hit real `auth` + workspace
  tables. The script prints a red banner. Don't leave it running.
- Never quote secret values back; use `op://` (secrets-protocol).
- Never `--no-verify`; never push/merge to main outside the pipeline.
- Direct prod SQL: prefer additive/forward-only. No destructive DDL without a committed
  migration + Pontus sign-off.
- Read `get_advisors(type:"security")` after any DDL on prod (catches missing RLS).

---

## 9. Cheat sheet
```bash
# boot prod-parity locally against live Supabase
./infra/scripts/local-prod.sh localhost

# diagnose prod auth (read-only)
#   MCP get_logs(service:auth) ; execute_sql on auth.audit_log_entries / auth.flow_state

# apply DB change live + coherent
#   write supabase/migrations/<ts>_x.sql ; MCP apply_migration(name=<ts>_x) ; commit

# deploy EF live + coherent
#   edit supabase/functions/<n>/index.ts ; MCP deploy_edge_function ; commit

# ship code (normal pipe)
op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh
gh pr create --base main --head preview --template preview-to-main.md
```
