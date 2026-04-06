---
title: "Security Protocol"
id: PROTO_SECURITY
status: canonical
layer: protocol
created: 2026-02-28
updated: 2026-04-06
depends_on:
  - SECRET_API_INFRA
  - ADMIN_KEY_MGMT
  - XCUT_SECURITY
---

# Security Protocol

> **Smartout.ai** — Mandatory development and operations protocol
> **Status:** ACTIVE — All team members and AI agents must follow this protocol.
> **Enforced by:** CLAUDE.md reference, PR checklist, deployment pipeline
> **Architecture docs:** `SMARTOUT_SECRET_API_INFRASTRUCTURE.md`, `needs-rewrite/SMARTOUT_ADMIN_KEY_MANAGEMENT.md` (pending merge into SECRET_API_INFRASTRUCTURE)

This is not a guideline. It is a protocol. Violations are security incidents.

---

## 1. The Three Laws

These apply everywhere, always, no exceptions.

```
LAW 1: Never store a plaintext secret in code, config files, logs, or database columns.
       Secrets go in Vault. Customer-issued keys go as SHA-256 hashes.

LAW 2: Never bypass RLS for convenience.
       API key auth uses set_config + SET LOCAL ROLE authenticated.
       Service role is for Vault access and admin operations only.

LAW 3: Never commit a key, token, or secret to Git.
       Not in code. Not in comments. Not in migrations. Not in seed files.
       .env files are gitignored. Always.
```

---

## 2. Secrets Management

### 2.1 Classification

| Rule           | Enforcement                                     |
| -------------- | ----------------------------------------------- |
| Never expose   | No raw values in prompts, code, or logs         |
| Classify first | env / type / scope tags required before storage |
| Master record  | 1Password always updated first                  |
| Rotate         | 30 days (runtime keys), 90 days (build keys)    |
| Reference      | Use `op://` references, never raw values        |

### 2.2 Key Storage Tiers

| Tier   | What                                                  | Storage                                  | Why                                                                                             |
| ------ | ----------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tier 1 | Workspace API keys (`smo_sk_`)                        | SHA-256 hash in `platform_api_key` table | Raw key shown once at creation, only hash stored. 256-bit entropy makes brute force impossible. |
| Tier 2 | External secrets (Stripe, Twilio, SendGrid, DocuSeal) | Supabase Vault (pgsodium, AES-256-GCM)   | Needs plaintext retrieval for API calls                                                         |
| Tier 3 | Service-to-service keys (`smo_svc_`)                  | SHA-256 hash in `platform_api_key` table | Internal auth between n8n/Vercel and Edge Functions                                             |

**Why SHA-256, not bcrypt for Tier 1/3:** API keys generated with `randomBytes(32)` have 256 bits of entropy. Brute-forcing SHA-256 at that entropy level is computationally impossible (2^256 combinations). bcrypt's deliberate ~100ms delay exists to protect low-entropy passwords — applying it to every API request creates a throughput bottleneck with zero security benefit.

### 2.3 Key Format

```
Format: smo_{type}_{env}_{random}

smo_sk_live_k7HjQ9xM2bP4vR8n...   → Workspace secret key, production
smo_sk_test_a3BcD4eF5gH6iJ7k...   → Workspace secret key, sandbox
smo_svc_live_p1Qr2St3Uv4Wx5Y...   → Service-to-service, production

Prefix breakdown:
  smo_     → Smartout (identifies the platform in leaked key scanners)
  sk_      → secret key (workspace API key)
  svc_     → service key (internal service-to-service)
  live_    → production data
  test_    → trainee/sandbox data only
  {random} → 32 bytes (256 bits) base64url-encoded
```

Never invent new prefixes. Use the established format.

> Full architecture: `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md`

### Vault Naming (Supersedes ADR-0055)

| Vault              | Environment           | Purpose                                 |
| ------------------ | --------------------- | --------------------------------------- |
| `smartout_ai`      | Development / Preview | Local dev, Vercel preview, Docker local |
| `smartout_ai_prod` | Production            | Vercel production, DigitalOcean droplet |

ADR-0055 defined `smartout_dev` / `smartout_prod` — these names were never used. All code, scripts, and 1Password items use `smartout_ai` / `smartout_ai_prod`.

### 1Password Service Account (CI/CD)

For automated pipelines (env sync, future GitHub Actions), use a 1Password Service Account instead of interactive `op signin`.

