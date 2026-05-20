---
title: "Plan — platform-admin-grant-invite-docs"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: platform-admin
tags: [plan, platform-admin, invitation, document-drop]
---

# Plan — platform-admin-grant-invite-docs

> Branch: `feat/platform-admin-grant-invite-docs` | Worktree: /home/sxtnl/dev/smartout.ai-wt-1 | Base: `development` | Module: platform-admin

## Goal

Close three gaps on `/platform-admin/workspaces/[id]`:
1. Godmode creator gets `profile { role: admin }` + `company_member { role: admin }` automatically when creating a workspace from platform-admin → can actually log into `{slug}.smartout.ai/dashboard`.
2. Workspace-detail gets an "Invite user" button — single-form + CSV upload — that targets `/api/admin/invite` with role ∈ {owner, admin, manager, employee}.
3. Workspace-detail gets the same DocumentDrop UX as `/setup` so super-admin can drop documents that analyze + update the workspace.

## Background

- `POST /api/platform-admin/workspaces/route.ts` (lines 164-296) creates workspace + company + pricing + draft contract — **no profile-insert** for the godmode creator. Catch-22: `/api/admin/invite` requires `withWorkspaceAdmin`, so without a profile the creator cannot invite anyone either.
- `ChampionsTab.tsx` is read-only (lines 89-118) — only filter + per-row email send. No invite trigger.
- `IntelligenceTab.tsx:10` imports `DocumentDrop` but never renders it. Bucket `workspace-documents` + `/api/platform-admin/workspaces/analyze-documents` already exist.
- `/dashboard/setup` (TeamSetupStep.tsx + DocumentDropStep.tsx) is the reference UX — CSV column mapper at `apps/web/src/components/dashboard/wizard-steps/csv-column-mapper.tsx`, synonyms at `csv-synonyms.ts`, DocumentDrop at `apps/web/src/components/platform-admin/document-drop.tsx`.

## Tasks

### A. Auto-grant superadmin creator (platform-admin only)
- [ ] `apps/web/src/app/api/platform-admin/workspaces/route.ts`: after workspace insert (line 203), look up `user_identity { first_name, last_name, email }` for `adminId`, insert `profile { workspace_id, user_id: adminId, role: "admin", status: "active", display_name }`, upsert `company_member { company_id, user_id: adminId, role: "admin" }` (on conflict do nothing).
- [ ] Best-effort: log error but don't fail the workspace-create response if the profile insert fails (workspace already exists, retry can be manual).

### B. Invite-user Sheet on workspace-detail
- [ ] New `apps/web/src/app/platform-admin/workspaces/[id]/_components/invite-user-sheet.tsx`:
  - Tabs: "Enkelt" + "CSV"
  - Single form: email + first_name + last_name + role-Select (`owner | admin | user` → maps `user → employee`)
  - CSV: reuse `CsvMappingDialog` + `MAPPABLE_FIELDS` (email, firstName, lastName + role synonyms)
  - Submit batch payload to `POST /api/admin/invite`
- [ ] `ChampionsTab.tsx`: add "Invitér bruker" button above the filter row, opens the sheet, passes `workspaceId`.

### C. Render DocumentDrop in IntelligenceTab
- [ ] `IntelligenceTab.tsx`: mount `<DocumentDrop bucket="workspace-documents" pathPrefix={workspaceId} workspaceId={workspaceId} existingFiles={intelligence.files} enableAnalysis />` after the 3 summary cards (line ~122).

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` passes
- [ ] Manual test: create new workspace from `/platform-admin/workspaces/new` → check `profile` + `company_member` rows for adminId
- [ ] Manual test: open workspace-detail → click "Invitér" → submit single invite → row appears in `invitation` table
- [ ] Manual test: open workspace-detail → IntelligenceTab → drop a PDF → file uploads to `workspace-documents` bucket
- [ ] Decision log: ADR if any new patterns added (likely none — pure UI wire + 2-line backend add)

## Out of Scope

- Demoting owners (separate feature)
- Bulk role changes from workspace-detail (separate feature)
- DocumentDrop wired into a wizard inside platform-admin (this is single-shot drop, not a multi-step wizard)
