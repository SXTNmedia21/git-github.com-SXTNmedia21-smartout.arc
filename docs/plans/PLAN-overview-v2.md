---
title: "Plan — overview-v2 (WebDayControl replaces OversiktView)"
status: done
updated: 2026-04-19
created: 2026-04-19
module: Dashboard
tags: [plan, dashboard, day-control, overview]
---

# Plan — overview-v2

> Branch: `feat/overview-v2` · Worktree: wt-1 · Module: Dashboard · Started: 2026-04-19
> Council: 2026-04-19 — APPROVE WITH CHANGES (unanimous)

## Goal

Replace `apps/web/src/components/dashboard/OversiktView.tsx` (executive-summary mock) with `WebDayControl` — a session-centric 7-tab admin panel driven by `department_session`. Wire to live Supabase data across all tabs.

## References

- **Holistic design spec:** `docs/superpowers/specs/2026-04-19-day-information-components-design.md`
- **Implementation spec:** `docs/superpowers/specs/2026-04-19-web-day-control-implementation-spec.md`
- **Council verdict:** `docs/council/COUNCIL-LOG.md` (2026-04-19 entry)
- **ADR-0156** — Day-Control Panel as Canonical D6 Admin Surface
- **ADR-0157** — Server Actions Scope Amendment (new mutations only)
- **L-0064** — Phase Enum UI-vs-DB Drift
- **Design bundle source:** `/tmp/smartout-design/smartout/project/day/*.jsx`

## PR sequence

### PR 1 — Design tokens prereq (~2h)
- [ ] Add `--dept-kitchen/service/bar/event` to `packages/design-tokens/src/tokens.ts`, `tokens.css`, `native.ts` (light + dark)
- [ ] Verify `--success`, `--warning`, `--info` dark variants exist; add if missing
- [ ] `pnpm turbo typecheck` passes
- [ ] Commit: `feat(design-tokens): department color scale + status dark variants`

### PR 2 — Scaffold + Overview tab live (~1 day)
- [ ] Create `apps/web/src/components/day/` structure (widgets/, tabs/, WebDayControl.tsx)
- [ ] Port 10 widgets (SessionHeader, PhaseBadge, PhaseTimeline, ShiftCard, TaskRow, HookTile, KpiTile, DeviationCard, BroadcastComposer, SignoffPanel, ReconSummary) — Nordic Split CSS variables only, no hex
- [ ] Portability discipline: no `next/*` imports, no direct Supabase in widget files
- [ ] Write `packages/utils/src/cascade/derive-phase.ts` with `derivePhase(session, recon)`
- [ ] Write `apps/web/src/app/dashboard/_lib/pin-day-control-context.ts`
- [ ] Wire Overview tab to live data (reuse `useDepartmentSessions` + dept-filter wrapper, `useLeaderPulse`, `useLiveShifts`, `useDeviations`, `useChannels`+`useChannelMessages`)
- [ ] Feature flag `NEXT_PUBLIC_DAY_CONTROL_V2` guards route in `apps/web/src/app/dashboard/page.tsx`
- [ ] Empty state: "Ingen sesjon registrert for i dag — venter på åpningsrutine"
- [ ] KPI tiles labeled by source (`live` / `snapshot` / `post-reconciliation`)
- [ ] Six other tabs render stubs with `TODO(live-data): PR 3`
- [ ] Commit: `feat(dashboard): scaffold WebDayControl + overview tab live`

### PR 3 — 6 remaining tabs + Server Actions + authority (~2.5 days)
- [ ] Build `apps/web/src/app/dashboard/_hooks/use-session-hooks-with-tasks.ts`
- [ ] Build `apps/web/src/app/dashboard/_hooks/use-roster.ts` (selector composing useDepartmentShifts + useLiveShifts for actual-hours column)
- [ ] Server Actions in `apps/web/src/app/dashboard/_actions/`:
  - [ ] `signoff-session-action.ts` (fixes registry emit gap for step-1 pending_signoff)
  - [ ] `toggle-session-task-action.ts` (uses emit() registry, not direct engine_event insert)
  - [ ] `send-broadcast-action.ts` (PII guardrail + writes `channel_message.metadata.broadcast_type`)
- [ ] Migration: `supabase/migrations/YYYYMMDDHHMMSS_seed_day_control_authority.sql` — seeds `session.signoff` + `broadcast.send` in `engine_authority_config`
- [ ] Registry emit: verify/amend `packages/telemetry/src/registry.ts` (broadcast engine_event routing decision)
- [ ] Wire tabs: Dagslinjen, Bemanning, Oppgaver, Avvik, Melding, Oppgjør
- [ ] engine_memory pin on panel mount (24h TTL, source="web.day-control")
- [ ] Commit: `feat(dashboard): wire remaining 6 tabs via Server Actions`

### PR 4 — Polish + delete OversiktView (~1 day)
- [ ] Motion spec (10 items per Designer review) with `useReducedMotion()` fallback
- [ ] Dark mode pass: SignoffPanel gradient via `color-mix(in oklch, ...)`, PhaseBadge tints uniform, orb hue-shift
- [ ] A11y fix list (11 items): ARIA tabs, focus rings, sr-only live-pulse, table semantics, accordion roles
- [ ] Reduce to one orb (from OversiktView's two), phase-reactive hue
- [ ] Remove `NEXT_PUBLIC_DAY_CONTROL_V2` flag
- [ ] Delete `apps/web/src/components/dashboard/OversiktView.tsx`
- [ ] Simplify `apps/web/src/app/dashboard/page.tsx` variant routing
- [ ] Mark ADR-0156, ADR-0157, L-0064 as accepted
- [ ] Write `docs/HANDOFF-overview-v2.md`
- [ ] Commit: `feat(dashboard): polish + retire OversiktView`

## Acceptance Criteria (enforced by close-feature.sh)

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] Decision log updated (ADR-0156, ADR-0157 registered)
- [ ] Learning log updated (L-0064 registered)
- [ ] Council log entry committed
- [ ] User journeys written: `docs/journeys/JOURNEY-overview-v2.md`
- [ ] HANDOFF document: `docs/HANDOFF-overview-v2.md`
- [ ] Feature flag removed, OversiktView deleted
- [ ] All 15 council Trust Gate conditions satisfied

## Trust Gate conditions (ADR-0156 §Acceptance)

1. Server Actions for signoff/broadcast/task-toggle
2. `engine_authority_config` rows for `session.signoff` + `broadcast.send`
3. `session pending_signoff` telemetry event fires on step 1
4. Task toggle UI uses `emit()` registry-path
5. PII guardrail blocks broadcast with personnummer regex
6. Dept filter enforced on `useDepartmentSessions`
7. `locked` phase derived, never stored
8. Widget portability discipline enforced (no `next/*` imports in widgets)
9. Dark mode verified on all 10 widgets
10. Revenue KPI labeled post-reconciliation, never fabricated
11. Broadcast type in `channel_message.metadata.broadcast_type` JSONB
12. engine_memory pin on panel mount
13. `useReducedMotion()` respected
14. ARIA tabs + accordions + table semantics
15. Feature flag removed before close-feature