| Context                 | Method                                              |
| ----------------------- | --------------------------------------------------- |
| Local development       | `op run --env-file=.env.template` (interactive CLI) |
| Vercel env sync         | Service account token (`OP_SERVICE_ACCOUNT_TOKEN`)  |
| DigitalOcean env sync   | Service account token via `sync-env-to-droplet.sh`  |
| GitHub Actions (future) | Service account token in GitHub Secrets             |

**Rules:**

- Service account has READ-ONLY access to both vaults
- Token stored in GitHub Secrets, never in code or docs
- Local dev continues using interactive `op run` (no change)

---

## 3. Environment Variables

| Rule                                           | Detail                                                    |
| ---------------------------------------------- | --------------------------------------------------------- |
| All secrets live in `.env.local`               | Never `.env` (committed) or hardcoded                     |
| `.env.local` is in `.gitignore`                | Verify this on every new repo/branch                      |
| `.env.example` exists with dummy values        | `STRIPE_SECRET_KEY=sk_test_REPLACE_ME`                    |
| Supabase service role key never in client code | Only in Edge Functions and server-side Next.js            |
| No secrets in `console.log` or error messages  | Use key prefix (`smo_sk_live_k7Hj...`) for identification |
| Validated with Zod                             | `@t3-oss/env-nextjs` + Zod in `apps/web/src/env.ts`       |
| 1Password integration                          | `op run --env-file=.env.template` for local dev           |

---

## 4. Authentication & Authorization

### 4.1 Auth Methods

| Scope                  | Method                       | Rule                                                       |
| ---------------------- | ---------------------------- | ---------------------------------------------------------- |
| User-facing operations | JWT (Supabase Auth)          | Always use anon key + RLS via `auth.uid()`                 |
| Admin operations       | Service role                 | Only for platform-admin tables, never for user-facing      |
| External API access    | API key (`x-api-key` header) | Hash lookup → workspace context → RLS                      |
| Service-to-service     | Service key (`smo_svc_`)     | Same as API key but no `workspace_id`, system-level scopes |
| Dual-auth functions    | JWT or API key               | Use `_shared/auth-middleware.ts`, never roll your own      |

### 4.2 RLS Rules

- RLS enabled on ALL tables — no exceptions
- `auth.uid()` in RLS policies for JWT auth
- `current_setting('app.workspace_id', true)::uuid` for API key auth
- Workspace isolation: every workspace-scoped table has `workspace_id` + RLS policy
- Use helpers: `get_workspace_ids_for_user()`, `is_admin_in_workspace()`
- All queries parameterized — no SQL injection
- `workspace_id` indexed on every table

### 4.3 RLS via `set_config` (API Key Auth)

When API key auth is used, workspace isolation requires PostgreSQL GUC variables:

```
Critical rules:
1. Always use set_config(..., true) — true makes it transaction-local.
   Supabase uses Supavisor (transaction-mode pooling), so session-scoped variables
   leak to the next client.
2. Always wrap in BEGIN/COMMIT — SET LOCAL only works inside a transaction.
3. Always SET LOCAL ROLE authenticated — direct connections use the postgres superuser,
   which bypasses RLS entirely.
```

### 4.4 Scope Checking

API key requests must have their scopes checked. JWT users get full scope (RLS handles access).

```
Scope format: {resource}:{action}
Examples: profiles:read, schedules:write, haccp:read

Preset bundles:
  "Read Only"       → profiles:read, schedules:read, operations:read, reports:read
  "POS Integration" → schedules:read, operations:read, operations:write
  "HACCP System"    → haccp:read, haccp:write
  "Full Access"     → All read + all write scopes
```

---

## 5. Edge Function Rules

```
BEFORE writing any Edge Function that touches auth:

1. Read: SMARTOUT_SECRET_API_INFRASTRUCTURE.md §2.7 (Dual-Auth Middleware)
2. Use: _shared/auth-middleware.ts — never roll your own auth check
3. Check: Does this function need verify_jwt = false? Add to config.toml.
4. Check: Does this function handle API keys? Use direct Postgres + set_config.
5. Check: Does this function read external secrets? Use supabase.rpc('get_secret').
6. Never: Create a Supabase client with service_role_key for user-facing queries.
```

Edge Functions with `verify_jwt = false` must be explicitly listed in `supabase/functions/config.toml`.

### 5.1 Vault Access

PostgREST cannot call `vault.create_secret` directly. Use `SECURITY DEFINER` wrapper functions:

| Function                            | Purpose                          | Access              |
| ----------------------------------- | -------------------------------- | ------------------- |
| `get_secret(name)`                  | Read decrypted secret from Vault | `service_role` only |
| `upsert_secret(name, secret, desc)` | Store or update a secret         | `service_role` only |
| `delete_secret(name)`               | Remove a secret                  | `service_role` only |

