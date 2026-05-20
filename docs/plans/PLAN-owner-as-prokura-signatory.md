---
title: "Plan — owner-as-prokura-signatory"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: platform-admin
tags: [plan, platform-admin, contracts, invitation, prokura]
---

# Plan — owner-as-prokura-signatory

> Branch: `feat/owner-as-prokura-signatory` | Worktree: /home/sxtnl/dev/smartout.ai-wt-5 | Base: `development` | Module: platform-admin

## Goal

When platform-admin invites a user with `role=owner` into a workspace, that user becomes the legal signatory (prokura) for the workspace and is set as the recipient of any pending draft contract. Schema-materialized via a new `workspace.signatory_profile_id` FK so downstream features (DocuSeal send, future legal flows) can find the signatory deterministically.

## Background

- Per session 2026-05-20 verify: `contract.recipient_name` + `recipient_email` are free-text. `workspace` has no `signatory_profile_id` / `owner_profile_id` column. `company.daglig_leder` is a text name, not a FK.
- Contract-service (`services/contract-service/src/routes/contracts.ts` line 226+) reads `contract.recipient_*` directly when calling DocuSeal — no lookup against profile.
- Today there is no concept of "this user is authorized to sign on behalf of the workspace."
- Pontus' choice 2026-05-20:
  - Trigger: **invite-SEND** (not accept) — contract.recipient updated as soon as owner-invite is dispatched
  - Multi-owner: **blokker** — 1 pending owner-invite per workspace
  - Schema: **materialize now** — add `workspace.signatory_profile_id` in this sortie

## Tasks

### A. Schema — `workspace.signatory_profile_id`
- [ ] Migration `supabase/migrations/<ts>_workspace_signatory_profile.sql`:
  - `ALTER TABLE public.workspace ADD COLUMN signatory_profile_id UUID NULL REFERENCES public.profile(profile_id) ON DELETE SET NULL;`
  - `COMMENT ON COLUMN public.workspace.signatory_profile_id IS 'Profile authorized to sign contracts on behalf of the workspace (prokura). Set when an owner-role invitation is accepted. Nullable for legacy workspaces.';`
- [ ] Regenerate `packages/supabase/src/database.types.ts`

### B. Invite-route owner gate + contract update
- [ ] `apps/web/src/app/api/admin/invite/route.ts`:
  - Pre-check: when `role === "owner"`, query `invitation` for `(workspace_id, role='owner', status='pending')` → return 409 with code `owner_invite_pending` if any exists. Applies to both single and batch payloads. In batch, fail the whole batch (atomic) — we don't partially-send.
  - Post-createInvitation: when `role === "owner"`, look up the workspace's most recent draft contract and update `recipient_name = first_name + " " + last_name`, `recipient_email = email`. Best-effort: log error but don't roll back the invite.

### C. Accept-invitation sets signatory_profile_id
- [ ] `supabase/functions/accept-invitation/index.ts`: after profile insert (line ~314), when `invitation.role === "owner"`, update `workspace.signatory_profile_id = profile.profile_id`.

### D. Contract-service uses signatory
- [ ] `services/contract-service/src/routes/contracts.ts` (send-path, ~line 220): before reading `contract.recipient_*`, look up `workspace.signatory_profile_id`. If set, fetch `profile { display_name, user_identity.email }` and overwrite the local `recipient_name` + `recipient_email` (and `kunde_navn`, `kunde_epost`) used for the DocuSeal payload. Keep `contract.recipient_*` denormalized cache untouched on existing rows; this just bumps the runtime values.

### E. UI surface
- [ ] `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ContractTab.tsx` (or wherever signatory belongs in workspace-detail): show "Signatar: {display_name} <email>" row from `workspace.signatory_profile_id`. Show warning "Ingen signatar — invitér owner først" if null. Fetch in server component via the same admin query used for the page.
- [ ] `apps/web/src/app/platform-admin/workspaces/[id]/_components/invite-user-sheet.tsx`: client-side advisory only — if the form is set to `role=owner` and an existing-pending banner is shown, hint to operator. (Optional; backend 409 is the hard gate.)

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` passes
- [ ] Migration applies cleanly via `npx supabase db reset` locally
- [ ] Invite role=owner with no existing pending → invite created + contract.recipient_* bumped (verify via SQL)
- [ ] Second invite role=owner same workspace → 409 with `owner_invite_pending`
- [ ] Accept-invitation for owner-role → `workspace.signatory_profile_id` populated
- [ ] Contract-service send-path reads signatory if set, falls back to contract.recipient_* otherwise

## Out of Scope

- Demoting current signatory (separate flow)
- Migration of existing live workspaces to populate signatory_profile_id from current owner-role profiles (script can be run later if needed)
- ADR for prokura model — write it after this lands so the ADR can reference the shipped schema
