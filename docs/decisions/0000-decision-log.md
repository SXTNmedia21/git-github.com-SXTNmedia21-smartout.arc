---
title: Decision Log
status: in_progress
updated: 2026-04-06
created: 2026-04-06
module: onboarding
tags: [decisions]
---

# Decision Log — invitation-rls-fix

| #   | Date       | Decision                                                                                                                                                                                                                     | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-04-06 | Replace USING(true) anon SELECT on invitation with SECURITY DEFINER RPC `get_invitation_by_token()`. Token (UUID, 122-bit) acts as authorization. Non-pending returns status only (no PII).                                  | accepted |
| 2   | 2026-04-06 | Set profile status to `active` directly on invite acceptance. Trainee mode deferred to engine_process — profile status on insert is not the right mechanism.                                                                 | accepted |
| 3   | 2026-04-06 | engine_event uses dot-separated event types (`invitation.accepted`) matching engine_trigger convention. activity_trail uses space-separated (`invitation accepted`) matching telemetry registry. Dual naming is intentional. | accepted |

created: 2026-03-29
module: governance
tags: [decisions]

---

# Decision Log

| #   | Date       | Decision                                                                                                                                                                             | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | 2026-03-29 | Silent signUp in wizard step 1, not step 6 — reduces friction, auth invisible to user                                                                                                | accepted |
| 2   | 2026-03-29 | workspace_status enum (sandbox/active/suspended/archived) on workspace table                                                                                                         | accepted |
| 3   | 2026-03-29 | email_confirmed_at on auth.users as verification source of truth — not a custom column                                                                                               | accepted |
| 4   | 2026-03-29 | Sandbox 48h deadline — workspaces auto-deleted if not verified within 48 hours                                                                                                       | accepted |
| 5   | 2026-03-29 | Fail-closed auth rate limiting — if Redis unavailable, block auth requests (not fail-open)                                                                                           | accepted |
| 6   | 2026-03-29 | Three-layer rate limiting: Supabase config + Upstash Redis + telemetry anomaly detection                                                                                             | accepted |
| 7   | 2026-03-29 | OTP as login method alongside password + Google — never reveals email existence on OTP send                                                                                          | accepted |
| 8   | 2026-03-29 | Engine FK CASCADE on workspace_id — enables sandbox cleanup without FK violations                                                                                                    | accepted |
| 9   | 2026-03-29 | Middleware sandbox cache (30s TTL) — same pattern as godmode cache, minimizes DB lookups                                                                                             | accepted |
| 10  | 2026-03-29 | Step 6 becomes summary/review — no auth logic, just data confirmation before provisioning                                                                                            | accepted |
| 11  | 2026-04-06 | Authority skills model — domain knowledge in repo-local skills, CLAUDE.md slimmed to pointers. Always-loaded context reduced ~260 lines. Skills load on-demand via keyword triggers. | accepted |
