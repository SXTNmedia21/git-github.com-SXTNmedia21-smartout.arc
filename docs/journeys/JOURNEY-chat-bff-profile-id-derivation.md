---
title: Journey — Chat BFF profile_id server-derivation
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: ai-router
tags: [journey, chat-bff, ADR-0151, G9]
---

# Journey — Forgery attempt rejected, real session honored

## J1 — Manager A posts chat with forged profile_id of Manager B

**Role:** Authenticated manager (A) with valid session
**Precondition:**
- Manager A and Manager B both exist in workspace
- Session cookie belongs to Manager A

**Steps:**
1. Manager A's client posts `POST /api/botsson/chat { message: "...", profile_id: "<B's UUID>" }`
2. BFF reads session cookie → resolves Manager A
3. BFF either: (a) strips body `profile_id` and uses A's, OR (b) returns 4xx because body ≠ session
4. Stage-engine RPC receives `profile_id = A` (NOT B)

**Postcondition:**
- engine_memory + chat-history rows attributed to A
- Manager B's data untouched
- Telemetry `chat.request` emit carries actor_id = A's profile_id

**Error paths:**
- No session cookie → 401 "Authentication required"
- Session OK + user has no profile in workspace → 403 "Profile not found in workspace"
- Body profile_id ≠ session-derived → 4xx (strict mode) OR silent-strip (lenient — confirm with team; default strict)

## J2 — Authenticated manager posts chat normally (no profile_id in body)

**Role:** Authenticated manager
**Precondition:** Valid session cookie

**Steps:**
1. Client posts `POST /api/botsson/chat { message: "..." }` (no profile_id)
2. BFF derives profile_id from session
3. Stage-engine receives correct profile_id

**Postcondition:** chat works as before, no regression.

## What changes vs broken state

BEFORE: BFF trusts `req.body.profile_id`. Any client (even unauthenticated tooling with cookie) can spoof another user's identity. Telemetry, gates, memory all attribute to forged ID.

AFTER: Body field stripped; server derives from session cookie via `createServerClient().auth.getUser()` → `profile.user_id = user.id` lookup. Fail-fast per L-0177.
