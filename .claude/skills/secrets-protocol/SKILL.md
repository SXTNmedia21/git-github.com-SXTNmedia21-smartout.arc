---
name: secrets-protocol
description: |
  THE LAW for credentials. MUST be loaded before creating, rotating, classifying, committing, or discussing any secret, credential, or environment variable.

  Triggers (English): secret, credential, password, API key, access token, bearer token, refresh token, JWT, service role, anon key, publishable key, signing secret, webhook secret, connection string, .env, env var, environment variable, rotate, leak, exposure, 1Password, op://, vault, classification, hardcoded key, commit key.

  Triggers (Norwegian): hemmelighet, legitimasjon, passord, nøkkel, rotere, lekket, sikkerhet.

  Triggers (files/paths): .env*, .env.template, apps/web/src/env.ts, supabase/.env, packages/supabase/.env, scripts/*env*sync*.sh, any file adding a `process.env.X` or `Deno.env.get`.

  Triggers (patterns): literal API-key values pasted by user, `Bearer ` tokens in source, `console.log` of credentials, raw values in commits, AI prompts containing secret values.

  Traps to remember: two-vault architecture (`smartout_ai` dev/shared + `smartout_ai_prod` prod) — never mix. Secrets NEVER enter AI context — if a user pastes one, suggest op:// replacement and do not quote the value back. Rotate immediately on suspected exposure.

  ALWAYS load when editing .env*, apps/web/src/env.ts, 1Password config, any auth flow, any sync script, or when a user mentions a credential by name.
---

# Secrets Protocol

**Secrets never touch AI context. This is the law.**

## The Rules

1. **Never expose to AI** — No secret values in prompts, logs, or AI tool context
2. **Classify first** — Every secret gets `env`, `type`, and `scope` tags
3. **Single source of truth** — 1Password is the master record
4. **Two vaults, always** — Every project has `{product}_dev` and `{product}_prod` vaults
5. **Vault drives environment** — URLs, keys, and config are vault-stored, not hardcoded
6. **Least privilege** — Secrets only accessible where needed
7. **Rotate by default** — All secrets have a rotation schedule
8. **Audit everything** — Every access, rotation, and exception is logged

## Hard Enforcement

⛔ **DO NOT accept raw secret values** — Always refuse, suggest op:// reference

⛔ **DO NOT store secrets in code** — No hardcoded values, ever

⛔ **DO NOT skip classification** — env / type / scope required before storage

⛔ **DO NOT share via chat** — Secrets never travel through Slack/email/AI

⛔ **DO NOT use same value for dev/prod** — Separate secrets per environment

⛔ **DO NOT hardcode URLs in .env.template** — Service URLs go in the vault

⛔ **DO NOT create one vault without the other** — Both dev and prod, always

This is not optional. This is the protocol.

---

## Two-Vault Architecture

Every project gets two 1Password vaults. The vault name determines the environment.
The `.env.template` uses `op://` references — same file for both environments.

### Naming Convention

```
{product}_dev   → development vault (localhost URLs, test keys)
{product}_prod  → production vault  (real URLs, live keys)
```

**Examples:**

- `smartout_ai` → dev (legacy name, equivalent to `smartout_ai_dev`)
- `smartout_ai_prod` → production

### What Goes in the Vault

**Everything that differs between environments:**

| Category     | Dev Vault Value          | Prod Vault Value                |
| ------------ | ------------------------ | ------------------------------- |
| Service URLs | `http://localhost:8000`  | `https://scrape.smartout.ai`    |
| Database     | `http://127.0.0.1:54321` | `https://{project}.supabase.co` |
| API keys     | Test/sandbox keys        | Live keys                       |
| App URLs     | `http://localhost:3060`  | `https://app.smartout.ai`       |
| NODE_ENV     | `development`            | `production`                    |
| Stripe       | `sk_test_*`              | `sk_live_*`                     |

**What stays hardcoded in `.env.template` (same in all environments):**

- `GENERIC_TIMEZONE=Europe/Oslo`
- `SESSION_EXPIRY_HOURS=24`
- `SENTRY_ORG=smartout`
- `NEXT_PUBLIC_LANDING_VARIANT=T`
- `SMARTOUT_COMPANY_NAME=Smartout AS`

### .env.template Pattern

```bash
# ALL environment-specific values come from vault
SCRAPLING_SERVICE_URL="op://smartout_ai/Scrapling/url"
NODE_ENV="op://smartout_ai/SmartOut/node_env"

# Only truly static values are hardcoded
GENERIC_TIMEZONE=Europe/Oslo
```

To switch to production: replace `smartout_ai` with `smartout_ai_prod` in `.env.template`.
Or maintain a separate `.env.template.prod` (less recommended — harder to keep in sync).

### Vault Sync Rule

When creating or updating a secret:

1. Update the dev vault first
2. Update the prod vault immediately after
3. If one vault doesn't exist yet, create it by duplicating the other
4. Never leave vaults out of sync

### WSL Environment

Running on WSL (Windows Subsystem for Linux). 1Password CLI authentication:

```bash
# Sign in (WSL requires eval)
eval $(op signin)

# Verify
op whoami

# Run with secrets
op run --env-file=.env.template -- pnpm dev
```

---

## New Project Setup

When starting a new project, create both vaults immediately:

```bash
# 1. Create vaults
op vault create "{product}_dev"
op vault create "{product}_prod"

# 2. Run setup script to populate from .env.template
./scripts/setup-vault.sh .env.template

# 3. Fill in actual values in both vaults
# Dev: localhost URLs, test keys
# Prod: real URLs, live keys
```

### Setup Script

`scripts/setup-vault.sh` reads `.env.template`, parses `op://` references, and creates
missing items in 1Password. It handles both vaults:

```bash
# Create items in dev vault (reads from template)
./scripts/setup-vault.sh .env.template

# Sync structure to prod vault (creates matching items with REPLACE_ME values)
./scripts/setup-vault.sh .env.template --sync-to {product}_prod
```

### Adding Fields to Existing Items

When new `op://` fields are added to the template but items already exist:

```bash
# Add URL field to existing Scrapling item
op item edit "Scrapling" --vault smartout_ai url=http://localhost:8000
op item edit "Scrapling" --vault smartout_ai_prod url=https://scrape.smartout.ai
```

---

## Classification Matrix

### Environments

| Environment   | Vault Suffix            | Purpose                            |
| ------------- | ----------------------- | ---------------------------------- |
| `development` | `_dev` (or legacy name) | Local development, preview deploys |
| `production`  | `_prod`                 | Live application                   |

### Types

| Type      | When Read            | Rotation             |
| --------- | -------------------- | -------------------- |
| `build`   | At deploy/build time | Requires redeploy    |
| `runtime` | At each request      | Instant, no redeploy |

### Scopes

| Scope    | Visibility                        |
| -------- | --------------------------------- |
| `public` | Exposed to browser (safe to leak) |
| `server` | Server-only (never expose)        |

### The Matrix

```
                    {product}_dev        {product}_prod
                 +----------------+----------------+
  build/public   | NEXT_PUBLIC_*  | NEXT_PUBLIC_*  |  -> Host env vars
                 +----------------+----------------+
  build/server   | DB connection  | DB connection  |  -> Host env vars
                 +----------------+----------------+
  runtime/server | API keys       | API keys       |  -> Vault
                 +----------------+----------------+
  config/urls    | localhost URLs | prod URLs      |  -> Vault
                 +----------------+----------------+
```

---

## Decision Flow

When adding a secret or config value:

```
Does the value differ between dev and prod?
+-- YES -> Store in BOTH vaults, reference via op://
|   +-- Is it a secret (key, token, password)?
|   |   +-- YES -> Classify: build or runtime, public or server
|   |   +-- NO  -> It's a URL or config value — still goes in vault
+-- NO -> Hardcode in .env.template (timezone, org name, etc.)
```

---

## Storage Rules

| Type        | Storage                         | Sync                 |
| ----------- | ------------------------------- | -------------------- |
| build       | Host platform (Vercel, Netlify) | Manual at deploy     |
| runtime     | Database vault (Supabase Vault) | Automatic at request |
| config/urls | 1Password vault                 | Via op:// at startup |

**Master record:** 1Password — always updated first, always both vaults.

---

## Rotation Schedule

| Type           | Frequency                     |
| -------------- | ----------------------------- |
| build/public   | On change only                |
| build/server   | 90 days                       |
| runtime/server | 30 days                       |
| config/urls    | On infrastructure change only |

---

## Linear Integration

When creating or rotating secrets, create Linear task:

```
[governance] [secrets-protocol] Rotate <secret name>
Labels: rotation, secrets-protocol
```

When leaked, create incident task:

```
[governance] [secrets-protocol] INCIDENT: <secret name> exposed
Labels: incident, secrets-protocol, critical
```

---

## AI Safety Patterns

### Safe Reference Patterns

```bash
# .env.template (SAFE - reference only, no values)
SUPABASE_KEY="op://smartout_ai/Supabase/anon_key"
SCRAPLING_SERVICE_URL="op://smartout_ai/Scrapling/url"

# Code (SAFE - environment variable)
const key = process.env.SUPABASE_KEY;
const url = process.env.SCRAPLING_SERVICE_URL;
```

### Dangerous Patterns (BLOCK)

```bash
# NEVER hardcode URLs that differ between environments
SCRAPLING_SERVICE_URL=https://scrape.smartout.ai  # ⛔ WRONG

# NEVER paste raw values
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...  # ⛔ RAW VALUE

# NEVER paste into AI chat
"My API key is sk-..."  # ⛔ EXPOSED
```

---

## Procedures Reference

| Procedure       | When to Use                     |
| --------------- | ------------------------------- |
| Add Secret      | New secret needed               |
| Add Service URL | New microservice added          |
| Rotate Secret   | Scheduled or emergency rotation |
| Revoke Secret   | Compromised or decommissioned   |
| New Project     | Starting a new product          |

### Add Secret Checklist

- [ ] Classify: env / type / scope
- [ ] Create in dev vault (1Password)
- [ ] Create in prod vault (1Password) — different value
- [ ] Add to `.env.template` as op:// reference
- [ ] Create rotation task in Linear
- [ ] Verify no raw value in git/code/AI

### Add Service URL Checklist

- [ ] Add `url` field to service item in dev vault (localhost)
- [ ] Add `url` field to service item in prod vault (real URL)
- [ ] Add to `.env.template` as `op://{vault}/{Item}/url`
- [ ] Verify: `op run --env-file=.env.template -- env | grep SERVICE_URL`

### Rotate Secret Checklist

- [ ] Generate new value
- [ ] Update dev vault first
- [ ] Update prod vault
- [ ] Update target storage (host/vault)
- [ ] Verify service works in both environments
- [ ] Log completion in Linear
- [ ] Schedule next rotation

### Revoke Secret Checklist

- [ ] Assess impact
- [ ] Generate replacement (if needed)
- [ ] Revoke at provider
- [ ] Verify revocation (401/403)
- [ ] Update both vaults
- [ ] Log incident in Linear

### New Project Checklist

- [ ] Create `{product}_dev` vault
- [ ] Create `{product}_prod` vault
- [ ] Create `.env.template` with op:// references
- [ ] Run `./scripts/setup-vault.sh` to populate vault structure
- [ ] Fill dev vault with localhost URLs and test keys
- [ ] Fill prod vault with real URLs and live keys
- [ ] Verify: `op run --env-file=.env.template -- env`

---

## Emergency Response

**If secret leaked (< 15 minutes):**

1. Revoke immediately at provider
2. Generate and deploy replacement — update BOTH vaults
3. Verify services operational
4. Check access logs for unauthorized use
5. File incident report in Linear
6. Conduct root cause analysis

---

## Protocol Source

Full protocol documentation:
`C:\Users\sxtnl\Obsidian\Genesis 6tn\genesis\governance\protocols\secrets-protocol\`

| Document                         | Purpose                     |
| -------------------------------- | --------------------------- |
| PROTOCOL.md                      | Full protocol specification |
| procedures/add-secret.md         | Adding new secrets          |
| procedures/rotate-secret.md      | Rotation procedure          |
| procedures/revoke-secret.md      | Emergency revocation        |
| runbooks/leaked-secret.md        | Incident response           |
| checklists/rotation-checklist.md | Rotation verification       |
| checklists/audit-checklist.md    | Quarterly audit             |
