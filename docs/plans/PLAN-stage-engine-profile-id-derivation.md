---
title: "Plan — Stage-Engine Profile ID Server Derivation (Phase A2)"
status: ready
updated: 2026-04-22
created: 2026-04-22
module: ai-agent
tags: [plan, stage-engine, security, adr-0151, forgery, campaign-a2]
---

# Plan — Stage-Engine Profile ID Server Derivation

> **Campaign:** `docs/plans/CAMPAIGN-botsson-arena.md` — Phase A, item A2
> **ADR:** 0151 (proposed)
> **Priority:** High (security gap — L-0058 recurrence risk)

## Goal

Flytt `profile_id`-derivasjon fra request-body til server-side i eksisterende stage-engine routes. Auth-context finnes allerede (JWT + API-key), vi bare slutter å stole på body-parameteren. Ingen ny endpoint, ingen ny auth-strategi — kun reparasjon av eksisterende flyt.

## Context

`services/stage-engine/src/routes/agent/chat.ts` accepts `profile_id` in the request body (lines 34, 94, 131, 191) and passes it directly to:
- `gate_action` RPC as `actor_profile_id`
- `activity_trail` inserts
- `engine_memory` scope filters (when wired)

JWT callers have this already validated via RLS; **API-key callers do not**. L-0058 documented a prior incident where this gap let a misconfigured adapter emit events under a different workspace's admin profile. The fix was defence-in-depth specific to that adapter; the structural fix is ADR-0151.

## Scope

**In:**
1. Add `deriveProfileId(request)` helper in `services/stage-engine/src/lib/auth.ts` (or new file) that:
   - For JWT bearer: decodes JWT, returns `sub` as user_identity_id, then resolves to `profile_id` via workspace context in request.
   - For API key bearer: looks up `api_key` row, returns the bound `profile_id` (api keys are issued to a specific profile per ADR-0117).
   - Throws 401 if neither works.
2. Remove `profile_id` from request body schemas for `/agent/chat`, `/sessions`, `/sessions/:id/*`.
3. Pass derived `profile_id` into `gate_action`, `activity_trail` inserts, context collector.
4. Keep `acting_on_behalf_of` optional parameter, but reject it on API-key routes (only admin JWT can invoke on-behalf-of another profile).
5. Unit + integration tests: JWT path, API-key path, forged body path (request body `profile_id` ignored).

**Out:**
- Rewriting API key model.
- Restructuring workspace context derivation (stays as-is).

## Tasks

- [ ] Draft ADR-0151 (if not already written — check `docs/decisions/0151-*`). Promote to `accepted` after council review.
- [ ] Write `deriveProfileId()` helper with both auth paths.
- [ ] Update `/routes/agent/chat.ts` — remove `profile_id` from body schema, call helper.
- [ ] Update `/routes/sessions.ts`, `/routes/advance.ts`, `/routes/store.ts`, `/routes/fetch.ts` similarly.
- [ ] Update `/routes/adapters/ultravox.ts`, `/routes/adapters/telegram.ts` — external adapters must derive or reject.
- [ ] Update TypeScript types — body types lose `profile_id`, add `derivedProfileId` to request context.
- [ ] Unit tests: forged `profile_id` in body is ignored.
- [ ] Integration tests: JWT + API key both succeed; mismatched workspace rejected.
- [ ] Deploy to preview, verify mobile `/api/botsson/chat` BFF still routes correctly (BFF is the primary JWT caller).

## Acceptance Criteria

- [ ] `grep -n "profile_id" services/stage-engine/src/routes/` matches exist ONLY in variables derived server-side, not in body schemas.
- [ ] Integration test: POST `/agent/chat` with `profile_id` in body + conflicting JWT → JWT wins, body value discarded.
- [ ] Integration test: API-key auth path derives `profile_id` from key binding, rejects body `profile_id`.
- [ ] All existing E2E journeys pass on preview.
- [ ] ADR-0151 moves from `proposed` to `accepted`.
- [ ] HANDOFF with before/after diff summary.

## Risks

1. **Mobile BFF breakage** — BFF currently forwards JWT, not `profile_id`. Verify BFF doesn't pass body `profile_id`. If it does, remove that line in `/apps/web/src/app/api/botsson/chat/route.ts` and `/apps/web/src/app/api/emma/chat/route.ts`.
2. **Ultravox adapter** — Ultravox callbacks don't carry JWT. They use an API key. Ensure the API key is issued to a system profile per workspace, bound correctly.
3. **Telegram adapter** — Same as Ultravox. Telegram bot uses workspace-scoped API key; must resolve to a bot profile.
4. **Backwards compat** — external integrations may be passing `profile_id`. Grep for callers, migrate them, or reject with 400 + clear error. No silent accept.

## Dependencies

- ADR-0117 (API key model) accepted — API keys are already profile-bound.
- Phase A6 (observability) helpful but not required — structured logs make debugging migration easier.

## Post-Implementation

- [ ] ADR-0151 accepted
- [ ] Learning log: record any surprising caller we discovered
- [ ] CAMPAIGN A2 → complete
- [ ] Move to `docs/plans/completed/`
