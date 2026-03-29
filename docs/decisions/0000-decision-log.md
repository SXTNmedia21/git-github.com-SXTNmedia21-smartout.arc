---
title: Decision Log
status: done
updated: 2026-03-30
created: 2026-03-29
module: auth
tags: [decisions]
---

# Decision Log — auth-security-friction

| #   | Date       | Decision                                                                                    | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-29 | Silent signUp in wizard step 1, not step 6 — reduces friction, auth invisible to user       | accepted |
| 2   | 2026-03-29 | workspace_status enum (sandbox/active/suspended/archived) on workspace table                | accepted |
| 3   | 2026-03-29 | email_confirmed_at on auth.users as verification source of truth — not a custom column      | accepted |
| 4   | 2026-03-29 | Sandbox 48h deadline — workspaces auto-deleted if not verified within 48 hours              | accepted |
| 5   | 2026-03-29 | Fail-closed auth rate limiting — if Redis unavailable, block auth requests (not fail-open)  | accepted |
| 6   | 2026-03-29 | Three-layer rate limiting: Supabase config + Upstash Redis + telemetry anomaly detection    | accepted |
| 7   | 2026-03-29 | OTP as login method alongside password + Google — never reveals email existence on OTP send | accepted |
| 8   | 2026-03-29 | Engine FK CASCADE on workspace_id — enables sandbox cleanup without FK violations           | accepted |
| 9   | 2026-03-29 | Middleware sandbox cache (30s TTL) — same pattern as godmode cache, minimizes DB lookups    | accepted |
| 10  | 2026-03-29 | Step 6 becomes summary/review — no auth logic, just data confirmation before provisioning   | accepted |
