---
title: "ADR-0006: Auth-bridge orchestration for users → user_identity"
status: accepted
created: 2026-04-16
updated: 2026-04-16
module: strike-mcp
tags: [decision, migration, identity, auth, supabase]
---

# ADR-0006: Auth-bridge orchestration for users → user_identity

## Status

Accepted 2026-04-16 — required for Tier 1 Wrightegaarden migration of 127
Bubble user records.

## Context

Q2 of the Tier 1 finish plan (2026-04-16): how should strike-mcp handle
the migration of `User` (Bubble) → `public.user_identity` (v3)?

The schema constraint:

```sql
CREATE TABLE public.user_identity (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  -- ...
);
```

`user_id` is a hard FK into `auth.users(id)`. Postgres cannot satisfy this
FK by inserting into `user_identity` alone — the row in `auth.users` must
exist first. Supabase's `auth.users` table is owned by the GoTrue auth
service and only writable via the Admin API
(`supabase.auth.admin.createUser({ id, email, ... })`), not via direct SQL.

Strike-mcp's design principle (ADR-0002): emit dry-run SQL files only;
never execute side-effecting calls. The Supabase Admin API is exactly such
a side-effecting call (creates real auth state, sends invite emails if
configured, etc.). Putting Admin API calls inside strike-mcp would violate
the dry-run boundary.

Three designs were considered:

**A. Strike-mcp grows an in-process auth-bridge capability.** It would
read Bubble Users, call `supabase.auth.admin.createUser` directly, then
emit user_identity SQL referencing the freshly-created UUIDs. Rejected:
breaks the dry-run boundary and conflates emit-time with apply-time.

**B. Strike-mcp emits a CSV manifest + a separate auth-bridge tool reads
it.** Strike-mcp's job stays "produce a deterministic UUID per Bubble
user_id." A separate Node script reads the CSV and calls
`supabase.auth.admin.createUser({ id: <same uuid>, email, password: <random>,
... })` per row. THEN strike-mcp's emitted user_identity INSERTs work
because the auth.users rows exist with matching UUIDs. Chosen — clean
separation; auth-bridge tool is reusable for future tenant migrations.

**C. Defer users entirely; never migrate auth.** Rejected: 127 employees
need to log in to v3 on cutover day. There is no path that skips this.

## Decision

### Responsibility split

| Step | Owner | Output |
|---|---|---|
| 1. Discover Bubble Users | strike-mcp | mappings/users.json + sidecar |
| 2. Decide field-level mapping | strike-mcp + reviewer | attested mappings/users.json |
| 3. Emit `auth_bridge.csv` per workspace | strike-mcp | one row per Bubble user: `(uuidv5, email, first_name, last_name, phone)` |
| 4. Pre-create auth.users entries | **separate `strike-auth-bridge` tool** | call `supabase.auth.admin.createUser({ id: <uuid>, email, password: <random>, email_confirm: true, user_metadata: { migrated_from_bubble: true } })` per CSV row |
| 5. Emit user_identity SQL | strike-mcp | INSERT INTO user_identity (user_id, email, ...) VALUES (uuidv5, ...) |
| 6. Apply user_identity SQL | apply script (psql) | rows land; FK to auth.users satisfied because step 4 created them with same UUIDs |

### Why deterministic UUIDs make this work

The `fk_uuid:user_identity` transform produces
`uuidv5("user_identity", bubble_user_id)`. This is a **pure function**:
the same Bubble ID always produces the same v5 UUID.

Step 4 calls `admin.createUser({ id: uuidv5("user_identity", bubble_user_id), ... })`
using the SAME formula. The FK alignment between auth.users.id and
user_identity.user_id is **guaranteed by construction**, no runtime lookup
needed. Step 5 just emits the SQL; the FK is satisfied at apply time.

### Strike-mcp's strict boundary

