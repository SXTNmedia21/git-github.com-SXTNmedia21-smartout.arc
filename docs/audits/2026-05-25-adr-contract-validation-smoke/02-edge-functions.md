---
title: Edge-Functions Audit — Smoke (2026-05-25)
status: done
updated: 2026-05-25
created: 2026-05-25
module: edge-functions
tags: [audit, security, edge-functions, adr-0039, adr-0151, adr-0265, adr-0388, adr-0389]
---

# Edge-Functions Audit — Smoke (2026-05-25)

## Coverage

- EFs scanned: 66 (all non-hidden, non-config entries under `supabase/functions/`)
- config.toml `[functions.*]` blocks audited: 63
- ADR cluster: ADR-0039, ADR-0151, ADR-0265, ADR-0388, ADR-0389, L-0042, L-0177

---

## CRITICAL findings

**C-01** — `supabase/functions/ingest-workspace-knowledge/index.ts:196-214` — **L-0177 / ADR-0151**
The `trigger='delete'` branch executes a `workspace_doc_chunk` DELETE against the service-role client before auth identity is verified. The only gate at this point is `if (!authHeader)` (line 162) — presence of any non-empty Authorization header is sufficient to reach the delete. The actual auth validity check (`callerToken === serviceKey` or `userClient.auth.getUser()`) happens at line 237, after the mutation. Any caller who can supply an arbitrary `Authorization` header value, a valid `workspace_id`, a `source_type`, and a `source_id` can delete RAG knowledge chunks for that workspace without being authenticated. Since `verify_jwt=false`, Supabase's gateway does not validate the JWT either.

Fix: move the auth block (lines 237-270) above the body parse, or at minimum above the `trigger=delete` branch. The delete path must only execute after `isServiceRole || (user && workspaceMember)` is established.

---

## HIGH findings

**H-01** — `supabase/functions/shift-clock-compliance/index.ts:54-78` — **ADR-0151 / L-0177**
`profile_id` and `shift_id` are accepted directly from the request body. The function has `verify_jwt=true` (Supabase gateway validates JWT), but the body never calls `supabase.auth.getUser()` to cross-check that the authenticated caller owns the supplied `profile_id`. The service-role client then queries `time_entry` and `shift_clock_config` scoped only to the body-supplied `profile_id`. An authenticated employee (any valid JWT) can supply a different employee's `profile_id` and receive their rest-period hours, weekly hours totals, and shift compliance data — a timesheet data leak. ADR-0151 mandates server-derive of identity fields from the JWT, not body.

Fix: call `supabase.auth.getUser()` with anon key + Authorization header, then verify `profile_id` matches a profile belonging to `user.id` in the same workspace before executing any queries.

**H-02** — `supabase/functions/call-command/index.ts:103,256,344,423` — **ADR-0151**
Four handler functions (`handleStart`, `handleRespond`, `handleInvite`, `handleLeave`) accept `workspaceId` from `body.workspaceId` and then query `profile` by `eq("workspace_id", workspaceId)`. The workspace ID is cross-validated by finding the caller's profile in that workspace (line 116-130), which is a reasonable runtime check. However the pattern deviates from ADR-0151's mandate to server-derive `workspace_id` from the JWT profile. If the profile lookup returns a row it implies the user is in that workspace, so the practical risk is low. Flagged as HIGH because it breaks the ADR pattern and could be exploited if the profile RLS policy had a gap. The `livekit-token` EF correctly documents and implements the ADR-0151 server-derive for its wizard branch, making the inconsistency visible.

Fix: derive `workspaceId` from the authenticated user's profile row rather than trusting the body value. Use the pattern from `livekit-token`'s wizard branch.

---

## MEDIUM findings

**M-01** — `supabase/functions/send-login-code/index.ts` (missing from config.toml) — **ADR-0388**
`send-login-code` is not listed in `config.toml`, so it gets the default `verify_jwt=true`. The function body also explicitly calls `auth.getUser()` via an anon-key client, resulting in double JWT verification (Supabase gateway + function body). This is redundant but not a bug — the function is safe. However the absence from config.toml means the intent is ambiguous (is it intentional or an oversight?). The two other missing EFs (`create-invitation` and `delete-account`) are the same situation. All three do call `auth.getUser()` in-body so the double-verify is redundant.

