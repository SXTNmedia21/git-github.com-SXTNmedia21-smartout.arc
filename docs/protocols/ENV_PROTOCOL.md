---
title: "Environment Variables Protocol"
id: PROTO_ENV
status: canonical
layer: protocol
created: 2026-03-09
updated: 2026-04-28
depends_on:
  - PROTO_SECURITY
---

# Environment Variables Protocol

> **Smartout.ai** — Mandatory protocol for environment variable management
> **Enforced by:** CLAUDE.md reference, PR checklist, deploy pipeline
> **Parent protocol:** `docs/protocols/SECURITY.md` (Three Laws)
> **Verification snapshot:** `docs/protocols/ENV_VERIFICATION.md`

---

## 0. The Whole Picture (one diagram)

```
┌──────────────────────────── 1Password (master record) ────────────────────────────┐
│                                                                                   │
│   smartout_ai          (legacy name; functions as the "dev" vault)                │
│      ├── localhost URLs, test keys, dev secrets                                   │
│      └── "Supabase Preview Branch" item — Branch DB credentials for Vercel       │
│                                                                                   │
│   smartout_ai_prod     (production)                                               │
│      ├── Production Supabase URL/keys                                             │
│      ├── Live Stripe / SendGrid / Twilio / DocuSeal / OpenRouter / Ultravox       │
│      └── DigitalOcean droplet service credentials (n8n, Stage-Engine prod)        │
│                                                                                   │
└──────────┬─────────────────────────────────┬──────────────────────────────────────┘
           │                                 │
           │ OP_SERVICE_ACCOUNT_TOKEN        │ OP_SERVICE_ACCOUNT_TOKEN (CI / scripts)
           │ (auto-loaded by .env.sh)        │
           ▼                                 ▼
   ┌──────────────────┐         ┌────────────────────────────┐
   │ Local dev (WSL)  │         │  sync-env-to-vercel.sh     │  ← syncs ~64 vars
   │  op run \        │         │  sync-env-to-droplet.sh    │  ← syncs 15 vars
   │   --env-file=    │         │  setup-vault.sh            │  ← bootstraps vaults
   │   .env.template  │         └─────────┬──────────────────┘
   └────────┬─────────┘                   │
            │                             ├── Vercel (smartout-web + smartout-landing)
            │                             │      • shared (preview+prod) ← prod vault
            │                             │      • preview Supabase ← dev vault Branch DB
            │                             │      • production Supabase ← prod vault
            │                             │
            │                             └── DigitalOcean droplet (164.92.176.42)
            │                                    /root/dev/smartout.ai/infra/.env
            │
            ▼
   pnpm dev / pnpm build / docker compose up
```

The flow is one-directional: **1Password is the only source of truth.** Vercel, the
droplet, and `process.env` are downstream views. Editing them directly is a violation.

---

## 1. Files in the Repo

| File                      | Purpose                                                    | Committed  | Used by                                  |
| ------------------------- | ---------------------------------------------------------- | ---------- | ---------------------------------------- |
| `.env.template`           | Canonical list — `op://` references for every secret        | Yes        | `pnpm dev`, `pnpm build`, all `op run`   |
| `.env.example`            | Plain-value mirror for fallback `dev:local` flow            | Yes        | `pnpm dev:local` only (no 1Password)     |
| `.env`, `.env.local`, `.env.*.local` | Anything resolved/local                          | **Never**  | gitignored — see `.gitignore`            |
| `infra/.env`              | Droplet runtime env (written by `sync-env-to-droplet.sh`)   | **Never**  | `docker compose` on the droplet          |
| `apps/web/src/env.ts`     | Zod validation for web app (28 server + 11 client vars)     | Yes        | Build-time + runtime via `@t3-oss/env`   |
| `apps/landing/src/env.ts` | Zod validation for landing (14 server + 6 client vars)      | Yes        | Build-time + runtime via `@t3-oss/env`   |

Counts as of 2026-04-28: `.env.template` has **76 `op://` references** + 18 hardcoded
plain values (see §3). Total declared variable lines: 94.

---

## 2. Two-Vault Architecture (the law)

> Authority: `docs/protocols/SECURITY.md` §2.3 "Vault Naming". Supersedes ADR-0055.

| Vault              | Environment           | Used by                                          |
| ------------------ | --------------------- | ------------------------------------------------ |
| `smartout_ai`      | Development + Preview | Local dev, Vercel preview Supabase (Branch DB)   |
| `smartout_ai_prod` | Production            | Vercel production, DigitalOcean droplet, Vercel "shared" (preview + production for non-Supabase vars) |

