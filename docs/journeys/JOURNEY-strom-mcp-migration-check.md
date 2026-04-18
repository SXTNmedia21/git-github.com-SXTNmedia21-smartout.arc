---
title: "Journeys — strom-mcp-migration-check (Bubble→v3 migration)"
status: done
updated: 2026-04-17
created: 2026-04-17
module: strike-mcp
tags: [journey, migration, bubble, strike-mcp]
---

# User Journeys — strom-mcp-migration-check

This branch delivers migration TOOLING. Direct users are admins running
strike-mcp + auth-bridge scripts, and migrated employees going through
the force-password-reset flow on first login.

## Journey 1: Admin runs Tier 1 + Tier 2 migration for a workspace

**Role:** Admin (Pontus, via terminal in `services/strike-mcp/`)
**Precondition:**
- wt-3 v3 schema migrations applied to target Postgres
- Bubble API token in `services/strike-mcp/.env.local`
- Workspace constants entry in `src/workspace_constants.ts` (wrightegaarden pre-registered)

1. **User:** `STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/emit_migration_sql.ts`
   **System:** fetches 16 Tier 1 entities from Bubble (workspace, company, departments, teams, users, profiles, shifts, salary_transactions, …); emits 10 numbered SQL files to `supabase/migration-staging/`; writes MANIFEST.json
   **User sees:** per-entity progress with row counts; final summary + manifest path

2. **User:** reviews `07_user_identity.sql` — confirms email addresses + names match expectations (manual spot-check against Bubble admin)

3. **User:** `NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/auth-bridge/apply.ts --sql=supabase/migration-staging/07_user_identity.sql --apply`
   **System:** calls `supabase.auth.admin.createUser({ id, email, password: <random>, email_confirm: true, user_metadata: { force_password_reset: true, migrated_from_bubble: true, ... } })` for each user; generates recovery link per user; writes audit CSV to `scripts/auth-bridge/.audit/bridge-audit-<timestamp>.csv`
   **User sees:** per-user "created"/"already_exists"/"collision" status; final summary with CSV path

4. **User:** `for f in supabase/migration-staging/*.sql; do psql <service-role-conn> -f $f; done`
   **System:** applies all Tier 1 SQL files. `07_user_identity.sql` now FKs resolve cleanly because auth.users exist (step 3 created them).

5. **User:** `STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/tier2_extract.ts`
   **System:** fetches handbooks + handbook_challenges + activities from Bubble; extracts content via content-extraction approach (per Learning 0034); emits 5 SQL files + MANIFEST to `supabase/migration-staging-tier2/` — policy, protocol, procedure, procedure_step, confirmation. Provenance JSONB populated per ADR-0140.
   **User sees:** summary with row counts (e.g. "2 policies + 2 protocols + 31 procedures + 21 procedure_steps + 2 confirmations"); warnings about NULL descriptions or skipped drafts

6. **User:** reviews `02_protocol.sql` etc. for admin curation of `[IMPORT]`-prefixed names + NULL descriptions

7. **User:** `for f in supabase/migration-staging-tier2/*.sql; do psql <service-role-conn> -f $f; done`
   **System:** applies Tier 2 SQL. ON CONFLICT clauses make it idempotent.

8. **User:** promotes migrated protocols from `status='draft'` to `status='active'` after content review. Then applies `06_backfill_assignments.sql` to create `protocol_assignment` rows for existing profiles (works around `auto_assign_protocols` trigger firing only on profile INSERT).

**Postcondition:**
- All workspace users exist in `auth.users` with `force_password_reset=true`
- Tier 1 rows (workspaces, profiles, shifts, payroll) in place
- Tier 2 governance content (handbooks as protocols, challenges as confirmations, operational activities as procedures/steps) in place with `provenance` JSONB
- Recovery links available in audit CSV for admin to distribute

**Error paths:**
- Bubble API rate-limit → strike-mcp cache layer (`mappings/.local/tier2-cache/`) enables retry without refetch
- Email collision in auth.users (different UUID exists with same email) → auth-bridge halts with audit CSV entry `status: collision`; admin resolves manually then re-runs
- FK violations on Tier 1 apply → indicates auth-bridge wasn't run first; re-run auth-bridge then retry

---

## Journey 2: Admin distributes recovery links to migrated users

**Role:** Admin (Jørn at Wrightegaarden, via email client)
**Precondition:** Journey 1 complete; audit CSV has per-user recovery links

1. **User:** opens audit CSV from `scripts/auth-bridge/.audit/bridge-audit-<timestamp>.csv`

2. **User:** uses template from `scripts/auth-bridge/email-template.md` (Norwegian primary, English fallback)

3. **User:** personalizes {{first_name}} + {{recovery_link}} per row, sends individually from personal email address (NOT no-reply)

