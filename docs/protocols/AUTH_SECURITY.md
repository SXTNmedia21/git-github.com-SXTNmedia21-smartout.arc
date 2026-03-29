---
title: Auth Security Protocol
status: in_progress
updated: 2026-03-29
created: 2026-03-29
module: auth
tags: [auth, security, otp, sandbox, rate-limiting]
---

# Auth Security Protocol

Operational reference for the Smartout auth system. Covers how authentication works in
production, sandbox lifecycle rules, rate limiting layers, cleanup routines, and incident
response. Written for an ops engineer maintaining or debugging the system.

---

## 1. Auth Flows

### Email + Password (standard login)

The default auth method for returning users who completed workspace setup.

**What Supabase handles:**

- Password hashing (bcrypt via GoTrue)
- Session creation and JWT issuance
- Refresh token rotation
- Min password length enforcement (config.toml: `min_password_length = 8`)

**What our code handles:**

1. User submits email + password to the login form
2. `supabase.auth.signInWithPassword({ email, password })` is called client-side
3. On success: middleware reads the session JWT, extracts `user_id`
4. Middleware fetches `user_identity` + associated workspaces
5. If the user has one workspace: redirect to `/dashboard`
6. If the user has multiple workspaces: redirect to workspace picker
7. Rate limiter (`auth` bucket: 5 attempts / 60s) is checked before the Supabase call — if
   Redis is available and limit is exceeded, the request is rejected before hitting Supabase

**Failure paths:**

- Wrong password: Supabase returns 400, surface "Invalid credentials"
- Rate limit exceeded: surface "Too many attempts. Try again in a moment."
- Redis unavailable (fail-closed): all auth blocked — see Incident Response §9

---

### OTP / Engangskode (passwordless login + workspace entry verification)

Used in two contexts:

1. **Passwordless login** — user enters email, receives OTP, enters it to log in
2. **Workspace entry verification** — after workspace creation in wizard, owner must verify
   via OTP before workspace becomes `active`

**What Supabase handles:**

- OTP generation and delivery (via email/SMS configured in project settings)
- OTP expiry enforcement (config.toml: `otp_expiry = 1800` — 30 minutes)
- Rate limit at Supabase layer (`sign_in_sign_ups = 30` per 5 min per IP)

**What our code handles (passwordless login):**

1. User submits email on the OTP login screen
2. `supabase.auth.signInWithOtp({ email })` is called
3. OTP rate limiter checked (`otp` bucket: 3 requests / 15 min) — blocks if exceeded
4. Telemetry: `auth.otp_sent` emitted
5. User receives email with OTP code
6. User submits OTP code
7. `supabase.auth.verifyOtp({ email, token, type: 'email' })` is called
8. On success: `auth.otp_verified` emitted, session established, redirect to workspace
9. On failure: `auth.otp_failed` emitted, error surfaced to user

**What our code handles (workspace entry verification):**

1. Workspace created in wizard with `workspace_status = 'sandbox'`
2. System records `verification_deadline = now() + 48 hours`
3. OTP sent to workspace owner's email
4. Owner enters OTP code in the verification prompt inside dashboard
5. On verified: `workspace_status` updated to `'active'` via Edge Function
6. On timeout: cleanup routine deletes the workspace (see §5)

**OTP expiry:** 30 minutes (1800 seconds). If expired, user must request a new code.

---

### Google OAuth

**What Supabase handles:**

- OAuth redirect flow (GoTrue as OAuth proxy)
- Token exchange with Google
- User upsert in `auth.users`

**What our code handles:**

1. User clicks "Continue with Google"
2. `supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: ... })` is called
3. User is redirected to Google consent screen
4. Google redirects back to our callback URL (`/auth/callback`)
5. `/auth/callback` route exchanges the code for a session
6. `handle_new_user()` trigger fires if this is a new user — creates `user_identity` row
7. Middleware checks for existing workspace membership
8. If no workspace: redirect to onboarding wizard
9. If workspace exists: redirect to dashboard

**Note:** Google OAuth does not go through our Redis rate limiter — it relies on
Supabase's built-in limits and Google's own rate limiting.

---

## 2. Workspace Lifecycle

Workspaces follow a defined status path controlled by the `workspace_status` enum.

```
sandbox → active → suspended → archived
```

| Status      | Meaning                             | Transition trigger        |
| ----------- | ----------------------------------- | ------------------------- |
| `sandbox`   | Created, pending email verification | Wizard completion         |
| `active`    | Verified, fully operational         | OTP verification by owner |
| `suspended` | Temporarily blocked (admin action)  | Manual by platform admin  |
| `archived`  | Permanently closed (admin action)   | Manual by platform admin  |

**Sandbox creation:**

- Wizard completion writes `workspace_status = 'sandbox'` and `verification_deadline = now() + interval '48 hours'`
- A verification OTP is immediately sent to the workspace owner

**Sandbox → Active transition:**

