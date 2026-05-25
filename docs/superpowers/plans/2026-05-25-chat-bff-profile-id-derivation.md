---
title: Plan — Chat BFF profile_id server-derivation (G9 / ADR-0151)
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: ai-router
tags: [plan, chat-bff, ADR-0151, security, G9]
---

# Plan — Chat BFF profile_id server-derivation (G9)

## Context

Council 2026-05-25 flagged G9: `/api/botsson/chat` and `/api/emma/chat` accept body-supplied `profile_id`. ADR-0151 mandates server-side derivation — body-supplied IDs are forgeable. Same class as L-0177 silent-fallback failure mode.

## Scope

In:
- `apps/web/src/app/api/botsson/chat/route.ts` — derive `profile_id` from JWT session
- `apps/web/src/app/api/emma/chat/route.ts` — same
- Existing helper if present (grep `getProfileFromSession`, `derive*Profile`, `getProfileContext`); reuse over reinvent
- Mobile BFF /api/mobile/chat/* if exists — grep + apply same pattern
- Tests: forgery rejection + missing-session rejection (4xx fail-fast)

Out (defer):
- `workspace_id` derivation if already done (verify; if not, add to scope)
- LiveKit voice token endpoint — separate ADR
- Profile lookup-by-email middleware — out

## Acceptance

1. Zod body schema strips `profile_id` field (or rejects with 4xx if present + non-matching session)
2. Server resolves `profile_id` via:
   - `createServerClient()` (Next.js cookies) → `auth.getUser()` → `profile.user_id = user.id`
   - Fail-fast 401 if no session, 403 if no profile in workspace
3. Pass derived `profile_id` to stage-engine RPC payload (NOT body value)
4. NEW unit test: forgery attempt POST `/api/botsson/chat` with `profile_id: "<other-user-uuid>"` AND valid session → 4xx (NOT silent-swap, NOT 200-with-other-user)
5. NEW unit test: missing session → 401
6. NEW unit test: session OK + no profile in workspace → 403
7. typecheck + existing chat E2E green

## Approach

1. Read both route handlers; identify current Zod schema + payload assembly
2. Check `apps/web/src/lib/` for existing helper (likely `derive-profile-context.ts` or in `apps/mobile/src/lib/profile-context.ts` per ADR-0134; reuse pattern, port if web-side missing)
3. Apply fail-fast per L-0177 — never silent fallback to JWT-default workspace, never accept body value if differs from server-derived

## Tests

- Vitest spec mocking `createServerClient` + profile lookup
- Existing E2E already covers happy path; add forgery-attempt fixture

## Out-of-scope (explicit)

- Service-role bypass for godmode chat — separate ADR
- WebSocket / SSE chat endpoint — if exists, follow-up sortie
- Refactor stage-engine internals to ignore body profile_id — sufficient that BFF strips it
