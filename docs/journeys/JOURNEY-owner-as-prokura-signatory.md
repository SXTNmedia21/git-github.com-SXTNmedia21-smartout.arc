---
title: "Journey — Owner becomes contract recipient + prokura signatory"
status: draft
updated: 2026-05-20
created: 2026-05-20
module: platform-admin
tags: [journey, platform-admin, contracts, invitation, prokura]
---

# Journey — Owner becomes contract recipient + prokura signatory

> Branch: `feat/owner-as-prokura-signatory`

## Journey 1: Platform-admin invites owner → contract recipient updated

**Precondition:** Workspace exists with draft contract. Godmode user (Pontus) is on `/platform-admin/workspaces/[id]` → Champions tab.

1. Pontus clicks **Invitér bruker** → Sheet opens → "Enkelt" tab
2. Pontus fills `email=owner@kunde.no`, `first_name=Erik`, `last_name=Eriksen`, `role=owner` → clicks Send
3. System validates → `withWorkspaceAdmin` gate passes
4. System pre-checks `invitation` for `(workspace_id, role=owner, status=pending)` → none exist → continue
5. System calls `createInvitation()` → invitation row inserted
6. System updates workspace's draft contract: `recipient_name="Erik Eriksen"`, `recipient_email="owner@kunde.no"`
7. Toast "Invitasjon sendt" → sheet closes
8. ContractTab now shows recipient_email = `owner@kunde.no`

**Postcondition:** Invitation pending for owner. Draft contract addressed to that owner.

**Error paths:**
- Existing pending owner-invite → backend returns 409 `owner_invite_pending` → toast "En owner-invite venter allerede"
- Contract update fails (e.g. no draft contract on workspace) → invitation still succeeds; logged warning

## Journey 2: Owner accepts invite → becomes prokura signatory

**Precondition:** Pending owner invitation. Owner clicks link in email → lands on `/accept-invitation/{token}`.

1. Owner fills name + password → submits
2. Edge function `accept-invitation` creates `auth.users` row + `user_identity` + `profile { role=owner, status=active }`
3. **NEW:** because `invitation.role === "owner"`, function updates `workspace.signatory_profile_id = newly_created_profile.profile_id`
4. Function returns success → owner redirected to `{slug}.smartout.ai/dashboard`

**Postcondition:** `workspace.signatory_profile_id` populated. Owner is the deterministic signatory for any contract send from this point.

**Error paths:**
- Profile insert fails → entire accept fails (existing behaviour)
- Workspace update fails → log + continue; signatory can be re-set later by re-inviting owner (would need separate flow)

## Journey 3: Platform-admin sends contract → DocuSeal uses signatory

**Precondition:** Workspace has `signatory_profile_id` populated. Draft contract exists.

1. Pontus on `/platform-admin/contracts/[id]` → clicks Send
2. Platform-admin route forwards to `contract-service POST /contracts/{id}/send`
3. Contract-service loads contract → loads workspace → reads `signatory_profile_id`
4. If set: joins profile + user_identity → overwrites `recipient_name` and `recipient_email` for the DocuSeal payload
5. If null: falls back to `contract.recipient_*` (legacy path)
6. DocuSeal envelope dispatched → email lands in signatory's inbox

**Postcondition:** Contract emailed to the prokura signatory regardless of stale `contract.recipient_*` values.

**Error paths:**
- `signatory_profile_id` set but profile soft-deleted or missing email → fall back to `contract.recipient_*` with a warning event
- DocuSeal failure → existing error handling

## Journey 4: Second owner-invite blocked

**Precondition:** Workspace has pending owner invitation (from Journey 1).

1. Pontus tries to invite a second owner → backend 409 `{ "error": "Pending owner-invite already exists", "code": "owner_invite_pending" }`
2. Toast surfaces error → sheet stays open with details
3. To replace pending owner, Pontus must cancel/expire current invite first (existing invitation flow)

**Postcondition:** Owner-invite uniqueness enforced — never two pending owners at once.
