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
| `localhost` (default) | forced to `localhost` | http://localhost:3060 | host-scoped, persist ✓ | middleware/prefetch/logic bugs, the verifier-nuke. **Not** `.smartout.ai` cookies, **not** the post-login flow. |
| `domain` | `smartout.ai` | https://app.smartout.ai | `.smartout.ai`-scoped ✓ | **everything**, incl. dual-domain collision + full authed multi-subdomain flow. Needs DNS map + :443 HTTPS proxy. |

### Topology gotcha — bare `localhost` can NOT test post-login (load-bearing)
`extractSubdomain("localhost")` returns **`{ type: "root" }`** (`apps/web/src/lib/subdomain.ts`). The
whole post-login flow assumes the prod topology:
- `app.smartout.ai` → `{ type: "portal" }` → portal `/dashboard` redirects to `/select-workspace`
- `{slug}.smartout.ai` → `{ type: "workspace" }` → renders the workspace dashboard
- `app.localhost:3060` / `{slug}.localhost:3060` → same, for dev (Chrome auto-resolves `*.localhost`)

On **bare `localhost:3060`** the OAuth callback (`next=/dashboard`) lands on a `root`-type host →
proxy.ts subdomain routing can't resolve a workspace subdomain → **ERR_TOO_MANY_REDIRECTS**.
This loop is a **local-topology artifact, NOT a prod bug.** GoTrue login succeeds (session row +
audit `login`), the exchange completes — only the post-login navigation loops. So:
- Use `localhost` mode ONLY for pre-session mechanics (verifier-nuke, middleware cookie clearing).
- To test the **authed** flow you MUST use real subdomains (`domain` mode, or `app.localhost`/`{slug}.localhost`).
- Cross-subdomain session sharing requires `.smartout.ai`-scoped cookies → `domain` mode (ROOT_DOMAIN=smartout.ai).
  Host-scoped localhost cookies do NOT carry `app.` → `{slug}.` → another reason bare-localhost can't test it.

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

### Mode `domain` — full prod parity (the ONLY way to test the authed flow)

Goal: browser believes it is on `https://app.smartout.ai` + `https://{slug}.smartout.ai`,
both resolved to the local prod build, with real `.smartout.ai` cookies. Two ways to drive it.

**Why :443 (not :8443):** the app builds **portless** cross-subdomain redirects
(`https://${slug}.${rootDomain}/dashboard`). A `:8443` proxy is never hit by those hops →
the post-login flow breaks. Cookie *domain* ignores port, but the redirect *target* does not.
So domain mode needs the proxy on **:443**.

Steps:
1. **Build domain mode** (inlines `NEXT_PUBLIC_ROOT_DOMAIN=smartout.ai` so the CLIENT sets
   `.smartout.ai` verifier/session cookies):
   ```bash
   ./infra/scripts/local-prod.sh domain      # serves http on :3060
   ```
2. **Self-signed cert** with a wildcard SAN (covers app + every workspace slug):
   ```bash
   openssl req -x509 -newkey rsa:2048 -keyout /tmp/proxy-key.pem -out /tmp/proxy-cert.pem \
     -days 1 -nodes -subj "/CN=app.smartout.ai" \
     -addext "subjectAltName=DNS:app.smartout.ai,DNS:*.smartout.ai"
   ```
3. **HTTPS proxy on :443**, preserving the original Host (do NOT rewrite to app.smartout.ai —
   workspace-subdomain requests must forward `{slug}.smartout.ai` so subdomain routing works).
   :443 needs privilege — the agent shell usually has neither sudo nor a display, so **Pontus runs this**:
   ```bash
   # easiest: caddy auto-CA, both hosts
   sudo caddy reverse-proxy --from app.smartout.ai:443 --to 127.0.0.1:3060
   # (repeat / add the workspace host you test, e.g. smartout.smartout.ai)
   ```
