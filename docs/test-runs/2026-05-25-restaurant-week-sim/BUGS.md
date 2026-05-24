---
title: Restaurant Week Sim 2026-05-25 — Bug Tracker
status: in_progress
created: 2026-05-25
updated: 2026-05-25
module: communication
tags: [sim, audience-resolver, cross-tenant, workspace-scope]
---

# Restaurant Week Sim — Bug Tracker

## BUG-SIM-11

| Field | Value |
|-------|-------|
| ID | BUG-SIM-11 |
| Severity | P0 (cross-tenant audience leak risk) |
| Status | FIXED |
| Component | `packages/ai/src/capabilities/communication/audience-resolver.ts` + `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts` |
| Introduced | Wave A, commit `3854f3513` |
| Fixed in | See commit below |

### Description

`on_duty` branch in both `audience-resolver.ts` (server-side capability) and
`use-audience-resolver.ts` (client-side hook) queried `timesheet.time_entry`
without a `workspace_id` filter. Every other branch (`all`, `department`, `role`)
scoped the query to the requesting workspace.

A workspace A announcement targeted at `on_duty` audience would include
currently-clocked-in employees from ALL workspaces sharing the Supabase tenant —
cross-tenant audience leak.

### Root Cause

Asymmetric filter application. The `on_duty` query pattern was ported from
`use-broadcast-recipients.ts` but the workspace scoping was omitted in both the
server-side port (Sortie D reference: `audience-resolver.ts:63-68`) and the
client-side hook (`use-audience-resolver.ts:51-56`).

### Fix

Added `.eq("workspace_id", workspaceId)` / `.eq("workspace_id", wsId)` to the
`on_duty` branch in both files, between `.select("profile_id")` and
`.is("punch_out", null)`.

Aligns with ADR-0151 (server-derived workspace_id) and L-0177 (no silent
cross-tenant fallback).

**Fixed in commit:** <!-- SHA inserted after commit -->

### Verification

- `pnpm --filter @smartout/ai typecheck` passes
- Mental scenario: workspace A `on_duty` query now returns only workspace A
  time-entries with open punch_out. Workspace B employees excluded.
- No `audience-resolver.test.ts` exists — noted for follow-up (separate test
  sortie needed per BUG-SIM-11 follow-up).
