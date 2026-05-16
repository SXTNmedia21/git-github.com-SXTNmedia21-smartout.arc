---
title: "Plan — workspace-status-context"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [plan, ui-shell, debt, context, harness]
---

# Plan — workspace-status-context

> Branch: `feat/ui-shell-workspace-status-context` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-16

## Goal

Extend `WorkspaceData` type + `resolve-page-context.ts` to expose `workspace.is_active` (boolean from DB schema). Unblocks 1 documented debt item: PosAccountsList workspaceIsActive hardcode (commit `ccb794dca` TODO).

## Recon (DONE)

- DB schema `public.workspace` exposes `is_active: boolean` (verified in `packages/supabase/src/database.types.ts`)
- `WorkspaceData` type in `apps/web/src/lib/workspace-context.tsx:5` lacks `is_active`
- `resolve-page-context.ts` doesn't select it
- Consumer: PosAccountsList.tsx:255 hardcodes `workspaceIsActive={true}` with TODO referencing exact blocker

## Scope

In scope:
- Add `is_active: boolean` to `WorkspaceData` type
- Update workspace `.select()` in `resolve-page-context.ts` (+ any other place that builds WorkspaceData)
- Update page.tsx of `/dashboard/admin/pos-accounts` to pass `workspace.is_active` down to PosAccountsList
- Remove TODO comment in PosAccountsList.tsx:258-260

Out of scope:
- Other consumers of WorkspaceData (audit grep first; if any need `is_active`, document but don't change in this sortie unless trivial)
- Adding additional workspace fields (`deactivated_at`, `grace_period_ends`, `override_*`) — defer to future sortie
- SectionEditor `isVisible` (already solved differently in debt-closeout via `usePages`)

## Tasks

- [ ] Read `apps/web/src/lib/workspace-context.tsx` — add `is_active: boolean` to `WorkspaceData` type
- [ ] Read `apps/web/src/app/dashboard/_data/resolve-page-context.ts` — extend `.select()` to include `is_active`
- [ ] Grep for other WorkspaceData builders (`apps/web/src/**/*.ts*`) — confirm all paths populate `is_active` or document gap
- [ ] Read `apps/web/src/app/dashboard/admin/pos-accounts/page.tsx` — pass `workspace.is_active` as prop to PosAccountsList
- [ ] Update `PosAccountsList.tsx` props signature: add `workspaceIsActive: boolean` prop
- [ ] Replace hardcoded `workspaceIsActive={true}` (line 255+ ish) with `workspaceIsActive={workspace.is_active}` or prop variable
- [ ] Remove TODO comment (lines 258-260)
- [ ] Verify typecheck + site-map validator + grep "TODO" in pos-accounts tree returns 0 hits

## Acceptance Criteria

- [ ] `WorkspaceData` includes `is_active: boolean`
- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] 0 `TODO` comments referring to workspaceIsActive in pos-accounts tree
- [ ] 1 journey + HANDOFF written
- [ ] Decision log unchanged (no new ADR needed)

## Risks

- Other WorkspaceData consumers may fail typecheck if a path builds the object without `is_active`. Grep + fix or use Partial<>/optional if many sites.
- RLS may require service-role to read `is_active`. Unlikely — boolean is typically readable by member, but verify.
- `is_active` semantics: confirm it means "billing active" vs "soft-deleted" vs "grace period". DB doc may differ from intent. Default behavior preserved (fallback to `true` if undefined).

## Next

Single agent dispatch — touch 3 files (workspace-context.tsx, resolve-page-context.ts, page.tsx + PosAccountsList.tsx). Solo + sequential per L-2026-05-04 (small change, no parallel needed).
