---
title: "Journey — User rejects ghost card → activity_trail row"
feature: botsson-fase-4-proposal-pipeline
journey: reject-emits-trail
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: Botsson
tags: [journey]
---

# Journey: User rejects proposal → audit trail captured

**Role:** admin / manager

**Precondition:** Ghost card rendered. `change_proposal` row with `status = 'pending'`. User has authority to reject.

## Happy Path

1. User clicks "Avvis" on ghost card → `rejectProposal()` invoked with `workspaceId` + `profileId` props → `change_proposal.status` flipped to `'rejected'` → `emit('change_proposal.rejected')` writes to activity_trail + telemetry registry routes (PostHog, Logger, engine_event) → ghost card removed from React state.

**Postcondition:** `change_proposal.status = 'rejected'`. `activity_trail` row exists with `event = 'change_proposal.rejected'`, `actor_id = profileId`, `workspace_id = workspaceId`. No `schedule_shift` mutation. Telemetry registry contains `change_proposal.rejected` event definition.

## Error Paths

- **`workspaceId` or `profileId` prop missing** → `getProfileContext()` (or equivalent guard) throws fail-fast → no corrupt telemetry written.
- **Network failure during reject** → ghost card stays visible for retry.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — Task 14.6
- [ ] Manually tested end-to-end
- [ ] Telemetry registry has `change_proposal.rejected` entry (T2 verification)

**Mark `status: verified` in frontmatter when all four boxes are checked.**