Fix: add explicit `[functions.send-login-code]`, `[functions.create-invitation]`, and `[functions.delete-account]` blocks to config.toml with `verify_jwt = true` to make intent explicit and match the ADR-0388 convention of documenting all function auth intent.

**M-02** — `supabase/functions/ingest-workspace-knowledge/index.ts:237-238` — **Token comparison anti-pattern**
Service-role detection uses `callerToken === serviceKey` (string equality of the raw service-role JWT string). If the service-role key is ever rotated, the comparison breaks silently (rejects legitimate internal calls). The preferred pattern used elsewhere (`verifyInternalAuth`) accepts both `SUPABASE_SERVICE_ROLE_KEY` and `WATCHDOG_CRON_SECRET`. Beyond the rotation risk: string-comparing a raw JWT to detect privilege is fragile — a Supabase SDK update that adds key padding/normalization could break it without any code change. Note: this finding is secondary to C-01; fixing C-01 should refactor this path entirely.

**M-03** — `supabase/functions/ops-triage/index.ts:109,125` — **L-0177**
`workspace_id` is resolved as `body.workspace_id ?? payload.workspace_id` where `payload` comes from the request body. The function is gated by `WATCHDOG_CRON_SECRET` so only internal/cron callers can reach it. Risk is limited to internal callers mismapping workspace context — not an external attack surface. Nonetheless, cron functions writing to `notification` and `engine_event` with an untrusted `workspace_id` from the body violates the L-0177 fail-fast pattern. The correct source for workspace_id in this context would be the event payload validated against DB.

**M-04** — `supabase/functions/payroll-period-locked-handler/index.ts:63,129` — **L-0177**
`workspace_id` is accepted from the request body with only a string-non-empty check (`isNonEmptyString`). No DB row verification confirms the workspace exists or that the `period_id` belongs to that `workspace_id`. Gated by `verifyInternalAuth` so only service-role or cron callers can reach it — external attack surface is zero. Internal miscall (engine-dispatch passing wrong workspace_id) would silently corrupt notification routing. Fix: add DB lookup `SELECT 1 FROM payroll_period WHERE id = period_id AND workspace_id = workspace_id` before executing mutations; fail-fast if no row.

---

## LOW findings

**L-01** — `supabase/functions/gather-workspace-intelligence/index.ts:150` — Mixed auth
`verifyInternalAuth` is called first (correct), but the function also calls `supabase.auth.getUser()` on line 150 after the internal auth check. If called from engine-dispatch with a service-role Bearer, the subsequent `getUser()` with that token will return `null` (service role is not a user). The function likely falls through gracefully, but the double-auth path is inconsistent and the getUser result is either unused or causes a null-dereference risk. Low because the primary gate is the internal auth check; the getUser path only runs on a code path that should be unreachable via cron.

**L-02** — `supabase/functions/identify-company/index.ts:69` — Same as L-01
`verifyInternalAuth` at line 15 is the gate, but `supabase.auth.getUser()` is called at line 69 in the same handler. Same mixed-auth pattern. Risk: if called without a valid user JWT the getUser result is null and downstream code may assume a user context that isn't there.

**L-03** — All cron EFs with `"Access-Control-Allow-Origin": "*"` — **CORS open on internal-only endpoints**
Cron-only EFs (`daily-session-replenish`, `session-task-overdue-cron`, `session-lifecycle`, `heartbeat-dispatcher`, `fire-delayed-triggers`, `note-fanout-scheduler`, `guardian-sweep`, `leader-pulse`, `obligation-overdue-cron`, `obligation-due-soon-cron`, `publish-birthday-celebrations`, `shift-lateness-check`, `contract-lifecycle`, `generate-monthly-invoices`, `session-watchdog-demoter`, `pos-sync`, `ops-day-brief`, `ops-learn`, `ops-monitor`, `ops-predict`, `ops-triage`, `watchdog-integrity`, `watchdog-uptime`) all return `"Access-Control-Allow-Origin": "*"` CORS headers and handle OPTIONS preflight. These functions are not browser-callable (cron secret required) so the open CORS header is a no-op security-wise. However it is misleading — it suggests browser calls are expected. Remove CORS boilerplate from cron-only EFs to reduce surface ambiguity. Low severity since the WATCHDOG_CRON_SECRET gate blocks any unauthenticated access.

