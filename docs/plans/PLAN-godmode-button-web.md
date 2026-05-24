---
title: "Plan — godmode-button-web"
status: done
updated: 2026-05-25
created: 2026-05-25
module: platform-admin
affected_domains: [platform-admin, security]
tags: [plan, godmode, adr-0410]
---

# Plan — godmode-button-web

> Branch: `feat/godmode-button-web` | Worktree: /home/sxtnl/dev/smartout.ai-wt-6 | Base: `development` | Module: platform-admin | Started: 2026-05-25

## Goal

Bring the ADR-0410 godmode "Gå til workspace" capability to `apps/web` (port 3060). Adds a "Logg inn på workspace" button to the workspace detail page that auto-joins the godmode admin as an `admin` profile (idempotent) and redirects to `{slug}.smartout.ai/dashboard`.

## Why

The godmode RPC + button shipped 2026-05-24 (commit 1a946600c, ADR-0410) on `apps/admin` only and never landed on `development`. Pontus needs the same capability on the platform-admin workspace detail page in `apps/web` to log into any workspace from `/platform-admin/workspaces/<id>` without manual profile setup.

## Tasks

- [x] Cherry-pick 1a946600c from cloud/main → feat/godmode-button-web
- [x] Resolve add/add conflict on `docs/test-runs/2026-05-23-prod-release-d766392a.md` (take incoming)
- [x] Re-stamp migration `20260625130000_fn_godmode_join_workspace.sql` → `20260626000000_fn_godmode_join_workspace.sql` (avoid collision with `20260625130000_channel_is_active_column.sql` already staged on development)
- [x] Update timestamp references in ADR-0410 decision-log entries + go-to-workspace.ts comment + migration header
- [x] Create `apps/web/src/app/platform-admin/workspaces/[id]/_actions/go-to-workspace.ts` (server action, mirrors apps/admin)
- [x] Create `apps/web/src/app/platform-admin/workspaces/[id]/_components/go-to-workspace-button.tsx` (client component, sonner toast on error)
- [x] Mount `<GoToWorkspaceButton>` in workspace-detail-client.tsx header (right-aligned via `ml-auto`)
- [x] `pnpm --filter web typecheck` — green

## Acceptance Criteria

- [x] Typecheck passes: `pnpm --filter web typecheck`
- [x] Decision log updated (ADR-0410 entry edited with re-stamp note)
- [x] User journey written (JOURNEY-godmode-button-web.md)
- [ ] HANDOFF doc written at closure (close-feature.sh writes it)
- [ ] Migration applied to local Supabase after merge: `supabase db reset` or `supabase migration up`
- [ ] Manual smoke: open `/platform-admin/workspaces/<id>`, click "Logg inn på workspace", verify redirect to `{slug}.smartout.ai/dashboard`

## Files Touched

| Path | Change |
|------|--------|
| `apps/web/src/app/platform-admin/workspaces/[id]/_actions/go-to-workspace.ts` | NEW — Server Action calling `fn_godmode_join_workspace` RPC + redirect |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/go-to-workspace-button.tsx` | NEW — Client component, `useTransition` + sonner toast |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/workspace-detail-client.tsx` | EDIT — mount button in header |
| `supabase/migrations/20260626000000_fn_godmode_join_workspace.sql` | NEW (cherry-picked + re-stamped) — RPC body |
| `apps/admin/**` (cherry-picked) | NEW + EDIT — full ADR-0410 surface on apps/admin too |
| `docs/decisions/0410-godmode-workspace-auto-join.md` | NEW (cherry-picked) — ADR-0410 text |
| `docs/decisions/0000-decision-log.md` | EDIT — ADR-0410 entry + re-stamp note |
| `packages/telemetry/src/registry.ts` | EDIT (cherry-picked) — `godmode.admin_access` + `godmode.workspace_joined` events |

## Notes

- Security gate: the workspace detail page is already gated by `getSuperAdminId()` on the server (apps/web/src/app/platform-admin/workspaces/[id]/page.tsx:7). Reaching the client = proof of godmode. RPC also asserts is_godmode server-side as defense-in-depth.
- No password re-prompt v1 — ADR-0410 treats activity_trail audit row as the sufficient security control. If we later add step-up auth, do it in a follow-up sortie.
- Redirect target `https://{slug}.smartout.ai/dashboard` requires DNS for the workspace subdomain. On localhost this will jump to the prod subdomain; for local-only flows we'd need a localhost-aware variant (out of scope).
