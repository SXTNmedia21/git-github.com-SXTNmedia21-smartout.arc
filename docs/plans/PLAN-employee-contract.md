---
title: "Plan — employee-contract"
status: draft
updated: 2026-04-28
created: 2026-04-28
module: other
tags: [plan, contracts, ux, services]
---

# Plan — employee-contract

> Branch: `feat/services-employee-contract` | Worktree: /home/sxtnl/dev/smartout.ai-services-wt-1 | Base: `campaign/services` | Module: other | Started: 2026-04-28

**Spec:** [2026-04-06-employee-contract-management-design.md](../../superpowers/specs/2026-04-06-employee-contract-management-design.md)

## Goal

Tighten the employee contract flow end-to-end: fix silent data loss in CompositionDrawer/MalerTab editors, add destructive-action confirmations, plug telemetry holes, and verify the DocuSeal webhook signing loop on local infra.

## Context

- Triggered by audit pass 2026-04-28 on `/dashboard/contracts/*`
- 6 gaps + 7 UX smells found (see audit notes in conversation memory)
- Frontend-designer pass 2026-04-28 produced specs for fixes 1, 4, 5, 6, 7, 9
- Backend (contract-service `infra-contract-service-1`) verified healthy + auth gate works
- 4 journeys declared up front (admin-create, admin-send, employee-sign, admin-cancel)

## Scope

In:
- Fix 1 — MalerTab editor as deliberate read-only (Lock badge + Copy/Open-in-admin)
- Fix 4 — Cancel confirmation AlertDialog (destructive variant + loading state)
- Fix 5 — CompositionDrawer pass `editedHtml` to API + "Manuelle endringer" badge in SendStep
- Fix 6 — `contract-preview-editor` enforce `editable: false` when `mode==="preview"`
- Fix 7 — Loading state on Resend / Cancel dropdown menu items
- Fix 9 — Unsaved-changes guard on contract-send-drawer + CompositionDrawer + BulkSendDrawer
- Telemetry: add `emit()` for template.cloned, contract.resend, contract.cancel, contract.detail.viewed, bulk.submitted, compose.opened
- Bug: `use-employment-contracts.ts:97` actor_id uses subject's profile_id — fix to use admin's profile_id

Out (deferred):
- Fix 2 (revise → parent_contract_id) — needs backend API change, separate sub-sortie
- Fix 3 (Regenerer button) — hide-only is trivial; full action is roadmap
- Fix 10 (bucket tabs filter) — touches data hook + query, separate scope

## Tasks

- [ ] Extract `DestructiveConfirmDialog` to `apps/web/src/components/`
- [ ] Extract `MutationButton` + `MutationDropdownMenuItem` to `apps/web/src/components/`
- [ ] Extract `UnsavedChangesGuard` to `apps/web/src/components/`
- [ ] Apply Fix 1 — MalerTab read-only pane (i18n keys + Copy + Open-in-admin)
- [ ] Apply Fix 4 — Cancel confirmation in contracts-data-table dropdown + sheet
- [ ] Apply Fix 5 — CompositionDrawer.handleSubmit passes editedHtml + SendStep badge
- [ ] Apply Fix 6 — contract-preview-editor `editable: false` when preview
- [ ] Apply Fix 7 — Resend/Cancel loading state via MutationDropdownMenuItem
- [ ] Apply Fix 9 — UnsavedChangesGuard wired to 3 drawers
- [ ] Plug 6 missing `emit()` calls on contract mutations
- [ ] Fix actor_id bug in use-employment-contracts.ts:97
- [ ] E2E verify webhook flow: DocuSeal → contract.status=signed → audit_trail
- [ ] Write 4 journeys (see Acceptance Criteria)
- [ ] Typecheck + lint clean
- [ ] HANDOFF written at closure

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated (Fix 1 read-only decision needs ADR if it deprecates "edit in admin" plan)
- [ ] 4 user journeys written:
  - JOURNEY-services-employee-contract-create.md
  - JOURNEY-services-employee-contract-send.md
  - JOURNEY-services-employee-contract-sign.md
  - JOURNEY-services-employee-contract-cancel.md
- [ ] No mutation without `emit()` (verified by grep)
- [ ] No silent data loss (every editable surface either persists or is read-only with Lock badge)
- [ ] Manual test in dev confirms: create → send → DocuSeal completes → webhook updates DB → cancel works with confirmation
