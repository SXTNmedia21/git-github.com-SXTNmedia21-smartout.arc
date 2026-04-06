---
title: "Environment Variables Protocol"
id: PROTO_ENV
status: canonical
layer: protocol
created: 2026-03-09
updated: 2026-04-06
depends_on:
  - PROTO_SECURITY
---

# Environment Variables Protocol

> **Smartout.ai** — Mandatory protocol for environment variable management
> **Enforced by:** CLAUDE.md reference, PR checklist
> **Parent protocol:** `docs/protocols/SECURITY.md` (Three Laws)

---

## 1. Single Source of Truth

`.env.template` in project root is the canonical list of all environment variables.
Every variable the codebase references MUST exist in this file.

---

## 2. When Adding a New Variable

### 2.1 It's a secret (API key, token, password, connection string)

1. Add to `.env.template` with `op://` reference:
   ```
   NEW_SERVICE_API_KEY="op://smartout_ai/ServiceName/api_key"
   ```
2. Place under the correct section header, or create a new one
3. Create the item in 1Password if it doesn't exist:
   ```bash
   op item create --vault smartout_ai --category "API Credential" --title "ServiceName" api_key=REPLACE_ME
   ```
4. Update `.env.example`:
   ```bash
   sed 's/=op:\/\/.*/=REPLACE_ME/' .env.template > .env.example
   ```

### 2.2 It's not a secret (URL, port, flag, config)

1. Add to `.env.template` as plain value:
   ```
   NEW_SERVICE_URL=http://localhost:5020
   ```
2. Add same line to `.env.example`

---

## 3. Sections in .env.template

Group variables under comment headers. Current sections:

```
# ── Supabase ──
# ── Client-side (public) ──
# ── Service URLs (internal) ──
# ── Sentry ──
# ── App config (non-secret) ──
# ── Auth ──
# ── Stripe ──
# ── Email / SMS ──
# ── AI / Search / Voice ──
# ── Contracts ──
# ── Cache ──
# ── Vision ──
# ── Landing-only ──
# ── n8n ──
```

New services get a new section. Don't dump into existing sections.

---

## 4. Vault Structure

- **Vault:** `smartout_ai`
- **One item per service** (Supabase, Stripe, Twilio, etc.)
- **Fields named descriptively:** `api_key`, `secret_key`, `webhook_secret`, `connection_string`
- **Reference format:** `op://smartout_ai/{ItemName}/{field_name}`

---

## 5. Validation

Before committing, verify no orphan env vars exist:

```bash
# Find all process.env references in code
grep -rhoP 'process\.env\.\K[A-Z_]+' apps/ packages/ services/ --include="*.ts" --include="*.tsx" | sort -u > /tmp/used.txt

# Find all declared variables in .env.template
grep -oP '^[A-Z_]+' .env.template | sort -u > /tmp/declared.txt

# Show vars used in code but missing from .env.template
comm -23 /tmp/used.txt /tmp/declared.txt
```

Empty output = all variables are covered. If not, add the missing ones.

---

## 6. Forbidden

- Never create `.env` or `.env.local` files (use `op run`)
- Never hardcode secrets in code
- Never put secrets as plain values in `.env.template`
- Never duplicate variables across sections
- Never remove a variable from `.env.template` without checking code references first

---

## 7. Running the App

```bash
# With 1Password (recommended)
op run --env-file=.env.template -- pnpm run dev

# Single app
op run --env-file=.env.template -- pnpm --filter web dev

# Alias
opdev pnpm run dev
```

---

## 8. New Worktree / New Clone

`.env.template` is in git — it exists in all worktrees automatically.
No extra setup needed. Just `op run`.

---

## 9. Rotating a Secret

1. Update value in 1Password (app or CLI)
2. Next `op run` picks up the new value automatically
3. No files to change, no commits needed
4. Follow rotation schedule in `docs/protocols/SECURITY.md` §9

---

## Service Account for CI/CD

Local development uses interactive `op run`. Automated pipelines use a 1Password Service Account.

```bash
# Local (interactive)
op run --env-file=.env.template -- pnpm run dev

# CI/CD (service account)
OP_SERVICE_ACCOUNT_TOKEN=<token> op run --env-file=.env.template -- <command>
```

The service account has read-only access to `smartout_ai` and `smartout_ai_prod` vaults.

---

## Preview Environment Variables

Preview deployments (Vercel) receive Supabase Branch DB credentials automatically via the Supabase-Vercel integration. No manual env var configuration needed for preview.

Non-Supabase env vars for preview are synced by `infra/scripts/sync-env-to-vercel.sh` with `gitBranch: 'preview'`.
