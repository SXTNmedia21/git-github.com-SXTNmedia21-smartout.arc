---
title: HANDOFF — Chat BFF profile_id server-derivation (G9 / ADR-0151)
status: done
updated: 2026-05-25
created: 2026-05-25
module: ai-router
tags: [handoff, chat-bff, ADR-0151, G9, security]
---

# HANDOFF — Chat BFF profile_id server-derivation (G9)

## Summary

Investigated, documented, and regression-tested the G9 gap: body-supplied
`profile_id` in `/api/botsson/chat` and `/api/emma/chat`. Added 13 tests
covering forgery, missing-session, missing-profile, and happy-path cases.
No code changes to the routes were needed — `profile_id` was already
server-derived before this sortie. The tests lock in that behavior.

## What Changed

### New files

| File | Purpose |
|------|---------|
| `apps/web/src/app/api/botsson/__tests__/chat-route.test.ts` | 7 tests: forgery rejection, 401/403 fail-fast, role gate, status gate, Bearer path |
| `apps/web/src/app/api/emma/__tests__/chat-route.test.ts` | 6 tests: forgery rejection, 401/403 fail-fast, workspace membership, Bearer path |

### No route modifications

Both routes already implement ADR-0151 for `profile_id`. The fix for the
original gap (stripping body-supplied `profile_id`) was applied in commit
`84f374cc5` (2026-05-06). The G9 gap as documented referred to a regression
from that date — the regression was already present and fixed in that commit.
This sortie adds regression tests to prevent drift.

## Decisions

### D1 — Silent-strip over strict-reject for body profile_id

Both routes use `z.object()` without a declared `profile_id` field. Zod
silently strips unknown fields in `.parse()` mode. This is lenient (silent-
strip) not strict (4xx on unexpected field). Rationale: changing to strict
mode would break legitimate clients that send extra fields for other reasons
(e.g. primeContext.profileId — which IS in the schema for a different purpose).
The forgery defense is complete: even if a client sends `profile_id: "other"`,
Zod strips it and the server uses the session-derived value. No need for a
`.strict()` or `.strip()` explicit call — the default behavior is sufficient.

### D2 — workspaceId remains body-supplied (documented residual gap)

`workspaceId` is body-supplied in both routes. Full ADR-0151 compliance would
require server-derivation from a trusted source (JWT claim or subdomain
middleware). Neither exists today:
- No Next.js middleware derives workspace from subdomain for API routes.
- The Supabase JWT does not embed workspace_id (user can have multiple
  workspace memberships).

The existing mitigation: the profile lookup `.eq("user_id", user.id).eq("workspace_id", body.workspaceId)` forces the authenticated user to actually own a profile in the supplied workspace. A forged workspaceId for a workspace the user doesn't belong to → 403. A forged workspaceId for a workspace the user DOES belong to → returns their own profile in that workspace — this is not identity forgery, it is workspace-switching.

Risk: multi-workspace users can switch context by supplying a different
`workspaceId`. This is accepted behavior today (the intent resolver and
context snapshot scope to whichever workspace the client sends). Full
remediation requires either: (a) middleware deriving workspace from subdomain
header for all `/api/` routes, or (b) JWT-embedded workspace claim.

This is flagged as a separate debt item — it is NOT a regression from this
sortie, it is the pre-existing design.

### D3 — No new `derive-chat-profile.ts` helper

A new helper was planned. Not needed: both routes already inline the same
pattern (auth → profile lookup → fail-fast 4xx). The existing
`apps/web/src/lib/auth/resolve-auth.ts` and `get-server-context.ts` cover
the auth portion. Creating a third helper for the chat-specific variant
(with role gate on botsson, no role gate on emma) would duplicate the inline
code without reducing the footprint. The inline pattern is clear and
covered by tests.

## Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `profile_id` not in Zod schema (stripped by Zod) | PASS — confirmed: no `profile_id` field in RequestSchema of either route |
| 2 | Server derives `profile_id` via auth + profile lookup | PASS — steps 1-3 in both routes |
| 3 | 401 when no session | PASS — 2 tests (one per route) |
| 4 | 403 when no profile in workspace | PASS — 2 tests (one per route) |
| 5 | Forgery: body `profile_id=B` with session for A → stage-engine gets A | PASS — 2 tests |
| 6 | Happy path — 200 with server-derived profile_id | PASS — 2 tests |
| 7 | `pnpm --filter web typecheck` PASS | OOM on WSL2 (3.9Gi available, swap=0B). Pre-existing errors confirmed unrelated. New test files have 0 type errors (verified via targeted `tsc --skipLibCheck \| grep __tests__` output). |
| 8 | `pnpm test apps/web/src/app/api/botsson/` PASS | PASS — 13/13 |

## Known Issues / Debt

### RES-1: workspaceId server-derivation (separate follow-up)

Body-supplied `workspaceId` is the residual gap. Full ADR-0151 compliance
requires one of:
- Next.js middleware that reads `x-workspace-slug` (set by subdomain routing)
  and injects a trusted `x-workspace-id` header into API route requests.
- Supabase JWT custom claim embedding the active `workspace_id`.

Recommended path: middleware approach. Wire `x-workspace-id` from the
existing subdomain middleware, then both chat routes can read it from
`request.headers.get("x-workspace-id")` and ignore `body.workspaceId`.

### RES-2: `get-server-context.ts` takes first profile (no workspace pin)

The existing helper in `apps/web/src/lib/auth/get-server-context.ts` selects
`.limit(1)` — the "first" profile regardless of workspace. Callers that use
this helper and then rely on `ctx.profile.workspace_id` get the first
workspace alphabetically or by insertion order. Not used by the chat routes
(which do their own workspace-pinned lookup), but future consumers should
be aware. Flag for the workspace-derivation follow-up sortie.

## Next Steps

1. Follow-up sortie: middleware workspace derivation (reads subdomain slug →
   resolves workspace_id → injects trusted `x-workspace-id` header for API
   routes). This closes the RES-1 gap and fully satisfies ADR-0151 for both
   routes.
2. Update `get-server-context.ts` to accept an optional `workspaceId` param
   so it can do a workspace-pinned lookup (fixes RES-2).
3. When middleware lands: update chat routes to read workspace from header,
   drop `workspaceId` from RequestSchema, add test for header-vs-body
   workspace conflict.
