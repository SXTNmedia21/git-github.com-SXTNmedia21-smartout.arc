---
title: "Plan — shift-swap-harness (Sortie 1 of schedule-harness)"
status: in_progress
updated: 2026-04-23
created: 2026-04-23
module: schedule-harness
tags: [plan, shift-swap, authority, telemetry, bff, council-2026-04-23]
---

# Plan — shift-swap-harness

> Branch: `feat/schedule-harness-shift-swap-harness` | Worktree: `/home/sxtnl/dev/smartout.ai-schedule-harness-wt-1` | Base: `campaign/schedule-harness` | Module: schedule-harness | Started: 2026-04-23

## Goal

Fix the 6 conventional breaches found by 2026-04-23 Hospitality Council on shift_swap capability + RPC path. Unblocks `employee-availability-v1` (Sortie 2).

## Council context

2026-04-23 Council (APPROVE WITH CHANGES) — Trust Gate FAILS for shift_swap:
- 🔴 Zero `gate_action` calls in capability tools or RPC path
- 🔴 No `engine_authority_config` rows seeded for shift_swap (only comment)
- 🔴 Phantom telemetry: `shift swap_approved` + `shift swap_executed` in registry, zero emitters
- 🔴 Bug: `target_profile_id` missing from mobile payload (`use-swap.ts:47-51`)
- 🟡 ADR-0132 breach: mobile calls Supabase RPC directly, not via BFF
- 🟡 `absence_type TEXT` (no CHECK/enum)
- 🟡 Capability tools emit NOTHING despite `emitPrefix: "shift_swap"`

ADRs: 0200 (availability three-table), 0201 (gate_action mandatory), 0202 (voice policy split). Learnings: L-0129/0130/0131/0132.

## Tasks (parallel where independent)

### Task A — Authority seed migration
Migration `supabase/migrations/YYYYMMDDHHMMSS_seed_shift_swap_authority.sql`. CROSS JOIN VALUES form. Three capabilities:
- `shift_swap.request` — level `suggest`, min_role `employee`
- `shift_swap.respond` — level `suggest`, min_role `employee`
- `shift_swap.cancel` — level `confirm`, min_role `employee` (own only)
Must satisfy `authority-seed-parity` scanner.

### Task B — gate_action wiring
`packages/ai/src/capabilities/shift-swap/tools.ts` — wrap `requestSwap`, `respondToSwap`, `cancelSwap` with `gate_action` call before RPC. Channel=`chat`. Actor from `ctx.actorProfileId`. On deny → return `ok:false` structured error.

### Task C — Mobile/Web BFF refactor (ADR-0132)
Create `apps/web/src/app/api/shift-swap/{initiate,respond,cancel}/route.ts` BFF routes with dual-auth + server-side `workspace_id + profile_id` derivation (ADR-0151, ADR-0176 Invariant 3).
Refactor:
- `apps/mobile/src/hooks/mutations/use-swap.ts` — replace `supabase.rpc(...)` with `fetch('/api/shift-swap/...')`
- `apps/web/src/app/dashboard/schedule/_hooks/use-shift-swap.ts` — same
Mobile must use `getProfileContext()` only for local state; server re-derives.

### Task D — Payload bug fix + telemetry rename + emit wiring
- Fix `target_profile_id` payload in use-swap.ts and use-shift-swap.ts
- Rename registry entries: `shift swap_requested` → `shift_swap.requested` (6 events) — dot-form per ADR-0164 consensus (Harness + Agent-Coord alignment; L-0129)
- Wire `emit()` from capability tools onSuccess with all 4 destinations (posthog + logger + activity_trail + engine_event)
- Remove space-form entries; add dot-form entries

### Task E — schedule_absence.absence_type enum (0a/0b/0c per L-0075)
- 0a: create `absence_type` Postgres enum with values: `vacation`, `sick`, `personal`, `other` (snapshot of current TEXT values)
- 0b: ALTER COLUMN TYPE to use new enum (with USING clause)
- 0c: add CHECK/NOT NULL constraints as needed
**Does NOT add `unavailable_preference`** — that's Sortie 2 greenfield (Council decision).

### Task F — Supervisor review (post A-E)
Verify all 6 breaches resolved. Typecheck + Nordic grep + authority-seed-parity.

## Acceptance criteria

- [ ] `pnpm turbo typecheck` PASS
- [ ] `pnpm tsx scripts/authority-seed-parity.ts` shows `shift_swap.{request,respond,cancel}` seeded
- [ ] Emit registry grep: zero space-form shift swap entries, 6 dot-form entries
- [ ] Grep `supabase.rpc("initiate_shift_swap")` returns 0 hits in apps/mobile + apps/web
- [ ] Grep `gate_action` in `packages/ai/src/capabilities/shift-swap/tools.ts` returns 3 call sites (one per tool)
- [ ] `schedule_absence.absence_type` is Postgres enum (not TEXT)
- [ ] Supervisor review APPROVE
- [ ] Journey + Handoff written
- [ ] E2E spec for swap flow (single happy-path)

## Out of scope (Sortie 2+)

- `employee_availability` + `employee_availability_preference` tables
- `availability.set_own` / `availability.query_others` capabilities
- Voice policy split (ADR-0202 implementation)
- RosterTab availability overlay
