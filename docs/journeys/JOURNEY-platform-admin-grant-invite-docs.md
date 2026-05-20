---
title: "Journey — Platform-admin grant, invite, and document drop"
status: draft
updated: 2026-05-20
created: 2026-05-20
module: platform-admin
tags: [journey, platform-admin, invitation, document-drop]
---

# Journey — Platform-admin grant, invite, and document drop

> Branch: `feat/platform-admin-grant-invite-docs`

## Journey 1: Super-admin creates a workspace and lands inside it

**Precondition:** Pontus (godmode user) is logged into `/platform-admin` and starts a new workspace from `/platform-admin/workspaces/new`.

1. Pontus fills out the company + workspace form → clicks **Create**
   - System validates with `CreateWorkspaceSchema`
   - System creates `workspace`, updates `company` subscription, inserts `pricing_terms`, creates draft `contract` if template selected
   - **NEW:** System inserts `profile { user_id: godmodeUserId, role: admin, status: active }` for the workspace
   - **NEW:** System upserts `company_member { user_id: godmodeUserId, role: admin }` on the company
   - System writes `create_workspace` row to `platform_audit_log`
2. Pontus is redirected to `/platform-admin/workspaces/[id]` → sees Overview tab
3. Pontus opens `{slug}.smartout.ai/dashboard` in a new tab → middleware finds his profile → dashboard loads without redirect-loop

**Postcondition:** Pontus is `admin` in the new workspace and can administer it from both `/platform-admin/workspaces/[id]` and `{slug}.smartout.ai/dashboard`.

**Error paths:**
- Profile insert fails (e.g. unique constraint): workspace-create still succeeds, audit-log records `auto_grant_failed: true`, Pontus must manually invite himself (workspace exists, manual recovery possible).

## Journey 2: Super-admin invites a real owner or admin

**Precondition:** Workspace exists. Pontus is on `/platform-admin/workspaces/[id]` → Champions tab.

1. Pontus clicks **Invitér bruker** → Sheet opens
2. Pontus picks tab **Enkelt** → fills email + first_name + last_name + role (`owner | admin | user`) → clicks **Send invitasjon**
   - System maps `user → employee` and POSTs `{ workspace_id, email, first_name, last_name, role, channels: ["email"] }` to `/api/admin/invite`
   - `withWorkspaceAdmin` gate passes because of Journey 1 (Pontus is admin)
   - `createInvitation()` writes invitation row, dispatches SendGrid email
3. Toast shows "Invitasjon sendt til {email}" → sheet closes → Champions tab still shows current profiles (invitee not in profile table yet)
4. Recipient receives email → clicks link → completes `/accept-invitation` flow → profile row created with the chosen role

**Postcondition:** Recipient appears in Champions tab with chosen role and status `active` (or `trainee` for non-admin roles per platform default).

**Error paths:**
- Duplicate invite for the same email → backend returns 4xx → toast shows the message.
- Email malformed → Zod fails → form shows inline error.

## Journey 3: Super-admin imports a CSV of users

**Precondition:** Workspace exists. Pontus is on `/platform-admin/workspaces/[id]` → Champions tab.

1. Pontus clicks **Invitér bruker** → Sheet opens → picks tab **CSV**
2. Pontus uploads CSV file → `CsvMappingDialog` opens with column-mapping suggestions
3. Pontus maps columns to email / first_name / last_name / role → clicks **Importer**
4. System builds batch payload (each row → `BatchInviteRowSchema`) → POSTs `/api/admin/invite` with `invites: [...]`
5. Backend loops `createInvitation()` per row → returns aggregate result
6. Toast shows "X invitasjoner sendt, Y feilet"

**Postcondition:** All valid rows dispatched as invitations. Failed rows surfaced to operator (toast or row-level error list).

**Error paths:**
- CSV with no recognizable email column → mapping dialog flags it → import button disabled.
- Row with invalid email or missing role → backend returns 4xx for that row → aggregate result lists failures.

## Journey 4: Super-admin drops documents that analyze and update the workspace

**Precondition:** Workspace exists. Pontus is on `/platform-admin/workspaces/[id]` → Intelligence tab.

1. Pontus scrolls past summary cards → sees DocumentDrop zone
2. Pontus drags PDF / DOCX into the drop zone → files upload to `workspace-documents/{workspaceId}/{filename}`
3. Pontus clicks **Analyser** → POST `/api/platform-admin/workspaces/analyze-documents` with `{ workspaceId, storagePaths, bucket }`
4. Backend downloads files → extracts text → updates `workspace_doc_chunk` + `engine_memory` rows
5. Toast shows "X dokumenter analysert"
6. Pontus reloads page → Intelligence tab summary cards reflect new chunk count

**Postcondition:** Workspace intelligence enriched with the dropped documents.

**Error paths:**
- File too large (>20 MB) → reject before upload, toast.
- Unsupported MIME → reject before upload, toast.
- Analyze API failure → toast with error message, files stay in bucket.
