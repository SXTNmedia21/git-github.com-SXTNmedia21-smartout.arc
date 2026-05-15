---
title: "Schedule View Density — 4-Tier Preference with Dedicated Persistence Table"
id: ADR_0331
status: accepted
layer: decision
created: 2026-05-15
updated: 2026-05-15
supersedes: []
superseded_by: []
related: [ADR_0032, ADR_0047, ADR_0078, ADR_0094, ADR_0115, ADR_0133, ADR_0151, ADR_0287, ADR_0297, ADR_0316]
tags: [schedule, ui, density, persistence, voice]
deciders: [pontus, claude]
---

# ADR-0331: Schedule View Density — 4-Tier Preference with Dedicated Persistence Table

**Status:** Accepted
**Date:** 2026-05-15

## Context and Problem Statement

The schedule planner shipped with a binary `scheduleCompactMode: boolean` flag — no persistence, no role-color, no conflict-signal distinction between normal and compact, no way to view a full week without scrolling. User-reported pain: two-shift days blew up cards to full height with empty whitespace; compact mode truncated role names unreadably; no state survived page reload.

This ADR captures the six sub-decisions made during `feat/schedule-card-density` (2026-05-15) that replace the binary mode with a 4-tier density preference persisted per user per workspace.

## Decision Drivers

- Per-user, cross-device view preference without page-reload flash
- Conflict signal must survive all density tiers (ADR-0151-class: UI compression ≠ data suppression)
- Voice + UI must converge at a single setter (L-0233: one source of truth)
- No new design-token sprawl — reuse existing `SHIFT_INDICATOR_STYLES`
- Telemetry pre-registration before call sites (ADR-0094 sequence invariant)
- Generic persistence foundation for future surfaces (governance, year-wheel, contracts)

## Six Sub-Decisions

### D1 — Four Density Tiers

`schedule_density` type: `"cozy" | "default" | "compact" | "pulse"`.

| Tier | Row height | Visible content |
|------|-----------|----------------|
| Cozy | 120px | Role, zone, time, hours, task count, status icon |
| Default | 100px | Role, zone, time, status icon (current state pre-feature) |
| Compact | 52px | Role + time + status dot |
| Pulse | 28px heatmap / 40px conflict-escape mini-card | Solid color cell OR 4px rail + role initials + time |

Selector UI: 4-button segmented group (Maximize2 / Rows3 / Rows4 / Activity icons from Lucide). NOT a dropdown — segmented matches existing `weekSpan` toggle pattern and keeps all options visible.

### D2 — Dedicated `user_view_preference` Table (NOT profile.preferences JSONB)

Schema `(profile_id, workspace_id, surface, preference_key, preference_value)` with UNIQUE constraint on the 4-tuple. `surface = 'schedule'`, `preference_key = 'density'`. Text column + CHECK constraint (avoids `database.types.ts` regen blocker from new enums on Local). Promotion to Postgres enum deferred if a second consumer appears.

Rejected alternatives:
- `profile.preferences JSONB` — one blob per user mixes all surfaces, difficult to query/RLS per surface
- `localStorage` — no cross-device parity; voice path cannot write to browser storage

RLS: JWT path (browser) owns-own-rows policy; API-key path intentionally omitted (server actions use service-role + manual profile/workspace guard per ADR-0151). Migration: `ea880f2ee`.

### D3 — Status-Strip Displaces Full Border; Conflict-Strip Survives All Tiers

`<DensityStrip />` — one component, 4px left rail in every tier including Pulse. Rail color: `SHIFT_INDICATOR_STYLES[indicator]` (role-color) when no conflict; `bg-destructive` when `hasConflict`. Existing conflict ring (`ring-destructive/60`) stays on the card — defence-in-depth so overlap cannot hide a conflict. Pulse conflict-escape: `MiniCardWithStrip` path (40px) renders when any shift in the cell has `hasConflict`, bypassing heatmap. Compliance constraint C2 satisfied: conflict signal is never suppressed by visual compression.

### D4 — Role-Color via `SHIFT_INDICATOR_STYLES` Re-Purpose

`SHIFT_INDICATOR_STYLES` (keyed by `schedule_shift.indicator`) is re-used as the role-color carrier in all tiers. A new role→color map in design-tokens was rejected (token-sprawl, V1 YAGNI per Pontus 2026-05-15). The semantic merge — indicator becomes role-identity carrier — is accepted; a future refactor may split if indicator semantics diverge.

### D5 — Voice Tool Uses Discriminated `schedule_view_change` Event (NOT a New Event Type)

`set_schedule_density` voice tool publishes `{ type: "schedule_view_change", payload: { action: "set_density", density } }` over the LiveKit data channel, extending the existing `ScheduleViewChangePayload` discriminated union (L-0234 pattern). Bridge handler `case "set_density":` calls `setScheduleDensity(payload.density)` — the identical setter the UI button calls. Voice tool itself does NOT call `gateAction` (view-state is not a domain mutation). Persistence ride-along happens via the shared setter → Server Action fire-and-forget. Acceptable V1 trade-off: failed persistence logs a Sentry breadcrumb but does not surface to the user.

### D6 — Compact Time Format `formatTimeShort` with En-Dash

`formatTimeShort(start, end)` strips `:00` from round hours and joins with en-dash (U+2013): `"10:00"–"22:00"` → `"10–22"`, `"10:30"–"22:15"` → `"10:30–22:15"`. En-dash is locale-neutral (nb/en/sv). Tooltip preserves full `HH:mm–HH:mm` for accessibility. Used by Compact + Pulse mini-card tiers; Default + Cozy keep current full format.

## Implementation References

| Artifact | Commit |
|----------|--------|
| Migration `20260515120050_user_view_preference.sql` | `ea880f2ee` |
| Sandbox prototype + DensityStrip/DensitySelector/formatTimeShort | `fc1c7b6fc` |
| Telemetry `schedule.density_changed` registration | `55bbe8566` |
| Server Actions (set + get density) | `938c0d867` |
| Live planner integration + voice + persistence wire-up | `4e74d489b` |
| Back-compat shim removal | `229b8d29a` |
| A11y: `aria-pressed` on density buttons | `90565fe48` |
| E2E specs (4 journeys) | `c5d5f21e4` |

Verification: Plan §10 test matrix (`apps/e2e/schedule/density.spec.ts`).

## Consequences

**Positive:**
- Per-user cross-device density preference; Pulse enables one-screen weekly overview
- Generic `user_view_preference` table is the foundation for future view-state per surface (governance, year-wheel, contracts) — one table, not N sibling tables
- Conflict signal preserved across all tiers via 4px rail — defence-in-depth alongside ring
- Voice + UI share a single setter; no channel drift (L-0233)

**Negative / Trade-offs:**
- New table + migration + RLS surface to maintain; future surfaces MUST reuse this schema rather than create siblings
- `SHIFT_INDICATOR_STYLES` semantic now carries both "shift status indicator" AND "role color in compact"; future refactor needed if indicator semantics diverge (YAGNI accepted 2026-05-15)
- Pulse heatmap re-render gating relies on `React.memo` + indicator-equality; naive implementation could perf-regress 1000-cell grids — mitigation: `React.memo(PulseCell, indicatorKey+hasConflict equality)` per plan §11 R2
- Voice persistence is fire-and-forget; failed upsert surfaces only as Sentry breadcrumb, not user-visible error (acceptable V1)

---

> Registered in `docs/decisions/0000-decision-log.md`. E2E coverage in `apps/e2e/schedule/density.spec.ts`. Journey doc: `docs/journeys/JOURNEY-schedule-card-density.md`.
