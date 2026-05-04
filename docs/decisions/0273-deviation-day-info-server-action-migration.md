---
id: ADR-0273
title: "Deviation + Day-Info: Server Action Migration (ADR-0114 closure)"
status: proposed
created: 2026-05-25
updated: 2026-05-25
module: hms, schedule, mobile
tags: [adr-0114, server-action, deviation, day-info, mobile-bff, gate-action, telemetry]
---

# ADR-0273 — Deviation + Day-Info: Server Action Migration

## Status

proposed

## Context

Two client-side `useMutation` hooks were discovered as ADR-0114 violations during the AddSheet BFF-wrap audit (2026-05-04):

1. `useCreateDeviation` (`apps/web/src/app/dashboard/hms/_hooks/use-create-deviation.ts`) — direct `supabase.from("deviation").insert()` from the browser with `void emit()` (fire-and-forget, unreliable).
2. `useCreateDayInfo` (`apps/web/src/app/dashboard/schedule/_hooks/use-day-info.ts:113-155`) — direct `supabase.from("schedule_day_info").insert()` from the browser with `void emit()`.

Both paths:
- Bypassed `gate_action()` entirely (no authority gate — ADR-0099 violation).
- Emitted telemetry client-side with `void` (ADR-0134 violation — emit not awaited; failures silently dropped).
- Mobile `actionMap` for both actions (`report_deviation`, `create_day_info`) went direct to Supabase without any BFF layer (ADR-0132 violation).
- `workspace_id` and `profile_id` were accepted from client context, not re-derived server-side (ADR-0151 violation).

## Decision

Migrate both mutation paths from client-side `useMutation` to Next.js Server Actions, with mobile BFF routes delegating to the same actions.

### Pattern (mirrors `addShiftAction` established by mobile-shift-system-polish)

**Server Action (web + mobile-BFF delegation target):**
- Validates input with Zod.
- Accepts optional `ResolvedActor` param: BFF injects it (Bearer path); web callers omit it → falls through to `resolveCurrentProfile()` (cookie SSR).
- Calls `gate_action()` (ADR-0099) before any write.
- Uses `createAdminClient()` for the insert (gated above; bypassing RLS is safe after gate passes).
- `await emit()` (ADR-0134) — server-side, all four destinations reliable.
- Returns `{ ok: true, id }` | `{ ok: false, error }`.

**Client hook (web):**
- Remains a `useMutation` wrapper so call-sites need zero changes.
- `mutationFn` calls the Server Action instead of Supabase directly.
- No `emit()` in `onSuccess` — telemetry is server-side.

**BFF route (mobile):**
- `POST /api/mobile/deviations` — Bearer-only auth, delegates to `reportDeviationAction`.
- `POST /api/mobile/day-info` — Bearer-only auth, delegates to `createDayInfoAction`.
- `workspace_id` + `profile_id` re-derived from Bearer JWT server-side (ADR-0151).
- `channel` pinned to `"system"` at the BFF layer.

**Mobile action-map:**
- `report_deviation`: BFF fetch instead of `supabase.from("deviation").insert()`.
- `create_day_info`: BFF fetch instead of `supabase.from("schedule_day_info").insert()`.

**Authority seeds:**
- `20260525100000_seed_deviation_authority.sql`: `hms.report_deviation_manual`, `level=confirm`, `min_role=employee`.
- `20260525100100_seed_day_info_authority.sql`: `schedule.add_day_info_manual`, `level=confirm`, `min_role=manager`.

## Alternatives Considered

**Keep direct client-side inserts, add gate call to client hook** — rejected. Client-side gate calls are forgeable (network interception), `profile_id` from `DashboardContext` is not re-derived per ADR-0151, and telemetry remains fire-and-forget. Partial compliance is not compliance.

**Single BFF route instead of Server Action** — rejected per ADR-0114: Server Actions are the canonical mutation primitive for web-initiated mutations. BFF route is additive (for mobile), not a replacement.

## Consequences

**Positive:**
- Both paths now satisfy ADR-0099 (gate_action), ADR-0114 (Server Action), ADR-0134 (awaited emit), ADR-0151 (server-derived identity).
- Mobile write path is now BFF-mediated per ADR-0132.
- Authority config rows prevent silent default-allow (L-0107 closure for both capabilities).

**Negative / Trade-offs:**
- `useCreateDayInfo` loses the `created_by` field population (was `info.createdBy`; `schedule_day_info.created_by` references `user_identity.user_id`, not `profile_id` — actor audit is covered by `activity_trail` via `emit()` instead).
- An extra network hop for mobile (BFF → Server Action) vs direct Supabase. Acceptable per ADR-0132 boundary.

## Cross-references

- ADR-0114: Server Actions as canonical mutation primitive
- ADR-0099: Unified authority gate
- ADR-0134: Mobile telemetry contract
- ADR-0151: Server-side identity derivation
- ADR-0132: Mobile AI routing (BFF boundary)
- ADR-0270: ADR-0114 original justification
- L-0107: Authority appearance ≠ authority presence (seed parity)