4. **DNS map** `app.smartout.ai` + the workspace subdomain → `127.0.0.1`:
   - Automated (Playwright, no Windows edit): launch with
     `args: ["--host-resolver-rules=MAP *.smartout.ai 127.0.0.1, MAP app.smartout.ai 127.0.0.1"]`
     + context `ignoreHTTPSErrors: true`. **But** real Google login needs a human + visible browser,
     and the agent shell has no WSLg display → can't drive headed itself.
   - Manual (Pontus's Windows Chrome): add to `C:\Windows\System32\drivers\etc\hosts` (admin):
     `127.0.0.1  app.smartout.ai` and `127.0.0.1  {slug}.smartout.ai` (e.g. `smartout.smartout.ai`).
     Click through the self-signed cert warning.
5. **Supabase redirect allowlist**: with :443 the callback is `https://app.smartout.ai/api/auth/callback`
   (portless) → already matched by the prod allow-list entry `https://*.smartout.ai`. No change needed.
   (If you ever use a port, you must add `https://app.smartout.ai:PORT/**` in Auth → URL Configuration.)
6. **Test**: open `https://app.smartout.ai/login`, do the real flow, confirm you land on the
   workspace dashboard and **stay** (session persists across the `app.` → `{slug}.` hop).
7. **Cleanup**: stop the proxy, revert Windows hosts entries (else this machine can't reach real prod).

**Distinguish local vs real prod at every step:** `curl -skI https://app.smartout.ai/login` →
**absence of `x-vercel-id`** = you hit the local proxy; presence = real prod (DNS map not active).

---

## 5. Verifying browser/auth behaviour (no secrets)

Two layers — know which one you're proving:

**A. Pre-session mechanics (automatable, headless, no real login).** Drive the prod build with
Playwright (repo has chromium). Covers the verifier-nuke + cookie clearing. Works in `localhost`
mode (domain-independent) AND in `domain` mode (real `.smartout.ai` cookies via the proxy +
`--host-resolver-rules`). Worked-example probe: `apps/e2e/domain-parity.mjs` (4 checks:
local-not-prod via `x-vercel-id`, verifier `.smartout.ai` domain, verifier survives `/dashboard`,
dual-domain orphan clearing). Pattern that caught the verifier-nuke:
- start a flow (`signInWithOAuth` / `resetPasswordForEmail`) → capture `context.cookies()` →
  confirm `sb-...-code-verifier` set + domain
- seed a context with **only** the verifier (+ optional orphan session cookies) → GET `/dashboard`
  → assert verifier survives (fix) vs len→0 (bug)

**B. The authed post-login flow (needs a REAL session → human + visible browser).** Cannot be
automated here (no Google headless, no email read, no WSLg display in the agent shell). Requires
`domain` mode + :443 proxy + real subdomains (§4). Pontus drives it in Windows Chrome; the agent
watches `/tmp/local-prod*.log` + Supabase `auth.audit_log_entries` / `auth.sessions` live.

Backend-side diagnosis (read-only, fast): MCP `get_logs(service:"auth")`, `execute_sql` on
`auth.audit_log_entries` + `auth.flow_state` (look for `auth_code_issued_at` set + consumed) +
`auth.sessions` (was a session row created?). **If GoTrue issues a session but the user lands on
`/login`/loops, the bug is the SSR cookie layer or subdomain routing, not the backend.** Temp
server-side debug: gate a `console.warn` on `process.env.LOCAL_PROD_DEBUG === "1"` and pass
`LOCAL_PROD_DEBUG=1` to the run (op run inherits the shell env) — but note that loops in
`proxy.ts`/middleware never reach `server.ts` `getUser`, so instrument `proxy.ts` for redirect-loop
diagnosis and `server.ts` only for RSC-layer null-user.

### Agent-shell constraints (plan around these)
- **No `sudo`** (harness-denied) → can't bind :443, install caddy, or `setcap`. Privileged steps = Pontus via `! <cmd>`.
- **No display** (`DISPLAY` empty, no WSLg) → can't drive a headed browser. Real OAuth = Pontus's browser.
- **`op` sessions expire** mid-session → re-auth with `! eval $(op signin)` (account `sxtn`).
- **`pkill` returns exit 144** when it hits its own process group — kill servers by PID
  (`ss -ltnp | grep :3060` → kill the `op` ancestor), not broad `pkill`.

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
