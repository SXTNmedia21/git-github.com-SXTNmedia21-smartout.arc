---
title: Restaurant Week Sim — Bug List (2026-05-25)
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: helpdesk
tags: [bugs, helpdesk, restaurant-week-sim, adr-0173]
---

# Restaurant Week Sim — Bugs Found

Bugs surfaced during the restaurant-week simulation run (2026-05-25).
Cross-references baseline journey sweep (2026-05-23).

---

## PRODUCT bugs

### BUG-SIM-05 — HelpDesk UI bypasses capability, writes directly to deprecated `help_request` table 🔴 CRITICAL — **FIXED**

- **Where:**
  - `apps/web/src/app/dashboard/komm/_components/HelpDesk.tsx`
  - `apps/web/src/app/dashboard/komm/_hooks/use-help-requests.ts:49-60`
- **Baseline cross-ref:** BUG-20 (helpdesk SLA: 0/4 PASS, 2026-05-23 sweep)
- **ADR violated:** ADR-0173 frozen-4 capability boundary. Direct `supabase.from('help_request').insert(...)` from `use-help-requests.ts` bypassed the `helpdesk_query` capability entirely, leaving:
  - No `gate_action` audit row
  - No `helpdesk.query.opened` telemetry emit
  - No `engine_state` ticket (SLA trigger never fired — root cause of BUG-20's 0/4 PASS)
  - Writes to deprecated `help_request` table instead of canonical `engine_state`
- **Schema mapping gap documented:**
  - `title` → `summary` (maps cleanly, 3-200 chars)
  - `description` has no direct counterpart in `openPrivateTicket` — concatenated to summary (truncated to 200 chars) to preserve information, not silently dropped
  - `desk_channel_id` was not collected by the form — now required via `HelpDesk` `deskChannelId` prop; submit disabled when missing (orphan-component guard)
- **Fix:** `feat/helpdesk-rewire-openticket` — commit `<sha>` (see git log)
  - `use-help-requests.ts`: replaced `help_request` direct write with `openPrivateTicket` Server Action call; replaced `help_request` read with `engine_state` query (process_id='helpdesk_query_lifecycle', requester_profile_id filter via JSONB path)
  - `HelpDesk.tsx`: added `deskChannelId?: string` prop; updated `useHelpRequests(profileId)` + `useCreateHelpRequest(profileId, deskChannelId)` signatures; submit disabled when `!deskChannelId`
  - Telemetry + gate_action now owned by `openPrivateTicket` Server Action (no double-emit in `onSuccess`)
  - Read shape preserved: `HelpRequest` type unchanged for display compatibility; `status` mapped from engine_state values via `mapEngineStatus()`
- **Remaining gap:** `HelpDesk` component is currently orphaned (not rendered in any page). A parent page that mounts it must supply `deskChannelId` — this requires a workspace-level helpdesk channel lookup at the mount site. Tracked as follow-up (Phase F0 G5 family — workspace config surface).
