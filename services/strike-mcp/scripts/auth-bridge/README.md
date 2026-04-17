---
title: strike-auth-bridge
status: in_progress
updated: 2026-04-17
created: 2026-04-17
module: strike-mcp
tags: [migration, auth, supabase]
---

# strike-auth-bridge

Pre-creates Supabase `auth.users` rows so strike-mcp's Tier 1 migration
(`07_user_identity.sql`) can apply without FK violations.

## Why

`public.user_identity.user_id` is PK + FK → `auth.users(id)`. Strike-mcp emits
`user_identity` INSERTs with deterministic uuidv5 IDs but cannot safely write
directly to `auth.users` (Supabase Auth owns password hashing, confirmation
timestamps, and the `auth.identities` sub-table). Without this bridge, Tier 1
apply fails at `07_user_identity.sql`.

## What it does

1. Parses `07_user_identity.sql` — extracts each user's UUID, email, names, phone.
2. For each user: `supabase.auth.admin.createUser({ id: <uuidv5>, email, password: <random>, email_confirm: true, user_metadata: { migrated_from_bubble: true, force_password_reset: true, ... } })`.
3. Generates a recovery link (`supabase.auth.admin.generateLink({ type: 'recovery' })`) for each user.
4. Writes audit CSV with `{email, user_id, status, recovery_link, error_message}`.
5. Halts on email collision (same email, different UUID in `auth.users`).

## Usage

```bash
# Dry-run — parse only, no API calls
pnpm tsx scripts/auth-bridge/apply.ts \
  --sql=supabase/migration-staging/07_user_identity.sql \
  --dry-run

# Apply — live calls to Supabase Admin API
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  pnpm tsx scripts/auth-bridge/apply.ts \
    --sql=supabase/migration-staging/07_user_identity.sql \
    --apply
```

Audit CSV lands in `scripts/auth-bridge/.audit/bridge-audit-<timestamp>.csv`.

## Idempotency

- Same UUID + same email already in `auth.users` → `status: already_exists`, regenerates recovery link for re-distribution.
- Same UUID, different email → `status: collision`, halts.
- Different UUID, same email → `status: collision`, halts.

Collisions require human resolution before continuing.

## Counterpart in apps/web

- **Middleware gate** (`apps/web/src/middleware.ts` §4b): if authenticated user has `user_metadata.force_password_reset === true`, redirect to `/reset-password` until the flag clears.
- **Flag clearing** (`apps/web/src/app/reset-password/page.tsx`): on successful password update, call `supabase.auth.updateUser({ password, data: { force_password_reset: false } })` — clears the flag, removes the middleware redirect.

## Operational runbook

1. Run strike-mcp Tier 1 emission → produces `07_user_identity.sql`.
2. Run `pnpm tsx scripts/auth-bridge/apply.ts --sql=...07_user_identity.sql --dry-run` to validate.
3. Run with `--apply` against staging Supabase; review audit CSV.
4. Distribute recovery links to users (email/Tripletex/personal channels).
5. Apply Tier 1 SQL files including `07_user_identity.sql` — FKs now resolve.
6. Users follow their recovery link → land on `/reset-password` → set new password → `force_password_reset` flag clears → normal access.

## Scripts

| Script | Purpose |
|---|---|
| `apply.ts` | Main bridge — parses SQL, creates auth.users, writes audit CSV |
| `verify_flow.ts` | Smoke-test the full flow against local Supabase (checks flag state + clear + restore) |

## Known limitations (v1)

- Hardcoded assumption that Supabase `admin.createUser` honors explicit `id` (works in `@supabase/supabase-js` >= 2.38). Script verifies post-creation and fails loudly if the UUID doesn't match.
- No rollback: if apply partially succeeds, operator must manually delete orphan auth.users via Supabase Studio or `admin.deleteUser(id)`.
- Pagination cap at 10k users in `findAuthUserByEmail` (safety cutoff).
- Distribution of recovery links is out of scope — admin's responsibility.

## Verified (2026-04-17)

Against local Supabase:
- 3 Wrightegaarden users created with correct UUIDs + metadata
- Re-run = idempotent (already_exists, regenerates links)
- Flag-clear path works (simulated via `admin.updateUserById`)
- Migration marker (`migrated_from_bubble`) survives flag clear (audit trail preserved)
- `07_user_identity.sql` applies cleanly once bridge has run