- Owner enters correct OTP within 48 hours
- Edge Function updates `workspace_status = 'active'`, clears `verification_deadline`
- Telemetry: `workspace.activated` emitted

**Sandbox expiry:**

- Daily cleanup routine finds workspaces where `workspace_status = 'sandbox'` AND
  `verification_deadline < now()`
- These workspaces and their orphaned users are deleted
- Telemetry: `workspace.abandoned` emitted per deleted workspace

**Suspended and Archived:**

- Not yet implemented in UI — manual database operations only
- Reserved for future platform-admin tooling

---

## 3. Sandbox Rules

Sandbox workspaces have restricted capabilities. The purpose is to give owners enough
visibility to understand the product while blocking actions that require a trusted,
verified workspace.

| KAN (allowed)                   | KAN IKKE (blocked)             |
| ------------------------------- | ------------------------------ |
| View dashboard                  | Create integrations / API keys |
| Browse own data                 | Invite team members            |
| Complete setup wizard           | Export data                    |
| View sample content             | Trigger agent interactions     |
| Complete workspace verification | Access billing settings        |

**Implementation:** Sandbox checks are enforced via the `workspace_status` field on the
`workspace` table. Components and API routes that touch blocked functionality must check
`workspace.workspace_status === 'sandbox'` before proceeding.

**Telemetry:** When a sandbox workspace attempts a blocked action, emit
`security.sandbox_blocked` with the action name and workspace ID.

---

## 4. Rate Limiting — Three Layers

Auth is protected by three independent rate limiting layers. They are not redundant —
each catches different attack vectors at different points in the stack.

### L1: Supabase Config Layer (`config.toml`)

Enforced by GoTrue before any request reaches application code.

| Setting               | Value                     | Purpose                                      |
| --------------------- | ------------------------- | -------------------------------------------- |
| `sign_in_sign_ups`    | 30 per 5 minutes (per IP) | Brute force protection on all auth endpoints |
| `otp_expiry`          | 1800 seconds (30 min)     | Limits OTP validity window                   |
| `min_password_length` | 8 characters              | Prevents trivially weak passwords            |

These limits are set in `supabase/config.toml` and apply in all environments.

### L2: Upstash Redis Application Layer (`packages/supabase/src/rate-limit.ts`)

Enforced by our application code before calling Supabase. Uses Upstash Redis with
sliding window counters.

| Bucket             | Limit       | Window     | Applies to                                      |
| ------------------ | ----------- | ---------- | ----------------------------------------------- |
| `auth`             | 5 requests  | 60 seconds | All login attempts (email+password, OTP verify) |
| `otp`              | 3 requests  | 15 minutes | OTP send requests                               |
| `workspace-create` | 3 requests  | 1 hour     | Workspace creation                              |
| `api`              | 20 requests | 60 seconds | General API endpoints                           |

**Fail-closed behavior:** If Redis is unavailable, the rate limiter returns `blocked`
for all auth requests. This is intentional — a degraded rate limiter is worse than no
service, because it creates a false sense of security. If Redis goes down, restore it
immediately (see Incident Response §9).

Telemetry on limit exceeded: `security.rate_limited` with bucket name, IP, and user ID
(if authenticated).

### L3: Telemetry Anomaly Detection (Future)

Not yet implemented. Planned events that feed future anomaly detection:

- `security.rate_limited` — already emitted by L2, will feed aggregation
- `security.lockout_triggered` — fired when a user is explicitly locked out
- Pattern: >10 `rate_limited` events/hour from same IP triggers a Slack alert

---

## 5. Cleanup Routines

### `cleanup-sandbox-workspaces` Edge Function

Removes abandoned sandbox workspaces that failed to verify within the deadline.

| Property         | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Function name    | `cleanup-sandbox-workspaces`                             |
| Recommended cron | `0 3 * * *` (daily at 03:00 UTC)                         |
| Auth method      | `WATCHDOG_CRON_SECRET` bearer token                      |
| `verify_jwt`     | `false` (configured in `supabase/functions/config.toml`) |

**What it does:**

1. Authenticates the request using the cron secret
2. Queries for workspaces where `workspace_status = 'sandbox'` AND `verification_deadline < now()`
3. For each expired workspace:
   a. Collects member `user_id` values
   b. Deletes the workspace (cascades to related data via FK rules)
   c. Deletes orphaned `user_identity` rows (users with no remaining workspace membership)
   d. Deletes the corresponding `auth.users` record via service role
   e. Emits `workspace.abandoned` telemetry event
4. Returns a summary of deleted workspaces for logging

**Manual run:**

```bash
curl -X POST https://<project>.supabase.co/functions/v1/cleanup-sandbox-workspaces \
  -H "Authorization: Bearer $WATCHDOG_CRON_SECRET"
```

**Monitoring:** Check Edge Function logs in the Supabase dashboard after each run.
Failures are silent if the cron job doesn't alert — review logs weekly (see §7).

