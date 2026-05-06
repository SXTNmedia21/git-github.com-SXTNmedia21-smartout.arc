---
title: "Voice-Agent Workspace Authority Chain"
status: canonical
created: 2026-05-06
updated: 2026-05-06
module: MODULE_BOTSSON
tags: [botsson, voice, security, authority, adr-0151, workspace_id, livekit]
---

# Voice-Agent Workspace Authority Chain

> **Staleness gate:** Cite `verified_against_code: 2026-05-06`. A reviewer reading `adapter.ts:ask()` should be able to trace the full chain from this document without opening any other file.

---

## 1. Purpose

`ctx.workspace.workspace_id` is threaded into every stage-engine call from the voice-agent (`adapter.ts:ask()` line 73). If a client could forge this value, it could cause stage-engine to act, emit telemetry, and write audit rows under a workspace it does not belong to — violating the **"Confident ≠ Authorized"** principle and the core invariant of ADR-0151.

This document proves that the value is **server-authority** from the first HTTP request to the final stage-engine body. No client-supplied field at any step can elevate access to a workspace the authenticated user does not have an active profile in.

---

## 2. The Chain

### Diagram

```
Browser (JWT cookie)
    │
    │  POST /api/botsson/voice/token
    │  body: { workspaceId: "<uuid>" }
    │
    ▼
token/route.ts:33–68
  ├─ supabase.auth.getUser()            → JWT verified → user.id (unforgeable)
  ├─ profile lookup: user_id = user.id  → cross-checks body.workspaceId
  │   AND workspace_id = body.workspaceId
  │   AND status IN (active, trainee)
  ├─ 403 PROFILE_NOT_FOUND if no row    → body.workspaceId not granted
  └─ LiveKit token minted: identity = profile.profile_id
     room = botsson-orb:<profile_id>
     metadata: { source: "botsson-orb", is_ai: false, ... }
    │
    │  GET /api/botsson/voice/session-context?workspaceId=<uuid>
    │
    ▼
session-context/route.ts:32–141
  ├─ supabase.auth.getUser()            → JWT verified → userId (unforgeable)
  ├─ profile lookup: user_id = userId   → cross-checks query param workspaceId
  │   AND workspace_id = workspaceId
  ├─ 403 FORBIDDEN if no row            → query param workspaceId not granted
  ├─ workspace row fetched by PK        → workspace.workspace_id from DB
  └─ WorkspaceContext { workspace_id: workspace.workspace_id, ... }
       workspace_id is the DB value — not the query param echoed back
    │
    │  Browser sends data message on LiveKit data channel
    │  topic = "botsson-context"
    │  { type: "context_init", user: {...}, workspace: { workspace_id, ... } }
    │
    ▼
context.ts:setSessionContext()          → _workspace = msg.workspace
  (voice-agent Node.js process)
    │
    │  On every voice turn:
    │
    ▼
adapter.ts:ask() line 54
  ctx = getSessionContextSnapshot()     → reads _workspace (server-resolved)
  body.workspace_id = ctx.workspace.workspace_id   (line 73)
    │
    │  POST stage-engine /agent/chat
    │  { workspace_id, profile_id, channel: "voice", message }
    │
    ▼
stage-engine/core/derive-profile-id.ts
  ├─ bearer token → admin.auth.getUser() → userId (unforgeable)
  ├─ profile lookup: user_id = userId
  │   AND workspace_id = body.workspace_id
  └─ ActorDerivationError (→ 403) if no row   → defence-in-depth
```

### Step-by-step

| Step | File:line | What happens | Authority source |
|------|-----------|--------------|------------------|
| 1. Cookie auth | `token/route.ts:35–43` | `supabase.auth.getUser()` validates the Supabase JWT cookie. `user.id` is set by the auth server — cannot be forged by body content. | Supabase Auth server |
| 2. Profile cross-check | `token/route.ts:59–68` | DB lookup `profile WHERE user_id = user.id AND workspace_id = body.workspaceId AND status IN (active, trainee)`. 403 on no row. `body.workspaceId` acts as a **selector**, not a **grant** — the user must already have a profile row. | PostgreSQL + RLS |
| 3. Token mint | `token/route.ts:91–113` | LiveKit AccessToken minted with `identity = profile.profile_id`. The `workspaceId` body field is not embedded in the token — only the profile identity is. | Server-side LiveKit SDK |
| 4. Session-context fetch | `session-context/route.ts:32–65` | Second independent JWT validation + profile cross-check. `workspace_id` in the response comes from `workspace.workspace_id` (DB row, line 78), not from the query param. | PostgreSQL + RLS |
| 5. `context_init` data message | browser → LK data channel | Browser publishes the server-returned `WorkspaceContext` over the LiveKit data channel (topic `botsson-context`). The browser cannot alter `workspace_id` without already having it from step 4 — but even if it did, step 7 catches it. | Server-resolved at step 4 |
| 6. `setSessionContext()` | `context.ts:86–98` | Voice-agent stores `msg.workspace` into module-level `_workspace`. No validation here — trust originates from steps 1–4. | Steps 1–4 |
| 7. `ask()` reads snapshot | `adapter.ts:54–76` | `getSessionContextSnapshot().workspace.workspace_id` threaded as `workspace_id` in stage-engine body (line 73). Comment at line 70–72 cites ADR-0151. | Steps 1–4 (carried forward) |
| 8. Stage-engine re-derives | `derive-profile-id.ts:22–50` | `deriveProfileId(userId, workspaceId, supabase)` — server derives `profile_id` from bearer token + `workspace_id`. `ActorDerivationError` → 403 on no row. Defence-in-depth: even if `workspace_id` were somehow wrong, this lookup fails. | PostgreSQL + bearer token |