4. **User:** tracks per-user send date + click/password-set status in follow-up spreadsheet

**Postcondition:** Each migrated user has received a personal email with their unique recovery link valid for 1 hour.

**Error paths:**
- Recovery link expired (user waited >1 hour) → admin regenerates via `admin.generateLink({ type: 'recovery', email })` or directs user to standard `/reset-password` flow
- Email bounces → cross-check with Tripletex for current email, update `auth.users.email` via admin API, regenerate link

---

## Journey 3: Migrated employee first-login

**Role:** Employee (Anneli, Natalie, Erik — migrated from Bubble)
**Precondition:** Journey 1 + 2 complete; user has received recovery email

1. **User:** receives email "Din nye Smartout-konto er klar — sett passord (2 min)" from personal admin address
   **User sees:** Warm Norwegian copy explaining migration + single CTA link

2. **User:** clicks recovery link
   **System:** Supabase Auth verifies recovery token; redirects to `/reset-password` with auth session established; `PASSWORD_RECOVERY` event fires on client
   **User sees:** "Sett nytt passord" form with password + confirm fields

3. **User:** enters new password (min 8 chars), clicks submit
   **System:** calls `supabase.auth.updateUser({ password, data: { force_password_reset: false } })`. Clears flag atomically with password set.
   **User sees:** "Passordet er oppdatert! Sender deg videre..." → 2s delay → `/login`

4. **User:** logs in with email + new password at `/login`
   **System:** standard `signInWithPassword` flow. Middleware §4b no longer triggers (flag is false). User lands on `/dashboard`.
   **User sees:** Own dashboard with migrated data visible (profile, schedule, handbook assignments)

**Postcondition:** User has working account with new password; `force_password_reset=false`; `migrated_from_bubble=true` (audit marker preserved).

**Error paths:**
- Link clicked >1h after generation → Supabase returns "token expired"; user must use standard `/reset-password` email-entry flow
- User logs in via Google OAuth before password-reset → middleware redirects to `/reset-password` until flag clears (same flow as step 2-3)
- User tries to navigate anywhere before clearing flag → middleware redirect (force-password-reset gate); cannot bypass

---

## Journey 4: Admin audits migrated content

**Role:** Admin (post-migration review)
**Precondition:** Tier 1 + Tier 2 applied; migrated rows carry `provenance`

1. **User:** runs `SELECT name, provenance->>'bubble_id' AS source FROM public.protocol WHERE provenance->>'origin' = 'bubble-import';`
   **System:** returns all migrated protocols with reverse-lookup IDs
   **User sees:** Each migrated handbook's v3 row + original Bubble ID

2. **User:** spots a protocol with NULL description or stale `[IMPORT]` prefix → edits via Governance admin UI (TanStack mutations)
   **System:** `useUpdateProtocol` writes standard UPDATE; `provenance` column is unaffected (migration marker preserved for audit)

3. **User:** promotes `status='draft'` → `status='active'` on reviewed protocols
   **System:** `protocol_assignment` rows for existing profiles only appear if backfill was run (step 8 of Journey 1)

**Postcondition:** Migrated content is live and curated. Audit trail via `provenance` remains queryable indefinitely.

---

## Error-path summary table

| Scenario | Detection | Recovery |
|---|---|---|
| Bubble API down mid-fetch | strike-mcp throws | Cache layer persists prior responses; re-run resumes from cache |
| Duplicate auth.users UUID | auth-bridge `getUserById` check | Skip (status=already_exists); regenerate recovery link for redistribution |
| Email collision | auth-bridge `findAuthUserByEmail` | Halt (status=collision); admin resolves manually |
| Tier 2 UNIQUE(policy_id) violation | Local Supabase test catches 23505 | Council 2026-04-17 fixed via 1-policy-per-protocol pattern |
| Recovery link expired | Supabase returns token-expired error | User uses standard `/reset-password` flow OR admin regenerates |
| Existing profiles missing new protocol assignments | Empty protocol_assignment query | Run `06_backfill_assignments.sql` after admin promotes protocols to active |
| Admin-UI writes workspace_id to tables without it | Post-migration dashboard mutation fails | Bug class closed 2026-04-17 (knowledge_test + procedure + confirmation fixes) |

---

## Non-UI journeys — why this feature is tooling-first

This branch does not add UI surfaces. Migrated content lands in existing governance tables and is rendered via the standard governance dashboard (out of scope for this branch). All journeys above involve terminal commands + email distribution + existing auth/reset-password flows, with the sole addition being the middleware gate for force-password-reset users.

Journey 3 (employee first-login) uses the existing `/reset-password` page (no new route) — the counterpart is the middleware gate in `apps/web/src/middleware.ts` §4b.