All three are `SECURITY DEFINER` with `REVOKE EXECUTE FROM public, anon, authenticated`.

---

## 6. Migration Rules

```
BEFORE writing any migration that touches auth or key management:

1. Read: SMARTOUT_SECRET_API_INFRASTRUCTURE.md §2.3 (Data Model)
2. Every new table needs RLS enabled — no exceptions
3. Vault wrapper functions are SECURITY DEFINER + REVOKE FROM public
4. Test with two workspaces: verify workspace A cannot see workspace B data
5. EXPLAIN ANALYZE on key_hash lookup — must use index, no seq scan
6. Check docs/reference/DATABASE.md for existing enums before creating new ones
```

### Migration Idempotency (Supabase Branching)

All `CREATE INDEX` and `CREATE TABLE` statements MUST use `IF NOT EXISTS`. Supabase Branch DBs replay all migrations from scratch — non-idempotent statements cause branch creation failures.

**Rule:** Never write `CREATE INDEX idx_name ON table(col)` without `IF NOT EXISTS`.
**Enforcement:** Phase 0 of deployment pipeline wrapped all 85 existing bare indexes.

---

## 7. Frontend Rules

```
RULES for any UI that displays or manages keys:

1. API key plaintext is shown ONCE — at creation and rotation only
2. After creation, only key_prefix is displayed (first 20 chars)
3. Copy-to-clipboard uses navigator.clipboard API, never a visible text field
4. "Show once" modal requires checkbox confirmation before close
5. No secret values in React state that persists across navigation
6. No secret values in URL parameters, ever
7. No secret values logged to browser console
```

---

## 8. Data Encryption

| Layer         | Method                                                              |
| ------------- | ------------------------------------------------------------------- |
| At rest       | Supabase (AES-256)                                                  |
| In transit    | TLS 1.2+ everywhere                                                 |
| Passwords     | bcrypt via Supabase Auth                                            |
| Vault secrets | pgsodium (AES-256-GCM), root key managed by Supabase infrastructure |
| API keys      | SHA-256 hash only, no reversible storage                            |

---

## 9. Key Rotation

### 9.1 Rotation Schedule

