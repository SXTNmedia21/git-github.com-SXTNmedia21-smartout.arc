---
title: "Journey — User accepts ghost card → schedule_shift INSERT"
feature: botsson-fase-4-proposal-pipeline
journey: accept-creates-shift
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: Botsson
tags: [journey]
---

# Journey: User accepts proposal → real shift mutation

**Role:** admin / manager

**Precondition:** Ghost card rendered from prior voice or chat proposal. `change_proposal` row exists with `status = 'pending'`. User has schedule write authority.

## Happy Path

1. User clicks "Aksepter" on ghost card → optimistic UI commits proposal → backend `schedule_shift` INSERT/UPDATE/DELETE applied per `change_proposal.kind` → `change_proposal.status` flipped to `'accepted'` → telemetry emits `change_proposal.accepted` + the underlying schedule mutation event → ghost card removed from React state, real shift row appears in grid.

**Postcondition:** Real `schedule_shift` mutation persisted. `change_proposal.status = 'accepted'`. `activity_trail` records the acceptance event with `actor_id = current user`. Botsson never bypassed acceptance.

## Error Paths

- **Backend validation fails (e.g. overlap, position not assignable)** → `change_proposal.status` stays `pending`, ghost card surfaces validation error, no `schedule_shift` mutation.
- **User loses workspace permission between propose and accept** → C4 gate rejects → ghost card surfaces "ikke autorisert" error.
- **Network failure during accept** → optimistic UI rolls back → ghost card stays visible for retry.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — Task 14.5
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