Strike-mcp:
- ✅ Emits `auth_bridge.csv` alongside the SQL files (declarative manifest)
- ✅ Emits user_identity SQL with deterministic UUIDs
- ❌ Does NOT call Supabase Admin API
- ❌ Does NOT manage passwords (random temp passwords are the bridge's job)
- ❌ Does NOT send invite emails

The bridge tool (separate package, separate ADR — out of scope here)
handles all side-effects.

### Email field extraction

Bubble's User type stores email at the nested path
`authentication.email.email` (the outer `email` is the auth method, the
inner `email` is the address):

```json
{
  "_id": "1612...",
  "authentication": {
    "email": {
      "email": "anneli@sf-nett.no",
      "email_confirmed": null
    }
  },
  "First name": "Anneli",
  ...
}
```

A new transform `email_from_auth` is registered to extract this. It's
specific to Bubble's User authentication shape and not reused elsewhere.

### Apply-time gating

The user_identity migration is **gated** on the auth-bridge step
completing first. The apply script (out of strike-mcp scope) must:

1. Run auth-bridge tool first (idempotent: if user already exists in
   auth.users with same UUID, skip).
2. Run user_identity SQL second.
3. Run profile SQL third (profile.user_id FKs to user_identity).

A README in the auth-bridge tool will document this order.

### Idempotency expectations on the bridge

- If `auth.users` already has an entry with matching UUID → skip (200 OK).
- If `auth.users` has matching email but different UUID → **fail loud**
  (potential email collision; manual reconciliation).
- If `auth.users` has neither → create.

### Required apply-script behaviors (council 2026-04-16 amendment)

The Tier 1 council surfaced that "fail loud" by itself is operationally
underspecified. The apply script (which runs both bridge + user_identity
SQL) MUST implement:

1. **Row-level error isolation** — wrap each user_identity INSERT in a
   `SAVEPOINT` so a single NOT NULL email violation aborts only that row,
   not the entire 127-row batch. Postgres default is whole-transaction
   abort on first constraint failure.
2. **Failure CSV** — write `auth_bridge.failed.csv` for any non-skip
   non-create outcome (collision, missing email, partial create + FK fail).
   Format: `(bubble_user_id, email, failure_reason, suggested_action)`.
3. **Halt threshold** — if failure count exceeds 5% of total users, abort
   the batch and require human triage. Default protects against
   discovery-data corruption masquerading as per-row failures.
4. **`auth_bridge.csv` retention** — the manifest is a PII-bearing
   artifact (email + name + UUID). Encrypt at rest, delete after T+30
   days post-cutover, log every read access.
5. **Rollback story** — if user_identity SQL applies but profile SQL
   fails, the apply script does NOT auto-rollback auth.users entries.
   Manual cleanup is required: `auth_bridge.failed.csv` plus a
   `cleanup_auth_users.sh` script that takes the failed UUID list and
   calls `supabase.auth.admin.deleteUser` per row. Document this as the
   recovery procedure, not "best-effort transactional."

### Required v3 login-flow behavior (council 2026-04-16 amendment)

Forced password reset on first login is **mandatory**, not advisory.
Compensates for `email_confirm: true` bypassing email verification at
create time.

- Auth-bridge sets `auth.users.user_metadata.migrated_from_bubble = true`
  at create.
- v3 login flow checks: if `migrated_from_bubble === true` AND
  `last_sign_in_at IS NULL` → force password reset before any session is
  granted. The reset email itself acts as the email-verification proxy
  (controls demonstrate possession of the address).
- This must land in v3 before bridge runs in production. Tracked as a
  separate v3 issue, not a strike-mcp deliverable.

### Cutover communication artifacts (required before bridge runs)

The bridge tool produces operational artifacts that need user-facing
communication. These templates must exist as drafts before cutover:

1. `docs/migration/CUTOVER-USER-NOTICE.md` — Norwegian + English. Tells
   migrated users: "your account is ready in v3, click here to set a
   password, your push notifications need re-enabling on first mobile
   login."
2. `docs/migration/CUTOVER-SWAP-NOTICE.md` — for the 14 employees with
   pending swaprecords (Wrightegaarden specifically). Names initiator +
   counterparty + the two shift dates + ask "please re-initiate this
   swap in v3 once you log in."
3. `reports/<workspace>-pending-swaps.csv` — generated artifact listing
   the 14 swap records strike-mcp dropped. Hand to manager for outreach.

Per Pontus's email policy (global CLAUDE.md): drafts only, never sent.
HR or workspace owner sends them manually post-review.

### Bridge-tool deliverable timeline

ADR-0006 was written assuming the bridge tool would be a separate
package built in parallel. Council 2026-04-16 noted this is currently
vapor — no scoped work, no owner, no deadline. Before any production
cutover:

- A scoped strike-auth-bridge package must exist with: CSV reader,
  `supabase.auth.admin.createUser` wrapper, idempotency logic per the
  rules above, failure CSV emitter, halt-threshold enforcement.
- Its own ADR-0001 in that package's docs/ folder must lock the contract
  with this ADR-0006 (especially the deterministic UUID formula and the
  user_metadata.migrated_from_bubble flag).
- Estimated effort: 1-2 days of focused work. Not in scope for Tier 1
  attestation; required for Tier 1 apply.

### Auth-method homogeneity assumption

ADR-0006 assumes all 127 Wrightegaarden Bubble users used Bubble's email
auth provider (`authentication.email.email`). Sample of 100/127 records
during discovery showed 100% email-auth shape. **Before bridge runs:**
explicitly query the full 127-row dataset for any non-email auth shapes
(Facebook, Google, etc.). Non-email-auth users need separate triage
(re-invite via standard v3 SSO flow), not bridge migration.

## Consequences

**Positive:**

- Strike-mcp stays dry-run-only (preserves ADR-0002 boundary).
- Deterministic UUIDs make the FK alignment trivial.
- Auth-bridge tool is single-purpose and reusable for future tenants.
- Email collisions surface as explicit failures, not silent overwrites.

**Negative:**

- Two-step apply flow is more complex than single-step. Mitigated by
  documentation + apply script wrapping both steps.
- Random temp passwords mean every migrated user must reset password on
  first login. Acceptable: cutover communication can include "you'll
  need to reset your password the first time you log in to v3."
- Bubble users without email (rare but possible) cannot be migrated as
  auth.users — they'll surface as bridge failures, requiring manual
  decision (fabricate email, drop user, etc.).

## Implementation references

- `src/migration/transforms.ts` — register `email_from_auth` transform.
- `tests/migration/transforms.test.ts` — add tests for the nested path
  extraction (happy path + missing nested keys + null record).
- `mappings/users.json` — patched + attested with field decisions.
- Future: `strike-auth-bridge` tool (separate package, future ADR-0007 in
  that tool's docs).

## Related decisions

- ADR-0002 (dry-run-only emit) — the boundary this protects.
- ADR-0003 (conflict strategy) — bridge step is `manual_only` from
  strike-mcp's perspective.
- ADR-0004 (derived/constant columns) — derived_columns alone cannot
  handle nested path extraction; a real transform is required.
- ADR-0005 (raw_json_target) — orthogonal; auth fields don't need raw_json.