**L-04** — `supabase/functions/emma-task-trigger/index.ts` and `supabase/functions/contract-lifecycle/index.ts` — Missing config.toml verify_jwt comment
Both are cron-only EFs with `verify_jwt=false` correctly set, but unlike the other cron EFs there is no comment in config.toml documenting why verify_jwt=false (intent documentation pattern used for `session-task-overdue-cron`, `note-fanout-scheduler`, `publish-birthday-celebrations`, etc.). Minor doc debt.

---

## verify_jwt mismatch table

| Function | config.toml `verify_jwt` | Body expects | Verdict |
|---|---|---|---|
| `stripe-webhook` | `false` | Stripe signature (ECDSA) | CORRECT — external webhook, signature is auth boundary |
| `sendgrid-webhook` | `false` | ECDSA P-256 + timestamp window | CORRECT — external webhook |
| `livekit-webhook` | `false` | LiveKit SDK receiver (HMAC) | CORRECT — external webhook |
| `livekit-token` | `true` | JWT via `auth.getUser()` (+ anon path for wizard) | CORRECT — user-facing with partial anon exception |
| `apply-change-proposal` | `true` | JWT via `auth.getUser()` | CORRECT |
| `guardian-actions` | `true` | JWT via `auth.getUser()` | CORRECT |
| `shift-clock-compliance` | `true` (default) | JWT gateway validates but body `profile_id` unverified | HIGH — see H-01 |
| `workspace-api` | `false` | API key or JWT via `resolveAuth` | CORRECT — handles dual auth |
| `validate-api-key` | `false` | API key or JWT via `resolveAuth` | CORRECT |
| `send-login-code` | `true` (default, missing block) | JWT via `auth.getUser()` | MEDIUM — see M-01 (correct but undocumented) |
| `create-invitation` | `true` (default, missing block) | JWT via `auth.getUser()` | MEDIUM — see M-01 |
| `delete-account` | `true` (default, missing block) | JWT via `auth.getUser()` | MEDIUM — see M-01 |
| `engine-dispatch` | `false` | `verifyInternalAuth` (service-role or cron secret) | CORRECT |
| `bootstrap-cascade` | `false` | `verifyInternalAuth` | CORRECT |
| `ingest-workspace-knowledge` | `false` | Dual: service-role OR JWT+workspace check (but delete path skips — C-01) | CRITICAL — see C-01 |
| `analyze-setup-documents` | `false` | JWT via `auth.getUser()` (anon-key) | CORRECT — documented F-EF-07 |
| `push-dispatch` | `false` | `PUSH_DISPATCH_SECRET` bearer | CORRECT — internal dispatch secret |
| `process-notifications` | `false` | `PROCESS_NOTIFICATIONS_SECRET` bearer | CORRECT |
| `send-morning-digest` | `false` | `MORNING_DIGEST_SECRET` bearer | CORRECT |
| All cron EFs (22) | `false` | `WATCHDOG_CRON_SECRET` or `CRON_SECRET` bearer | CORRECT — prior H finding (ADR-0367 Day 2) resolved; all 5 ops EFs now have config.toml blocks |
| `tariff-amendment-sweep` | `false` | `CRON_SECRET` bearer | CORRECT |
| `obligation-overdue-cron` | `false` | `CRON_SECRET` bearer | CORRECT |
| `obligation-due-soon-cron` | `false` | `CRON_SECRET` bearer | CORRECT |
| `validate-settlement` | `false` | `verifyInternalAuth` | CORRECT |
| `process-settlement-image` | `false` | `verifyInternalAuth` | CORRECT |
| `gather-workspace-intelligence` | `false` | `verifyInternalAuth` (+ redundant getUser) | LOW — see L-01 |
| `google-places-intelligence` | `false` | `verifyInternalAuth` | CORRECT |
| `web-search-intelligence` | `false` | `verifyInternalAuth` | CORRECT |
| `scrape-website` | `false` | `verifyInternalAuth` | CORRECT |
| `search-brreg` | `false` | `verifyInternalAuth` | CORRECT |
| `identify-company` | `false` | `verifyInternalAuth` (+ redundant getUser) | LOW — see L-02 |
| `analyze-workspace` | `false` | `verifyInternalAuth` | CORRECT |
| `journey-stuck-detector` | `false` | `verifyInternalAuth` | CORRECT |
| `payroll-period-locked-handler` | `false` | `verifyInternalAuth` | CORRECT gate; workspace_id not DB-verified (M-04) |
| `activate-workspace` | `false` | JWT via `auth.getUser()` (anon key) | CORRECT — onboarding flow |
| `finalize-workspace` | `false` | JWT via `auth.getUser()` | CORRECT |
| `extract-workspace-data` | `false` | JWT via `auth.getUser()` | CORRECT |
| `scrape-raw-data` | `false` | JWT via `auth.getUser()` | CORRECT |
| `accept-invitation` | `false` | Optional JWT (allows anonymous) | CORRECT — invitation tokens are the auth |
| `health-check` | `false` | `WATCHDOG_CRON_SECRET` | CORRECT |
| `cleanup-sandbox-workspaces` | `false` | `verifyInternalAuth` | CORRECT |
| `cleanup-api-keys` | `false` | `WATCHDOG_CRON_SECRET` | CORRECT |
| `contract-lifecycle` | `false` | `WATCHDOG_CRON_SECRET` | CORRECT |
| `emma-task-trigger` | `false` | `WATCHDOG_CRON_SECRET` | CORRECT |
| `heartbeat-dispatcher` | `false` | `WATCHDOG_CRON_SECRET` | CORRECT |