| Secret Type               | Max Age                     | Reminder At               | Enforced By           |
| ------------------------- | --------------------------- | ------------------------- | --------------------- |
| Workspace API keys        | No hard limit               | Never (customer's choice) | —                     |
| Stripe secret key         | 90 days                     | 45 days remaining         | Admin dashboard alert |
| Twilio auth token         | 90 days                     | 45 days remaining         | Admin dashboard alert |
| SendGrid API key          | 90 days                     | 45 days remaining         | Admin dashboard alert |
| DocuSeal API key          | 90 days                     | 45 days remaining         | Admin dashboard alert |
| Service-to-service keys   | 180 days                    | 30 days remaining         | Super-admin alert     |
| Supabase service role key | Never (managed by Supabase) | —                         | —                     |

### 9.2 Rotation Process (Workspace API Keys)

Rotation uses a dual-key grace period — both old and new keys work during transition:

1. New `current` key is created
2. Old `current` is demoted to `previous` with configurable grace period (default 48h)
3. Any existing `previous` key is immediately revoked
4. `pg_cron` job runs hourly to revoke expired `previous` keys
5. Customer updates their integration with the new key during grace period

### 9.3 Rotation Process (External Secrets)

1. Admin rotates key in the provider dashboard (e.g., Stripe)
2. Admin pastes new key in Smartout dashboard
3. Smartout stores in Vault via `upsert_secret()`
4. Smartout verifies the new key works by calling the provider API
5. If verification succeeds → update `last_rotated_at`, show success
6. If verification fails → rollback to old key, show error

---

## 10. Rate Limiting

Supabase Edge Functions are stateless. Rate limiting uses **Upstash Redis** (HTTP-based, ~1-5ms latency).

| Plan         | Workspace API Key | Service Key  |
| ------------ | ----------------- | ------------ |
| Trial        | 30 req/min        | N/A          |
| Starter      | 60 req/min        | N/A          |
| Professional | 300 req/min       | 1000 req/min |
| Enterprise   | Custom            | Custom       |

---

## 11. Monitoring Thresholds

| Metric                    | Warning                    | Critical          | Action                          |
| ------------------------- | -------------------------- | ----------------- | ------------------------------- |
| Requests per key per hour | >500% of 7-day average     | >1000% of average | Notify owner + super-admin      |
| Error rate per key        | >10% in 1 hour             | >25% in 1 hour    | Notify owner                    |
| Failed auth attempts      | >50 in 1 hour from same IP | >200 in 1 hour    | Rate limit + notify super-admin |
| Key unused                | 30 days                    | 60 days           | Notify creator → notify owner   |
| External secret age       | `rotation_reminder_days`   | 2x reminder days  | Dashboard warning → email       |

---

## 12. Audit Trail

### 12.1 What Gets Logged

All security-relevant actions are logged in the audit trail:

- Key creation, rotation, revocation
- External secret updates
- RLS policy changes
- Role changes (admin, owner promotions/demotions)
- Failed authentication attempts
- Scope changes on API keys
- Emergency revocations by super-admin

### 12.2 Retention

| Log Type         | Retention |
| ---------------- | --------- |
| Audit logs       | 7 years   |
| AI event logs    | 90 days   |
| Application logs | 30 days   |
| Error logs       | 90 days   |
| API key usage    | 90 days   |

---

## 13. Incident Response: Leaked Key

If any key is suspected to be compromised:

```
IMMEDIATE (within 15 minutes):
  1. Identify key type by prefix:
     smo_sk_  → Workspace API key → Revoke via admin dashboard
     smo_svc_ → Service key → Revoke via super-admin dashboard
     sk_live_ → Stripe → Roll in Stripe dashboard → update Vault
     Other    → Identify provider → roll key → update Vault

  2. Check platform_api_key_usage for the compromised key:
     - What endpoints were called?
     - What data was accessed?
     - When did suspicious activity start?

  3. Notify workspace owner (if workspace key) or team (if service key).

WITHIN 1 HOUR:
  4. Audit how the key was leaked (logs, Git history, client code).
  5. Fix the leak vector.
  6. Document in incident log.

WITHIN 24 HOURS:
  7. Review all keys of the same type for similar exposure.
  8. Update this protocol if the leak vector was not covered.
  9. Write a Learning record documenting the incident.
```

---

## 14. Deployment Checklist

Before every deployment that touches auth, keys, or secrets:

```
☐ No secrets in committed code (grep for smo_sk_, smo_svc_, sk_live_, sk_test_)
☐ No secrets in migration files (grep for plaintext keys)
☐ .env.local is in .gitignore
☐ .env.example is updated with new variable names
☐ Edge Functions with verify_jwt = false are listed in config.toml
☐ New RLS policies tested with two workspace contexts
☐ Vault wrapper functions have REVOKE FROM public
☐ Rate limiting is configured for new API endpoints
☐ Key hash indexes verified with EXPLAIN ANALYZE
☐ Input validation with Zod on all Edge Functions
☐ CORS configuration correct for target environment
☐ No secrets in console.log or error messages
```

---

## 15. AI Agent Rules

When Claude Code, Cursor, or any AI agent works on Smartout code:

### 15.1 Context Loading (Before ANY auth/key work)

```
MANDATORY — Read these before touching auth, secrets, keys, RLS, or Edge Functions:
  1. This document (docs/protocols/SECURITY.md)
  2. CLAUDE.md § "API Gateway — Mandatory Checklists"
  3. docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md (if touching key logic)
  4. docs/architecture/SMARTOUT_ADMIN_KEY_MANAGEMENT.md (if touching key UI)
```

### 15.2 New Table Checklist

```
EVERY new workspace-scoped table MUST have:
  ☐ ALTER TABLE ... ENABLE ROW LEVEL SECURITY
  ☐ JWT read policy:  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
  ☐ API key read policy: CREATE POLICY "api_key_read_{table}" USING (workspace_id = get_api_workspace_id())
  ☐ Write policies if applicable (JWT + API key variants)
  ☐ If exposed via public API: handler + route + scope guard + API registry entry

Tables WITHOUT workspace_id (identity layer, platform-admin) are exempt from API key policies.
```

### 15.3 New Edge Function Checklist

```
EVERY new Edge Function MUST:
  ☐ Use one of the three auth patterns (JWT-only, dual-auth, cron-only)
  ☐ NEVER implement custom auth logic — use _shared/auth-middleware.ts
  ☐ If dual-auth: add verify_jwt = false to supabase/functions/config.toml
  ☐ If data endpoint: call requireScope() from _shared/scope-middleware.ts
  ☐ If querying workspace data: use executeWithWorkspaceContext() from _shared/api-key-auth.ts
  ☐ Add to API registry in health/_components/api-registry.ts
  ☐ Update CLAUDE.md Edge Function count
```

### 15.4 New Scope Checklist

```
EVERY new API scope MUST:
  ☐ Follow format: {resource}:{action} (e.g., schedules:read)
  ☐ Be added to CLAUDE.md canonical scope table
  ☐ Be added to SMARTOUT_SECRET_API_INFRASTRUCTURE.md §2.4
  ☐ Have a handler in workspace-api/handlers/
  ☐ Have a route registered in workspace-api/index.ts
  ☐ Be added to relevant preset bundles if applicable
  ☐ Have api_key_read/write RLS policies on all tables it accesses
```

### 15.5 New Microservice Checklist

```
EVERY new microservice MUST:
  ☐ Authenticate via managed service key (smo_svc_live_*)
  ☐ Validate key against platform_api_key (via validate-api-key or DB lookup)
  ☐ NEVER use hardcoded env var keys for auth
  ☐ Document the key in platform-admin Keys & Secrets UI
  ☐ Health endpoint must be public (no auth required)
  ☐ Webhook endpoints use provider-specific signature verification, not API keys
```

### 15.6 Forbidden Actions

```
NEVER:
  - Generate placeholder secrets that look real (use "REPLACE_ME")
  - Create Edge Functions with custom auth logic
  - Store secrets in Supabase tables outside Vault
  - Write RLS policies that use service_role bypass for convenience
  - Log request bodies that might contain API keys
  - Create API key validation without scope checking
  - Accept raw secret values in prompts — suggest op:// reference
  - Invent new key prefixes — use smo_sk_ and smo_svc_ only
  - Create workspace-scoped tables without api_key_read_* RLS policies
  - Add workspace-api endpoints without scope guards
  - Skip the API registry when adding endpoints
```

### 15.7 Required Actions

```
ALWAYS:
  - Reference this protocol in PR descriptions for auth-related changes
  - Include workspace isolation test in acceptance criteria
  - Use the established key format (smo_sk_, smo_svc_)
  - Write ADR for any new auth pattern or security decision
  - Update CLAUDE.md scope table when adding scopes
  - Run workspace isolation test: fake workspace → 0 results
```

---

## 16. Preview Environment Security

### Branch Database Isolation

Preview deployments use Supabase Branch DBs — isolated copies of the production schema.

**Rules:**

- Branch DBs are ephemeral — created on PR, destroyed on merge
- Branch DBs contain NO production data (schema only + seed-preview.sql)
- Branch DB credentials are injected by Supabase-Vercel integration (never manual)
- Edge Functions in preview still point to production Supabase — branch isolation is Vercel-side only

### Docker Service Asymmetry (Accepted)

Docker services (Stage Engine, Shift MCP, Contract Service, Scrapling) have no preview tier. Preview Vercel apps hit production Docker services.

**Mitigations:**

- Services are stateless request handlers — they use their own Supabase credentials (production)
- No cross-contamination: preview app uses Branch DB credentials, Docker services use production credentials
- Agent features must be tested locally before preview deployment

### Vault in Branch DBs

Supabase Vault (`pgsodium`) availability in Branch DBs is verified during pipeline setup (Phase 2.0 go/no-go). If unavailable, `secrets.ts` falls back to environment variables.

---

## 17. Infrastructure

| Component             | Protection                                              |
| --------------------- | ------------------------------------------------------- |
| Vercel                | Automatic DDoS protection, edge network, HTTPS          |
| Supabase              | Managed PostgreSQL, automated backups, Vault encryption |
| DigitalOcean          | Firewalled n8n instance, VPC isolation                  |
| Upstash Redis         | Rate limiting, TLS connections                          |
| Environment isolation | Separate Supabase projects per environment              |

---

## 18. Document Relationships

```
CLAUDE.md
  └── References → docs/protocols/SECURITY.md (this doc)
                      ├── Enforces → docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md
                      │               (how keys are stored, validated, rotated)
                      ├── Enforces → docs/architecture/SMARTOUT_ADMIN_KEY_MANAGEMENT.md
                      │               (how humans manage keys via dashboard)
                      └── Extends  → docs/cross-cutting/SMARTOUT_CROSSCUT_SECURITY_INFRA.md
                                      (RLS, audit trail, encryption, monitoring)
```

This protocol sits above the architecture docs. The architecture docs describe what the system looks like. This protocol describes how you are allowed to work with it.

---

_If you can't explain which of the Three Laws your code change respects, you shouldn't be committing it._