---

## 6. Telemetry Events

All auth events route through `packages/telemetry` and are registered in
`packages/telemetry/src/registry.ts`. Do not emit events outside the registry.

| Domain      | Event               | When emitted                                  |
| ----------- | ------------------- | --------------------------------------------- |
| `auth`      | `otp_sent`          | OTP successfully requested and sent           |
| `auth`      | `otp_verified`      | OTP successfully verified                     |
| `auth`      | `otp_failed`        | OTP verification failed (wrong code, expired) |
| `auth`      | `logged_in`         | Any successful auth (password, OTP, OAuth)    |
| `security`  | `rate_limited`      | L2 rate limiter blocks a request              |
| `security`  | `lockout_triggered` | User explicitly locked out (future)           |
| `security`  | `sandbox_blocked`   | Blocked action attempted in sandbox workspace |
| `workspace` | `abandoned`         | Expired sandbox workspace deleted by cleanup  |

**Routing destinations (via telemetry registry):**

- `activity_trail` — all auth + security events (audit trail)
- `engine_event` — workspace events (trigger downstream workflows)
- `PostHog` — auth events (product analytics, funnel tracking)
- `Logger` — all events (stdout/structured log)

---

## 7. Weekly Audit Checklist

Run this check every week to catch issues before they escalate.

- [ ] Check rate limit hit counts in Upstash dashboard — any spikes?
- [ ] Review `security.rate_limited` events in `activity_trail` — patterns by IP or user?
- [ ] Verify sandbox cleanup ran — check Edge Function logs for `cleanup-sandbox-workspaces`
- [ ] Review failed OTP attempts (`auth.otp_failed`) — sudden spike = possible attack or email delivery issue
- [ ] Check for stale sandbox workspaces manually:
  ```sql
  SELECT id, name, verification_deadline
  FROM workspace
  WHERE workspace_status = 'sandbox'
  AND verification_deadline < now();
  ```
- [ ] Confirm no workspaces in `suspended` or `archived` that shouldn't be

---

## 8. Escalation Matrix

| Signal                                                      | Severity | Action                                                      |
| ----------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| >10 `rate_limited` events/hour from same IP                 | Medium   | Auto-escalate to Slack alert (future — not yet implemented) |
| >5 `lockout_triggered` events in 1 hour                     | High     | Manual review, assess for IP-level block                    |
| Sandbox cleanup failure (no log for >25h)                   | Low      | Check Edge Function logs, run cleanup manually              |
| Redis unavailable (fail-closed active)                      | Critical | All auth blocked — restore Redis immediately (see §9)       |
| Spike in `auth.otp_failed` without corresponding `otp_sent` | Medium   | Possible OTP enumeration — review IP patterns               |
| `workspace.abandoned` count jumps >5x baseline              | Low      | Possible onboarding funnel issue — review wizard metrics    |

---

## 9. Incident Response

### Auth blocked (Redis down — fail-closed active)

Redis unavailability causes all L2-protected auth requests to be rejected.

1. Check Upstash dashboard for service status: https://console.upstash.com
2. Verify the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars are
   correctly set in the deployment environment
3. If Upstash is down: wait for service recovery, monitor Upstash status page
4. If env vars are wrong: update via Vercel dashboard or `op run` → redeploy
5. Once Redis is restored, auth resumes automatically — no code changes needed
6. Review logs to confirm rate limit state was not corrupted during the outage

### Mass failed OTPs (spike in `auth.otp_failed`)

Could be email delivery failure or an enumeration attack.

1. Check email delivery status in SendGrid dashboard — are emails reaching recipients?
2. If delivery is healthy: review IP patterns in `activity_trail` for `otp_failed` events
3. If concentrated from a few IPs: manual IP assessment, consider temporary block
4. If distributed: possible bot activity — review volume vs baseline, escalate if >10x
5. Check sender reputation score in SendGrid — failed deliveries hurt reputation

### Sandbox overflow (cleanup not running)

Workspaces accumulating in `sandbox` state past their deadline.

1. Check Edge Function logs for `cleanup-sandbox-workspaces` — was the last run successful?
2. If no recent logs: the cron trigger may have stopped — verify cron config
3. Run cleanup manually using the curl command in §5
4. Verify the `WATCHDOG_CRON_SECRET` env var is set correctly
5. Check that `cleanup-sandbox-workspaces` is listed in `supabase/functions/config.toml`
   with `verify_jwt = false`

---

## Related Documents

- `docs/protocols/SECURITY.md` — broader security protocol (API keys, RLS, secrets)
- `supabase/functions/cleanup-sandbox-workspaces/` — cleanup Edge Function implementation
- `packages/supabase/src/rate-limit.ts` — L2 rate limiter implementation
- `packages/telemetry/src/registry.ts` — telemetry event registry
- `supabase/config.toml` — L1 Supabase auth configuration