**Critical:** The dev vault is named `smartout_ai`, not `smartout_ai_dev`. This is a
historical artifact and will not be renamed. ADR-0055 proposed `smartout_dev`/`smartout_prod`
but those names were never used in code.

### Where each environment reads from

| Surface                       | Vault used                                            | How                                |
| ----------------------------- | ----------------------------------------------------- | ---------------------------------- |
| Local dev (WSL)               | `smartout_ai` only                                    | `op run --env-file=.env.template`  |
| Vercel preview — Supabase     | `smartout_ai/Supabase Preview Branch`                 | `sync-env-to-vercel.sh` manifest   |
| Vercel preview — everything else | `smartout_ai_prod` (shared with production)        | `sync-env-to-vercel.sh` manifest   |
| Vercel production             | `smartout_ai_prod`                                    | `sync-env-to-vercel.sh` manifest   |
| Droplet (n8n, Stage-Engine prod) | `smartout_ai_prod`                                 | `sync-env-to-droplet.sh` → infra/.env |

> Why preview shares prod for non-Supabase: Stripe, SendGrid, etc. don't have separate
> "preview" environments. Branch DB isolates the database; everything else points at
> production providers. See `docs/protocols/SECURITY.md` §16 for the security rationale.

---

## 3. Hardcoded Values in `.env.template`