---

## ADR-0039 scope note

ADR-0039 mandates that *external* API consumers reach workspace-scoped data through `workspace-api`. Internal EFs writing directly to workspace-scoped tables via service-role is the correct architecture — they are trusted server-side callers, not external clients. No ADR-0039 violations found. `workspace-api` correctly uses `resolveAuth` + `requireScope` on all routes and enforces test-key-in-production guard.

---

## Prior finding status

- **5 ops cron EFs missing verify_jwt=false** (ADR-0367 Day 2 / HMS audit HIGH): RESOLVED. All five (`ops-day-brief`, `ops-learn`, `ops-monitor`, `ops-predict`, `ops-triage`) now have `verify_jwt = false` blocks in config.toml.
- **sendgrid-webhook missing signature verification** (prior H-02): RESOLVED. ECDSA P-256 + 5-minute timestamp window is in place; fail-closed on missing `SENDGRID_WEBHOOK_VERIFICATION_KEY`.

---

## False-positives ignored

1. `ingest-workspace-knowledge` delete-path uses service-role Supabase client scoped to `workspace_id + source_type + source_id` — even if auth is bypassed, the caller must know a valid `workspace_id` and `source_id` pair to cause damage. This reduces blast radius but does not eliminate the finding (C-01 stands).
2. `ops-triage` accepting `body.workspace_id` is mitigated by the WATCHDOG_CRON_SECRET gate; marked MEDIUM not HIGH.
3. `shift-clock-compliance` returning compliance data for an arbitrary `profile_id` is a data leak but not a write vulnerability; marked HIGH not CRITICAL.
4. CORS `*` on cron EFs is defense-in-depth debt, not exploitable alone.

---

## Confidence: 82/100

Reduction factors:
- 8 EFs with large bodies (`engine-dispatch` ~4000 lines, `process-notifications`, `bootstrap-cascade`) read only headers/auth section; their internal logic was not exhaustively audited.
- `session-hook-executor` handler logic not read; auth confirmed via `verifyInternalAuth`.
- `contract-lifecycle`, `ops-monitor`, `ops-predict`, `ops-learn`, `ops-day-brief` bodies not read past auth sections.
- RLS policies not verified at DB level (out of scope for EF audit; covered by database-guide skill).