---

## 3. Why It Is Unforgeable

A client attempting to escalate to a workspace it has no profile in will be blocked at **every link** in the chain:

1. **Token route** (step 2): `profile WHERE user_id = JWT.sub AND workspace_id = attacker_value` returns zero rows → **403 "No active profile in workspace"** (`token/route.ts:67–69`).
2. **Session-context route** (step 4): same lookup, independent JWT validation → **403 "Profile not found in workspace"** (`session-context/route.ts:60–65`).
3. **Stage-engine** (step 8): `deriveProfileId` throws `ActorDerivationError` for "no profile row for user in workspace" → **403** (`derive-profile-id.ts:38–40`).

The `workspaceId` body/query field is a **selector that requires a matching DB row** — it is validated, not trusted. Owning a valid JWT for user A does not grant access to workspaces where user A has no active profile row.

**File:line authority citations:**

| Guard | File | Lines |
|-------|------|-------|
| Token route — profile row check | `apps/web/src/app/api/botsson/voice/token/route.ts` | 59–68 |
| Session-context route — profile row check | `apps/web/src/app/api/botsson/voice/session-context/route.ts` | 52–65 |
| Stage-engine — server-side re-derivation | `services/stage-engine/src/core/derive-profile-id.ts` | 22–50 |
| `ask()` — comment citing ADR-0151 | `services/voice-agent/src/adapter.ts` | 70–72 |

---

## 4. Failure Modes

| Attack vector | Where it fails | HTTP status | Log signal |
|---------------|---------------|-------------|------------|
| Forge `workspaceId` in token body (workspace user has no profile in) | `token/route.ts:67` — `profile` row not found | 403 | `"No active profile in workspace"` |
| Forge `workspaceId` in session-context query param | `session-context/route.ts:60` — `profile` row not found | 403 | `"Profile not found in workspace"` |
| Tamper `workspace_id` inside `context_init` data message (post-LK-connect) | `derive-profile-id.ts:38` — profile row not found for (JWT user, tampered workspace_id) | stage-engine 403 / `ActorDerivationError` | `"no profile row for user in workspace"` |
| Expired/invalid JWT cookie | `token/route.ts:41`, `session-context/route.ts:35` — `auth.getUser()` fails | 401 | `"Unauthorized"` |
| Inactive/offboarding profile | `token/route.ts:64` — `.in("status", ["active", "trainee"])` filter excludes row | 403 | `"No active profile in workspace"` |
| Direct API-key call to stage-engine with forged `workspace_id` | `derive-profile-id.ts` — bearer token `userId` does not match a profile in attacker workspace | stage-engine 403 | `ActorDerivationError` thrown |

---

## 5. Test Strategy

### Unit / Integration

The primary integration test is at:

```
services/stage-engine/src/__tests__/agent-chat-forged-profile.test.ts
```

This verifies that stage-engine rejects a body with a `profile_id` from a different workspace (landed ADR-0151, 2026-04-23).

### Cross-workspace token request (manual smoke)

1. Authenticate as user A (workspace W1).
2. POST `/api/botsson/voice/token` with `body.workspaceId = W2` (a workspace user A has no profile in).
3. Expected: **403** `{ "error": "No active profile in workspace" }`.
4. Repeat for `/api/botsson/voice/session-context?workspaceId=W2`.
5. Expected: **403** `{ "error": "FORBIDDEN", "message": "Profile not found in workspace" }`.

### Fase 4 Task 14.8

Automated cross-workspace assertion is referenced in the Fase 4 proposal pipeline plan (Task 14.8). It covers:

- Token route returns 403 for cross-workspace attempt
- Session-context route returns 403 for cross-workspace attempt
- Stage-engine rejects forged `workspace_id` when bearer token does not match

---

## Related

| Reference | Where |
|-----------|-------|
| ADR-0151 — no-forgeable-IDs | `docs/decisions/0151-stage-engine-profile-id-server-derivation.md` |
| Botsson System Map | `docs/architecture/BOTSSON-SYSTEM-MAP.md` |
| Stage Engine architecture | `docs/architecture/STAGE-ENGINE.md` |
| ADR-0132 — voice routes through BFF | `docs/decisions/0132-*.md` |
| ADR-0078 — channel policy | `docs/decisions/0078-*.md` |