Static across all environments (don't put these in 1Password):

```bash
NEXT_PUBLIC_LANDING_VARIANT=T
NEXT_PUBLIC_INTERACTIVE_DASHBOARD=false
NEXT_PUBLIC_STAGE_ENGINE_WS_URL=ws://localhost:5010   # dev only
SESSION_EXPIRY_HOURS=24
CLEANUP_INTERVAL_MINUTES=5
SESSION_PENDING_SIGNOFF_STALE_HOURS=24
SENTRY_ORG=smartout
SENTRY_PROJECT=smartout-web
SENTRY_TRACES_SAMPLE_RATE=         # blank -> Sentry uses internal default
GITHUB_ERROR_REPO=SXTNmedia21/smartout.ai
LOG_LEVEL=debug
DOCUSEAL_API_URL=https://api.docuseal.com
SMARTOUT_COMPANY_NAME="Smartout AS"
PLATFORM_COMPANY_NAME="Smartout AS"
ALLOWED_ORIGINS=http://localhost:3060,http://localhost:3055
NEXT_PUBLIC_FF_MY_CV=false
NEXT_PUBLIC_FF_SHIFT_CLOCK_LEADER=false
NEXT_PUBLIC_FF_AI_CHAT=false
```

**`NODE_ENV` is intentionally not in the template** — Next.js sets it per command
(`next dev` → development, `next build` → production). Forcing it here breaks
production prerendering.

---

## 4. Adding a New Variable

### 4.1 It's a secret (API key, token, password, connection string)

1. Add to `.env.template` with `op://` reference using the **dev vault**:

   ```bash
   NEW_SERVICE_API_KEY="op://smartout_ai/ServiceName/api_key"
   ```

2. Place under the correct section header (or create a new one — see §5).

3. Create item in **both** vaults — easiest via the setup script:

   ```bash
   # Local dev: .env.sh auto-loads OP_SERVICE_ACCOUNT_TOKEN on cd into the repo.
   # Admin biometric session is only needed when creating new vault items
   # (service-account tokens lack item-create scope by design).
   eval "$(op signin)"
   ./scripts/setup-vault.sh --sync .env.template
   ```

   This creates the missing item in `smartout_ai` (with `REPLACE_ME`) and mirrors it
   to `smartout_ai_prod` (with `REPLACE_ME_PROD`). Then fill in the real values in
   1Password — dev value in dev vault, prod value in prod vault.

4. Update `.env.example` with the literal var name + empty/example value:

   ```bash
   NEW_SERVICE_API_KEY=
   ```

5. Add to `apps/web/src/env.ts` and/or `apps/landing/src/env.ts` Zod schema if the
   web/landing apps need it (use `.optional()` so Vercel CI doesn't break).

6. If the variable is needed in production:
   - Vercel: add to `infra/scripts/sync-env-to-vercel.sh` MANIFEST
   - Droplet (Docker services): add to `infra/scripts/sync-env-to-droplet.sh` MANIFEST
   - Run the relevant sync script

7. Run validation (§7).

### 4.2 It's not a secret (URL, port, flag, config)

1. If it differs between environments → still goes in 1Password (`op://...`)
2. If it's the same in all environments → hardcode in `.env.template` (§3)
3. Mirror to `.env.example` with the same plain value

⛔ **Never hardcode environment-specific URLs in `.env.template`.** A localhost URL
in the template means production reads `localhost`. Always reference the vault.

---

## 5. Sections in `.env.template`

Variables are grouped under comment headers. Current sections (verified 2026-04-28):

```
# ── Supabase (bootstrap — required for everything) ──
# ── Client-side (public, safe to expose) ──
# ── Service URLs ──
# ── Sentry (build-time — read implicitly by Sentry plugin) ──
# ── GitHub Error Reporter ──
# ── App config ──
# ── Auth ──
# ── Stripe ──
# ── Email / SMS ──
# ── AI / Search / Voice ──
# ── Contracts ──
# ── Cache ──
# ── Landing-only ──
# ── Supabase external auth (read by supabase/config.toml at runtime) ──
# ── CORS (Edge Functions) ──
# ── Feature flags ──
```

New services get a new section. Don't dump into existing sections.

---

## 6. Vault Item Conventions

- One 1Password item per logical service (Supabase, Stripe, Twilio, etc.)
- Fields named descriptively in `snake_case`: `api_key`, `secret_key`, `webhook_secret`,
  `connection_string`, `url`, `account_sid`, `auth_token`
- Reference format: `op://{vault}/{ItemName}/{field_name}`
- Item names use **PascalCase or kebab-case** (matching what's in 1Password):
  `Stripe`, `SendGrid`, `Stage-Engine`, `Contract-Service`, `livekit`

Examples:

```bash
SUPABASE_URL="op://smartout_ai/Supabase/url"
STRIPE_SECRET_KEY="op://smartout_ai/Stripe/secret_key"
STAGE_ENGINE_API_KEY="op://smartout_ai/Stage-Engine/api_key"
LIVEKIT_API_SECRET="op://smartout_ai/livekit/api-secret"
```

---

## 7. Validation

### 7.1 Drift check — code references vs `.env.template`

```bash
# All process.env references in code
grep -rhoP 'process\.env\.\K[A-Z_]+' apps/ packages/ services/ \
  --include="*.ts" --include="*.tsx" | sort -u > /tmp/used.txt

# All declared in template
grep -oP '^[A-Z_]+' .env.template | sort -u > /tmp/declared.txt

# Vars used in code but missing from template
comm -23 /tmp/used.txt /tmp/declared.txt
```

Empty output = clean. Anything output = fix before commit.

### 7.2 op:// reference resolution

```bash
op run --env-file=.env.template -- env | grep -E "STRIPE|SENDGRID|TWILIO|UPSTASH"
```

Empty/`op://...` strings = vault item missing or signed out.

### 7.3 Zod schema check

```bash
pnpm --filter web typecheck
pnpm --filter landing typecheck
```

`@t3-oss/env-nextjs` runs Zod validation at build time. `SKIP_ENV_VALIDATION=1`
bypasses it (use sparingly — only for local debug).

### 7.4 Vercel manifest vs env.ts

The `sync-env-to-vercel.sh` MANIFEST must cover every required variable in
`apps/web/src/env.ts` and `apps/landing/src/env.ts`. After changes, dry-run:

```bash
op run --env-file=.env.template -- ./infra/scripts/sync-env-to-vercel.sh --dry-run
```

---

## 8. Forbidden

- ⛔ Never create `.env`, `.env.local`, or `.env.*.local` — gitignored, but also
  bypasses the `op run` flow. Use `op run --env-file=.env.template` instead.
- ⛔ Never hardcode secrets in code, comments, migrations, or seeds.
- ⛔ Never hardcode env-specific URLs in `.env.template`.
- ⛔ Never put real secrets as plain values in `.env.example`.
- ⛔ Never duplicate variables across sections in `.env.template`.
- ⛔ Never remove a variable from `.env.template` without first running the §7.1
  drift check.
- ⛔ Never update one vault and forget the other (see §11 sync rule).
- ⛔ Never paste raw secret values into AI chat or PR descriptions.

---

## 9. Running the App

| Command                                              | What it does                                             |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                                           | `op run --env-file=.env.template -- turbo run dev`       |
| `pnpm dev:local`                                     | `turbo run dev` — reads `.env.local` (no 1Password)      |
| `pnpm build`                                         | Auto-detects `op` and runs `op run` if available         |
| `pnpm --filter web dev`                              | Web only, port **3060**                                  |
| `pnpm --filter landing dev`                          | Landing only, port **3055**                              |
| `./scripts/dev-startup.sh`                           | Full dev env (1Password sign-in, Docker, Supabase, web, landing, mobile) |
| `op run --env-file=.env.template -- docker compose up` | Local Docker services with vault-resolved env          |

Supabase Local default API port: **54321** (see `supabase/config.toml`).
Web app dev port: **3060**. Landing dev port: **3055**.

---

## 10. New Worktree / New Clone

`.env.template` and `.env.example` are tracked in git — they exist in every worktree
automatically. The dev service-account token is loaded automatically:

```
.claude/op-auth.json   ← chmod 600, gitignored, holds OP_SERVICE_ACCOUNT_TOKEN
.env.sh                ← gitignored, sourced by ~/.bashrc cd-hook
```

When you `cd` into the repo, `.env.sh` reads the token from JSON and exports
`OP_SERVICE_ACCOUNT_TOKEN`. After that, `op whoami` and `op run --env-file=...`
work without prompting.

For a fresh clone, copy `.claude/op-auth.json` from a working machine (or
provision a new service-account token via 1Password.com → Service Accounts).
Verify:

```bash
op whoami    # USER_TYPE: SERVICE_ACCOUNT
op run --env-file=.env.template -- env | grep NEXT_PUBLIC_SUPABASE_URL
pnpm dev
```

Production secrets are sourced separately and never via the dev service-account
token.

---

## 11. Rotating a Secret

1. Update the value in **both** vaults — `smartout_ai` (dev) AND `smartout_ai_prod`
   (production), unless rotation is environment-specific.
2. For runtime services (Vercel, droplet) the value is read at process start. Trigger:
   - Vercel: `./infra/scripts/sync-env-to-vercel.sh` then redeploy from Vercel dashboard
   - Droplet: SSH in and run `infra/scripts/deploy.sh` (calls sync-env-to-droplet.sh)
   - Local dev: next `op run` picks up the new value automatically
3. If the secret is in **Supabase Vault** (Tier 2 — Stripe, SendGrid, Twilio, DocuSeal,
   Ultravox, OpenRouter), also update via the platform-admin Keys & Secrets UI. See
   `docs/reference/SECRET_MANAGEMENT_LIVE.md` for runtime access patterns.
4. Follow rotation schedule in `docs/protocols/SECURITY.md` §9.

⛔ **Never leave the two vaults out of sync.** A rotation that updates only one vault
creates a silent prod-vs-dev divergence that surfaces as a runtime error in production.

---

## 12. Sync Scripts

### 12.1 `scripts/setup-vault.sh` — vault bootstrap

Reads `.env.template`, creates missing items + fields in 1Password.

```bash
./scripts/setup-vault.sh                        # Setup dev vault from .env.template
./scripts/setup-vault.sh --sync                 # Setup dev + mirror to prod vault
./scripts/setup-vault.sh --prod-vault NAME      # Override prod vault name
./scripts/setup-vault.sh --env-file FILE        # Use different template file
```

Fills new fields with `REPLACE_ME` (dev) and `REPLACE_ME_PROD` (prod) — open 1Password
and replace with real values. Idempotent: safe to re-run after adding new vars.

### 12.2 `infra/scripts/sync-env-to-vercel.sh` — Vercel sync

NUKE-AND-REPLACE: deletes ALL env vars from the project, then re-adds from 1Password
based on the inline MANIFEST.

```bash
./infra/scripts/sync-env-to-vercel.sh                    # Sync all (web + landing)
./infra/scripts/sync-env-to-vercel.sh --dry-run          # Preview
./infra/scripts/sync-env-to-vercel.sh --project smartout-web    # One project
```

Manifest format: `project|target|key|op_ref|sensitive`. Targets: `shared` (preview+prod),
`preview`, `production`. As of 2026-04-28 the manifest contains **64 entries** (41 web,
23 landing). Authoritative count.

⛔ **Don't manually edit Vercel env vars** — they will be wiped on next sync. Always
update via the manifest + 1Password.

### 12.3 `infra/scripts/sync-env-to-droplet.sh` — DigitalOcean sync

Resolves 15 production vars from `smartout_ai_prod` + 3 static (`NODE_ENV=production`,
`LOG_LEVEL=info`, `APP_URL=https://app.smartout.ai`) and writes to `infra/.env` on the
droplet (or locally for inspection).

```bash
./infra/scripts/sync-env-to-droplet.sh                    # Local infra/.env only
./infra/scripts/sync-env-to-droplet.sh --remote           # SSH + write to droplet
./infra/scripts/sync-env-to-droplet.sh --dry-run          # Preview (redacted values)
```

Called automatically by `infra/scripts/deploy.sh` on the droplet.

⛔ Don't quote values in `infra/.env` — Docker Compose treats quotes as literal. The
sync script handles this correctly; manual edits often don't.

---

## 13. CI/CD Service Account

Local dev uses interactive `op run`. Automated pipelines (Vercel sync, droplet deploy,
GitHub Actions) use a 1Password Service Account.

| Context                  | Method                                              |
| ------------------------ | --------------------------------------------------- |
| Local development        | `op run --env-file=.env.template` (interactive CLI) |
| Vercel env sync          | `OP_SERVICE_ACCOUNT_TOKEN` env                      |
| DigitalOcean env sync    | `OP_SERVICE_ACCOUNT_TOKEN` env on droplet           |
| GitHub Actions (future)  | `OP_SERVICE_ACCOUNT_TOKEN` from GitHub Secrets      |

Rules:

- Service account has **read-only** access to both vaults
- Token stored in GitHub Secrets / Vercel envs / droplet shell — never in code
- Rotate service account token on personnel changes (offboard rule)

---

## 14. Preview Environment Variables (Vercel)

Preview deployments (Vercel) are **not** automatically wired by the Supabase-Vercel
integration in this project. They get env vars from the explicit MANIFEST in
`infra/scripts/sync-env-to-vercel.sh`:

| Target       | Source vault                 | Notes                                              |
| ------------ | ---------------------------- | -------------------------------------------------- |
| `shared`     | `smartout_ai_prod`           | Preview + production for non-Supabase vars         |
| `preview`    | `smartout_ai/Supabase Preview Branch` | Branch DB credentials (separate item)     |
| `production` | `smartout_ai_prod/Supabase`  | Live Supabase Cloud                                |

The "Supabase Preview Branch" item in the dev vault holds Branch DB credentials. These
are populated when the Supabase branch is created via the dashboard / `supabase branches`
CLI — a one-time setup per long-lived branch.

> Trap: Edge Functions in preview still hit production Supabase. Branch isolation is
> Vercel-side only. See `docs/protocols/SECURITY.md` §16.

---

## 15. Edge Function Env Vars

Edge Functions get env vars from `supabase/functions/.env` (gitignored) and the
Supabase Dashboard secrets. Distinct from the Vercel/droplet flow.

Auto-injected by Supabase runtime: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

Other vars are deployed via:

```bash
npx supabase secrets set --env-file ./supabase/.env
```

Or set individually in the Supabase Dashboard. Bearer-token cron secrets
(`WATCHDOG_CRON_SECRET`, `PROCESS_NOTIFICATIONS_SECRET`, `MORNING_DIGEST_SECRET`,
`PUSH_DISPATCH_SECRET`) are mirrored from `smartout_ai_prod` to Supabase secrets.

Full list: `docs/reference/ENV_VARS.md` § "Edge Function Variables".

---

## 16. Verification Cadence

| When                          | What                                                |
| ----------------------------- | --------------------------------------------------- |
| Adding any env var            | Drift check (§7.1)                                  |
| PR with env-related changes   | Manifest dry-run (`sync-env-to-vercel.sh --dry-run`)|
| Quarterly                     | Refresh `docs/protocols/ENV_VERIFICATION.md`        |
| After secret rotation         | `op run` resolves end-to-end + smoke test           |
| New worktree                  | `op whoami` + `op run --env-file=.env.template -- env \| head -5` |

---

## 17. Related Documents

| Document                                          | Purpose                                                |
| ------------------------------------------------- | ------------------------------------------------------ |
| `docs/protocols/SECURITY.md`                      | Three Laws, vault naming, secret tiers (Tier 1/2/3)    |
| `docs/protocols/ENV_VERIFICATION.md`              | Current drift snapshot (validate on schedule)          |
| `docs/reference/ENV_VARS.md`                      | Full per-app variable list with Zod validation rules   |
| `docs/reference/SECRET_MANAGEMENT_LIVE.md`        | Runtime secret flow (Vault, get_secret, rotation)      |
| `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md` | Tier 1/3 API key DB schema + validation         |
| `scripts/setup-vault.sh`                          | Bootstrap 1Password from `.env.template`               |
| `infra/scripts/sync-env-to-vercel.sh`             | NUKE-AND-REPLACE Vercel env from manifest              |
| `infra/scripts/sync-env-to-droplet.sh`            | Resolve prod vars to droplet `infra/.env`              |
| `infra/scripts/deploy.sh`                         | Droplet deploy (calls sync-env-to-droplet.sh)          |
| `apps/web/src/env.ts`, `apps/landing/src/env.ts`  | Zod validation entry points                            |
