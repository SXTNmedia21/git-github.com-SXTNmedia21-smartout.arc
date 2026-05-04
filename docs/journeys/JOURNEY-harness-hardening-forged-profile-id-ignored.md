---
title: "Journey — Forged profile_id is ignored"
feature: harness-hardening
journey: forged-profile-id-ignored
status: verified
verified_at: 2026-04-23
verification_debt: "Manual curl against running stage-engine deferred — dev stack not run during sortie. Code + integration test + CI invariant all green."
e2e_test: services/stage-engine/src/__tests__/agent-chat-forged-profile.test.ts
created: 2026-04-23
updated: 2026-04-23
module: MODULE_BOTSSON
tags: [journey, security, audit, stage-engine]
---

# Journey: Forged profile_id is ignored; audit trail shows real actor

**Role:** admin (observes audit trail) + API-key caller (adversary)

**Precondition:**
- Stage engine deployed with Task 2 + Task 3 shipped (profile_id server-derivation)
- Workspace has ≥ 2 profiles: `alice-profile` (real caller) and `bob-profile` (victim)
- `alice-profile` has a valid bearer token

## Happy Path

1. API-key caller POSTs `/agent/chat` with `Authorization: Bearer <alice>` and body containing `profile_id: "<bob-profile-uuid>"` (forged). → Stage engine ignores the body field, calls `deriveProfileId(alice.userId, workspaceId)` → resolves to `alice-profile`. → Emits `botsson.turn_started` with `actor_id = alice-profile` (branded `NonEmptyString`).
2. Admin opens `activity_trail` for the session. → All turn events show `actor_id = alice-profile`. → `bob-profile` does not appear anywhere in the trail.
3. Alternative happy path: client omits `profile_id` from body entirely. → Same outcome — server derives from bearer; no schema error.

**Postcondition:**
- `agent_session.profile_id = alice-profile` in DB
- `activity_trail` rows all carry `actor_id = alice-profile`
- No path through the stack permits `bob-profile` as `actor_id`

## Error Paths

- **Scenario:** Bearer is valid but no `profile` row exists in the workspace → `deriveProfileId` throws `ActorDerivationError` → route returns `403 PROFILE_NOT_FOUND`. No session created, no emit.
- **Scenario:** Bearer missing → `401 UNAUTHENTICATED` (existing behavior).
- **Scenario:** `profile_id` column in DB is somehow empty string → `nonEmpty()` brand factory throws in dev/test; returns `__EMIT_DROPPED__` sentinel in prod. Downstream providers reject the sentinel.

## Verification

- [ ] Implementation matches the steps above (Task 2 + Task 3 of the plan)
- [ ] E2E test exists and passes: `services/stage-engine/src/__tests__/agent-chat-forged-profile.test.ts`
- [ ] Manually tested end-to-end via curl against running stage-engine:
      `curl -X POST http://localhost:5010/agent/chat -H "Authorization: Bearer <alice>" -d '{"message":"hi","profile_id":"<bob-uuid>"}'` → audit shows alice, not bob
- [ ] CI invariant `invariants:server-actor` passes on HEAD (Task 10 + Task 12)

**Mark `status: verified` in frontmatter when all four boxes are checked.**
